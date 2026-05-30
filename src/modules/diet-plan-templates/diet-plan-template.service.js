// src/modules/diet-plan-templates/diet-plan-template.service.js
// Business rules and operations for Diet Plan Templates, meals, and items.
import { dietPlanTemplateRepository } from './diet-plan-template.repository.js';
import { dietPlanRepository } from '../diet-plans/diet-plan.repository.js';
import { clientRepository } from '../clients/client.repository.js';
import ApiError from '../../utils/ApiError.js';
import prisma from '../../lib/prisma.js';

// Helper to validate active plan collision
async function checkActivePlanCollision(tenantId, clientId, planId, startDate, endDate) {
  const activePlans = await dietPlanRepository.findActivePlans(tenantId, clientId, planId);

  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : null;

  for (const other of activePlans) {
    const otherStart = other.startDate ? new Date(other.startDate) : new Date(other.createdAt);
    const otherEnd = other.endDate ? new Date(other.endDate) : null;

    const overlaps = (start <= otherEnd || otherEnd === null) && (otherStart <= end || end === null);
    if (overlaps) {
      throw ApiError.badRequest('An active plan already exists for this client with overlapping dates');
    }
  }
}

export const dietPlanTemplateService = {
  // ─── Template CRUD Services ────────────────────────────────────────────────
  async createTemplate(tenantId, creatorId, data) {
    return dietPlanTemplateRepository.create(tenantId, creatorId, data);
  },

  async getTemplateById(tenantId, id) {
    const template = await dietPlanTemplateRepository.findById(tenantId, id);
    if (!template) {
      throw ApiError.notFound('Diet Plan Template');
    }
    return template;
  },

  async getTemplates(tenantId, pagination) {
    const [templates, total] = await dietPlanTemplateRepository.findManyAndCount(
      tenantId,
      pagination
    );

    return {
      templates,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  },

  async updateTemplate(tenantId, id, data) {
    const existing = await dietPlanTemplateRepository.findById(tenantId, id);
    if (!existing) {
      throw ApiError.notFound('Diet Plan Template');
    }

    return dietPlanTemplateRepository.update(id, data);
  },

  async deleteTemplate(tenantId, id) {
    const affectedCount = await dietPlanTemplateRepository.softDelete(tenantId, id);
    if (affectedCount === 0) {
      throw ApiError.notFound('Diet Plan Template');
    }
  },

  // ─── Template Meal Services ────────────────────────────────────────────────
  async createMeal(tenantId, templateId, data) {
    const template = await dietPlanTemplateRepository.findById(tenantId, templateId);
    if (!template) {
      throw ApiError.notFound('Diet Plan Template');
    }

    // Validate unique mealOrder within template (Refinement #1)
    const orderConflict = template.meals.find((m) => m.mealOrder === data.mealOrder);
    if (orderConflict) {
      throw ApiError.badRequest(`A meal with order ${data.mealOrder} already exists in this template`);
    }

    const meal = await dietPlanTemplateRepository.createMeal(templateId, data);

    // Recalculate totals on meal create
    await dietPlanTemplateRepository.recalculateTemplateNutrition(templateId);

    return meal;
  },

  async updateMeal(tenantId, mealId, data) {
    const meal = await dietPlanTemplateRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Template Meal');
    }

    // Validate unique mealOrder within template if changed (Refinement #1)
    if (data.mealOrder !== undefined && data.mealOrder !== meal.mealOrder) {
      const template = await dietPlanTemplateRepository.findById(tenantId, meal.templateId);
      const orderConflict = template.meals.find(
        (m) => m.mealOrder === data.mealOrder && m.id !== mealId
      );
      if (orderConflict) {
        throw ApiError.badRequest(`A meal with order ${data.mealOrder} already exists in this template`);
      }
    }

    const updated = await dietPlanTemplateRepository.updateMeal(mealId, data);

    // Recalculate totals on Template Meal Update (Refinement #5)
    await dietPlanTemplateRepository.recalculateTemplateNutrition(meal.templateId);

    return updated;
  },

  async deleteMeal(tenantId, mealId) {
    const meal = await dietPlanTemplateRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Template Meal');
    }

    // Wrap in a transaction (Refinement #2)
    await prisma.$transaction(async (tx) => {
      await tx.dietPlanTemplateMeal.delete({
        where: { id: mealId },
      });
    });

    // Recalculate totals after deletion
    await dietPlanTemplateRepository.recalculateTemplateNutrition(meal.templateId);
  },

  // ─── Template Meal Item Services ───────────────────────────────────────────
  async createMealItem(tenantId, mealId, data) {
    const meal = await dietPlanTemplateRepository.findMealById(tenantId, mealId);
    if (!meal) {
      throw ApiError.notFound('Template Meal');
    }

    // Snapshot from Food Library if foodLibraryId is supplied (Refinement #3 & #4)
    if (data.foodLibraryId) {
      const food = await prisma.foodLibrary.findFirst({
        where: { id: data.foodLibraryId, tenantId, deletedAt: null },
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

    const item = await dietPlanTemplateRepository.createMealItem(mealId, data);

    // Auto-aggregate
    await dietPlanTemplateRepository.recalculateTemplateNutrition(meal.templateId);

    return item;
  },

  async updateMealItem(tenantId, itemId, data) {
    const item = await dietPlanTemplateRepository.findMealItemById(tenantId, itemId);
    if (!item) {
      throw ApiError.notFound('Template Meal Item');
    }

    // Snapshot from Food Library if foodLibraryId is supplied (Refinement #3 & #4)
    if (data.foodLibraryId) {
      const food = await prisma.foodLibrary.findFirst({
        where: { id: data.foodLibraryId, tenantId, deletedAt: null },
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

    const updated = await dietPlanTemplateRepository.updateMealItem(itemId, data);

    // Auto-aggregate
    await dietPlanTemplateRepository.recalculateTemplateNutrition(item.meal.templateId);

    return updated;
  },

  async deleteMealItem(tenantId, itemId) {
    const item = await dietPlanTemplateRepository.findMealItemById(tenantId, itemId);
    if (!item) {
      throw ApiError.notFound('Template Meal Item');
    }

    await dietPlanTemplateRepository.deleteMealItem(itemId);

    // Auto-aggregate
    await dietPlanTemplateRepository.recalculateTemplateNutrition(item.meal.templateId);
  },

  // ─── Clone / Apply Services ────────────────────────────────────────────────
  async createTemplateFromPlan(tenantId, planId, creatorId, templateData) {
    const plan = await dietPlanRepository.findById(tenantId, planId);
    if (!plan) {
      throw ApiError.notFound('Diet Plan');
    }

    // Wrap whole cloning in a prisma transaction (Refinement #2)
    return prisma.$transaction(async (tx) => {
      const template = await tx.dietPlanTemplate.create({
        data: {
          title: templateData.title,
          description: templateData.description || plan.description,
          goal: plan.goal,
          dailyCalories: plan.dailyCalories,
          proteinGrams: plan.proteinGrams,
          carbGrams: plan.carbGrams,
          fatGrams: plan.fatGrams,
          totalCalories: plan.totalCalories,
          totalProtein: plan.totalProtein,
          totalCarbs: plan.totalCarbs,
          totalFat: plan.totalFat,
          isPublic: templateData.isPublic || false,
          tenantId,
          createdBy: creatorId,
        },
      });

      // Copy cycles and cycle days
      const cycles = await tx.dietPlanCycle.findMany({
        where: { dietPlanId: plan.id },
        include: {
          days: {
            include: {
              meals: {
                include: {
                  items: true,
                },
              },
            },
          },
        },
      });

      for (const cycle of cycles) {
        const templateCycle = await tx.templateCycle.create({
          data: {
            name: cycle.name,
            description: cycle.description,
            templateId: template.id,
          },
        });

        for (const day of cycle.days) {
          const templateDay = await tx.templateCycleDay.create({
            data: {
              cycleId: templateCycle.id,
              dayNumber: day.dayNumber,
              dayLabel: day.dayLabel,
              description: day.description,
              isActive: day.isActive,
              plannedCalories: day.plannedCalories,
              plannedProtein: day.plannedProtein,
              plannedCarbs: day.plannedCarbs,
              plannedFat: day.plannedFat,
            },
          });

          for (const meal of day.meals) {
            const clonedMeal = await tx.dietPlanTemplateMeal.create({
              data: {
                name: meal.name,
                mealOrder: meal.mealOrder,
                mealTime: meal.mealTime,
                notes: meal.notes,
                templateId: template.id,
                cycleDayId: templateDay.id,
              },
            });

            for (const item of meal.items) {
              await tx.dietPlanTemplateMealItem.create({
                data: {
                  foodName: item.foodName,
                  foodLibraryId: item.foodLibraryId,
                  sourceType: item.sourceType || 'CUSTOM',
                  quantity: item.quantity,
                  unit: item.unit,
                  calories: item.calories,
                  protein: item.protein,
                  carbs: item.carbs,
                  fat: item.fat,
                  notes: item.notes,
                  mealId: clonedMeal.id,
                },
              });
            }
          }
        }
      }

      // Also, copy static meals (meals where cycleDayId is null)
      const staticMeals = await tx.dietPlanMeal.findMany({
        where: { dietPlanId: plan.id, cycleDayId: null },
        include: { items: true },
      });

      for (const meal of staticMeals) {
        const clonedMeal = await tx.dietPlanTemplateMeal.create({
          data: {
            name: meal.name,
            mealOrder: meal.mealOrder,
            mealTime: meal.mealTime,
            notes: meal.notes,
            templateId: template.id,
          },
        });

        for (const item of meal.items) {
          await tx.dietPlanTemplateMealItem.create({
            data: {
              foodName: item.foodName,
              foodLibraryId: item.foodLibraryId,
              sourceType: item.sourceType || 'CUSTOM',
              quantity: item.quantity,
              unit: item.unit,
              calories: item.calories,
              protein: item.protein,
              carbs: item.carbs,
              fat: item.fat,
              notes: item.notes,
              mealId: clonedMeal.id,
            },
          });
        }
      }

      // Re-read full template scope to match findById response formatting
      return tx.dietPlanTemplate.findFirst({
        where: { id: template.id },
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
        },
      });
    });
  },

  async applyTemplateToClient(tenantId, templateId, clientId, creatorId, details) {
    const template = await dietPlanTemplateRepository.findById(tenantId, templateId);
    if (!template) {
      throw ApiError.notFound('Diet Plan Template');
    }

    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    // Default status to DRAFT
    const status = details.status || 'DRAFT';

    if (status === 'ACTIVE') {
      await checkActivePlanCollision(tenantId, clientId, null, details.startDate, details.endDate);
    }

    // Wrap plan creation in transaction (Refinement #2)
    return prisma.$transaction(async (tx) => {
      const plan = await tx.dietPlan.create({
        data: {
          title: template.title,
          description: template.description,
          goal: template.goal,
          dailyCalories: template.dailyCalories,
          proteinGrams: template.proteinGrams,
          carbGrams: template.carbGrams,
          fatGrams: template.fatGrams,
          totalCalories: template.totalCalories,
          totalProtein: template.totalProtein,
          totalCarbs: template.totalCarbs,
          totalFat: template.totalFat,
          status,
          startDate: details.startDate ? new Date(details.startDate) : null,
          endDate: details.endDate ? new Date(details.endDate) : null,
          cycleStartDate: details.cycleStartDate ? new Date(details.cycleStartDate) : (details.startDate ? new Date(details.startDate) : new Date()),
          versionNumber: 1,
          tenantId,
          clientId,
          createdBy: creatorId,
        },
      });

      // Copy template cycles and days
      const templateCycles = await tx.templateCycle.findMany({
        where: { templateId: template.id },
        include: {
          days: {
            include: {
              meals: {
                include: {
                  items: true,
                },
              },
            },
          },
        },
      });

      for (const cycle of templateCycles) {
        const planCycle = await tx.dietPlanCycle.create({
          data: {
            name: cycle.name,
            description: cycle.description,
            startDay: 1,
            dietPlanId: plan.id,
          },
        });

        for (const day of cycle.days) {
          const planDay = await tx.dietPlanCycleDay.create({
            data: {
              cycleId: planCycle.id,
              dayNumber: day.dayNumber,
              dayLabel: day.dayLabel,
              description: day.description,
              isActive: day.isActive,
              plannedCalories: day.plannedCalories,
              plannedProtein: day.plannedProtein,
              plannedCarbs: day.plannedCarbs,
              plannedFat: day.plannedFat,
            },
          });

          for (const meal of day.meals) {
            const clonedMeal = await tx.dietPlanMeal.create({
              data: {
                name: meal.name,
                mealOrder: meal.mealOrder,
                mealTime: meal.mealTime,
                notes: meal.notes,
                dietPlanId: plan.id,
                cycleDayId: planDay.id,
              },
            });

            for (const item of meal.items) {
              await tx.dietPlanMealItem.create({
                data: {
                  foodName: item.foodName,
                  foodLibraryId: item.foodLibraryId,
                  sourceType: item.sourceType || 'CUSTOM',
                  quantity: item.quantity,
                  unit: item.unit,
                  calories: item.calories,
                  protein: item.protein,
                  carbs: item.carbs,
                  fat: item.fat,
                  notes: item.notes,
                  mealId: clonedMeal.id,
                },
              });
            }
          }
        }
      }

      // Also, copy static template meals (meals where cycleDayId is null)
      const staticTemplateMeals = await tx.dietPlanTemplateMeal.findMany({
        where: { templateId: template.id, cycleDayId: null },
        include: { items: true },
      });

      for (const meal of staticTemplateMeals) {
        const clonedMeal = await tx.dietPlanMeal.create({
          data: {
            name: meal.name,
            mealOrder: meal.mealOrder,
            mealTime: meal.mealTime,
            notes: meal.notes,
            dietPlanId: plan.id,
          },
        });

        for (const item of meal.items) {
          await tx.dietPlanMealItem.create({
            data: {
              foodName: item.foodName,
              foodLibraryId: item.foodLibraryId,
              sourceType: item.sourceType || 'CUSTOM',
              quantity: item.quantity,
              unit: item.unit,
              calories: item.calories,
              protein: item.protein,
              carbs: item.carbs,
              fat: item.fat,
              notes: item.notes,
              mealId: clonedMeal.id,
            },
          });
        }
      }

      // Re-read full plan scope to match findById response formatting
      return tx.dietPlan.findFirst({
        where: { id: plan.id },
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
        },
      });
    });
  },
};
