import { Queue } from "bullmq";
import { getRedisConnectionConfig } from "../../../lib/redis.js";
import logger from "../../../utils/logger.js";

const connectionConfig = getRedisConnectionConfig();

export const webhookQueue = new Queue("whatsapp-webhook-queue", {
  connection: {
    ...connectionConfig,
    maxRetriesPerRequest: null, // Critical: must be null for BullMQ connection
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: 100, // Keep last 100 failures for debugging
  },
});

// Diagnostic Listener for Redis connection errors
webhookQueue.on("error", (err) => {
  logger.error("[BullMQ Webhook Queue] Redis Connection Error", {
    error: err.message,
    stack: err.stack,
  });
});
