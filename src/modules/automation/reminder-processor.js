// src/modules/automation/reminder-processor.js

import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { automationTemplateRegistry } from './automation-template-variables.js';
import { exists as redisExists } from '../../lib/redis.js';

export const reminderProcessor = {
  /**
   * Processes a scheduled reminder job.
   *
   * @param {object} data - Job payload containing { jobId }
   */
  async processJob({ jobId }) {
    // 1. Fetch Job from DB with relations
    const job = await prisma.reminderJob.findUnique({
      where: { id: jobId },
      include: {
        client: true,
        tenant: true,
        dietPlan: true,
      },
    });

    if (!job) {
      logger.warn(`[REMINDER_EXECUTION] Job ${jobId} not found in database. Skipping.`);
      return;
    }

    const logMeta = {
      tenantId: job.tenantId,
      clientId: job.clientId,
      automationId: job.automationId,
      dietPlanId: job.dietPlanId,
      reminderJobId: job.id,
      queueJobId: job.queueJobId,
    };

    // Check Redis regeneration lock before doing any processing
    const lockKey = `automation:lock:${job.automationId}`;
    const isLocked = await redisExists(lockKey);
    if (isLocked) {
      logger.warn(`[REMINDER_EXECUTION] Automation ${job.automationId} is locked for regeneration. Delaying job ${jobId}.`, logMeta);
      throw new Error(`Automation ${job.automationId} is currently locked for regeneration. Retrying later.`);
    }

    // 2. Opt-out safety check
    if (!job.client.remindersEnabled) {
      logger.info(`[AUTOMATION] Reminders disabled for client ${job.clientId}. Marking job ${job.id} as CANCELLED.`, logMeta);
      await prisma.reminderJob.update({
        where: { id: jobId },
        data: { status: 'CANCELLED' },
      });
      return;
    }

    // Skip if job is already sent or cancelled
    if (job.status === 'SENT' || job.status === 'CANCELLED') {
      logger.info(`[AUTOMATION] Job ${jobId} is in status ${job.status}. Skipping processing.`, logMeta);
      return;
    }

    logger.info(`[REMINDER_WORKER] Processing job ${job.id} (Type: ${job.jobType})`, logMeta);

    // Update job to PROCESSING and increment attempts
    const updatedJob = await prisma.reminderJob.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
      },
    });

    try {
      // 3. Immutable Snapshot Enforcement
      // Worker execution MUST ONLY use compiledTitle and compiledMessage from the snapshot.
      let compiledTitle = job.compiledTitle;
      let compiledMessage = job.compiledMessage;

      if (!compiledTitle || !compiledMessage) {
        logger.warn(`[AUTOMATION] Snapshot missing on job ${job.id}. Compiling fallback...`, logMeta);
        
        let template = null;
        if (job.templateId) {
          template = await prisma.reminderTemplate.findUnique({
            where: { id: job.templateId },
          });
        }
        if (!template) {
          // Fallback default
          template = await prisma.reminderTemplate.findFirst({
            where: {
              tenantId: job.tenantId,
              type: job.jobType,
              isDefault: true,
              isActive: true,
            },
          });
        }

        if (!template) {
          throw new Error(`No template found for type ${job.jobType}`);
        }

        const context = {
          client: job.client,
          tenant: job.tenant,
          dietPlan: job.dietPlan,
          meal: {
            name: job.payload?.mealName || '',
            mealTime: job.payload?.mealTime || '',
          },
        };

        compiledTitle = automationTemplateRegistry.compile(template.title, context);
        compiledMessage = automationTemplateRegistry.compile(template.message, context);

        // Save back snapshot
        await prisma.reminderJob.update({
          where: { id: job.id },
          data: { compiledTitle, compiledMessage },
        });
      }

      // 4. Mock Delivery (Phase 7B only logs dispatch)
      logger.info(`[Mock Dispatch - WHATSAPP] To: ${job.client.firstName} (${job.client.phone})\nTitle: ${compiledTitle}\nMessage: ${compiledMessage}`, logMeta);

      // 5. Create ReminderExecution record (Success)
      await prisma.reminderExecution.create({
        data: {
          tenantId: job.tenantId,
          reminderJobId: job.id,
          status: 'SENT',
          executedAt: new Date(),
          metadata: {
            attempt: updatedJob.attempts,
            channel: job.channel,
            compiledTitle,
            compiledMessage,
          },
        },
      });

      // 6. Update ReminderJob status to SENT
      await prisma.reminderJob.update({
        where: { id: job.id },
        data: {
          status: 'SENT',
          executedAt: new Date(),
          errorText: null, // Clear any previous error text
        },
      });

    } catch (err) {
      logger.error(`[REMINDER_FAILURE] Failed to process job ${job.id}: ${err.message}`, {
        ...logMeta,
        error: err.message,
        stack: err.stack,
      });

      // Log execution failure
      await prisma.reminderExecution.create({
        data: {
          tenantId: job.tenantId,
          reminderJobId: job.id,
          status: 'FAILED',
          executedAt: new Date(),
          errorMessage: err.message,
          metadata: {
            attempt: updatedJob.attempts,
            channel: job.channel,
          },
        },
      });

      // Update ReminderJob status to FAILED
      await prisma.reminderJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorText: err.message,
        },
      });

      // Rethrow to trigger BullMQ retries & exponential backoff
      throw err;
    }
  },
};

export default reminderProcessor;
