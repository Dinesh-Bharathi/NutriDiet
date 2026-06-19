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
    const templates = await reminderTemplateService.getTemplates(tenantId);
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: templates,
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
    };

    try {
      const [waiting, active, delayed, failed, completed, dlqCount] = await Promise.all([
        reminderQueue.getWaitingCount(),
        reminderQueue.getActiveCount(),
        reminderQueue.getDelayedCount(),
        reminderQueue.getFailedCount(),
        reminderQueue.getCompletedCount(),
        reminderDeadLetterQueue.getJobCountByTypes('completed', 'wait', 'active', 'delayed', 'failed'),
      ]);

      queueMetrics = {
        waiting,
        active,
        delayed,
        failed,
        completed,
        deadLetter: dlqCount,
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
};

export default automationController;
