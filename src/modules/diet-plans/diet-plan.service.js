// src/modules/diet-plans/diet-plan.service.js
// Business rules and operations for Diet Plans, Meals, and Meal Items.
import { dietPlanRepository } from './diet-plan.repository.js';
import { clientRepository } from '../clients/client.repository.js';
import { assessmentRepository } from '../assessments/assessment.repository.js';
import ApiError from '../../utils/ApiError.js';
import prisma from '../../lib/prisma.js';
import { clinicalProfileService } from '../assessments/clinical-profile.service.js';

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

    return dietPlanRepository.create(tenantId, clientId, creatorId, data);
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

    return dietPlanRepository.update(tenantId, id, updateData);
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

    return dietPlanRepository.createMeal(dietPlanId, data);
  },

  async updateMeal(tenantId, mealId, data) {
    // Verify meal exists and belongs to the tenant
    const meal = await dietPlanRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Meal');
    }

    // Lock archived plans
    checkNotArchived(meal.dietPlan);

    return dietPlanRepository.updateMeal(mealId, data);
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

    return prisma.$transaction(async (tx) => {
      const createdItem = await dietPlanRepository.createMealItem(mealId, data, tx);

      // Auto-aggregate macros
      await dietPlanRepository.recalculatePlanNutrition(meal.dietPlanId, tx);

      return createdItem;
    });
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

    return prisma.$transaction(async (tx) => {
      const updatedItem = await dietPlanRepository.updateMealItem(itemId, data, tx);

      // Auto-aggregate macros
      await dietPlanRepository.recalculatePlanNutrition(item.meal.dietPlanId, tx);

      return updatedItem;
    });
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
  },
};
