// src/modules/automation/automation.service.js

import prisma from '../../lib/prisma.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';
import { reminderGeneratorService } from './reminder-generator.service.js';
import { reminderProducer } from './reminder-producer.js';
import { set as redisSet, del as redisDel } from '../../lib/redis.js';

async function verifyWhatsAppConnection(tenantId) {
  const connection = await prisma.whatsAppConnection.findUnique({
    where: { tenantId },
  });
  if (!connection || connection.status !== 'CONNECTED') {
    throw ApiError.badRequest('Cannot schedule reminders. Tenant does not have a connected WhatsApp integration.');
  }
}

export const automationService = {
  /**
   * Creates a new active automation for a client and generates scheduled reminders.
   * Cancels any existing active automation for the same client.
   *
   * @param {string} tenantId
   * @param {object} params
   * @returns {Promise<object>} Created automation record
   */
  async createAutomation(tenantId, { clientId, dietPlanId, activatedBy, startDate }) {
    await verifyWhatsAppConnection(tenantId);
    logger.info(`[AUTOMATION] Creating new active automation session for client ${clientId} on tenant ${tenantId}`);

    // Fetch existing active automations and their pending jobs outside transaction
    const activeAutomations = await prisma.dietPlanAutomation.findMany({
      where: {
        tenantId,
        clientId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        reminderJobs: {
          where: { status: 'PENDING' },
          select: { id: true, queueJobId: true },
        },
      },
    });

    const pendingJobsToCancel = activeAutomations.flatMap(auto => auto.reminderJobs);

    const automation = await prisma.$transaction(async (tx) => {
      for (const auto of activeAutomations) {
        // Set status to CANCELLED and update database jobs
        await tx.reminderJob.updateMany({
          where: { tenantId, automationId: auto.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });

        await tx.dietPlanAutomation.update({
          where: { id: auto.id },
          data: {
            status: 'CANCELLED',
            stoppedAt: new Date(),
          },
        });
      }

      // Create new active automation
      return tx.dietPlanAutomation.create({
        data: {
          tenantId,
          clientId,
          dietPlanId,
          activatedBy,
          startDate: startDate ? new Date(startDate) : null,
          activatedAt: new Date(),
          status: 'ACTIVE',
        },
      });
    });

    // Cancel old queue jobs in BullMQ outside transaction
    for (const pj of pendingJobsToCancel) {
      if (pj.queueJobId) {
        await reminderProducer.cancelJob(pj.queueJobId);
      }
    }

    // Generate scheduled reminder jobs
    try {
      await reminderGeneratorService.generateJobs(tenantId, automation.id);
    } catch (err) {
      logger.error(`[REMINDER_FAILURE] Failed to generate reminder jobs for new active automation ${automation.id}: ${err.message}`);
    }

    return automation;
  },

  /**
   * Pauses an active automation by removing scheduled future jobs from BullMQ.
   *
   * @param {string} tenantId
   * @param {string} id - Automation ID
   * @returns {Promise<object>} Updated automation record
   */
  async pauseAutomation(tenantId, id) {
    const automation = await prisma.dietPlanAutomation.findFirst({
      where: { id, tenantId },
    });

    if (!automation) {
      throw ApiError.notFound('Automation not found');
    }

    if (automation.status !== 'ACTIVE') {
      throw ApiError.badRequest(`Cannot pause automation in status: ${automation.status}`);
    }

    logger.info(`[AUTOMATION] Pausing automation ${id} on tenant ${tenantId}`);

    // Fetch jobs scheduled in the future outside transaction
    const futurePendingJobs = await prisma.reminderJob.findMany({
      where: {
        tenantId,
        automationId: id,
        status: 'PENDING',
        scheduledFor: { gt: new Date() },
      },
      select: { id: true, queueJobId: true },
    });

    const updatedAutomation = await prisma.$transaction(async (tx) => {
      // Nullify queueJobIds in DB to reflect queue cancellation
      await tx.reminderJob.updateMany({
        where: {
          id: { in: futurePendingJobs.map(j => j.id) },
        },
        data: { queueJobId: null },
      });

      // Update automation status
      return tx.dietPlanAutomation.update({
        where: { id, tenantId },
        data: {
          status: 'PAUSED',
          stoppedAt: new Date(),
        },
      });
    });

    // Remove from BullMQ queue to prevent execution while paused outside transaction
    for (const job of futurePendingJobs) {
      if (job.queueJobId) {
        await reminderProducer.cancelJob(job.queueJobId);
      }
    }

    return updatedAutomation;
  },

  /**
   * Resumes a paused automation by re-scheduling future pending jobs in BullMQ.
   *
   * @param {string} tenantId
   * @param {string} id - Automation ID
   * @returns {Promise<object>} Updated automation record
   */
  async resumeAutomation(tenantId, id) {
    await verifyWhatsAppConnection(tenantId);
    const automation = await prisma.dietPlanAutomation.findFirst({
      where: { id, tenantId },
    });

    if (!automation) {
      throw ApiError.notFound('Automation not found');
    }

    if (automation.status !== 'PAUSED') {
      throw ApiError.badRequest(`Cannot resume automation in status: ${automation.status}`);
    }

    logger.info(`[AUTOMATION] Resuming automation ${id} on tenant ${tenantId}`);

    const futurePendingJobs = await prisma.reminderJob.findMany({
      where: {
        tenantId,
        automationId: id,
        status: 'PENDING',
        scheduledFor: { gt: new Date() },
      },
    });

    const updatedAutomation = await prisma.dietPlanAutomation.update({
      where: { id, tenantId },
      data: {
        status: 'ACTIVE',
        stoppedAt: null,
      },
    });

    // Re-schedule future pending jobs in BullMQ
    for (const job of futurePendingJobs) {
      try {
        const qJob = await reminderProducer.queueJob(job);
        await prisma.reminderJob.update({
          where: { id: job.id },
          data: { queueJobId: qJob.id },
        });
      } catch (err) {
        logger.error(`[REMINDER_FAILURE] Failed to re-enqueue job ${job.id} during resume: ${err.message}`);
      }
    }

    return updatedAutomation;
  },

  /**
   * Cancels a running automation session, clearing all pending jobs.
   *
   * @param {string} tenantId
   * @param {string} id - Automation ID
   * @returns {Promise<object>} Updated automation record
   */
  async cancelAutomation(tenantId, id) {
    const automation = await prisma.dietPlanAutomation.findFirst({
      where: { id, tenantId },
    });

    if (!automation) {
      throw ApiError.notFound('Automation not found');
    }

    if (automation.status === 'CANCELLED' || automation.status === 'COMPLETED') {
      throw ApiError.badRequest(`Cannot cancel automation that is already ${automation.status}`);
    }

    logger.info(`[AUTOMATION] Cancelling automation ${id} on tenant ${tenantId}`);

    // Find all PENDING jobs outside transaction
    const pendingJobs = await prisma.reminderJob.findMany({
      where: {
        tenantId,
        automationId: id,
        status: 'PENDING',
      },
      select: { id: true, queueJobId: true },
    });

    const updatedAutomation = await prisma.$transaction(async (tx) => {
      // Mark status as CANCELLED in DB
      await tx.reminderJob.updateMany({
        where: {
          id: { in: pendingJobs.map(j => j.id) },
        },
        data: {
          status: 'CANCELLED',
          queueJobId: null,
        },
      });

      // Update automation status
      return tx.dietPlanAutomation.update({
        where: { id, tenantId },
        data: {
          status: 'CANCELLED',
          stoppedAt: new Date(),
        },
      });
    });

    // Cancel from queue outside transaction
    for (const job of pendingJobs) {
      if (job.queueJobId) {
        await reminderProducer.cancelJob(job.queueJobId);
      }
    }

    return updatedAutomation;
  },

  /**
   * Retrieves automation status.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getAutomationStatus(tenantId, id) {
    const automation = await prisma.dietPlanAutomation.findFirst({
      where: { id, tenantId },
      include: {
        client: true,
        dietPlan: true,
      },
    });

    if (!automation) {
      throw ApiError.notFound('Automation not found');
    }

    return automation;
  },

  /**
   * Retrieves all automations for a client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<Array>}
   */
  async getClientAutomations(tenantId, clientId) {
    return prisma.dietPlanAutomation.findMany({
      where: { tenantId, clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        dietPlan: true,
      },
    });
  },

  /**
   * Regenerates reminder jobs for an active automation session.
   * Increments the automation version, deletes future pending jobs from DB & BullMQ,
   * and schedules new future jobs.
   *
   * @param {string} tenantId
   * @param {string} dietPlanId
   */
  async regenerateForPlan(tenantId, dietPlanId) {
    await verifyWhatsAppConnection(tenantId);
    const automation = await prisma.dietPlanAutomation.findFirst({
      where: {
        tenantId,
        dietPlanId,
        status: 'ACTIVE',
      },
    });

    if (!automation) {
      logger.info(`[AUTOMATION] No active automation found for diet plan ${dietPlanId}. Skipping regeneration.`);
      return;
    }

    const lockKey = `automation:lock:${automation.id}`;
    logger.info(`[AUTOMATION] Acquiring lock for automation ${automation.id}`);
    await redisSet(lockKey, 'locked', 30); // 30s expiration

    try {
      // 1. Increment automation version
      const updatedAutomation = await prisma.dietPlanAutomation.update({
        where: { id: automation.id },
        data: {
          version: { increment: 1 },
        },
      });

      // 2. Fetch pending jobs scheduled in the future
      const futurePendingJobs = await prisma.reminderJob.findMany({
        where: {
          tenantId,
          automationId: updatedAutomation.id,
          status: 'PENDING',
          scheduledFor: { gt: new Date() },
        },
        select: { id: true, queueJobId: true },
      });

      // 3. Delete from DB in a transaction
      if (futurePendingJobs.length > 0) {
        await prisma.reminderJob.deleteMany({
          where: {
            id: { in: futurePendingJobs.map(j => j.id) },
          },
        });
      }

      // 4. Cancel in BullMQ
      for (const job of futurePendingJobs) {
        if (job.queueJobId) {
          await reminderProducer.cancelJob(job.queueJobId);
        }
      }

      // 5. Generate new future jobs
      await reminderGeneratorService.generateJobs(tenantId, updatedAutomation.id);

      logger.info(`[AUTOMATION] Successfully regenerated reminders for automation ${automation.id} (Version ${updatedAutomation.version})`);
    } catch (err) {
      logger.error(`[REMINDER_FAILURE] Failed to regenerate reminders for automation ${automation.id}: ${err.message}`);
      throw err;
    } finally {
      logger.info(`[AUTOMATION] Releasing lock for automation ${automation.id}`);
      await redisDel(lockKey);
    }
  },

  /**
   * Updates an automation settings, increments version, deletes future pending jobs and regenerates.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} settings
   * @returns {Promise<object>} Updated automation record
   */
  async updateAutomationSettings(tenantId, id, settings) {
    const automation = await prisma.dietPlanAutomation.findFirst({
      where: { id, tenantId },
    });

    if (!automation) {
      throw ApiError.notFound('Automation not found');
    }

    const lockKey = `automation:lock:${automation.id}`;
    logger.info(`[AUTOMATION] Acquiring lock for settings update of automation ${automation.id}`);
    await redisSet(lockKey, 'locked', 30); // 30s expiration

    try {
      // 1. Update settings and increment version
      const updatedAutomation = await prisma.dietPlanAutomation.update({
        where: { id: automation.id },
        data: {
          waterEnabled: settings.waterEnabled !== undefined ? settings.waterEnabled : undefined,
          waterFrequencyType: settings.waterFrequencyType !== undefined ? settings.waterFrequencyType : undefined,
          waterIntervalHours: settings.waterIntervalHours !== undefined ? settings.waterIntervalHours : undefined,
          waterCustomTimes: settings.waterCustomTimes !== undefined ? settings.waterCustomTimes : undefined,
          sleepEnabled: settings.sleepEnabled !== undefined ? settings.sleepEnabled : undefined,
          sleepTime: settings.sleepTime !== undefined ? settings.sleepTime : undefined,
          version: { increment: 1 },
        },
      });

      // 2. Only regenerate if the status is ACTIVE
      if (updatedAutomation.status === 'ACTIVE') {
        await verifyWhatsAppConnection(tenantId);
        // Fetch pending jobs scheduled in the future
        const futurePendingJobs = await prisma.reminderJob.findMany({
          where: {
            tenantId,
            automationId: updatedAutomation.id,
            status: 'PENDING',
            scheduledFor: { gt: new Date() },
          },
          select: { id: true, queueJobId: true },
        });

        // Delete from DB
        if (futurePendingJobs.length > 0) {
          await prisma.reminderJob.deleteMany({
            where: {
              id: { in: futurePendingJobs.map(j => j.id) },
            },
          });
        }

        // Cancel in BullMQ
        for (const job of futurePendingJobs) {
          if (job.queueJobId) {
            await reminderProducer.cancelJob(job.queueJobId);
          }
        }

        // Generate new future jobs
        await reminderGeneratorService.generateJobs(tenantId, updatedAutomation.id);
      }

      logger.info(`[AUTOMATION] Successfully updated settings and regenerated reminders for automation ${automation.id} (Version ${updatedAutomation.version})`);
      return updatedAutomation;
    } catch (err) {
      logger.error(`[REMINDER_FAILURE] Failed to update settings/regenerate for automation ${automation.id}: ${err.message}`);
      throw err;
    } finally {
      logger.info(`[AUTOMATION] Releasing lock for settings update of automation ${automation.id}`);
      await redisDel(lockKey);
    }
  },
};

export default automationService;
