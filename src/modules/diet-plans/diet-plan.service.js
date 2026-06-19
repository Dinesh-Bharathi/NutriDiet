// src/modules/diet-plans/diet-plan.service.js
// Business rules and operations for Diet Plans, Meals, and Meal Items.
import { dietPlanRepository } from './diet-plan.repository.js';
import { clientRepository } from '../clients/client.repository.js';
import { assessmentRepository } from '../assessments/assessment.repository.js';
import ApiError from '../../utils/ApiError.js';
import prisma from '../../lib/prisma.js';
import { clinicalProfileService } from '../assessments/clinical-profile.service.js';
import { automationService } from '../automation/automation.service.js';

// Helper to serialize diet plan schedule for change detection
function serializeDietPlanSchedule(plan) {
  if (!plan) return '';
  const start = plan.startDate ? new Date(plan.startDate).toISOString() : '';
  const end = plan.endDate ? new Date(plan.endDate).toISOString() : '';
  
  const serializeMealsList = (meals) => {
    if (!meals || !Array.isArray(meals)) return '';
    return meals.map(m => {
      const items = m.items 
        ? m.items.map(it => `${it.foodName || ''}:${it.quantity || 0}:${it.unit || ''}`).sort().join(',') 
        : '';
      return `${m.id || ''}:${m.name || ''}:${m.mealTime || ''}:${m.mealOrder || 0}:${items}`;
    }).sort().join('|');
  };

  const mealsStr = serializeMealsList(plan.meals);
  
  const cyclesStr = plan.cycles ? plan.cycles.map(c => {
    const daysStr = c.days ? c.days.map(d => {
      const dMealsStr = serializeMealsList(d.meals);
      return `${d.dayNumber}:${dMealsStr}`;
    }).sort().join(';') : '';
    return `${c.startDay}:${c.endDay}:${daysStr}`;
  }).sort().join('||') : '';

  return `${start}#${end}#${mealsStr}#${cyclesStr}`;
}

export function hasSchedulingChanges(oldPlan, newPlan) {
  return serializeDietPlanSchedule(oldPlan) !== serializeDietPlanSchedule(newPlan);
}

// Helper to check if a plan is archived
function checkNotArchived(dietPlan) {
  if (dietPlan && dietPlan.status === 'ARCHIVED') {
    throw ApiError.badRequest('Cannot modify an archived diet plan');
  }
}

// Helper to validate active plan collision
async function checkActivePlanCollision(tenantId, clientId, planId, startDate, endDate) {
  const activePlans = await dietPlanRepository.findActivePlans(tenantId, clientId, planId);

  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : null;

  for (const other of activePlans) {
    const otherStart = other.startDate ? new Date(other.startDate) : new Date(other.createdAt);
    const otherEnd = other.endDate ? new Date(other.endDate) : null;

    // Two active plans overlap if (start <= otherEnd || otherEnd == null) && (otherStart <= end || end == null)
    const overlaps = (start <= otherEnd || otherEnd === null) && (otherStart <= end || end === null);
    if (overlaps) {
      throw ApiError.badRequest('An active plan already exists for this client with overlapping dates');
    }
  }
}

