// src/modules/automation/automation.controller.js

import prisma from '../../lib/prisma.js';
import { reminderTemplateService } from './reminder-template.service.js';
import { reminderGeneratorService } from './reminder-generator.service.js';
import { reminderQueue, reminderDeadLetterQueue } from './reminder-queue.js';
import { automationService } from './automation.service.js';
import { HTTP_STATUS } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';

export const automationController = {
  // ── Templates Endpoints ───────────────────────────────────────────────────

  async getTemplates(req, res) {
    const { tenantId } = req.user;
    const { page, limit, search, type, status, source } = req.query;
    const result = await reminderTemplateService.getTemplates(tenantId, {
      page,
      limit,
      search,
      type,
      status,
      source,
    });
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
    });
  },

  async getPlaceholders(req, res) {
    const { PLACEHOLDERS_REGISTRY } = await import('./automation-template-variables.js');
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        version: 1,
        placeholders: PLACEHOLDERS_REGISTRY,
      },
    });
  },

  async createTemplate(req, res) {
    const { tenantId } = req.user;
    const template = await reminderTemplateService.createTemplate(tenantId, req.body);
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: template,
    });
  },

  async updateTemplate(req, res) {
    const { tenantId } = req.user;
    const { id } = req.params;
    const template = await reminderTemplateService.updateTemplate(tenantId, id, req.body);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: template,
    });
  },

  async deleteTemplate(req, res) {
    const { tenantId } = req.user;
    const { id } = req.params;
    await reminderTemplateService.deleteTemplate(tenantId, id);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Template deleted successfully',
    });
  },

  async cloneTemplate(req, res) {
    const { tenantId } = req.user;
    const { id } = req.params;
    const template = await reminderTemplateService.cloneTemplate(tenantId, id);
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: template,
    });
  },

  async restoreDefault(req, res) {
    const { tenantId } = req.user;
    const { type } = req.body;
    if (!type) {
      throw ApiError.badRequest('type is required to restore defaults');
    }
    await reminderTemplateService.restoreDefault(tenantId, type);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Restored default templates for type: ${type}`,
    });
  },

  // ── Jobs Endpoints ────────────────────────────────────────────────────────

  async getJobs(req, res) {
    const { tenantId } = req.user;
    const {
      status,
      jobType,
      clientId,
      dietPlanId,
      automationVersion,
      startDate,
      endDate,
      timezone,
      isArchived = 'false',
      page = 1,
      limit = 10,
    } = req.query;

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const skip = (parsedPage - 1) * parsedLimit;

    // Filters
    const where = { tenantId };
    if (status) where.status = status;
    if (jobType) where.jobType = jobType;
    if (clientId) where.clientId = clientId;
    if (dietPlanId) where.dietPlanId = dietPlanId;
    if (timezone) where.timezone = timezone;
    if (automationVersion) where.automationVersion = parseInt(automationVersion, 10);
    if (startDate || endDate) {
      where.scheduledFor = {};
      if (startDate) where.scheduledFor.gte = new Date(startDate);
      if (endDate) where.scheduledFor.lte = new Date(endDate);
    }

    if (isArchived === 'true') {
      where.isArchived = true;
    } else if (isArchived === 'false') {
      where.isArchived = false;
    } else if (isArchived === 'all') {
      // No filter on isArchived
    } else {
      where.isArchived = false;
    }

    const [jobs, total] = await Promise.all([
      prisma.reminderJob.findMany({
        where,
        skip,
        take: parsedLimit,
        orderBy: [
          { scheduledFor: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          client: {
            select: { firstName: true, lastName: true, phone: true },
          },
          template: {
            select: { name: true, version: true },
          },
          automation: {
            select: { version: true },
          },
        },
      }),
      prisma.reminderJob.count({ where }),
    ]);

    // Fetch BullMQ state metrics (Dashboard requirement)
    let queueMetrics = {
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      deadLetter: 0,
      oldestPendingJobScheduledFor: null,
      averageProcessingTimeMs: 0,
      failedCount24h: 0,
      activeWorkers: 0,
    };

    try {
      const [waiting, active, delayed, failed, completed, dlqCount] = await Promise.all([
        reminderQueue.getWaitingCount(),
        reminderQueue.getActiveCount(),
        reminderQueue.getDelayedCount(),
        reminderQueue.getFailedCount(),
        reminderQueue.getCompletedCount(),
        reminderDeadLetterQueue.getJobCountByTypes('completed', 'wait', 'active', 'delayed', 'failed').catch(() => 0),
      ]);

      // Calculate Oldest Pending Job
      const oldestPending = await prisma.reminderJob.findFirst({
        where: { tenantId, status: 'PENDING', isArchived: false },
        orderBy: { scheduledFor: 'asc' },
        select: { scheduledFor: true },
      });

      // Calculate Average Processing Latency over last 100 sent jobs
      const recentSent = await prisma.reminderJob.findMany({
        where: { tenantId, status: 'SENT', executedAt: { not: null } },
        take: 100,
        orderBy: { executedAt: 'desc' },
        select: { scheduledFor: true, executedAt: true }
      });
      let averageProcessingTimeMs = 0;
      if (recentSent.length > 0) {
        const sum = recentSent.reduce((acc, job) => acc + (job.executedAt.getTime() - job.scheduledFor.getTime()), 0);
        averageProcessingTimeMs = Math.round(sum / recentSent.length);
      }

      // Calculate Failed Jobs (24h)
      const failedCount24h = await prisma.reminderJob.count({
        where: {
          tenantId,
          status: 'FAILED',
          updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });

      // Fetch Active queue workers count
      let activeWorkersCount = 0;
      try {
        const workers = await reminderQueue.getWorkers();
        activeWorkersCount = workers.length;
      } catch (err) {
        // Fallback
      }

      queueMetrics = {
        waiting,
        active,
        delayed,
        failed,
        completed,
        deadLetter: dlqCount,
        oldestPendingJobScheduledFor: oldestPending?.scheduledFor || null,
        averageProcessingTimeMs,
        failedCount24h,
        activeWorkers: activeWorkersCount,
      };
    } catch (err) {
      logger.error(`[REMINDER_FAILURE] Failed to query BullMQ metrics: ${err.message}`);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: jobs,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
      queueMetrics,
    });
  },

  async getJobById(req, res) {
    const { tenantId } = req.user;
    const { id } = req.params;

    const job = await prisma.reminderJob.findFirst({
      where: { id, tenantId },
      include: {
        client: true,
        dietPlan: true,
        template: true,
        automation: true,
        complianceEvent: true,
        executions: {
          orderBy: { executedAt: 'desc' },
        },
      },
    });

    if (!job) {
      throw ApiError.notFound('Reminder Job not found');
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: job,
    });
  },

  // ── Regeneration Endpoint ─────────────────────────────────────────────────

  async regenerateJobs(req, res) {
    const { tenantId } = req.user;
    const { id } = req.params; // Automation ID

    const count = await reminderGeneratorService.generateJobs(tenantId, id);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Successfully regenerated ${count} reminder jobs.`,
      count,
    });
  },

  async generatePreview(req, res) {
    const { tenantId } = req.user;
    const { id } = req.params; // Automation ID
    const counts = await reminderGeneratorService.generateJobs(tenantId, id, { dryRun: true });
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: counts,
    });
  },

  async getClientAutomations(req, res) {
    const { tenantId } = req.user;
    const { clientId } = req.params;
    const automations = await automationService.getClientAutomations(tenantId, clientId);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: automations,
    });
  },

  async updateAutomationSettings(req, res) {
    const { tenantId } = req.user;
    const { id } = req.params;
    const updated = await automationService.updateAutomationSettings(tenantId, id, req.body);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: updated,
    });
  },

  async getDisableImpact(req, res) {
    const { tenantId } = req.user;
    const { id } = req.params;
    const impact = await reminderTemplateService.getTemplateDisableImpact(tenantId, id);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: impact,
    });
  },

  async toggleTemplateActive(req, res) {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { isActive } = req.body;
    if (isActive === undefined) {
      throw ApiError.badRequest('isActive is required');
    }
    const updated = await reminderTemplateService.toggleTemplateActive(tenantId, id, isActive);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: updated,
    });
  },

  async getReminderConfig(req, res) {
    const { tenantId } = req.user;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { reminderConfig: true },
    });
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: tenant?.reminderConfig || {},
    });
  },

  async updateReminderConfig(req, res) {
    const { tenantId } = req.user;
    const config = req.body;

    // Validate config
    if (config.mealReminderOffsetMinutes !== undefined && config.mealReminderOffsetMinutes !== null) {
      const val = parseInt(config.mealReminderOffsetMinutes, 10);
      if (isNaN(val) || val < 1 || val > 120) {
        throw ApiError.badRequest('Meal reminder offset minutes must be between 1 and 120 minutes');
      }
    }
    if (config.mealFollowupOffsetMinutes !== undefined && config.mealFollowupOffsetMinutes !== null) {
      const val = parseInt(config.mealFollowupOffsetMinutes, 10);
      if (isNaN(val) || val < 15 || val > 720) {
        throw ApiError.badRequest('Meal follow-up offset minutes must be between 15 and 720 minutes');
      }
    }
    
    const hhMmRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    
    if (config.waterStartTime !== undefined && config.waterStartTime !== null) {
      if (!hhMmRegex.test(config.waterStartTime)) {
        throw ApiError.badRequest('Water start time must be in HH:mm format');
      }
    }
    if (config.waterEndTime !== undefined && config.waterEndTime !== null) {
      if (!hhMmRegex.test(config.waterEndTime)) {
        throw ApiError.badRequest('Water end time must be in HH:mm format');
      }
    }
    if (config.waterFrequencyHours !== undefined && config.waterFrequencyHours !== null) {
      const val = parseInt(config.waterFrequencyHours, 10);
      if (isNaN(val) || val < 1 || val > 12) {
        throw ApiError.badRequest('Water frequency hours must be between 1 and 12 hours');
      }
    }
    if (config.waterDailyTargetMl !== undefined && config.waterDailyTargetMl !== null) {
      const val = parseInt(config.waterDailyTargetMl, 10);
      if (isNaN(val) || val < 500 || val > 10000) {
        throw ApiError.badRequest('Water daily target must be between 500 and 10000 mL');
      }
    }

    if (config.sleepReminderTime !== undefined && config.sleepReminderTime !== null) {
      if (!hhMmRegex.test(config.sleepReminderTime)) {
        throw ApiError.badRequest('Sleep reminder time must be in HH:mm format');
      }
    }
    if (config.sleepResponseWindowMinutes !== undefined && config.sleepResponseWindowMinutes !== null) {
      const val = parseInt(config.sleepResponseWindowMinutes, 10);
      if (isNaN(val) || val < 15 || val > 720) {
        throw ApiError.badRequest('Sleep response window minutes must be between 15 and 720 minutes');
      }
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { reminderConfig: config },
      select: { reminderConfig: true },
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: updated.reminderConfig,
    });
  },

  async bulkArchiveJobs(req, res) {
    const { tenantId } = req.user;
    const { jobIds, clientId, statuses, jobType, startDate, endDate } = req.body;

    const where = { tenantId, isArchived: false };
    if (Array.isArray(jobIds) && jobIds.length > 0) {
      where.id = { in: jobIds };
    } else {
      if (clientId) where.clientId = clientId;
      if (jobType) where.jobType = jobType;
      if (Array.isArray(statuses) && statuses.length > 0) {
        where.status = { in: statuses };
      }
      if (startDate || endDate) {
        where.scheduledFor = {};
        if (startDate) where.scheduledFor.gte = new Date(startDate);
        if (endDate) where.scheduledFor.lte = new Date(endDate);
      }
    }

    // Find the target jobs first to get their queue IDs and statuses
    const targetJobs = await prisma.reminderJob.findMany({
      where,
      select: { id: true, queueJobId: true, status: true },
    });

    if (targetJobs.length === 0) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'No jobs found matching criteria to archive',
        count: 0,
      });
    }

    const pendingTargetIds = targetJobs.filter(j => j.status === 'PENDING').map(j => j.id);
    const nonPendingTargetIds = targetJobs.filter(j => j.status !== 'PENDING').map(j => j.id);

    await prisma.$transaction(async (tx) => {
      if (pendingTargetIds.length > 0) {
        await tx.reminderJob.updateMany({
          where: { id: { in: pendingTargetIds } },
          data: { isArchived: true, status: 'CANCELLED', errorText: 'Archived by user' },
        });
      }
      if (nonPendingTargetIds.length > 0) {
        await tx.reminderJob.updateMany({
          where: { id: { in: nonPendingTargetIds } },
          data: { isArchived: true },
        });
      }
    });

    // Cancel BullMQ jobs
    for (const job of targetJobs) {
      if (job.status === 'PENDING' && job.queueJobId) {
        try {
          await reminderProducer.cancelJob(job.queueJobId);
        } catch (err) {
          logger.error(`[REMINDER_FAILURE] Failed to cancel BullMQ job ${job.queueJobId}: ${err.message}`);
        }
      }
    }

    // Remove from DLQ if exists
    for (const job of targetJobs) {
      try {
        const dlqJob = await reminderDeadLetterQueue.getJob(job.id);
        if (dlqJob) {
          await dlqJob.remove();
        }
      } catch (err) {
        // Ignore if not in DLQ
      }
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Successfully archived ${targetJobs.length} reminder jobs`,
      count: targetJobs.length,
    });
  },
};

export default automationController;
