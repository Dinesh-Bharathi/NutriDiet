// src/lib/redis.js
// ─────────────────────────────────────────────────────────────────────────────
// Redis client singleton using ioredis.
// Used for: refresh token rotation, session caching, rate-limit state, etc.
// ─────────────────────────────────────────────────────────────────────────────
import Redis from 'ioredis';
import env from '../config/env.js';
import logger from '../utils/logger.js';

let redisClient = null;
const redisEnabled = !!env.REDIS_URL;

if (!redisEnabled) {
  logger.info('Redis disabled - REDIS_URL not configured');
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
    redisClient = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('Redis reconnection failed after 3 attempts. Giving up.');
          return null; // Stop retrying
        }
        return Math.min(times * 500, 2000);
      },
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('error', (err) => {
      // Don't spam logs with connection refused if we are handling it gracefully
      if (err.code !== 'ECONNREFUSED') {
        logger.error('Redis client error', { error: err.message });
      }
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting...');
    });
    
    // Trigger initial connection
    redisClient.connect().catch((err) => {
      logger.warn('Redis initial connection failed', { error: err.message });
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
  return !!redisClient && redisClient.status === 'ready';
}

/**
 * Gracefully disconnect Redis. Called from server.js on shutdown.
 */
export async function disconnectRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (err) {
      logger.warn('Error disconnecting Redis', { error: err.message });
    }
  }
}

export default getRedisClient;
