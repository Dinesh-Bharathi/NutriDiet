// src/modules/automation/reminder-worker.js

import { Worker } from 'bullmq';
import { getRedisConnectionConfig } from '../../lib/redis.js';
import { reminderProcessor } from './reminder-processor.js';
import { reminderDeadLetterQueue } from './reminder-queue.js';
import logger from '../../utils/logger.js';

const connectionConfig = getRedisConnectionConfig();

export function createReminderWorker() {
  const worker = new Worker(
    'reminder-jobs-queue',
    async (job) => {
      // Process using the processor
      return reminderProcessor.processJob(job.data);
    },
    {
      connection: {
        ...connectionConfig,
        maxRetriesPerRequest: null,
      },
      concurrency: 5,
    }
  );

  worker.on('error', (err) => {
    logger.error(`[REMINDER_WORKER] Connection error: ${err.message}`, err);
  });

  worker.on('failed', async (job, err) => {
    const jobIdStr = job ? job.id : 'unknown';
    logger.error(`[REMINDER_FAILURE] Job ${jobIdStr} failed with error: ${err.message}`);

    if (job && job.attemptsMade >= job.opts.attempts) {
      logger.warn(`[REMINDER_FAILURE] Job ${job.id} reached max retry attempts (${job.opts.attempts}). Routing to Dead Letter Queue.`);
      try {
        await reminderDeadLetterQueue.add(
          'dead-letter-job',
          {
            jobId: job.data.jobId,
            failedAt: new Date(),
            error: err.message,
            attemptsMade: job.attemptsMade,
          },
          {
            jobId: `dlq-${job.data.jobId}-${Date.now()}`, // unique ID for dead letter entries
          }
        );
      } catch (dlqErr) {
        logger.error(`[REMINDER_FAILURE] Failed to push to Dead Letter Queue for job ${job.id}: ${dlqErr.message}`);
      }
    }
  });

  worker.on('completed', (job) => {
    logger.info(`[REMINDER_WORKER] Job ${job.id} completed successfully.`);
  });

  return worker;
}
