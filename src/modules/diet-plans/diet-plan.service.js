// src/modules/diet-plans/diet-plan.service.js
// Business rules and operations for Diet Plans, Meals, and Meal Items.
import { dietPlanRepository } from './diet-plan.repository.js';
import { clientRepository } from '../clients/client.repository.js';
import { assessmentRepository } from '../assessments/assessment.repository.js';
import ApiError from '../../utils/ApiError.js';

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

    // 2. Verify assessment belongs to the same client and tenant if updated
    if (updateData.assessmentId) {
      const assessment = await assessmentRepository.findById(tenantId, updateData.assessmentId);
      if (!assessment || assessment.clientId !== existing.clientId) {
        throw ApiError.badRequest('Assessment must belong to the same client');
      }
    }

    return dietPlanRepository.update(id, updateData);
  },

  async deleteDietPlan(tenantId, id) {
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

    return dietPlanRepository.createMeal(dietPlanId, data);
  },

  async updateMeal(tenantId, mealId, data) {
    // Verify meal exists and belongs to the tenant
    const meal = await dietPlanRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Meal');
    }

    return dietPlanRepository.updateMeal(mealId, data);
  },

  async deleteMeal(tenantId, mealId) {
    // Verify meal exists and belongs to the tenant
    const meal = await dietPlanRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Meal');
    }

    await dietPlanRepository.deleteMeal(mealId);
  },

  // ─── Meal Item Services ────────────────────────────────────────────────────
  async createMealItem(tenantId, mealId, data) {
    // Verify meal exists and belongs to the tenant
    const meal = await dietPlanRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Meal');
    }

    return dietPlanRepository.createMealItem(mealId, data);
  },

  async updateMealItem(tenantId, itemId, data) {
    // Verify meal item exists and belongs to the tenant
    const item = await dietPlanRepository.findMealItemById(tenantId, itemId);
    if (!item) {
      throw ApiError.notFound('Meal Item');
    }

    return dietPlanRepository.updateMealItem(itemId, data);
  },

  async deleteMealItem(tenantId, itemId) {
    // Verify meal item exists and belongs to the tenant
    const item = await dietPlanRepository.findMealItemById(tenantId, itemId);
    if (!item) {
      throw ApiError.notFound('Meal Item');
    }

    await dietPlanRepository.deleteMealItem(itemId);
  },
};
