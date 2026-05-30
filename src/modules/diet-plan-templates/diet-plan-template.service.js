// src/modules/diet-plan-templates/diet-plan-template.service.js
// Business rules and operations for Diet Plan Templates, meals, and items.
import { dietPlanTemplateRepository } from './diet-plan-template.repository.js';
import { dietPlanRepository } from '../diet-plans/diet-plan.repository.js';
import { clientRepository } from '../clients/client.repository.js';
import ApiError from '../../utils/ApiError.js';

// Helper to validate active plan collision
async function checkActivePlanCollision(tenantId, clientId, planId, startDate, endDate) {
  const activePlans = await dietPlanRepository.findActivePlans(tenantId, clientId, planId);

  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : null;

  for (const other of activePlans) {
    const otherStart = other.startDate ? new Date(other.startDate) : new Date(other.createdAt);
    const otherEnd = other.endDate ? new Date(other.endDate) : null;

    const overlaps = (start <= otherEnd || otherEnd === null) && (otherStart <= end || end === null);
    if (overlaps) {
      throw ApiError.badRequest('An active plan already exists for this client with overlapping dates');
    }
  }
}

export const dietPlanTemplateService = {
  // ─── Template CRUD Services ────────────────────────────────────────────────
  async createTemplate(tenantId, creatorId, data) {
    return dietPlanTemplateRepository.create(tenantId, creatorId, data);
  },

  async getTemplateById(tenantId, id) {
    const template = await dietPlanTemplateRepository.findById(tenantId, id);
    if (!template) {
      throw ApiError.notFound('Diet Plan Template');
    }
    return template;
  },

  async getTemplates(tenantId, pagination) {
    const [templates, total] = await dietPlanTemplateRepository.findManyAndCount(
      tenantId,
      pagination
    );

    return {
      templates,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  },

  async updateTemplate(tenantId, id, data) {
    const existing = await dietPlanTemplateRepository.findById(tenantId, id);
    if (!existing) {
      throw ApiError.notFound('Diet Plan Template');
    }

    return dietPlanTemplateRepository.update(id, data);
  },

  async deleteTemplate(tenantId, id) {
    const affectedCount = await dietPlanTemplateRepository.softDelete(tenantId, id);
    if (affectedCount === 0) {
      throw ApiError.notFound('Diet Plan Template');
    }
  },

  // ─── Template Meal Services ────────────────────────────────────────────────
  async createMeal(tenantId, templateId, data) {
    const template = await dietPlanTemplateRepository.findById(tenantId, templateId);
    if (!template) {
      throw ApiError.notFound('Diet Plan Template');
    }

    return dietPlanTemplateRepository.createMeal(templateId, data);
  },

  async updateMeal(tenantId, mealId, data) {
    const meal = await dietPlanTemplateRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Template Meal');
    }

    return dietPlanTemplateRepository.updateMeal(mealId, data);
  },

  async deleteMeal(tenantId, mealId) {
    const meal = await dietPlanTemplateRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Template Meal');
    }

    await dietPlanTemplateRepository.deleteMeal(mealId);
  },

  // ─── Template Meal Item Services ───────────────────────────────────────────
  async createMealItem(tenantId, mealId, data) {
    const meal = await dietPlanTemplateRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Template Meal');
    }

    const item = await dietPlanTemplateRepository.createMealItem(mealId, data);

    // Auto-aggregate
    await dietPlanTemplateRepository.recalculateTemplateNutrition(meal.templateId);

    return item;
  },

  async updateMealItem(tenantId, itemId, data) {
    const item = await dietPlanTemplateRepository.findMealItemById(tenantId, itemId);
    if (!item) {
      throw ApiError.notFound('Template Meal Item');
    }

    const updated = await dietPlanTemplateRepository.updateMealItem(itemId, data);

    // Auto-aggregate
    await dietPlanTemplateRepository.recalculateTemplateNutrition(item.meal.templateId);

    return updated;
  },

  async deleteMealItem(tenantId, itemId) {
    const item = await dietPlanTemplateRepository.findMealItemById(tenantId, itemId);
    if (!item) {
      throw ApiError.notFound('Template Meal Item');
    }

    await dietPlanTemplateRepository.deleteMealItem(itemId);

    // Auto-aggregate
    await dietPlanTemplateRepository.recalculateTemplateNutrition(item.meal.templateId);
  },

  // ─── Clone / Apply Services ────────────────────────────────────────────────
  async createTemplateFromPlan(tenantId, planId, creatorId, templateData) {
    const plan = await dietPlanRepository.findById(tenantId, planId);
    if (!plan) {
      throw ApiError.notFound('Diet Plan');
    }

    const template = await dietPlanTemplateRepository.create(tenantId, creatorId, {
      title: templateData.title,
      description: templateData.description || plan.description,
      goal: plan.goal,
      dailyCalories: plan.dailyCalories,
      proteinGrams: plan.proteinGrams,
      carbGrams: plan.carbGrams,
      fatGrams: plan.fatGrams,
      totalCalories: plan.totalCalories,
      totalProtein: plan.totalProtein,
      totalCarbs: plan.totalCarbs,
      totalFat: plan.totalFat,
      isPublic: templateData.isPublic || false,
    });

    // Copy meals and meal items
    for (const meal of plan.meals) {
      const clonedMeal = await dietPlanTemplateRepository.createMeal(template.id, {
        name: meal.name,
        mealOrder: meal.mealOrder,
        mealTime: meal.mealTime,
        notes: meal.notes,
      });

      for (const item of meal.items) {
        await dietPlanTemplateRepository.createMealItem(clonedMeal.id, {
          foodName: item.foodName,
          quantity: item.quantity,
          unit: item.unit,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          notes: item.notes,
        });
      }
    }

    await dietPlanTemplateRepository.recalculateTemplateNutrition(template.id);

    return dietPlanTemplateRepository.findById(tenantId, template.id);
  },

  async applyTemplateToClient(tenantId, templateId, clientId, creatorId, details) {
    const template = await dietPlanTemplateRepository.findById(tenantId, templateId);
    if (!template) {
      throw ApiError.notFound('Diet Plan Template');
    }

    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    // Default status to DRAFT (safer, as requested)
    const status = details.status || 'DRAFT';

    if (status === 'ACTIVE') {
      await checkActivePlanCollision(tenantId, clientId, null, details.startDate, details.endDate);
    }

    // Create the plan
    const plan = await dietPlanRepository.create(tenantId, clientId, creatorId, {
      title: template.title,
      description: template.description,
      goal: template.goal,
      dailyCalories: template.dailyCalories,
      proteinGrams: template.proteinGrams,
      carbGrams: template.carbGrams,
      fatGrams: template.fatGrams,
      totalCalories: template.totalCalories,
      totalProtein: template.totalProtein,
      totalCarbs: template.totalCarbs,
      totalFat: template.totalFat,
      status,
      startDate: details.startDate || null,
      endDate: details.endDate || null,
      versionNumber: 1,
    });

    // Copy meals and items
    for (const meal of template.meals) {
      const clonedMeal = await dietPlanRepository.createMeal(plan.id, {
        name: meal.name,
        mealOrder: meal.mealOrder,
        mealTime: meal.mealTime,
        notes: meal.notes,
      });

      for (const item of meal.items) {
        await dietPlanRepository.createMealItem(clonedMeal.id, {
          foodName: item.foodName,
          quantity: item.quantity,
          unit: item.unit,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          notes: item.notes,
        });
      }
    }

    await dietPlanRepository.recalculatePlanNutrition(plan.id);

    return dietPlanRepository.findById(tenantId, plan.id);
  },
};
