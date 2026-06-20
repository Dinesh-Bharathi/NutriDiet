// src/modules/automation/reminder-template.service.js

import prisma from "../../lib/prisma.js";
import ApiError from "../../utils/ApiError.js";
import logger from "../../utils/logger.js";
import {
  validateTemplateText,
  automationTemplateRegistry,
} from "./automation-template-variables.js";
import { reminderQueue } from "./reminder-queue.js";
import { reminderProducer } from "./reminder-producer.js";
import { reminderGeneratorService } from "./reminder-generator.service.js";

export const reminderTemplateService = {
  /**
   * Seeds global system defaults if they do not exist.
   */
  async seedSystemTemplates() {
    const defaults = [
      {
        tenantId: null,
        name: "Default Meal Reminder",
        type: "MEAL_REMINDER",
        title: "🍽️ Time for {{meal_name}}",
        message:
          "Hi {{client_name}},\n\nYour {{meal_name}} is scheduled in 5 minutes.\n\n📋 Today's {{meal_name}}\n\n{{meal_summary}}\n\n⏰ Scheduled Time:\n{{meal_time}}\n\n— {{clinic_name}}",
        buttons: [],
        templateButtons: [],
        buttonVersion: 1,
        isDefault: true,
        isActive: true,
        version: 1,
      },
      {
        tenantId: null,
        name: "Default Meal Follow-Up",
        type: "MEAL_FOLLOWUP",
        title: "👋 Quick Check-In",
        message:
          "Did you complete your {{meal_name}}?\n\n📋 Meal\n\n{{meal_summary}}\n\n⏰ Scheduled:\n{{meal_time}}\n\nYour response helps us track your adherence.\n\n— {{clinic_name}}",
        buttons: [],
        templateButtons: [],
        buttonVersion: 1,
        isDefault: true,
        isActive: true,
        version: 1,
      },
      {
        tenantId: null,
        name: "Default Water Reminder",
        type: "WATER_REMINDER",
        title: "💧 Hydration Reminder",
        message:
          "Hi {{client_name}},\n\nRemember to keep working toward today's hydration goal.\n\nDaily Target:\n{{water_target_ml}} mL\n\nSmall sips throughout the day make a big difference.",
        buttons: [],
        templateButtons: [],
        buttonVersion: 1,
        isDefault: true,
        isActive: true,
        version: 1,
      },
      {
        tenantId: null,
        name: "Default Water Follow-Up",
        type: "WATER_FOLLOWUP",
        title: "💧 Daily Hydration Check",
        message: "Hi {{client_name}},\n\nHow much water did you drink today?",
        buttons: [
          { id: "v1_water_lt1", text: "🥤 Less than 1L" },
          { id: "v1_water_1_2", text: "💧 1–2L" },
          { id: "v1_water_2_3", text: "🚰 2–3L" },
          { id: "v1_water_gt3", text: "🌊 3L+" },
        ],
        templateButtons: [
          { id: "v1_water_lt1", text: "🥤 Less than 1L" },
          { id: "v1_water_1_2", text: "💧 1–2L" },
          { id: "v1_water_2_3", text: "🚰 2–3L" },
          { id: "v1_water_gt3", text: "🌊 3L+" },
        ],
        buttonVersion: 1,
        isDefault: true,
        isActive: true,
        version: 1,
      },
      {
        tenantId: null,
        name: "Default Sleep Reminder",
        type: "SLEEP_REMINDER",
        title: "😴 Sleep Reminder",
        message:
          "Hi {{client_name}},\n\nIt's time to prepare for sleep.\n\nQuality sleep supports recovery, metabolism, and long-term nutrition adherence.\n\nGood night 🌙",
        buttons: [],
        templateButtons: [],
        buttonVersion: 1,
        isDefault: true,
        isActive: true,
        version: 1,
      },
      {
        tenantId: null,
        name: "Default Sleep Follow-Up",
        type: "SLEEP_FOLLOWUP",
        title: "🌅 Morning Sleep Check-In",
        message:
          "Hi {{client_name}},\n\nHow many hours did you sleep last night?",
        buttons: [
          { id: "v1_sleep_lt5", text: "😪 Less than 5 hrs" },
          { id: "v1_sleep_5_6", text: "🙂 5–7 hrs" },
          { id: "v1_sleep_7_8", text: "😃 7–9 hrs" },
          { id: "v1_sleep_gt8", text: "💪 9+ hrs" },
        ],
        templateButtons: [
          { id: "v1_sleep_lt5", text: "😪 Less than 5 hrs" },
          { id: "v1_sleep_5_6", text: "🙂 5–7 hrs" },
          { id: "v1_sleep_7_8", text: "😃 7–9 hrs" },
          { id: "v1_sleep_gt8", text: "💪 9+ hrs" },
        ],
        buttonVersion: 1,
        isDefault: true,
        isActive: true,
        version: 1,
      },
    ];

    logger.info("[AUTOMATION] Syncing global system defaults...");
    for (const data of defaults) {
      const existing = await prisma.reminderTemplate.findFirst({
        where: { tenantId: null, type: data.type, isDefault: true },
      });
      if (existing) {
        await prisma.reminderTemplate.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            title: data.title,
            message: data.message,
            buttons: data.buttons,
            templateButtons: data.templateButtons,
          },
        });
      } else {
        await prisma.reminderTemplate.create({
          data,
        });
      }
    }
  },

  /**
   * Lists all templates available to a tenant (both system defaults and tenant customized).
   *
   * @param {string} tenantId
   * @returns {Promise<Array>}
   */
  /**
   * Lists all templates available to a tenant (both system defaults and tenant customized) with pagination and filters.
   *
   * @param {string} tenantId
   * @param {object} filters - { page, limit, search, type, status }
   * @returns {Promise<object>} { templates, total, page, limit }
   */
  async getTemplates(tenantId, filters = {}) {
    await this.seedSystemTemplates();

    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 100;
    const skip = (page - 1) * limit;

    const where = {
      OR: [{ tenantId }, { tenantId: null }],
    };

    if (filters.type && filters.type !== "ALL") {
      where.type = filters.type;
    }

    if (filters.search) {
      where.name = {
        contains: filters.search,
        mode: "insensitive",
      };
    }

    if (filters.status) {
      if (filters.status === "ACTIVE") {
        where.isActive = true;
      } else if (filters.status === "INACTIVE") {
        where.isActive = false;
      } else if (filters.status === "SYSTEM") {
        where.isDefault = true;
      } else if (filters.status === "CLINIC") {
        where.isDefault = false;
      }
    }

    if (filters.source) {
      if (filters.source === "SYSTEM") {
        where.isDefault = true;
      } else if (filters.source === "CLINIC") {
        where.isDefault = false;
      }
    }

    const [templates, total] = await Promise.all([
      prisma.reminderTemplate.findMany({
        where,
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        skip,
        take: limit,
      }),
      prisma.reminderTemplate.count({ where }),
    ]);

    return {
      templates,
      total,
      page,
      limit,
    };
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
        OR: [{ tenantId }, { tenantId: null }],
      },
    });

    if (!template) {
      throw ApiError.notFound("Reminder Template not found");
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

    const templateButtons = data.templateButtons || data.buttons || null;
    const buttons = data.buttons || data.templateButtons || null;

    // Enforce tenant boundary
    return prisma.reminderTemplate.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type,
        title: data.title,
        message: data.message,
        buttons,
        templateButtons,
        buttonVersion: 1,
        isDefault: false,
        isActive: data.isActive !== undefined ? data.isActive : true,
        version: 1,
        config: data.config !== undefined ? data.config : null,
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
    const template = await prisma.reminderTemplate.findUnique({
      where: { id },
    });

    if (!template || (template.tenantId && template.tenantId !== tenantId)) {
      throw ApiError.notFound("Reminder Template not found");
    }

    if (template.tenantId === null || template.isDefault) {
      throw ApiError.badRequest(
        "System default templates are read-only and cannot be modified directly.",
      );
    }

    validateTemplateText(data.title);
    validateTemplateText(data.message);

    const templateButtons =
      data.templateButtons !== undefined
        ? data.templateButtons
        : data.buttons !== undefined
          ? data.buttons
          : template.templateButtons;
    const buttons =
      data.buttons !== undefined
        ? data.buttons
        : data.templateButtons !== undefined
          ? data.templateButtons
          : template.buttons;

    const buttonsChanged =
      JSON.stringify(buttons) !== JSON.stringify(template.buttons);
    const buttonVersion = buttonsChanged
      ? template.buttonVersion + 1
      : template.buttonVersion;

    const updated = await prisma.reminderTemplate.update({
      where: { id },
      data: {
        name: data.name,
        title: data.title,
        message: data.message,
        buttons,
        templateButtons,
        buttonVersion,
        isActive:
          data.isActive !== undefined ? data.isActive : template.isActive,
        version: { increment: 1 },
        config: data.config !== undefined ? data.config : template.config,
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
    const template = await prisma.reminderTemplate.findUnique({
      where: { id },
    });

    if (!template || (template.tenantId && template.tenantId !== tenantId)) {
      throw ApiError.notFound("Reminder Template not found");
    }

    if (template.tenantId === null || template.isDefault) {
      throw ApiError.badRequest("System default templates cannot be deleted.");
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
          templateButtons: template.templateButtons || template.buttons || null,
          buttonVersion: template.buttonVersion || 1,
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
    logger.info(
      `[AUTOMATION] Restoring system default template for type: ${type} on tenant: ${tenantId}`,
    );

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
    logger.info(
      `[AUTOMATION] Propagating template changes for type: ${templateType} on tenant: ${tenantId}`,
    );

    // 1. Fetch currently active template of this type
    const templates = await prisma.reminderTemplate.findMany({
      where: {
        OR: [
          { tenantId, isActive: true },
          { tenantId: null, isDefault: true, isActive: true },
        ],
      },
    });

    const activeTemplate =
      templates.find(
        (t) => t.type === templateType && t.tenantId === tenantId,
      ) ||
      templates.find((t) => t.type === templateType && t.tenantId === null);

    if (!activeTemplate) {
      logger.warn(
        `[AUTOMATION] No active template found for type ${templateType}. Propagation skipped.`,
      );
      return;
    }

    // 2. Fetch all future pending jobs of this type
    const futurePendingJobs = await prisma.reminderJob.findMany({
      where: {
        tenantId,
        jobType: templateType,
        status: "PENDING",
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
              include: { items: true },
            },
          },
        },
      },
    });

    if (futurePendingJobs.length === 0) {
      logger.info(
        `[AUTOMATION] No future pending jobs found for type ${templateType}. Propagation skipped.`,
      );
      return;
    }

    logger.info(
      `[AUTOMATION] Found ${futurePendingJobs.length} future pending jobs to propagate for type ${templateType}.`,
    );

    for (const job of futurePendingJobs) {
      try {
        const payload =
          job.payload && typeof job.payload === "object" ? job.payload : {};
        let mealObj = null;

        if (payload.mealId) {
          // Resolve meal from diet plan
          const resolvedMeal = job.dietPlan?.meals?.find(
            (m) => m.id === payload.mealId,
          );
          if (resolvedMeal) {
            mealObj = {
              name:
                resolvedMeal.name.charAt(0).toUpperCase() +
                resolvedMeal.name.slice(1).toLowerCase().replace("_", " "),
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

        const compiledTitle = automationTemplateRegistry.compile(
          activeTemplate.title,
          context,
        );
        const compiledMessage = automationTemplateRegistry.compile(
          activeTemplate.message,
          context,
        );

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
        logger.error(
          `[REMINDER_FAILURE] Failed to propagate template change for job ${job.id}: ${err.message}`,
        );
      }
    }

    logger.info(
      `[AUTOMATION] Completed template propagation for type: ${templateType}`,
    );
  },

  /**
   * Calculates the impact of disabling a specific reminder template.
   * Returns counts of affected pending reminder jobs and active client sessions.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getTemplateDisableImpact(tenantId, id) {
    const template = await this.getTemplateById(tenantId, id);

    // Count pending, future reminders using this template
    const pendingRemindersCount = await prisma.reminderJob.count({
      where: {
        tenantId,
        templateId: template.id,
        status: "PENDING",
        scheduledFor: { gt: new Date() },
        isArchived: false,
      },
    });

    let automationWhere = {
      tenantId,
      status: "ACTIVE",
    };
    if (
      template.type === "WATER_REMINDER" ||
      template.type === "WATER_FOLLOWUP"
    ) {
      automationWhere.waterEnabled = true;
    } else if (
      template.type === "SLEEP_REMINDER" ||
      template.type === "SLEEP_FOLLOWUP"
    ) {
      automationWhere.sleepEnabled = true;
    }

    const affectedAutomations = await prisma.dietPlanAutomation.findMany({
      where: automationWhere,
      select: { clientId: true },
    });

    const activeClientsCount = new Set(
      affectedAutomations.map((a) => a.clientId),
    ).size;

    return {
      pendingRemindersCount,
      activeClientsCount,
      affectedAutomationsCount: affectedAutomations.length,
    };
  },

  /**
   * Toggles a template's active state.
   * On deactivation, cancels and archives future pending reminders.
   * On activation, deactivates other overrides of same type and regenerates future jobs.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {boolean} isActive
   * @returns {Promise<object>}
   */
  async toggleTemplateActive(tenantId, id, isActive) {
    const template = await this.getTemplateById(tenantId, id);

    if (template.tenantId === null || template.isDefault) {
      throw ApiError.badRequest(
        "System default templates cannot be disabled or activated manually.",
      );
    }

    if (!isActive) {
      // 1. Deactivate template
      const updated = await prisma.reminderTemplate.update({
        where: { id },
        data: { isActive: false },
      });

      // 2. Fetch pending future jobs using this template
      const pendingJobs = await prisma.reminderJob.findMany({
        where: {
          tenantId,
          templateId: id,
          status: "PENDING",
          scheduledFor: { gt: new Date() },
          isArchived: false,
        },
        select: { id: true, queueJobId: true },
      });

      if (pendingJobs.length > 0) {
        // 3. Mark them as CANCELLED and isArchived
        await prisma.reminderJob.updateMany({
          where: { id: { in: pendingJobs.map((j) => j.id) } },
          data: {
            status: "CANCELLED",
            isArchived: true,
            errorText: "Cancelled due to template deactivation",
          },
        });

        // 4. Cancel BullMQ jobs
        for (const job of pendingJobs) {
          if (job.queueJobId) {
            await reminderProducer.cancelJob(job.queueJobId);
          }
        }
      }

      return updated;
    } else {
      // Activation: Deactivate other custom templates and activate this one
      const updated = await prisma.$transaction(async (tx) => {
        await tx.reminderTemplate.updateMany({
          where: {
            tenantId,
            type: template.type,
            isDefault: false,
          },
          data: { isActive: false },
        });

        return tx.reminderTemplate.update({
          where: { id },
          data: { isActive: true },
        });
      });

      // Fetch affected active automations
      let automationWhere = {
        tenantId,
        status: "ACTIVE",
      };
      if (
        template.type === "WATER_REMINDER" ||
        template.type === "WATER_FOLLOWUP"
      ) {
        automationWhere.waterEnabled = true;
      } else if (
        template.type === "SLEEP_REMINDER" ||
        template.type === "SLEEP_FOLLOWUP"
      ) {
        automationWhere.sleepEnabled = true;
      }

      const affectedAutomations = await prisma.dietPlanAutomation.findMany({
        where: automationWhere,
        select: { id: true },
      });

      // Regenerate future reminders for these sessions
      for (const aut of affectedAutomations) {
        await reminderGeneratorService.generateJobs(tenantId, aut.id);
      }

      return updated;
    }
  },
};

export default reminderTemplateService;
