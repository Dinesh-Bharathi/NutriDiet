// src/modules/automation/reminder-processor.js

import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { automationTemplateRegistry } from './automation-template-variables.js';
import { exists as redisExists } from '../../lib/redis.js';
import { whatsappAutomationService } from './whatsapp-automation.service.js';
import { complianceService } from './compliance.service.js';
import { complianceTimeoutQueue } from './compliance-timeout.worker.js';

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

    // Enforce opt-in status check
    const conversation = await prisma.whatsAppConversation.findFirst({
      where: { tenantId: job.tenantId, clientId: job.clientId },
    });

    if (!conversation || !conversation.optInStatus) {
      logger.info(`[AUTOMATION] WhatsApp opt-in status is FALSE for client ${job.clientId}. Silently skipping reminder job ${job.id}.`, logMeta);
      await prisma.reminderJob.update({
        where: { id: jobId },
        data: { status: 'CANCELLED', errorText: 'Skipped: Client has not opted into WhatsApp communications.' },
      });
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
      let compiledTitle = job.compiledTitle;
      let compiledMessage = job.compiledMessage;
      let template = null;

      if (job.templateId) {
        template = await prisma.reminderTemplate.findUnique({
          where: { id: job.templateId },
        });
      }

      if (!template) {
        template = await prisma.reminderTemplate.findFirst({
          where: {
            tenantId: job.tenantId,
            type: job.jobType,
            isDefault: true,
            isActive: true,
          },
        });
      }

      if (!compiledTitle || !compiledMessage) {
        logger.warn(`[AUTOMATION] Snapshot missing on job ${job.id}. Compiling fallback...`, logMeta);

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

      const buttons = template?.buttons || [];
      let metaMessageId = job.sentMetaMessageId;
      let messageId = null;

      // 4. Live WhatsApp Dispatch (Idempotency Guard)
      if (metaMessageId) {
        logger.info(`[AUTOMATION] Job ${job.id} was already successfully sent in a previous attempt (metaMessageId: ${metaMessageId}). Skipping WhatsApp send.`, logMeta);
      } else {
        const dispatchResult = await whatsappAutomationService.sendAutomationReminder(job.tenantId, {
          clientId: job.clientId,
          compiledMessage,
          buttons,
          reminderJobId: job.id,
          jobType: job.jobType,
        });

        if (dispatchResult.skipped) {
          logger.warn(`[AUTOMATION] Reminder send skipped: ${dispatchResult.reason}. Marking job ${job.id} as CANCELLED.`, logMeta);
          await prisma.reminderJob.update({
            where: { id: job.id },
            data: {
              status: 'CANCELLED',
              errorText: `Skipped: ${dispatchResult.reason}`,
            },
          });
          return;
        }

        metaMessageId = dispatchResult.metaMessageId;
        messageId = dispatchResult.messageId;

        // 5. Create Success ReminderExecution record
        await prisma.reminderExecution.create({
          data: {
            tenantId: job.tenantId,
            reminderJobId: job.id,
            status: 'SENT',
            executedAt: new Date(),
            metaMessageId,
            metadata: {
              attempt: updatedJob.attempts,
              channel: job.channel,
              compiledTitle,
              compiledMessage,
              whatsAppMessageId: messageId,
            },
          },
        });

        // 6. Update ReminderJob status to SENT and save metaMessageId
        await prisma.reminderJob.update({
          where: { id: job.id },
          data: {
            status: 'SENT',
            executedAt: new Date(),
            errorText: null,
            sentMetaMessageId: metaMessageId,
          },
        });
      }

      // 7. Get or Create Compliance Event (Only for follow-ups/compliance jobs)
      const requiresCompliance = [
        'MEAL_FOLLOWUP',
        'WATER_FOLLOWUP',
        'SLEEP_FOLLOWUP'
      ].includes(job.jobType);

      let complianceEvent = null;

      if (requiresCompliance) {
        complianceEvent = await prisma.clientComplianceEvent.findUnique({
          where: { reminderJobId: job.id },
        });

        if (complianceEvent) {
          logger.info(`[AUTOMATION] Compliance event already exists for job ${job.id} (eventId: ${complianceEvent.id}). Skipping creation.`, logMeta);
        } else {
          // Fetch latest job details to ensure we pass updated SENT status and sentMetaMessageId
          const currentJob = await prisma.reminderJob.findUnique({ where: { id: job.id } });
          complianceEvent = await complianceService.createComplianceEvent(prisma, currentJob);
        }

        // 8. Queue Compliance Timeout BullMQ delayed job
        const delayMs = complianceEvent.responseWindowClosesAt.getTime() - Date.now();
        await complianceTimeoutQueue.add(
          'compliance-timeout',
          { complianceEventId: complianceEvent.id },
          {
            delay: Math.max(0, delayMs),
            jobId: `timeout-${complianceEvent.id}`,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          }
        );
      }

      // Final status sync to ensure job remains SENT in database
      await prisma.reminderJob.update({
        where: { id: job.id },
        data: {
          status: 'SENT',
          errorText: null,
        },
      });

      if (requiresCompliance && complianceEvent) {
        logger.info(`[AUTOMATION] Successfully processed reminder, created/retrieved event ${complianceEvent.id}, and scheduled timeout job.`, logMeta);
      } else {
        logger.info(`[AUTOMATION] Successfully processed behavioral reminder job ${job.id}.`, logMeta);
      }

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
