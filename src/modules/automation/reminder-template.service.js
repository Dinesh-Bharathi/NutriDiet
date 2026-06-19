// src/modules/automation/reminder-template.service.js

import prisma from '../../lib/prisma.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';
import { validateTemplateText, automationTemplateRegistry } from './automation-template-variables.js';
import { reminderQueue } from './reminder-queue.js';

export const reminderTemplateService = {
  /**
   * Seeds global system defaults if they do not exist.
   */
  async seedSystemTemplates() {
    const count = await prisma.reminderTemplate.count({
      where: { tenantId: null, isDefault: true },
    });
    if (count > 0) return;

    logger.info('[AUTOMATION] Seeding global system defaults...');
    await prisma.reminderTemplate.createMany({
      data: [
        {
          tenantId: null,
          name: 'System Default Meal Reminder',
          type: 'MEAL_REMINDER',
          title: '🍽️ {{meal_name}} Reminder',
          message: 'Hi {{client_name}},\n\nYour {{meal_name}} is scheduled in 5 minutes.\n\nStay consistent 💪',
          isDefault: true,
          isActive: true,
          version: 1,
        },
        {
          tenantId: null,
          name: 'System Default Meal Follow-Up',
          type: 'MEAL_FOLLOWUP',
          title: 'How was your {{meal_name}}?',
          message: 'How was your {{meal_name}}?\n\nWe\'ll ask for your response shortly.',
          isDefault: true,
          isActive: true,
          version: 1,
        },
        {
          tenantId: null,
          name: 'System Default Water Reminder',
          type: 'WATER_REMINDER',
          title: '💧 Water Intake Reminder',
          message: '💧 Water Intake Reminder\n\nRemember to stay hydrated.',
          isDefault: true,
          isActive: true,
          version: 1,
        },
        {
          tenantId: null,
          name: 'System Default Sleep Reminder',
          type: 'SLEEP_REMINDER',
          title: '😴 Sleep Tracking Reminder',
          message: '😴 Sleep Tracking Reminder\n\nHow many hours did you sleep yesterday?',
          isDefault: true,
          isActive: true,
          version: 1,
        },
      ],
    });
  },

  /**
   * Lists all templates available to a tenant (both system defaults and tenant customized).
   *
   * @param {string} tenantId
   * @returns {Promise<Array>}
   */
  async getTemplates(tenantId) {
    await this.seedSystemTemplates();

    return prisma.reminderTemplate.findMany({
      where: {
        OR: [
          { tenantId },
          { tenantId: null },
        ],
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  },

  /**
   * Retrieves a single template by ID.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getTemplateById(tenantId, id) {
    const template = await prisma.reminderTemplate.findFirst({
      where: {
        id,
        OR: [
          { tenantId },
          { tenantId: null },
        ],
      },
    });

    if (!template) {
      throw ApiError.notFound('Reminder Template not found');
    }

    return template;
  },

  /**
   * Creates a custom template for a tenant.
   *
   * @param {string} tenantId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createTemplate(tenantId, data) {
    validateTemplateText(data.title);
    validateTemplateText(data.message);

    // Enforce tenant boundary
    return prisma.reminderTemplate.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type,
        title: data.title,
        message: data.message,
        buttons: data.buttons || null,
        isDefault: false,
        isActive: data.isActive !== undefined ? data.isActive : true,
        version: 1,
      },
    });
  },

  /**
   * Updates an existing custom template. System templates cannot be modified directly.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async updateTemplate(tenantId, id, data) {
    const template = await prisma.reminderTemplate.findUnique({ where: { id } });

    if (!template || (template.tenantId && template.tenantId !== tenantId)) {
      throw ApiError.notFound('Reminder Template not found');
    }

    if (template.tenantId === null || template.isDefault) {
      throw ApiError.badRequest('System default templates are read-only and cannot be modified directly.');
    }

    validateTemplateText(data.title);
    validateTemplateText(data.message);

    const updated = await prisma.reminderTemplate.update({
      where: { id },
      data: {
        name: data.name,
        title: data.title,
        message: data.message,
        buttons: data.buttons || null,
        isActive: data.isActive !== undefined ? data.isActive : template.isActive,
        version: { increment: 1 },
      },
    });

    // Propagate changes to future pending reminder jobs
    await this.propagateTemplateChanges(tenantId, updated.type);

    return updated;
  },

  /**
   * Deletes a custom template. System templates cannot be deleted.
   *
   * @param {string} tenantId
   * @param {string} id
   */
  async deleteTemplate(tenantId, id) {
    const template = await prisma.reminderTemplate.findUnique({ where: { id } });

    if (!template || (template.tenantId && template.tenantId !== tenantId)) {
      throw ApiError.notFound('Reminder Template not found');
    }

    if (template.tenantId === null || template.isDefault) {
      throw ApiError.badRequest('System default templates cannot be deleted.');
    }

    await prisma.reminderTemplate.delete({
      where: { id },
    });
  },

  /**
   * Clones a template (default or custom) into the tenant context.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async cloneTemplate(tenantId, id) {
    const template = await this.getTemplateById(tenantId, id);

    // Create a new customized version
    const clone = await prisma.$transaction(async (tx) => {
      // Deactivate other custom templates of the same type for this tenant
      await tx.reminderTemplate.updateMany({
        where: {
          tenantId,
          type: template.type,
          isDefault: false,
        },
        data: { isActive: false },
      });

      // Clone
      return tx.reminderTemplate.create({
        data: {
          tenantId,
          name: `Copy of ${template.name}`,
          type: template.type,
          title: template.title,
          message: template.message,
          buttons: template.buttons || null,
          isDefault: false,
          isActive: true,
          version: 1,
        },
      });
    });

    // Propagate changes to future pending reminder jobs
    await this.propagateTemplateChanges(tenantId, clone.type);

    return clone;
  },

  /**
   * Restores system default template by deactivating all custom overrides of that type.
   *
   * @param {string} tenantId
   * @param {string} type - ReminderTemplateType
   * @returns {Promise<void>}
   */
  async restoreDefault(tenantId, type) {
    logger.info(`[AUTOMATION] Restoring system default template for type: ${type} on tenant: ${tenantId}`);
    
    await prisma.reminderTemplate.updateMany({
      where: {
        tenantId,
        type,
        isDefault: false,
      },
      data: { isActive: false },
    });

    // Propagate changes to future pending reminder jobs
    await this.propagateTemplateChanges(tenantId, type);
  },

  /**
   * Propagates template changes to all future pending reminder jobs of that type.
   * Updates compiled snapshots in the database and updates BullMQ delayed payloads.
   *
   * @param {string} tenantId
   * @param {string} templateType - ReminderTemplateType
   */
  async propagateTemplateChanges(tenantId, templateType) {
    logger.info(`[AUTOMATION] Propagating template changes for type: ${templateType} on tenant: ${tenantId}`);

    // 1. Fetch currently active template of this type
    const templates = await prisma.reminderTemplate.findMany({
      where: {
        OR: [
          { tenantId, isActive: true },
          { tenantId: null, isDefault: true, isActive: true },
        ],
      },
    });

    const activeTemplate = templates.find(t => t.type === templateType && t.tenantId === tenantId) ||
                           templates.find(t => t.type === templateType && t.tenantId === null);

    if (!activeTemplate) {
      logger.warn(`[AUTOMATION] No active template found for type ${templateType}. Propagation skipped.`);
      return;
    }

    // 2. Fetch all future pending jobs of this type
    const futurePendingJobs = await prisma.reminderJob.findMany({
      where: {
        tenantId,
        jobType: templateType,
        status: 'PENDING',
        scheduledFor: { gt: new Date() },
      },
      include: {
        client: {
          include: { dietitian: true },
        },
        tenant: true,
        dietPlan: {
          include: {
            meals: {
              include: { items: true }
            },
          },
        },
      },
    });

    if (futurePendingJobs.length === 0) {
      logger.info(`[AUTOMATION] No future pending jobs found for type ${templateType}. Propagation skipped.`);
      return;
    }

    logger.info(`[AUTOMATION] Found ${futurePendingJobs.length} future pending jobs to propagate for type ${templateType}.`);

    for (const job of futurePendingJobs) {
      try {
        const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
        let mealObj = null;

        if (payload.mealId) {
          // Resolve meal from diet plan
          const resolvedMeal = job.dietPlan?.meals?.find(m => m.id === payload.mealId);
          if (resolvedMeal) {
            mealObj = {
              name: resolvedMeal.name.charAt(0).toUpperCase() + resolvedMeal.name.slice(1).toLowerCase().replace('_', ' '),
              mealTime: resolvedMeal.mealTime,
            };
          }
        }

        const context = {
          client: job.client,
          tenant: job.tenant,
          dietPlan: job.dietPlan,
          meal: mealObj,
        };

        const compiledTitle = automationTemplateRegistry.compile(activeTemplate.title, context);
        const compiledMessage = automationTemplateRegistry.compile(activeTemplate.message, context);

        // Update DB
        await prisma.reminderJob.update({
          where: { id: job.id },
          data: {
            templateId: activeTemplate.id,
            templateVersion: activeTemplate.version,
            compiledTitle,
            compiledMessage,
          },
        });

        // Update BullMQ Delayed Job Payload
        const qJob = await reminderQueue.getJob(job.id);
        if (qJob) {
          await qJob.updateData({
            jobId: job.id,
            templateVersion: activeTemplate.version,
          });
        }
      } catch (err) {
        logger.error(`[REMINDER_FAILURE] Failed to propagate template change for job ${job.id}: ${err.message}`);
      }
    }

    logger.info(`[AUTOMATION] Completed template propagation for type: ${templateType}`);
  }
};

export default reminderTemplateService;
