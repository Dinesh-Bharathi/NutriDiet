// src/modules/automation/reminder-producer.js

import { reminderQueue } from './reminder-queue.js';
import logger from '../../utils/logger.js';

export const reminderProducer = {
  /**
   * Enqueues a delayed job in BullMQ corresponding to a database ReminderJob.
   *
   * @param {object} reminderJob - The database ReminderJob record.
   * @returns {Promise<object>} The BullMQ Job instance.
   */
  async queueJob(reminderJob) {
    const now = Date.now();
    const targetTime = new Date(reminderJob.scheduledFor).getTime();
    const delay = Math.max(0, targetTime - now);

    logger.info(`[REMINDER_QUEUE] Enqueuing job ${reminderJob.id} (Type: ${reminderJob.jobType}) with delay of ${delay}ms`, {
      tenantId: reminderJob.tenantId,
      clientId: reminderJob.clientId,
      automationId: reminderJob.automationId,
      dietPlanId: reminderJob.dietPlanId,
      reminderJobId: reminderJob.id,
    });

    const job = await reminderQueue.add(
      'send-reminder',
      { jobId: reminderJob.id },
      {
        jobId: reminderJob.id, // Enforce uniqueness in queue by using the db job ID
        delay,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 60000, // 60s base delay
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    return job;
  },

  /**
   * Removes a scheduled job from the BullMQ queue to prevent orphan executions.
   *
   * @param {string} queueJobId
   */
  async cancelJob(queueJobId) {
    if (!queueJobId) return;
    try {
      const job = await reminderQueue.getJob(queueJobId);
      if (job) {
        await job.remove();
        logger.info(`[REMINDER_QUEUE] Successfully removed job ${queueJobId} from queue`);
      } else {
        logger.info(`[REMINDER_QUEUE] Job ${queueJobId} not found in queue (may have already run or been cleared)`);
      }
    } catch (err) {
      logger.error(`[REMINDER_FAILURE] Failed to cancel queue job ${queueJobId}: ${err.message}`);
    }
  },
};

export default reminderProducer;
