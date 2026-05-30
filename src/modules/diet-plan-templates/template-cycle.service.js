// src/modules/diet-plan-templates/template-cycle.service.js
import { templateCycleRepository } from './template-cycle.repository.js';
import { dietPlanTemplateRepository } from './diet-plan-template.repository.js';
import ApiError from '../../utils/ApiError.js';
import prisma from '../../lib/prisma.js';

export function enrichTemplateCycleDayWithActualTotals(day) {
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

export function enrichTemplateCycleWithTotals(cycle) {
  if (!cycle) return null;
  const enrichedDays = cycle.days ? cycle.days.map(enrichTemplateCycleDayWithActualTotals) : [];

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

export const templateCycleService = {
  async createCycle(tenantId, templateId, data) {
    const template = await dietPlanTemplateRepository.findById(tenantId, templateId);
    if (!template) {
      throw ApiError.notFound('Diet Plan Template');
    }

    const cycle = await templateCycleRepository.createCycle(templateId, data);
    return enrichTemplateCycleWithTotals(cycle);
  },

  async getCyclesByTemplateId(tenantId, templateId) {
    const template = await dietPlanTemplateRepository.findById(tenantId, templateId);
    if (!template) {
      throw ApiError.notFound('Diet Plan Template');
    }

    const cycles = await templateCycleRepository.findCyclesByTemplateId(templateId);
    return cycles.map(enrichTemplateCycleWithTotals);
  },

  async getCycleById(tenantId, cycleId) {
    const cycle = await templateCycleRepository.findCycleById(cycleId);
    if (!cycle || cycle.template.tenantId !== tenantId) {
      throw ApiError.notFound('Template Cycle');
    }

    return enrichTemplateCycleWithTotals(cycle);
  },

  async updateCycle(tenantId, cycleId, data) {
    const cycle = await templateCycleRepository.findCycleById(cycleId);
    if (!cycle || cycle.template.tenantId !== tenantId) {
      throw ApiError.notFound('Template Cycle');
    }

    const updated = await templateCycleRepository.updateCycle(cycleId, data);
    return enrichTemplateCycleWithTotals(updated);
  },

  async deleteCycle(tenantId, cycleId) {
    const cycle = await templateCycleRepository.findCycleById(cycleId);
    if (!cycle || cycle.template.tenantId !== tenantId) {
      throw ApiError.notFound('Template Cycle');
    }

    await prisma.$transaction(async (tx) => {
      await tx.templateCycle.delete({
        where: { id: cycleId },
      });
    });
  },

  async createCycleDay(tenantId, cycleId, data) {
    const cycle = await templateCycleRepository.findCycleById(cycleId);
    if (!cycle || cycle.template.tenantId !== tenantId) {
      throw ApiError.notFound('Template Cycle');
    }

    const day = await templateCycleRepository.createCycleDay(cycleId, data);
    return enrichTemplateCycleDayWithActualTotals(day);
  },

  async getCycleDays(tenantId, cycleId) {
    const cycle = await templateCycleRepository.findCycleById(cycleId);
    if (!cycle || cycle.template.tenantId !== tenantId) {
      throw ApiError.notFound('Template Cycle');
    }

    const days = await templateCycleRepository.findCycleDays(cycleId);
    return days.map(enrichTemplateCycleDayWithActualTotals);
  },

  async updateCycleDay(tenantId, dayId, data) {
    const day = await templateCycleRepository.findCycleDayById(dayId);
    if (!day || day.cycle.template.tenantId !== tenantId) {
      throw ApiError.notFound('Template Cycle Day');
    }

    const updated = await templateCycleRepository.updateCycleDay(dayId, data);
    return enrichTemplateCycleDayWithActualTotals(updated);
  },

  async deleteCycleDay(tenantId, dayId) {
    const day = await templateCycleRepository.findCycleDayById(dayId);
    if (!day || day.cycle.template.tenantId !== tenantId) {
      throw ApiError.notFound('Template Cycle Day');
    }

    await prisma.$transaction(async (tx) => {
      await tx.templateCycleDay.delete({
        where: { id: dayId },
      });
    });
  },
};