export const dietPlanService = {
  // ─── Diet Plan Services ────────────────────────────────────────────────────
  async createDietPlan(tenantId, clientId, creatorId, data) {
    // 1. Verify client exists and belongs to the tenant
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    // 2. Verify assessment belongs to the same client and tenant
    if (data.assessmentId) {
      const assessment = await assessmentRepository.findById(tenantId, data.assessmentId);
      if (!assessment || assessment.clientId !== clientId) {
        throw ApiError.badRequest('Assessment must belong to the same client');
      }
    }

    // 2.5 Verify or auto-resolve goal profile
    if (!data.goalProfileId) {
      const activeGoal = await clinicalProfileService.getActiveGoal(tenantId, clientId);
      if (!activeGoal) {
        throw ApiError.badRequest('Client has no active goal profile. A goal profile is required to create a diet plan.');
      }
      data.goalProfileId = activeGoal.id;
    }
    
    const goalProfile = await clinicalProfileService.getGoalProfileById(tenantId, clientId, data.goalProfileId);
    if (!goalProfile) {
      throw ApiError.badRequest('Goal Profile must exist and belong to the client');
    }

    // 3. Prevent active plan collision
    if (data.status === 'ACTIVE') {
      await checkActivePlanCollision(tenantId, clientId, null, data.startDate, data.endDate);
    }

    const createdPlan = await dietPlanRepository.create(tenantId, clientId, creatorId, data);
    if (createdPlan.status === 'ACTIVE') {
      await automationService.createAutomation(tenantId, {
        clientId: createdPlan.clientId,
        dietPlanId: createdPlan.id,
        activatedBy: creatorId,
        startDate: createdPlan.startDate || null,
      });
    }
    return createdPlan;
  },

  async getDietPlanById(tenantId, id) {
    const dietPlan = await dietPlanRepository.findById(tenantId, id);
    if (!dietPlan) {
      throw ApiError.notFound('Diet Plan');
    }
    return dietPlan;
  },

  async getClientDietPlans(tenantId, clientId, pagination) {
    // Verify client exists and belongs to the tenant
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    const [dietPlans, total] = await dietPlanRepository.findManyAndCount(
      tenantId,
      clientId,
      pagination
    );

    return {
      dietPlans,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  },

  async updateDietPlan(tenantId, id, updateData) {
    // 1. Verify diet plan exists and belongs to the tenant
    const existing = await dietPlanRepository.findById(tenantId, id);
    if (!existing) {
      throw ApiError.notFound('Diet Plan');
    }

    // 2. Prevent modifying archived diet plan
    checkNotArchived(existing);

    // 3. Verify assessment belongs to the same client and tenant if updated
    if (updateData.assessmentId) {
      const assessment = await assessmentRepository.findById(tenantId, updateData.assessmentId);
      if (!assessment || assessment.clientId !== existing.clientId) {
        throw ApiError.badRequest('Assessment must belong to the same client');
      }
    }

    // 3.5 Verify goal profile if updated
    if (updateData.goalProfileId) {
      const goalProfile = await clinicalProfileService.getGoalProfileById(tenantId, existing.clientId, updateData.goalProfileId);
      if (!goalProfile) {
        throw ApiError.badRequest('Goal Profile must exist and belong to the client');
      }
    }

    // 4. Prevent active plan collision
    const finalStatus = updateData.status !== undefined ? updateData.status : existing.status;
    const finalStart = updateData.startDate !== undefined ? updateData.startDate : existing.startDate;
    const finalEnd = updateData.endDate !== undefined ? updateData.endDate : existing.endDate;

    if (finalStatus === 'ACTIVE') {
      await checkActivePlanCollision(tenantId, existing.clientId, id, finalStart, finalEnd);
    }

    const updatedPlan = await dietPlanRepository.update(tenantId, id, updateData);
    if (existing.status !== 'ACTIVE' && updatedPlan.status === 'ACTIVE') {
      await automationService.createAutomation(tenantId, {
        clientId: updatedPlan.clientId,
        dietPlanId: updatedPlan.id,
        activatedBy: null,
        startDate: updatedPlan.startDate || null,
      });
    } else if (updatedPlan.status === 'ACTIVE' && hasSchedulingChanges(existing, updatedPlan)) {
      await automationService.regenerateForPlan(tenantId, id);
    }
    return updatedPlan;
  },

  async deleteDietPlan(tenantId, id) {
    const existing = await dietPlanRepository.findById(tenantId, id);
    if (!existing) {
      throw ApiError.notFound('Diet Plan');
    }

    // Prevent deleting archived diet plan
    checkNotArchived(existing);

    const affectedCount = await dietPlanRepository.softDelete(tenantId, id);
    if (affectedCount === 0) {
      throw ApiError.notFound('Diet Plan');
    }
  },

  // ─── Meal Services ─────────────────────────────────────────────────────────
  async createMeal(tenantId, dietPlanId, data) {
    // Verify diet plan exists and belongs to the tenant
    const dietPlan = await dietPlanRepository.findById(tenantId, dietPlanId);
    if (!dietPlan) {
      throw ApiError.notFound('Diet Plan');
    }

    // Lock archived plans
    checkNotArchived(dietPlan);

    const result = await dietPlanRepository.createMeal(dietPlanId, data);
    if (dietPlan.status === 'ACTIVE') {
      await automationService.regenerateForPlan(tenantId, dietPlanId);
    }
    return result;
  },

  async updateMeal(tenantId, mealId, data) {
    // Verify meal exists and belongs to the tenant
    const meal = await dietPlanRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Meal');
    }

    // Lock archived plans
    checkNotArchived(meal.dietPlan);

    const result = await dietPlanRepository.updateMeal(mealId, data);
    if (meal.dietPlan?.status === 'ACTIVE') {
      await automationService.regenerateForPlan(tenantId, meal.dietPlanId);
    }
    return result;
  },

  async deleteMeal(tenantId, mealId) {
    // Verify meal exists and belongs to the tenant
    const meal = await dietPlanRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Meal');
    }

    // Lock archived plans
    checkNotArchived(meal.dietPlan);

    await dietPlanRepository.deleteMeal(mealId);
    if (meal.dietPlan?.status === 'ACTIVE') {
      await automationService.regenerateForPlan(tenantId, meal.dietPlanId);
    }
  },

  // ─── Meal Item Services ────────────────────────────────────────────────────
  async createMealItem(tenantId, mealId, data) {
    // Verify meal exists and belongs to the tenant
    const meal = await dietPlanRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Meal');
    }

    // Lock archived plans
    checkNotArchived(meal.dietPlan);

    // Snapshot logic
    if (data.foodLibraryId) {
      const food = await prisma.foodLibrary.findFirst({
        where: { id: data.foodLibraryId, tenantId, deletedAt: null }
      });
      if (!food) {
        throw ApiError.notFound('Food from Library');
      }
      data.foodName = data.foodName || food.foodName;
      data.unit = data.unit || food.defaultUnit;
      data.calories = data.calories ?? food.calories;
      data.protein = data.protein ?? food.protein;
      data.carbs = data.carbs ?? food.carbs;
      data.fat = data.fat ?? food.fat;
      data.sourceType = food.sourceType;
    }

    const createdItem = await prisma.$transaction(async (tx) => {
      const result = await dietPlanRepository.createMealItem(mealId, data, tx);

      // Auto-aggregate macros
      await dietPlanRepository.recalculatePlanNutrition(meal.dietPlanId, tx);

      return result;
    });

    if (meal.dietPlan?.status === 'ACTIVE') {
      await automationService.regenerateForPlan(tenantId, meal.dietPlanId);
    }

    return createdItem;
  },

  async updateMealItem(tenantId, itemId, data) {
    // Verify meal item exists and belongs to the tenant
    const item = await dietPlanRepository.findMealItemById(tenantId, itemId);
    if (!item) {
      throw ApiError.notFound('Meal Item');
    }

    // Lock archived plans
    checkNotArchived(item.meal?.dietPlan);

    // Snapshot logic
    if (data.foodLibraryId) {
      const food = await prisma.foodLibrary.findFirst({
        where: { id: data.foodLibraryId, tenantId, deletedAt: null }
      });
      if (!food) {
        throw ApiError.notFound('Food from Library');
      }
      data.foodName = data.foodName || food.foodName;
      data.unit = data.unit || food.defaultUnit;
      data.calories = data.calories ?? food.calories;
      data.protein = data.protein ?? food.protein;
      data.carbs = data.carbs ?? food.carbs;
      data.fat = data.fat ?? food.fat;
      data.sourceType = food.sourceType;
    }

    const updatedItem = await prisma.$transaction(async (tx) => {
      const result = await dietPlanRepository.updateMealItem(itemId, data, tx);

      // Auto-aggregate macros
      await dietPlanRepository.recalculatePlanNutrition(item.meal.dietPlanId, tx);

      return result;
    });

    if (item.meal?.dietPlan?.status === 'ACTIVE') {
      await automationService.regenerateForPlan(tenantId, item.meal.dietPlanId);
    }

    return updatedItem;
  },

  async deleteMealItem(tenantId, itemId) {
    // Verify meal item exists and belongs to the tenant
    const item = await dietPlanRepository.findMealItemById(tenantId, itemId);
    if (!item) {
      throw ApiError.notFound('Meal Item');
    }

    // Lock archived plans
    checkNotArchived(item.meal?.dietPlan);

    await prisma.$transaction(async (tx) => {
      await dietPlanRepository.deleteMealItem(itemId, tx);

      // Auto-aggregate macros
      await dietPlanRepository.recalculatePlanNutrition(item.meal.dietPlanId, tx);
    });

    if (item.meal?.dietPlan?.status === 'ACTIVE') {
      await automationService.regenerateForPlan(tenantId, item.meal.dietPlanId);
    }
  },
};
