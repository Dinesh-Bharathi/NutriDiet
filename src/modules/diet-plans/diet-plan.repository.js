// src/modules/diet-plans/diet-plan.repository.js
// Database adapter for Diet Plans, Meals, and Meal Items — strictly tenant-isolated.
import prisma from '../../lib/prisma.js';

export const dietPlanRepository = {
  // ─── Diet Plan Operations ──────────────────────────────────────────────────
  async create(tenantId, clientId, creatorId, data) {
    return prisma.dietPlan.create({
      data: {
        ...data,
        tenantId,
        clientId,
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
          orderBy: { startDay: 'asc' },
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
    return prisma.dietPlan.findFirst({
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
          orderBy: { startDay: 'asc' },
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

  async findManyAndCount(tenantId, clientId, pagination) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const take = limit;

    const where = {
      tenantId,
      clientId,
      deletedAt: null,
    };

    const [dietPlans, total] = await Promise.all([
      prisma.dietPlan.findMany({
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
      prisma.dietPlan.count({ where }),
    ]);

    return [dietPlans, total];
  },

  async update(id, data) {
    return prisma.dietPlan.update({
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
          orderBy: { startDay: 'asc' },
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
    const result = await prisma.dietPlan.updateMany({
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

  async findActivePlans(tenantId, clientId, excludePlanId) {
    return prisma.dietPlan.findMany({
      where: {
        tenantId,
        clientId,
        status: 'ACTIVE',
        deletedAt: null,
        id: excludePlanId ? { not: excludePlanId } : undefined,
      },
    });
  },

  // ─── Meal Operations ───────────────────────────────────────────────────────
  async createMeal(dietPlanId, data) {
    return prisma.dietPlanMeal.create({
      data: {
        ...data,
        dietPlanId,
      },
      include: {
        items: true,
      },
    });
  },

  async findMealById(tenantId, mealId) {
    return prisma.dietPlanMeal.findFirst({
      where: {
        id: mealId,
        dietPlan: {
          tenantId,
          deletedAt: null,
        },
      },
      include: {
        items: true,
        dietPlan: true,
      },
    });
  },

  async updateMeal(mealId, data) {
    return prisma.dietPlanMeal.update({
      where: { id: mealId },
      data,
      include: {
        items: true,
        dietPlan: true,
      },
    });
  },

  async deleteMeal(mealId) {
    return prisma.dietPlanMeal.delete({
      where: { id: mealId },
    });
  },

  // ─── Meal Item Operations ──────────────────────────────────────────────────
  async createMealItem(mealId, data) {
    return prisma.dietPlanMealItem.create({
      data: {
        ...data,
        mealId,
      },
    });
  },

  async findMealItemById(tenantId, itemId) {
    return prisma.dietPlanMealItem.findFirst({
      where: {
        id: itemId,
        meal: {
          dietPlan: {
            tenantId,
            deletedAt: null,
          },
        },
      },
      include: {
        meal: {
          include: {
            dietPlan: true,
          },
        },
      },
    });
  },

  async updateMealItem(itemId, data) {
    return prisma.dietPlanMealItem.update({
      where: { id: itemId },
      data,
    });
  },

  async deleteMealItem(itemId) {
    return prisma.dietPlanMealItem.delete({
      where: { id: itemId },
    });
  },

  async recalculatePlanNutrition(dietPlanId) {
    const aggregations = await prisma.dietPlanMealItem.aggregate({
      where: {
        meal: {
          dietPlanId,
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

    return prisma.dietPlan.update({
      where: { id: dietPlanId },
      data: {
        totalCalories: Math.round(sum.calories || 0),
        totalProtein: sum.protein || 0,
        totalCarbs: sum.carbs || 0,
        totalFat: sum.fat || 0,
      },
    });
  },
};
