// src/modules/diet-plans/cycle.service.js
import { cycleRepository } from './cycle.repository.js';
import { dietPlanRepository } from './diet-plan.repository.js';
import { calendarEngineService } from '../calendar-engine/calendar-engine.service.js';
import ApiError from '../../utils/ApiError.js';
import prisma from '../../lib/prisma.js';

export function enrichCycleDayWithActualTotals(day) {
  if (!day) return null;
  let actualCalories = 0;
  let actualProtein = 0;
  let actualCarbs = 0;
  let actualFat = 0;

  if (day.meals) {
    day.meals.forEach((meal) => {
      if (meal.items) {
        meal.items.forEach((item) => {
          actualCalories += item.calories || 0;
          actualProtein += item.protein || 0;
          actualCarbs += item.carbs || 0;
          actualFat += item.fat || 0;
        });
      }
    });
  }

  return {
    ...day,
    actualCalories: Math.round(actualCalories),
    actualProtein: Math.round(actualProtein * 100) / 100,
    actualCarbs: Math.round(actualCarbs * 100) / 100,
    actualFat: Math.round(actualFat * 100) / 100,
  };
}

export function enrichCycleWithTotals(cycle) {
  if (!cycle) return null;
  const enrichedDays = cycle.days ? cycle.days.map(enrichCycleDayWithActualTotals) : [];

  let totalPlannedCalories = 0;
  let totalPlannedProtein = 0;
  let totalPlannedCarbs = 0;
  let totalPlannedFat = 0;
  let totalActualCalories = 0;
  let totalActualProtein = 0;
  let totalActualCarbs = 0;
  let totalActualFat = 0;

  enrichedDays.forEach((day) => {
    totalPlannedCalories += day.plannedCalories || 0;
    totalPlannedProtein += day.plannedProtein || 0;
    totalPlannedCarbs += day.plannedCarbs || 0;
    totalPlannedFat += day.plannedFat || 0;

    totalActualCalories += day.actualCalories || 0;
    totalActualProtein += day.actualProtein || 0;
    totalActualCarbs += day.actualCarbs || 0;
    totalActualFat += day.actualFat || 0;
  });

  return {
    ...cycle,
    days: enrichedDays,
    totalPlannedCalories,
    totalPlannedProtein: Math.round(totalPlannedProtein * 100) / 100,
    totalPlannedCarbs: Math.round(totalPlannedCarbs * 100) / 100,
    totalPlannedFat: Math.round(totalPlannedFat * 100) / 100,
    totalActualCalories,
    totalActualProtein: Math.round(totalActualProtein * 100) / 100,
    totalActualCarbs: Math.round(totalActualCarbs * 100) / 100,
    totalActualFat: Math.round(totalActualFat * 100) / 100,
  };
}

export const cycleService = {
  async createCycle(tenantId, dietPlanId, data) {
    const plan = await dietPlanRepository.findById(tenantId, dietPlanId);
    if (!plan) {
      throw ApiError.notFound('Diet Plan');
    }

    const cycle = await cycleRepository.createCycle(dietPlanId, data);
    return enrichCycleWithTotals(cycle);
  },

  async getCyclesByPlanId(tenantId, dietPlanId) {
    const plan = await dietPlanRepository.findById(tenantId, dietPlanId);
    if (!plan) {
      throw ApiError.notFound('Diet Plan');
    }

    const cycles = await cycleRepository.findCyclesByPlanId(dietPlanId);
    return cycles.map(enrichCycleWithTotals);
  },

  async getCycleById(tenantId, cycleId) {
    const cycle = await cycleRepository.findCycleById(cycleId);
    if (!cycle || cycle.dietPlan.tenantId !== tenantId) {
      throw ApiError.notFound('Diet Plan Cycle');
    }

    return enrichCycleWithTotals(cycle);
  },

  async updateCycle(tenantId, cycleId, data) {
    const cycle = await cycleRepository.findCycleById(cycleId);
    if (!cycle || cycle.dietPlan.tenantId !== tenantId) {
      throw ApiError.notFound('Diet Plan Cycle');
    }

    const updated = await cycleRepository.updateCycle(cycleId, data);
    return enrichCycleWithTotals(updated);
  },

  async deleteCycle(tenantId, cycleId) {
    const cycle = await cycleRepository.findCycleById(cycleId);
    if (!cycle || cycle.dietPlan.tenantId !== tenantId) {
      throw ApiError.notFound('Diet Plan Cycle');
    }

    await prisma.$transaction(async (tx) => {
      await tx.dietPlanCycle.delete({
        where: { id: cycleId },
      });
    });
  },

  async createCycleDay(tenantId, cycleId, data) {
    const cycle = await cycleRepository.findCycleById(cycleId);
    if (!cycle || cycle.dietPlan.tenantId !== tenantId) {
      throw ApiError.notFound('Diet Plan Cycle');
    }

    const day = await cycleRepository.createCycleDay(cycleId, data);
    return enrichCycleDayWithActualTotals(day);
  },

  async getCycleDays(tenantId, cycleId) {
    const cycle = await cycleRepository.findCycleById(cycleId);
    if (!cycle || cycle.dietPlan.tenantId !== tenantId) {
      throw ApiError.notFound('Diet Plan Cycle');
    }

    const days = await cycleRepository.findCycleDays(cycleId);
    return days.map(enrichCycleDayWithActualTotals);
  },

  async updateCycleDay(tenantId, dayId, data) {
    const day = await cycleRepository.findCycleDayById(dayId);
    if (!day || day.cycle.dietPlan.tenantId !== tenantId) {
      throw ApiError.notFound('Cycle Day');
    }

    const updated = await cycleRepository.updateCycleDay(dayId, data);
    return enrichCycleDayWithActualTotals(updated);
  },

  async deleteCycleDay(tenantId, dayId) {
    const day = await cycleRepository.findCycleDayById(dayId);
    if (!day || day.cycle.dietPlan.tenantId !== tenantId) {
      throw ApiError.notFound('Cycle Day');
    }

    await prisma.$transaction(async (tx) => {
      await tx.dietPlanCycleDay.delete({
        where: { id: dayId },
      });
    });
  },

  async getCalendarPreview(tenantId, planId, limit) {
    const plan = await dietPlanRepository.findById(tenantId, planId);
    if (!plan) {
      throw ApiError.notFound('Diet Plan');
    }

    return calendarEngineService.getPlanCalendarPreview(tenantId, planId, limit);
  },
};
