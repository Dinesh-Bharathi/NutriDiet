import { Worker } from "bullmq";
import prisma from "../../../lib/prisma.js";
import { whatsappWebhookService } from "../whatsapp-webhook.service.js";
import { getRedisConnectionConfig, getRedisClient } from "../../../lib/redis.js";
import { logWhatsApp } from "../whatsapp-logger.js";

const connectionConfig = getRedisConnectionConfig();

export const webhookWorker = new Worker(
  "whatsapp-webhook-queue",
  async (job) => {
    const startTime = Date.now();
    logWhatsApp('[WHATSAPP_QUEUE]', { messageId: job.id }, `Job started: Queue=whatsapp-webhook-queue, jobId=${job.id}`);

    const redis = getRedisClient();
    if (redis && job.attemptsMade > 0) {
      await redis.incr("whatsapp:metrics:queue:retries");
    }

    try {
      const result = await whatsappWebhookService.processPayload(job.data);
      const duration = Date.now() - startTime;
      const tenantId = result?.tenantId || 'N/A';

      logWhatsApp('[WHATSAPP_QUEUE]', { messageId: job.id, tenantId }, `Job completed: Queue=whatsapp-webhook-queue, jobId=${job.id}, duration=${duration}ms, retryCount=${job.attemptsMade}`);
      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      let tenantId = 'N/A';

      try {
        const entry = job.data?.entry?.[0];
        const wabaId = entry?.id;
        const phoneId = entry?.changes?.[0]?.value?.metadata?.phone_number_id;
        if (wabaId && phoneId) {
          const conn = await prisma.whatsAppConnection.findFirst({
            where: { wabaId, phoneNumberId: phoneId }
          });
          if (conn) tenantId = conn.tenantId;
        }
      } catch (inner) {
        // Suppress
      }

      logWhatsApp('[WHATSAPP_QUEUE]', { messageId: job.id, tenantId }, `Job failed: Queue=whatsapp-webhook-queue, jobId=${job.id}, retryCount=${job.attemptsMade}, duration=${duration}ms, error=${err.message}`, 'error');
      throw err;
    }
  },
  {
    connection: {
      ...connectionConfig,
      maxRetriesPerRequest: null,
    },
    concurrency: 5,
  }
);

// Diagnostic Listener for Redis connection errors
webhookWorker.on("error", (err) => {
  logWhatsApp('[WHATSAPP_QUEUE]', {}, `Redis Connection Error in Webhook Worker: ${err.message}`, 'error');
});

webhookWorker.on("completed", async (_job) => {
  const redis = getRedisClient();
  if (redis) {
    await redis.incr("whatsapp:metrics:queue:processed");
  }
});

webhookWorker.on("failed", async (_job, _err) => {
  const redis = getRedisClient();
  if (redis) {
    await redis.incr("whatsapp:metrics:queue:failed");
  }
});
