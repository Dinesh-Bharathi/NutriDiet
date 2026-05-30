// src/modules/diet-plan-templates/diet-plan-template.repository.js
// Database operations for DietPlanTemplate, DietPlanTemplateMeal, and DietPlanTemplateMealItem — tenant-isolated.
import prisma from '../../lib/prisma.js';

export const dietPlanTemplateRepository = {
  // ─── Template Operations ───────────────────────────────────────────────────
  async create(tenantId, creatorId, data) {
    return prisma.dietPlanTemplate.create({
      data: {
        ...data,
        tenantId,
        createdBy: creatorId,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        meals: {
          orderBy: { mealOrder: 'asc' },
          include: {
            items: true,
          },
        },
        cycles: {
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
        },
      },
    });
  },

  async findById(tenantId, id) {
    return prisma.dietPlanTemplate.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        meals: {
          orderBy: { mealOrder: 'asc' },
          include: {
            items: true,
          },
        },
        cycles: {
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
        },
      },
    });
  },

  async findManyAndCount(tenantId, pagination) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const take = limit;

    const where = {
      tenantId,
      deletedAt: null,
    };

    const [templates, total] = await Promise.all([
      prisma.dietPlanTemplate.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.dietPlanTemplate.count({ where }),
    ]);

    return [templates, total];
  },

  async update(id, data) {
    return prisma.dietPlanTemplate.update({
      where: { id },
      data,
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        meals: {
          orderBy: { mealOrder: 'asc' },
          include: {
            items: true,
          },
        },
        cycles: {
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
        },
      },
    });
  },

  async softDelete(tenantId, id) {
    const result = await prisma.dietPlanTemplate.updateMany({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
    return result.count;
  },

  // ─── Template Meal Operations ──────────────────────────────────────────────
  async createMeal(templateId, data) {
    return prisma.dietPlanTemplateMeal.create({
      data: {
        ...data,
        templateId,
      },
      include: {
        items: true,
      },
    });
  },

  async findMealById(tenantId, mealId) {
    return prisma.dietPlanTemplateMeal.findFirst({
      where: {
        id: mealId,
        template: {
          tenantId,
          deletedAt: null,
        },
      },
      include: {
        items: true,
        template: true,
      },
    });
  },

  async updateMeal(mealId, data) {
    return prisma.dietPlanTemplateMeal.update({
      where: { id: mealId },
      data,
      include: {
        items: true,
        template: true,
      },
    });
  },

  async deleteMeal(mealId) {
    return prisma.dietPlanTemplateMeal.delete({
      where: { id: mealId },
    });
  },

  // ─── Template Meal Item Operations ─────────────────────────────────────────
  async createMealItem(mealId, data) {
    return prisma.dietPlanTemplateMealItem.create({
      data: {
        ...data,
        mealId,
      },
    });
  },

  async findMealItemById(tenantId, itemId) {
    return prisma.dietPlanTemplateMealItem.findFirst({
      where: {
        id: itemId,
        meal: {
          template: {
            tenantId,
            deletedAt: null,
          },
        },
      },
      include: {
        meal: {
          include: {
            template: true,
          },
        },
      },
    });
  },

  async updateMealItem(itemId, data) {
    return prisma.dietPlanTemplateMealItem.update({
      where: { id: itemId },
      data,
    });
  },

  async deleteMealItem(itemId) {
    return prisma.dietPlanTemplateMealItem.delete({
      where: { id: itemId },
    });
  },

  // ─── Template Auto Aggregation ─────────────────────────────────────────────
  async recalculateTemplateNutrition(templateId) {
    const aggregations = await prisma.dietPlanTemplateMealItem.aggregate({
      where: {
        meal: {
          templateId,
        },
      },
      _sum: {
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
      },
    });

    const sum = aggregations._sum;

    return prisma.dietPlanTemplate.update({
      where: { id: templateId },
      data: {
        totalCalories: Math.round(sum.calories || 0),
        totalProtein: sum.protein || 0,
        totalCarbs: sum.carbs || 0,
        totalFat: sum.fat || 0,
      },
    });
  },
};
