// src/lib/redis.js
// ─────────────────────────────────────────────────────────────────────────────
// Redis client singleton using ioredis.
// Used for: refresh token rotation, session caching, rate-limit state, etc.
// ─────────────────────────────────────────────────────────────────────────────
import Redis from 'ioredis';
import env from '../config/env.js';
import logger from '../utils/logger.js';

let redisClient;

/**
 * Returns the Redis client singleton, creating it on first call.
 * Using a factory function instead of a direct instantiation allows tests
 * to replace the client before the first call.
 *
 * @returns {Redis}
 */
export function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting...');
    });
  }

  return redisClient;
}

/**
 * Gracefully disconnect Redis. Called from server.js on shutdown.
 */
export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
}

export default getRedisClient;
