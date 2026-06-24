// src/modules/automation/automation.controller.js

import prisma from '../../lib/prisma.js';
import { reminderTemplateService } from './reminder-template.service.js';
import { reminderGeneratorService } from './reminder-generator.service.js';
import { reminderQueue, reminderDeadLetterQueue } from './reminder-queue.js';
import { automationService } from './automation.service.js';
import { HTTP_STATUS } from '../../config/constants.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';
import { utcToZonedTime, format as formatTz } from 'date-fns-tz';

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
    if (status) {
      if (status === 'SENT' || status === 'DELIVERED' || status === 'READ' || status === 'FAILED') {
        if (status === 'FAILED') {
          const failedMessages = await prisma.whatsAppMessage.findMany({
            where: { tenantId, status: 'FAILED', direction: 'OUTBOUND', source: 'AUTOMATION' },
            select: { metaMessageId: true },
          });
          const failedMetaIds = failedMessages.map((m) => m.metaMessageId).filter(Boolean);
          where.OR = [
            { status: 'FAILED' },
            { status: 'SENT', sentMetaMessageId: { in: failedMetaIds } },
          ];
        } else {
          where.status = 'SENT';
          const targetStatuses = status === 'DELIVERED' ? ['DELIVERED', 'READ'] : [status];
          const matchingMessages = await prisma.whatsAppMessage.findMany({
            where: { tenantId, status: { in: targetStatuses }, direction: 'OUTBOUND', source: 'AUTOMATION' },
            select: { metaMessageId: true },
          });
          const metaIds = matchingMessages.map((m) => m.metaMessageId).filter(Boolean);

          if (status === 'SENT') {
            const otherStatusMessages = await prisma.whatsAppMessage.findMany({
              where: { tenantId, status: { in: ['DELIVERED', 'READ', 'FAILED'] }, direction: 'OUTBOUND', source: 'AUTOMATION' },
              select: { metaMessageId: true },
            });
            const otherMetaIds = otherStatusMessages.map((m) => m.metaMessageId).filter(Boolean);
            where.OR = [
              { sentMetaMessageId: { in: metaIds } },
              { sentMetaMessageId: { notIn: otherMetaIds } },
              { sentMetaMessageId: null },
            ];
          } else {
            where.sentMetaMessageId = { in: metaIds };
          }
        }
      } else {
        where.status = status;
      }
    }
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

    // Fetch actual WhatsApp delivery/read status for SENT jobs
    const metaMessageIds = jobs
      .filter((j) => j.status === 'SENT' && j.sentMetaMessageId)
      .map((j) => j.sentMetaMessageId);
    
    let messageStatusMap = new Map();
    if (metaMessageIds.length > 0) {
      const messages = await prisma.whatsAppMessage.findMany({
        where: {
          tenantId,
          metaMessageId: { in: metaMessageIds },
        },
        select: { metaMessageId: true, status: true },
      });
      messageStatusMap = new Map(messages.map((m) => [m.metaMessageId, m.status]));
    }

    const mappedJobs = jobs.map((job) => {
      if (job.status === 'SENT' && job.sentMetaMessageId) {
        const messageStatus = messageStatusMap.get(job.sentMetaMessageId);
        if (messageStatus) {
          return { ...job, status: messageStatus };
        }
      }
      return job;
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: mappedJobs,
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

    let displayStatus = job.status;
    let errorMessage = job.errorText;
    if (job.status === 'SENT' && job.sentMetaMessageId) {
      const message = await prisma.whatsAppMessage.findUnique({
        where: { metaMessageId: job.sentMetaMessageId },
        select: { status: true, errorText: true },
      });
      if (message) {
        displayStatus = message.status;
        if (message.status === 'FAILED') {
          errorMessage = message.errorText || 'Message delivery failed (Meta API callback)';
        }
      }
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: { ...job, status: displayStatus, errorText: errorMessage },
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
    if (config.waterFollowupOffsetMinutes !== undefined && config.waterFollowupOffsetMinutes !== null) {
      const val = parseInt(config.waterFollowupOffsetMinutes, 10);
      if (isNaN(val) || val < 1 || val > 120) {
        throw ApiError.badRequest('Water follow-up offset minutes must be between 1 and 120 minutes');
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
    if (config.sleepFollowupTime !== undefined && config.sleepFollowupTime !== null) {
      if (!hhMmRegex.test(config.sleepFollowupTime)) {
        throw ApiError.badRequest('Sleep follow-up time must be in HH:mm format');
      }
    }
    if (config.sleepFollowupEnabled !== undefined && config.sleepFollowupEnabled !== null) {
      if (typeof config.sleepFollowupEnabled !== 'boolean') {
        throw ApiError.badRequest('Sleep follow-up enabled must be a boolean value');
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
  // ── Operations Analytics Endpoint ────────────────────────────────────────

  async getOperationsAnalytics(req, res) {
    const { tenantId } = req.user;
    const period = req.query.period || '7d';

    const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
    const now = new Date();
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);

    try {
      // ── 1. Count jobs for current and previous windows ─────────────────
      const [
        currScheduled, currFailedDb, currCancelled,
        prevScheduled, prevFailedDb,
      ] = await Promise.all([
        prisma.reminderJob.count({ where: { tenantId, scheduledFor: { gte: currentStart, lt: now }, isArchived: false } }),
        prisma.reminderJob.count({ where: { tenantId, scheduledFor: { gte: currentStart, lt: now }, status: 'FAILED', isArchived: false } }),
        prisma.reminderJob.count({ where: { tenantId, scheduledFor: { gte: currentStart, lt: now }, status: 'CANCELLED', isArchived: false } }),
        prisma.reminderJob.count({ where: { tenantId, scheduledFor: { gte: previousStart, lt: currentStart }, isArchived: false } }),
        prisma.reminderJob.count({ where: { tenantId, scheduledFor: { gte: previousStart, lt: currentStart }, status: 'FAILED', isArchived: false } }),
      ]);

      // Find metaMessageIds of active reminder jobs sent in current window
      const currJobs = await prisma.reminderJob.findMany({
        where: {
          tenantId,
          scheduledFor: { gte: currentStart, lt: now },
          isArchived: false,
          status: 'SENT',
          sentMetaMessageId: { not: null },
        },
        select: { sentMetaMessageId: true },
      });
      const currMetaIds = currJobs.map((j) => j.sentMetaMessageId).filter(Boolean);

      const currMessages = currMetaIds.length > 0 ? await prisma.whatsAppMessage.findMany({
        where: {
          tenantId,
          metaMessageId: { in: currMetaIds },
        },
        select: { status: true },
      }) : [];

      let currSentOnly = 0;
      let currDeliveredOnly = 0;
      let currReadOnly = 0;
      let currFailedMessages = 0;
      for (const msg of currMessages) {
        if (msg.status === 'SENT') currSentOnly++;
        else if (msg.status === 'DELIVERED') currDeliveredOnly++;
        else if (msg.status === 'READ') currReadOnly++;
        else if (msg.status === 'FAILED') currFailedMessages++;
      }

      // Find metaMessageIds of active reminder jobs sent in previous window
      const prevJobs = await prisma.reminderJob.findMany({
        where: {
          tenantId,
          scheduledFor: { gte: previousStart, lt: currentStart },
          isArchived: false,
          status: 'SENT',
          sentMetaMessageId: { not: null },
        },
        select: { sentMetaMessageId: true },
      });
      const prevMetaIds = prevJobs.map((j) => j.sentMetaMessageId).filter(Boolean);

      const prevMessages = prevMetaIds.length > 0 ? await prisma.whatsAppMessage.findMany({
        where: {
          tenantId,
          metaMessageId: { in: prevMetaIds },
        },
        select: { status: true },
      }) : [];

      let prevSentOnly = 0;
      let prevDeliveredOnly = 0;
      let prevReadOnly = 0;
      let prevFailedMessages = 0;
      for (const msg of prevMessages) {
        if (msg.status === 'SENT') prevSentOnly++;
        else if (msg.status === 'DELIVERED') prevDeliveredOnly++;
        else if (msg.status === 'READ') prevReadOnly++;
        else if (msg.status === 'FAILED') prevFailedMessages++;
      }

      const currSent = currSentOnly + currDeliveredOnly + currReadOnly;
      const prevSent = prevSentOnly + prevDeliveredOnly + prevReadOnly;
      const currFailed = currFailedDb + currFailedMessages;
      const prevFailed = prevFailedDb + prevFailedMessages;

      // ── 2. Compliance events for current and previous windows ──────────
      const [currEvents, prevEvents] = await Promise.all([
        prisma.clientComplianceEvent.findMany({
          where: {
            tenantId,
            scheduledFor: { gte: currentStart, lt: now },
            reminderJob: { isArchived: false },
          },
          include: {
            reminderJob: { select: { jobType: true, timezone: true, templateId: true, templateVersion: true } },
            client: { select: { timezone: true, firstName: true, lastName: true, id: true } },
          },
        }),
        prisma.clientComplianceEvent.findMany({
          where: {
            tenantId,
            scheduledFor: { gte: previousStart, lt: currentStart },
            reminderJob: { isArchived: false },
          },
          select: { status: true, responseType: true },
        }),
      ]);

      // ── 3. Compliance daily summaries for health score ─────────────────
      const [currSummaries, prevSummaries] = await Promise.all([
        prisma.complianceDailySummary.findMany({
          where: { tenantId, date: { gte: currentStart, lt: now } },
          select: { overallCompliancePercent: true, clientId: true },
        }),
        prisma.complianceDailySummary.findMany({
          where: { tenantId, date: { gte: previousStart, lt: currentStart } },
          select: { overallCompliancePercent: true },
        }),
      ]);

      // ── 4. Compute health scores ───────────────────────────────────────
      const calcPct = (num, den) => den > 0 ? Math.round((num / den) * 100) : 0;
      const avgArr = (arr) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
      const calcTrend = (curr, prev) => {
        if (prev === null || prev === 0) return null;
        return parseFloat(((curr - prev) / prev * 100).toFixed(1));
      };

      const currFired = currSent + currFailed + currCancelled;
      const prevFired = prevSent + prevFailed; // approx

      const currResponded = currEvents.filter(e => e.status === 'COMPLETED' && e.responseType !== 'NO_RESPONSE').length;
      const currTotalCompleted = currEvents.filter(e => e.status === 'COMPLETED').length;
      const prevResponded = prevEvents.filter(e => e.status === 'COMPLETED' && e.responseType !== 'NO_RESPONSE').length;
      const prevTotalCompleted = prevEvents.filter(e => e.status === 'COMPLETED').length;

      const currComplianceAvg = avgArr(currSummaries.map(s => s.overallCompliancePercent));
      const prevComplianceAvg = avgArr(prevSummaries.map(s => s.overallCompliancePercent));

      const automationHealth = calcPct(currFired, currScheduled);
      const deliveryHealth = calcPct(currSent, currScheduled);
      const engagementRate = calcPct(currResponded, currTotalCompleted);
      const complianceHealth = currComplianceAvg;

      const prevAutomationHealth = calcPct(prevFired, prevScheduled);
      const prevDeliveryHealth = calcPct(prevSent, prevScheduled);
      const prevEngagementRate = calcPct(prevResponded, prevTotalCompleted);

      const healthScores = {
        automation: { value: automationHealth, trend: calcTrend(automationHealth, prevAutomationHealth), previous: prevAutomationHealth },
        delivery: { value: deliveryHealth, trend: calcTrend(deliveryHealth, prevDeliveryHealth), previous: prevDeliveryHealth },
        engagement: { value: engagementRate, trend: calcTrend(engagementRate, prevEngagementRate), previous: prevEngagementRate },
        compliance: { value: complianceHealth, trend: calcTrend(complianceHealth, prevComplianceAvg), previous: prevComplianceAvg },
      };

      // ── 5. Delivery Funnel ─────────────────────────────────────────────
      const currExpired = currEvents.filter(e => e.status === 'COMPLETED' && e.responseType === 'NO_RESPONSE').length;
      const deliveryFunnel = {
        queued: await prisma.reminderJob.count({ where: { tenantId, scheduledFor: { gte: currentStart, lt: now }, status: 'PENDING', isArchived: false } }),
        sent: currSent,
        delivered: currDeliveredOnly + currReadOnly,
        read: currReadOnly,
        responded: currResponded,
        expired: currExpired,
        failed: currFailed,
      };

      // ── 6. Engagement Intelligence (timezone-aware) ────────────────────
      const typeResponseCounts = {};
      const hourCounts = {};
      const dayCounts = {};
      let totalLatency = 0;
      let latencyCount = 0;

      for (const event of currEvents) {
        const jobType = event.reminderJob?.jobType;
        const timezone = event.client?.timezone || event.reminderJob?.timezone || 'UTC';

        if (!typeResponseCounts[jobType]) typeResponseCounts[jobType] = { responded: 0, total: 0 };
        typeResponseCounts[jobType].total++;
        if (event.status === 'COMPLETED' && event.responseType !== 'NO_RESPONSE') {
          typeResponseCounts[jobType].responded++;
        }

        // Timezone-aware hour and day from respondedAt
        if (event.respondedAt) {
          const localDt = utcToZonedTime(event.respondedAt, timezone);
          const hour = localDt.getHours();
          const dayName = formatTz(localDt, 'EEEE', { timeZone: timezone });
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
        }

        if (event.responseLatencySeconds !== null && event.responseLatencySeconds !== undefined) {
          totalLatency += event.responseLatencySeconds;
          latencyCount++;
        }
      }

      const sortedTypes = Object.entries(typeResponseCounts).sort((a, b) => {
        const rateA = a[1].total > 0 ? a[1].responded / a[1].total : 0;
        const rateB = b[1].total > 0 ? b[1].responded / b[1].total : 0;
        return rateB - rateA;
      });

      const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const dayEntries = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
      const avgResponseMinutes = latencyCount > 0 ? Math.round(totalLatency / latencyCount / 60) : null;

      const engagementInsights = {
        mostRespondedType: sortedTypes[0]?.[0] || null,
        mostIgnoredType: sortedTypes[sortedTypes.length - 1]?.[0] || null,
        peakResponseHour: peakHour !== undefined ? parseInt(peakHour) : null,
        avgResponseMinutes,
        bestPerformingDay: dayEntries[0]?.[0] || null,
        worstPerformingDay: dayEntries[dayEntries.length - 1]?.[0] || null,
        typeRates: Object.fromEntries(
          Object.entries(typeResponseCounts).map(([type, { responded, total }]) => [
            type,
            { responded, total, rate: calcPct(responded, total) },
          ])
        ),
      };

      // ── 7. Reminder Performance (per job type) ─────────────────────────
      const jobTypes = [
        'MEAL_REMINDER',
        'MEAL_FOLLOWUP',
        'WATER_REMINDER',
        'WATER_FOLLOWUP',
        'SLEEP_REMINDER',
        'SLEEP_FOLLOWUP',
      ];
      const reminderPerformance = {};

      for (const jt of jobTypes) {
        const typeEvents = currEvents.filter(e => e.reminderJob?.jobType === jt);
        
        // Use actual reminderJob count for behavioral reminders, compliance events for follow-ups
        const isCompliance = ['MEAL_FOLLOWUP', 'WATER_FOLLOWUP', 'SLEEP_FOLLOWUP'].includes(jt);
        const sent = isCompliance
          ? typeEvents.length
          : await prisma.reminderJob.count({
              where: {
                tenantId,
                jobType: jt,
                scheduledFor: { gte: currentStart, lt: now },
                isArchived: false,
                status: 'SENT',
              },
            });
        const responded = typeEvents.filter(e => e.status === 'COMPLETED' && e.responseType !== 'NO_RESPONSE').length;
        const expired = typeEvents.filter(e => e.status === 'COMPLETED' && e.responseType === 'NO_RESPONSE').length;

        // Query SENT jobs of this type whose message delivery failed
        const typeJobs = await prisma.reminderJob.findMany({
          where: {
            tenantId,
            jobType: jt,
            scheduledFor: { gte: currentStart, lt: now },
            isArchived: false,
            status: 'SENT',
            sentMetaMessageId: { not: null },
          },
          select: { sentMetaMessageId: true },
        });
        const typeMetaIds = typeJobs.map((j) => j.sentMetaMessageId).filter(Boolean);

        const typeMessages = typeMetaIds.length > 0 ? await prisma.whatsAppMessage.findMany({
          where: {
            tenantId,
            metaMessageId: { in: typeMetaIds },
          },
          select: { status: true },
        }) : [];

        let typeFailedMessages = 0;
        for (const msg of typeMessages) {
          if (msg.status === 'FAILED') typeFailedMessages++;
        }

        const failedDb = await prisma.reminderJob.count({
          where: { tenantId, jobType: jt, status: 'FAILED', scheduledFor: { gte: currentStart, lt: now }, isArchived: false },
        });
        const failed = failedDb + typeFailedMessages;

        let typeLatency = 0;
        let typeLatencyCount = 0;
        for (const e of typeEvents) {
          if (e.responseLatencySeconds) { typeLatency += e.responseLatencySeconds; typeLatencyCount++; }
        }

        reminderPerformance[jt] = {
          sent,
          responded,
          expired,
          failed,
          responseRate: calcPct(responded, sent),
          avgResponseMinutes: typeLatencyCount > 0 ? Math.round(typeLatency / typeLatencyCount / 60) : null,
        };
      }

      // ── 8. Attention Center Items ──────────────────────────────────────
      const attentionItems = [];

      // Critical: Failed jobs grouped by client
      const failedJobs = await prisma.reminderJob.findMany({
        where: { tenantId, status: 'FAILED', isArchived: false, scheduledFor: { gte: currentStart } },
        include: { client: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { scheduledFor: 'desc' },
        take: 20,
      });

      // Find SENT jobs whose message delivery failed
      const failedSentJobs = await prisma.reminderJob.findMany({
        where: {
          tenantId,
          status: 'SENT',
          isArchived: false,
          scheduledFor: { gte: currentStart },
          sentMetaMessageId: { not: null },
        },
        include: { client: { select: { id: true, firstName: true, lastName: true } } },
      });

      const failedSentMetaIds = failedSentJobs.map((j) => j.sentMetaMessageId).filter(Boolean);
      const failedMessages = failedSentMetaIds.length > 0 ? await prisma.whatsAppMessage.findMany({
        where: { tenantId, status: 'FAILED', metaMessageId: { in: failedSentMetaIds } },
        select: { metaMessageId: true },
      }) : [];
      const failedMetaSet = new Set(failedMessages.map((m) => m.metaMessageId));

      const actualFailedJobs = [
        ...failedJobs,
        ...failedSentJobs.filter((j) => failedMetaSet.has(j.sentMetaMessageId)),
      ].sort((a, b) => new Date(b.scheduledFor || b.createdAt).getTime() - new Date(a.scheduledFor || a.createdAt).getTime())
       .slice(0, 20);

      const failedByClient = new Map();
      for (const job of actualFailedJobs) {
        const key = job.clientId;
        if (!failedByClient.has(key)) {
          failedByClient.set(key, { client: job.client, jobs: [], jobType: job.jobType, time: job.scheduledFor || job.createdAt });
        }
        failedByClient.get(key).jobs.push(job.id);
      }
      for (const [, data] of failedByClient) {
        attentionItems.push({
          type: 'FAILED_DELIVERY',
          severity: 'critical',
          clientId: data.client.id,
          clientName: `${data.client.firstName} ${data.client.lastName}`,
          count: data.jobs.length,
          jobIds: data.jobs.slice(0, 5),
          jobType: data.jobType,
          description: `${data.jobs.length} reminder delivery failure${data.jobs.length > 1 ? 's' : ''}`,
          time: data.time,
        });
      }

      // Critical: Dead Letter Queue
      try {
        const dlqCount = await reminderDeadLetterQueue.getJobCountByTypes('completed', 'wait', 'active', 'delayed', 'failed').catch(() => 0);
        if (dlqCount > 0) {
          attentionItems.push({
            type: 'DEAD_LETTER_QUEUE',
            severity: 'critical',
            count: dlqCount,
            description: `${dlqCount} reminder${dlqCount > 1 ? 's' : ''} permanently failed (Dead Letter Queue)`,
            time: null,
          });
        }
      } catch (_) {}

      // Warning: NO_RESPONSE streaks (≥3 consecutive days per client)
      const recentEventsByClient = {};
      for (const event of currEvents) {
        const cid = event.clientId;
        if (!recentEventsByClient[cid]) {
          recentEventsByClient[cid] = {
            name: `${event.client?.firstName || ''} ${event.client?.lastName || ''}`.trim(),
            noResponse: 0,
            time: event.respondedAt || event.createdAt || null
          };
        }
        if (event.status === 'COMPLETED' && event.responseType === 'NO_RESPONSE') {
          recentEventsByClient[cid].noResponse++;
        }
      }
      for (const [clientId, data] of Object.entries(recentEventsByClient)) {
        if (data.noResponse >= 5) {
          attentionItems.push({
            type: 'NO_RESPONSE_STREAK',
            severity: 'critical',
            clientId,
            clientName: data.name,
            count: data.noResponse,
            description: `${data.noResponse} unanswered reminders`,
            time: data.time,
          });
        } else if (data.noResponse >= 3) {
          attentionItems.push({
            type: 'NO_RESPONSE_STREAK',
            severity: 'warning',
            clientId,
            clientName: data.name,
            count: data.noResponse,
            description: `${data.noResponse} unanswered reminders`,
            time: data.time,
          });
        }
      }

      // Warning: High response latency (avg > 120 min)
      const latencyByClient = {};
      for (const event of currEvents) {
        if (event.responseLatencySeconds && event.clientId) {
          if (!latencyByClient[event.clientId]) {
            latencyByClient[event.clientId] = {
              name: `${event.client?.firstName || ''} ${event.client?.lastName || ''}`.trim(),
              total: 0,
              count: 0,
              time: event.respondedAt || event.createdAt || null
            };
          }
          latencyByClient[event.clientId].total += event.responseLatencySeconds;
          latencyByClient[event.clientId].count++;
        }
      }
      for (const [clientId, data] of Object.entries(latencyByClient)) {
        const avgMin = Math.round(data.total / data.count / 60);
        if (avgMin > 120) {
          attentionItems.push({
            type: 'HIGH_LATENCY',
            severity: 'warning',
            clientId,
            clientName: data.name,
            avgLatencyMinutes: avgMin,
            description: `Average response time: ${avgMin} min`,
            time: data.time,
          });
        }
      }

      // Info: Pending jobs older than 2 hours
      const stalePendingCount = await prisma.reminderJob.count({
        where: { tenantId, status: 'PENDING', isArchived: false, scheduledFor: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
      });
      if (stalePendingCount > 0) {
        const oldestStaleJob = await prisma.reminderJob.findFirst({
          where: { tenantId, status: 'PENDING', isArchived: false, scheduledFor: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
          orderBy: { scheduledFor: 'asc' },
          select: { scheduledFor: true },
        });
        attentionItems.push({
          type: 'STALE_PENDING',
          severity: 'info',
          count: stalePendingCount,
          description: `${stalePendingCount} pending reminder${stalePendingCount > 1 ? 's' : ''} overdue by >2 hours`,
          time: oldestStaleJob?.scheduledFor || null,
        });
      }

      // Sort: critical → warning → info
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      attentionItems.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

      // ── 9. Client Intelligence ─────────────────────────────────────────
      const clientSummaries = {};
      for (const event of currEvents) {
        const cid = event.clientId;
        if (!clientSummaries[cid]) {
          clientSummaries[cid] = {
            clientId: cid,
            name: `${event.client?.firstName || ''} ${event.client?.lastName || ''}`.trim(),
            responded: 0,
            total: 0,
          };
        }
        clientSummaries[cid].total++;
        if (event.status === 'COMPLETED' && event.responseType !== 'NO_RESPONSE') {
          clientSummaries[cid].responded++;
        }
      }

      const clientList = Object.values(clientSummaries).map(c => ({
        ...c,
        responseRate: calcPct(c.responded, c.total),
      }));

      // Top Responders: highest response rate, min 3 events
      const topResponders = clientList
        .filter(c => c.total >= 3)
        .sort((a, b) => b.responseRate - a.responseRate)
        .slice(0, 5)
        .map(c => ({ clientId: c.clientId, name: c.name, responseRate: c.responseRate, responded: c.responded, total: c.total }));

      // At-Risk: low compliance (<50% response rate), min 3 events
      const atRiskClients = clientList
        .filter(c => c.total >= 3 && c.responseRate < 50)
        .sort((a, b) => a.responseRate - b.responseRate)
        .slice(0, 5)
        .map(c => ({ clientId: c.clientId, name: c.name, responseRate: c.responseRate, responded: c.responded, total: c.total }));

      // Inactive: no events in current period
      const activeClientIds = new Set(currEvents.map(e => e.clientId));
      const allClientsWithAutomation = await prisma.client.findMany({
        where: {
          tenantId,
          dietPlanAutomations: { some: { status: 'ACTIVE' } },
        },
        select: { id: true, firstName: true, lastName: true },
      });
      const inactiveClients = allClientsWithAutomation
        .filter(c => !activeClientIds.has(c.id))
        .slice(0, 5)
        .map(c => ({ clientId: c.id, name: `${c.firstName} ${c.lastName}` }));

      // Most Improved: compare current vs previous period response rate
      const prevClientSummaries = {};
      for (const event of prevEvents) {
        // prevEvents only has status/responseType (no client data)
      }
      // Simplified: compute improvement from daily summaries
      const prevSummaryByClient = {};
      const prevSummaryRows = await prisma.complianceDailySummary.findMany({
        where: { tenantId, date: { gte: previousStart, lt: currentStart } },
        select: { clientId: true, overallCompliancePercent: true },
      });
      for (const s of prevSummaryRows) {
        if (!prevSummaryByClient[s.clientId]) prevSummaryByClient[s.clientId] = [];
        prevSummaryByClient[s.clientId].push(s.overallCompliancePercent);
      }

      const currSummaryByClient = {};
      for (const s of currSummaries) {
        if (!currSummaryByClient[s.clientId]) currSummaryByClient[s.clientId] = [];
        currSummaryByClient[s.clientId].push(s.overallCompliancePercent);
      }

      const improvementList = [];
      for (const [cid, currRates] of Object.entries(currSummaryByClient)) {
        const prevRates = prevSummaryByClient[cid];
        if (!prevRates || prevRates.length < 3 || currRates.length < 3) continue;
        const currAvg = currRates.reduce((a, b) => a + b, 0) / currRates.length;
        const prevAvg = prevRates.reduce((a, b) => a + b, 0) / prevRates.length;
        const delta = currAvg - prevAvg;
        if (delta > 0) {
          const clientInfo = allClientsWithAutomation.find(c => c.id === cid);
          if (clientInfo) {
            improvementList.push({ clientId: cid, name: `${clientInfo.firstName} ${clientInfo.lastName}`, delta: Math.round(delta), currAvg: Math.round(currAvg) });
          }
        }
      }
      const mostImprovedClients = improvementList.sort((a, b) => b.delta - a.delta).slice(0, 5);

      const clientIntelligence = { topResponders, atRiskClients, inactiveClients, mostImprovedClients };

      // ── 10. Empty state signals ────────────────────────────────────────
      const hasAutomation = await prisma.dietPlanAutomation.count({ where: { tenantId, status: 'ACTIVE' } });
      const hasJobs = await prisma.reminderJob.count({ where: { tenantId, isArchived: false } });
      const hasCompliance = currEvents.length > 0;

      let emptyState = null;
      if (hasAutomation === 0) emptyState = 'NO_AUTOMATION';
      else if (hasJobs === 0) emptyState = 'NO_JOBS';
      else if (!hasCompliance) emptyState = 'NO_COMPLIANCE';

      // ── 11. Cleanup Impact Metrics ─────────────────────────────────────
      const getStatusImpact = async (status) => {
        const whereClause = { tenantId, status, isArchived: false };
        const [recordsCount, clientsGroup, typesGroup] = await Promise.all([
          prisma.reminderJob.count({ where: whereClause }),
          prisma.reminderJob.groupBy({
            by: ['clientId'],
            where: whereClause,
          }),
          prisma.reminderJob.groupBy({
            by: ['jobType'],
            where: whereClause,
          }),
        ]);

        const impact = {
          records: recordsCount,
          clients: clientsGroup.length,
          types: typesGroup.length,
        };

        if (status === 'PENDING') {
          impact.futureDeliveries = recordsCount;
        }

        return impact;
      };

      const [pendingImpact, failedImpact, cancelledImpact, sentImpact] = await Promise.all([
        getStatusImpact('PENDING'),
        getStatusImpact('FAILED'),
        getStatusImpact('CANCELLED'),
        getStatusImpact('SENT'),
      ]);

      const cleanupImpact = {
        pending: pendingImpact,
        failed: failedImpact,
        cancelled: cancelledImpact,
        sent: sentImpact,
      };

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          period,
          emptyState,
          healthScores,
          deliveryFunnel,
          engagementInsights,
          reminderPerformance,
          attentionItems,
          clientIntelligence,
          cleanupImpact,
        },
      });
    } catch (err) {
      logger.error(`[ANALYTICS] getOperationsAnalytics failed: ${err.message}`);
      throw err;
    }
  },
};

export default automationController;
