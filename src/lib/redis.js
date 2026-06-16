// src/lib/redis.js
// ─────────────────────────────────────────────────────────────────────────────
// Redis client singleton using ioredis.
// Used for: refresh token rotation, session caching, rate-limit state, etc.
// ─────────────────────────────────────────────────────────────────────────────
import Redis from "ioredis";
import env from "../config/env.js";
import logger from "../utils/logger.js";

let redisClient = null;
const redisEnabled = !!env.REDIS_URL;

if (!redisEnabled) {
  logger.info("Redis disabled - REDIS_URL and REDIS_HOST not configured");
}

/**
 * Returns the Redis client singleton, creating it on first call.
 * Using a factory function instead of a direct instantiation allows tests
 * to replace the client before the first call.
 *
 * @returns {Redis | null}
 */
export function getRedisClient() {
  if (!redisEnabled) {
    return null;
  }

  if (!redisClient) {
    const redisOptions = {
      lazyConnect: true,
      connectTimeout: 5000, // 5s connection timeout
      maxRetriesPerRequest: null, // ioredis reconnect logic works best with null
      enableOfflineQueue: false, // Fail fast on connection loss to avoid pool starvation
      retryStrategy(times) {
        // Exponential backoff, capping at 4s
        const delay = Math.min(times * 150, 4000);
        logger.warn(
          `Redis connection retry attempt ${times}. Reconnecting in ${delay}ms...`,
        );
        return delay;
      },
    };

    if (env.REDIS_PASSWORD) {
      redisOptions.password = env.REDIS_PASSWORD;
    }

    if (env.REDIS_DB !== undefined) {
      redisOptions.db = env.REDIS_DB;
    }

    if (env.REDIS_URL) {
      redisClient = new Redis(env.REDIS_URL, redisOptions);
    } else {
      redisClient = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        ...redisOptions,
      });
    }

    redisClient.on("connect", () => {
      logger.info("Redis client connected");
    });

    redisClient.on("ready", () => {
      logger.info("Redis client ready");
    });

    redisClient.on("error", (err) => {
      // Don't spam logs with connection refused if we are handling it gracefully
      if (err.code !== "ECONNREFUSED") {
        logger.error("Redis client error", { error: err.message });
      }
    });

    redisClient.on("close", () => {
      logger.warn("Redis connection closed");
    });

    redisClient.on("reconnecting", () => {
      logger.warn("Redis client reconnecting...");
    });

    // Trigger initial connection
    redisClient.connect().catch((err) => {
      logger.warn("Redis initial connection failed", { error: err.message });
    });
  }

  return redisClient;
}

/**
 * Helper to check if Redis is currently available to process commands.
 *
 * @returns {boolean}
 */
export function isRedisAvailable() {
  return !!redisClient && redisClient.status === "ready";
}

/**
 * Gracefully disconnect Redis. Called from server.js on shutdown.
 */
export async function disconnectRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info("Redis connection closed");
    } catch (err) {
      logger.warn("Error disconnecting Redis", { error: err.message });
    }
  }
}

/**
 * Resolves when the Redis client is connected and ready, or when the timeout is reached.
 * Ensures the application startup waits for Redis but doesn't block permanently if offline.
 *
 * @returns {Promise<Redis | null>}
 */
export async function connectRedis() {
  if (!redisEnabled) {
    logger.info("Redis is disabled. Skipping connection wait.");
    return null;
  }

  const client = getRedisClient();
  if (!client) {
    return null;
  }

  if (client.status === "ready") {
    return client;
  }

  return new Promise((resolve) => {
    let resolved = false;

    const onReady = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        logger.info("Redis connection successfully verified at startup");
        resolve(client);
      }
    };

    const onError = (err) => {
      logger.warn("Redis connection issue during startup", {
        error: err.message,
      });
    };

    // Setup a 5-second timeout for startup synchronization
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        logger.warn(
          "Redis startup connection wait timed out. Continuing application boot offline.",
        );
        resolve(client);
      }
    }, 5000);

    const cleanup = () => {
      clearTimeout(timeout);
      client.off("ready", onReady);
      client.off("error", onError);
    };

    client.on("ready", onReady);
    client.on("error", onError);

    // If client is in wait state, call connect
    if (client.status === "wait") {
      client.connect().catch(() => {});
    }
  });
}

/**
 * Safely executes a Redis operation, returning a default value if Redis is unavailable or errors.
 *
 * @template T
 * @param {function(Redis): Promise<T>} operation
 * @param {T} defaultValue
 * @returns {Promise<T>}
 */
async function safeRedisOp(operation, defaultValue) {
  if (!isRedisAvailable()) {
    return defaultValue;
  }
  try {
    const client = getRedisClient();
    return await operation(client);
  } catch (err) {
    logger.error("Redis operation error", { error: err.message });
    return defaultValue;
  }
}

/**
 * Gets a parsed JSON value from Redis by key.
 * If the value is not JSON, returns the raw string.
 *
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function get(key) {
  return safeRedisOp(async (redis) => {
    const val = await redis.get(key);
    if (val === null) return null;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }, null);
}

/**
 * Sets a key to a value in Redis, serializing objects to JSON.
 * Optional TTL in seconds can be supplied.
 *
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlSeconds]
 * @returns {Promise<boolean>}
 */
export async function set(key, value, ttlSeconds = null) {
  return safeRedisOp(async (redis) => {
    const strValue = typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await redis.set(key, strValue, "EX", ttlSeconds);
    } else {
      await redis.set(key, strValue);
    }
    return true;
  }, false);
}

/**
 * Deletes a key (or array of keys) from Redis.
 *
 * @param {string | string[]} key
 * @returns {Promise<boolean>}
 */
export async function del(key) {
  return safeRedisOp(async (redis) => {
    const keys = Array.isArray(key) ? key : [key];
    const count = await redis.del(...keys);
    return count > 0;
  }, false);
}

/**
 * Checks if a key exists in Redis.
 *
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function exists(key) {
  return safeRedisOp(async (redis) => {
    const count = await redis.exists(key);
    return count > 0;
  }, false);
}

/**
 * Sets a TTL expiry (in seconds) on an existing key.
 *
 * @param {string} key
 * @param {number} ttlSeconds
 * @returns {Promise<boolean>}
 */
export async function expire(key, ttlSeconds) {
  return safeRedisOp(async (redis) => {
    const success = await redis.expire(key, ttlSeconds);
    return success === 1;
  }, false);
}

/**
 * Gets and deserializes multiple keys at once.
 *
 * @param {string[]} keys
 * @returns {Promise<any[]>}
 */
export async function mget(keys) {
  if (!keys || keys.length === 0) return [];
  return safeRedisOp(
    async (redis) => {
      const values = await redis.mget(keys);
      return values.map((val) => {
        if (val === null) return null;
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      });
    },
    keys.map(() => null),
  );
}

/**
 * Sets multiple key-value pairs at once, serializing non-strings.
 * Acceptable argument format: { key1: value1, key2: value2 }
 *
 * @param {Record<string, any>} keyValuePairs
 * @returns {Promise<boolean>}
 */
export async function mset(keyValuePairs) {
  return safeRedisOp(async (redis) => {
    const flatPairs = [];
    for (const [key, val] of Object.entries(keyValuePairs)) {
      flatPairs.push(key);
      flatPairs.push(typeof val === "string" ? val : JSON.stringify(val));
    }
    if (flatPairs.length > 0) {
      await redis.mset(flatPairs);
    }
    return true;
  }, false);
}

export default getRedisClient;
