// src/modules/diet-plan-templates/template-cycle.repository.js
import prisma from '../../lib/prisma.js';

export const templateCycleRepository = {
  async createCycle(templateId, data) {
    return prisma.templateCycle.create({
      data: {
        ...data,
        templateId,
      },
    });
  },

  async findCyclesByTemplateId(templateId) {
    return prisma.templateCycle.findMany({
      where: { templateId },
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
    return prisma.templateCycle.findUnique({
      where: { id: cycleId },
      include: {
        template: true,
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
    return prisma.templateCycle.update({
      where: { id: cycleId },
      data,
    });
  },

  async deleteCycle(cycleId) {
    return prisma.templateCycle.delete({
      where: { id: cycleId },
    });
  },

  async createCycleDay(cycleId, data) {
    return prisma.templateCycleDay.create({
      data: {
        ...data,
        cycleId,
      },
    });
  },

  async findCycleDays(cycleId) {
    return prisma.templateCycleDay.findMany({
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
    return prisma.templateCycleDay.findUnique({
      where: { id: dayId },
      include: {
        cycle: {
          include: {
            template: true,
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
    return prisma.templateCycleDay.update({
      where: { id: dayId },
      data,
    });
  },

  async deleteCycleDay(dayId) {
    return prisma.templateCycleDay.delete({
      where: { id: dayId },
    });
  },
};
