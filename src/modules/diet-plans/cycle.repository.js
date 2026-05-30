// src/modules/diet-plans/cycle.repository.js
import prisma from '../../lib/prisma.js';

export const cycleRepository = {
  async createCycle(dietPlanId, data) {
    return prisma.dietPlanCycle.create({
      data: {
        ...data,
        dietPlanId,
      },
    });
  },

  async findCyclesByPlanId(dietPlanId) {
    return prisma.dietPlanCycle.findMany({
      where: { dietPlanId },
      orderBy: { createdAt: 'asc' },
      include: {
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            meals: {
              orderBy: { mealOrder: 'asc' },
              include: {
                items: true,
              },
            },
          },
        },
      },
    });
  },

  async findCycleById(cycleId) {
    return prisma.dietPlanCycle.findUnique({
      where: { id: cycleId },
      include: {
        dietPlan: true,
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            meals: {
              orderBy: { mealOrder: 'asc' },
              include: {
                items: true,
              },
            },
          },
        },
      },
    });
  },

  async updateCycle(cycleId, data) {
    return prisma.dietPlanCycle.update({
      where: { id: cycleId },
      data,
    });
  },

  async deleteCycle(cycleId) {
    return prisma.dietPlanCycle.delete({
      where: { id: cycleId },
    });
  },

  async createCycleDay(cycleId, data) {
    return prisma.dietPlanCycleDay.create({
      data: {
        ...data,
        cycleId,
      },
    });
  },

  async findCycleDays(cycleId) {
    return prisma.dietPlanCycleDay.findMany({
      where: { cycleId },
      orderBy: { dayNumber: 'asc' },
      include: {
        meals: {
          orderBy: { mealOrder: 'asc' },
          include: {
            items: true,
          },
        },
      },
    });
  },

  async findCycleDayById(dayId) {
    return prisma.dietPlanCycleDay.findUnique({
      where: { id: dayId },
      include: {
        cycle: {
          include: {
            dietPlan: true,
          },
        },
        meals: {
          orderBy: { mealOrder: 'asc' },
          include: {
            items: true,
          },
        },
      },
    });
  },

  async updateCycleDay(dayId, data) {
    return prisma.dietPlanCycleDay.update({
      where: { id: dayId },
      data,
    });
  },

  async deleteCycleDay(dayId) {
    return prisma.dietPlanCycleDay.delete({
      where: { id: dayId },
    });
  },
};
