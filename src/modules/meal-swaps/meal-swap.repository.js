// src/modules/meal-swaps/meal-swap.repository.js
import prisma from '../../lib/prisma.js';

export const mealSwapRepository = {
  /**
   * Find a specific meal item by ID, isolated by tenant
   */
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
        foodLibrary: true,
      },
    });
  },

  /**
   * Find a specific food item by ID, isolated by tenant
   */
  async findFoodById(tenantId, foodId) {
    return prisma.foodLibrary.findFirst({
      where: {
        id: foodId,
        OR: [
          { tenantId, isSystem: false },
          { isSystem: true },
        ],
        deletedAt: null,
        status: 'ACTIVE',
      },
      include: {
        category: true,
        tagMappings: {
          include: {
            tag: true,
          },
        },
      },
    });
  },

  /**
   * Find a specific diet plan by ID, isolated by tenant
   */
  async findDietPlanById(tenantId, planId) {
    return prisma.dietPlan.findFirst({
      where: {
        id: planId,
        tenantId,
        deletedAt: null,
      },
    });
  },

  /**
   * Find a specific diet plan template by ID, isolated by tenant
   */
  async findTemplateById(tenantId, templateId) {
    return prisma.dietPlanTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        deletedAt: null,
      },
    });
  },

  /**
   * Fetch all candidate foods (tenant-specific + active system foods)
   */
  async findCandidateFoods(tenantId, excludeFoodId, searchQuery, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const take = limit;

    const baseWhere = {
      OR: [
        { tenantId, isSystem: false },
        { isSystem: true },
      ],
      id: excludeFoodId ? { not: excludeFoodId } : undefined,
      deletedAt: null,
      status: 'ACTIVE',
    };

    if (searchQuery && searchQuery.trim() !== '') {
      const cleanQ = searchQuery.trim();
      baseWhere.AND = [
        {
          OR: [
            { foodName: { contains: cleanQ, mode: 'insensitive' } },
            { commonName: { contains: cleanQ, mode: 'insensitive' } },
            { brandName: { contains: cleanQ, mode: 'insensitive' } },
            { searchKeywords: { contains: cleanQ, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [candidates, total] = await Promise.all([
      prisma.foodLibrary.findMany({
        where: baseWhere,
        skip,
        take,
        orderBy: { foodName: 'asc' },
        include: {
          category: true,
          tagMappings: {
            include: {
              tag: true,
            },
          },
          sourceEquivalents: {
            where: {
              targetFoodId: excludeFoodId,
            },
          },
          targetEquivalents: {
            where: {
              sourceFoodId: excludeFoodId,
            },
          },
        },
      }),
      prisma.foodLibrary.count({
        where: baseWhere,
      }),
    ]);

    return { candidates, total };
  },

  /**
   * Fetch all category items to construct category paths or hierarchy
   */
  async getFoodCategories(tenantId) {
    return prisma.foodCategory.findMany({
      where: {
        OR: [
          { tenantId },
          { isSystem: true },
        ],
      },
    });
  },

  /**
   * Execute single meal item swap + audit log + total nutrition recalculation in a transaction
   */
  async applySingleSwap(itemId, updateData, auditData) {
    return prisma.$transaction(async (tx) => {
      // 1. Update the meal item
      const updatedItem = await tx.dietPlanMealItem.update({
        where: { id: itemId },
        data: updateData,
        include: {
          meal: true,
        },
      });

      // 2. Insert into swap history
      await tx.mealSwapHistory.create({
        data: {
          ...auditData,
          mealItemId: itemId,
        },
      });

      // 3. Trigger recalculation
      const planId = updatedItem.meal.dietPlanId;
      
      // Recalculate inside tx (manually compute to avoid stale reads)
      const aggregations = await tx.dietPlanMealItem.aggregate({
        where: {
          meal: {
            dietPlanId: planId,
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

      await tx.dietPlan.update({
        where: { id: planId },
        data: {
          totalCalories: Math.round(sum.calories || 0),
          totalProtein: sum.protein || 0,
          totalCarbs: sum.carbs || 0,
          totalFat: sum.fat || 0,
        },
      });

      return updatedItem;
    });
  },

  /**
   * Execute bulk swap for Diet Plan cycles/days + audit logging + recalculation
   */
  async applyBulkPlanSwap({
    tenantId,
    dietPlanId,
    originalFoodId,
    targetFoodId,
    swapStrategy,
    performedBy,
    cycleId,
    cycleDayId,
    calculateNewItemFn,
    score
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Find all matching items in the plan
      const items = await tx.dietPlanMealItem.findMany({
        where: {
          foodLibraryId: originalFoodId,
          meal: {
            dietPlanId,
            cycleDay: cycleId || cycleDayId ? {
              cycleId: cycleId || undefined,
              id: cycleDayId || undefined,
            } : undefined,
          },
        },
        include: {
          meal: true,
        },
      });

      const swappedItems = [];

      for (const item of items) {
        // Calculate scaled quantity and updated macros
        const scaled = calculateNewItemFn(item.quantity);

        const updatePayload = {
          foodLibraryId: targetFoodId,
          foodName: scaled.foodName,
          quantity: scaled.quantity,
          unit: scaled.unit,
          calories: scaled.calories,
          protein: scaled.protein,
          carbs: scaled.carbs,
          fat: scaled.fat,
        };

        // Update the item
        const updated = await tx.dietPlanMealItem.update({
          where: { id: item.id },
          data: updatePayload,
        });

        // Insert audit log
        await tx.mealSwapHistory.create({
          data: {
            tenantId,
            mealItemId: item.id,
            originalFoodId,
            targetFoodId,
            swapStrategy,
            scope: cycleId ? 'CYCLE' : (cycleDayId ? 'CYCLE_DAY' : 'DIET_PLAN'),
            matchScore: score,
            quantityBefore: item.quantity,
            quantityAfter: scaled.quantity,
            performedBy,
          },
        });

        swappedItems.push(updated);
      }

      // 2. Trigger recalculation
      const aggregations = await tx.dietPlanMealItem.aggregate({
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

      await tx.dietPlan.update({
        where: { id: dietPlanId },
        data: {
          totalCalories: Math.round(sum.calories || 0),
          totalProtein: sum.protein || 0,
          totalCarbs: sum.carbs || 0,
          totalFat: sum.fat || 0,
        },
      });

      return swappedItems;
    });
  },

  /**
   * Execute bulk swap for Diet Plan Template cycles/days + audit logging + recalculation
   */
  async applyBulkTemplateSwap({
    tenantId,
    templateId,
    originalFoodId,
    targetFoodId,
    swapStrategy,
    performedBy,
    cycleId,
    cycleDayId,
    calculateNewItemFn,
    score
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Find all matching template meal items
      const items = await tx.dietPlanTemplateMealItem.findMany({
        where: {
          foodLibraryId: originalFoodId,
          meal: {
            templateId,
            cycleDay: cycleId || cycleDayId ? {
              cycleId: cycleId || undefined,
              id: cycleDayId || undefined,
            } : undefined,
          },
        },
        include: {
          meal: true,
        },
      });

      const swappedItems = [];

      for (const item of items) {
        // Calculate scaled quantity and updated macros
        const scaled = calculateNewItemFn(item.quantity);

        const updatePayload = {
          foodLibraryId: targetFoodId,
          foodName: scaled.foodName,
          quantity: scaled.quantity,
          unit: scaled.unit,
          calories: scaled.calories,
          protein: scaled.protein,
          carbs: scaled.carbs,
          fat: scaled.fat,
        };

        // Update the item
        const updated = await tx.dietPlanTemplateMealItem.update({
          where: { id: item.id },
          data: updatePayload,
        });

        // Insert audit log
        await tx.mealSwapHistory.create({
          data: {
            tenantId,
            mealItemId: item.id,
            originalFoodId,
            targetFoodId,
            swapStrategy,
            scope: cycleId ? 'CYCLE' : (cycleDayId ? 'CYCLE_DAY' : 'TEMPLATE'),
            matchScore: score,
            quantityBefore: item.quantity,
            quantityAfter: scaled.quantity,
            performedBy,
          },
        });

        swappedItems.push(updated);
      }

      // 2. Trigger recalculation
      const aggregations = await tx.dietPlanTemplateMealItem.aggregate({
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

      await tx.dietPlanTemplate.update({
        where: { id: templateId },
        data: {
          totalCalories: Math.round(sum.calories || 0),
          totalProtein: sum.protein || 0,
          totalCarbs: sum.carbs || 0,
          totalFat: sum.fat || 0,
        },
      });

      return swappedItems;
    });
  },
};
