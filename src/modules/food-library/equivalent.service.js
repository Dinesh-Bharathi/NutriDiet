// src/modules/food-library/equivalent.service.js
import { equivalentRepository } from './equivalent.repository.js';
import { foodLibraryRepository } from './food-library.repository.js';
import ApiError from '../../utils/ApiError.js';
import prisma from '../../lib/prisma.js';

export const equivalentService = {
  async createEquivalent(tenantId, sourceFoodId, data) {
    // 1. Verify source food exists and belongs to tenant
    const sourceFood = await foodLibraryRepository.findById(tenantId, sourceFoodId);
    if (!sourceFood) {
      throw ApiError.notFound('Source Food');
    }

    // 2. Prevent equivalency to itself
    if (sourceFoodId === data.targetFoodId) {
      throw ApiError.badRequest('A food cannot be equivalent to itself');
    }

    // 3. Verify target food exists and belongs to tenant
    const targetFood = await foodLibraryRepository.findById(tenantId, data.targetFoodId);
    if (!targetFood) {
      throw ApiError.notFound('Target Food');
    }

    // 4. Prevent duplicate equivalency rules
    const existing = await prisma.foodEquivalent.findFirst({
      where: {
        sourceFoodId,
        targetFoodId: data.targetFoodId,
        equivalencyType: data.equivalencyType,
      },
    });
    if (existing) {
      throw ApiError.badRequest('An equivalency relationship of this type already exists between these foods');
    }

    return equivalentRepository.create(sourceFoodId, data);
  },

  async getAllEquivalentsForFood(tenantId, foodId) {
    const food = await foodLibraryRepository.findById(tenantId, foodId);
    if (!food) {
      throw ApiError.notFound('Food item');
    }

    return equivalentRepository.findAllForFood(foodId);
  },

  async deleteEquivalent(tenantId, id) {
    const equivalent = await equivalentRepository.findById(id);
    if (!equivalent || equivalent.sourceFood.tenantId !== tenantId) {
      throw ApiError.notFound('Equivalence relationship');
    }

    return equivalentRepository.delete(id);
  },

  // Future Swap Engine Support
  async getEquivalentFoods(tenantId, foodId) {
    const food = await foodLibraryRepository.findById(tenantId, foodId);
    if (!food) {
      throw ApiError.notFound('Food item');
    }

    const equivalents = await equivalentRepository.findEquivalentFoods(foodId);

    // Compute macro density per 100g on-the-fly for comparison:
    // Calories/Protein/Carbs/Fat density = (value / servingSize) * 100
    return equivalents.map((eq) => {
      const target = eq.targetFood;
      const size = target.servingSize || 100;
      return {
        id: eq.id,
        equivalencyType: eq.equivalencyType,
        similarityScore: eq.similarityScore,
        food: {
          id: target.id,
          foodName: target.foodName,
          commonName: target.commonName,
          brandName: target.brandName,
          status: target.status,
          calories: target.calories,
          protein: target.protein,
          carbs: target.carbs,
          fat: target.fat,
          servingSize: target.servingSize,
          servingUnit: target.servingUnit,
          // Macro Density per 100g:
          caloriesPer100g: target.calories ? (target.calories / size) * 100 : 0,
          proteinPer100g: target.protein ? (target.protein / size) * 100 : 0,
          carbsPer100g: target.carbs ? (target.carbs / size) * 100 : 0,
          fatPer100g: target.fat ? (target.fat / size) * 100 : 0,
          category: target.category,
          servings: target.servings,
          tags: target.tagMappings ? target.tagMappings.map((m) => m.tag) : [],
        },
      };
    });
  },
};
