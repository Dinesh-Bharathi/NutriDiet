// src/modules/meal-swaps/meal-swap.service.js
import { mealSwapRepository } from "./meal-swap.repository.js";
import {
  scaleQuantity,
  calculateDeltas,
  calculateMatchScore,
} from "./meal-swap.engine.js";
import { ApiError } from "../../utils/ApiError.js";
import prisma from "../../lib/prisma.js";

/**
 * Builds a map of category ID -> category and calculates relationship
 */
function getCategoryRelationship(origFood, targetFood, categories) {
  if (!origFood.categoryId || !targetFood.categoryId) {
    return "DIFFERENT";
  }

  if (origFood.categoryId === targetFood.categoryId) {
    return "SAME_CATEGORY";
  }

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const origCat = catMap.get(origFood.categoryId);
  const targetCat = catMap.get(targetFood.categoryId);

  if (!origCat || !targetCat) {
    return "DIFFERENT";
  }

  // Parent-Child relationship
  if (
    origCat.parentId === targetFood.categoryId ||
    targetCat.parentId === origFood.categoryId
  ) {
    return "PARENT_CHILD_CATEGORY";
  }

  // Sister relationship (share parent)
  if (origCat.parentId && origCat.parentId === targetCat.parentId) {
    return "SISTER_CATEGORY";
  }

  return "DIFFERENT";
}

export const mealSwapService = {
  /**
   * Fetch swap candidates for a specific meal item
   */
  async getSwapCandidates(tenantId, itemId, strategy, filters = {}) {
    const { q, page = 1, limit = 20 } = filters;

    const mealItem = await mealSwapRepository.findMealItemById(
      tenantId,
      itemId,
    );
    if (!mealItem) {
      throw ApiError.notFound("Meal item");
    }

    const origFoodId = mealItem.foodLibraryId;
    if (!origFoodId) {
      throw ApiError.badRequest(
        "Cannot swap custom food item not linked to the food library",
      );
    }

    const originalFood = await mealSwapRepository.findFoodById(
      tenantId,
      origFoodId,
    );
    if (!originalFood) {
      throw ApiError.notFound("Original food library item");
    }

    // 1. Fetch potential candidates (excluding original food) using DB query (search & paginated)
    const { candidates, total } = await mealSwapRepository.findCandidateFoods(
      tenantId,
      origFoodId,
      q,
      page,
      limit,
    );

    // 2. Fetch categories for relationship checks
    const categories = await mealSwapRepository.getFoodCategories(tenantId);

    // 3. Process and score candidates
    const recommended = [];
    const equivalents = [];
    const sameCategory = [];
    const alternatives = [];

    const origQty = mealItem.quantity;

    for (const targetFood of candidates) {
      // 3.1. Filter check for tags (future filter support)
      if (filters.tags && filters.tags.length > 0) {
        const foodTags = targetFood.tagMappings.map((m) =>
          m.tag.name.toLowerCase(),
        );
        const hasMatchingTag = filters.tags.some((t) =>
          foodTags.includes(t.toLowerCase()),
        );
        if (!hasMatchingTag) continue;
      }

      // Future filter support placeholders (allergies, preferences, restrictions)
      if (filters.allergies && filters.allergies.length > 0) {
        // Reserved for future integration.
      }
      if (filters.preferences && filters.preferences.length > 0) {
        // Reserved for future integration.
      }
      if (filters.restrictions && filters.restrictions.length > 0) {
        // Reserved for future integration.
      }

      // 3.2. Scaling
      const suggestedQuantity = scaleQuantity(
        originalFood,
        targetFood,
        strategy,
        origQty,
      );

      // 3.3. Deltas
      const deltas = calculateDeltas(
        originalFood,
        targetFood,
        origQty,
        suggestedQuantity,
      );

      // 3.4. Match Score
      let score = 0;

      // Check for direct equivalents first
      const directEquivalent =
        targetFood.sourceEquivalents[0] || targetFood.targetEquivalents[0];

      const catRel = getCategoryRelationship(
        originalFood,
        targetFood,
        categories,
      );

      if (directEquivalent) {
        score = directEquivalent.similarityScore;
      } else {
        score = calculateMatchScore(originalFood, targetFood, catRel);
      }

      const mappedCandidate = {
        food: {
          id: targetFood.id,
          foodName: targetFood.foodName,
          commonName: targetFood.commonName,
          brandName: targetFood.brandName,
          searchKeywords: targetFood.searchKeywords,
          isSystem: targetFood.isSystem,
          calories: targetFood.calories,
          protein: targetFood.protein,
          carbs: targetFood.carbs,
          fat: targetFood.fat,
          defaultUnit: targetFood.defaultUnit,
          servingSize: targetFood.servingSize,
          servingUnit: targetFood.servingUnit,
          categoryId: targetFood.categoryId,
          categoryName: targetFood.category?.name || null,
          tags: targetFood.tagMappings.map((m) => ({
            id: m.tag.id,
            name: m.tag.name,
            description: m.tag.description,
          })),
        },
        suggestedQuantity,
        deltas,
        matchScore: score,
        matchStrategy: strategy,
        isEquivalent: !!directEquivalent,
      };

      // Classification Rules:
      // 1. Direct FoodEquivalent -> equivalents
      // 2. Same Category -> sameCategory
      // 3. Sister Category -> recommended
      // 4. Everything else -> alternatives
      if (directEquivalent) {
        equivalents.push(mappedCandidate);
      } else if (
        originalFood.categoryId &&
        targetFood.categoryId === originalFood.categoryId
      ) {
        if (score >= 85) {
          recommended.push(mappedCandidate);
        } else {
          sameCategory.push(mappedCandidate);
        }
      } else if (
        catRel === "SISTER_CATEGORY" ||
        catRel === "PARENT_CHILD_CATEGORY"
      ) {
        if (score >= 60) {
          recommended.push(mappedCandidate);
        } else {
          alternatives.push(mappedCandidate);
        }
      } else {
        alternatives.push(mappedCandidate);
      }
    }

    // Sort helper function
    const sortFn = (a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return a.food.foodName.localeCompare(b.food.foodName);
    };

    return {
      data: {
        recommended: recommended.sort(sortFn),
        equivalents: equivalents.sort(sortFn),
        sameCategory: sameCategory.sort(sortFn),
        alternatives: alternatives.sort(sortFn),
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Apply single swap on a meal item
   */
  async applySingleSwap(tenantId, itemId, targetFoodId, strategy, performedBy) {
    const mealItem = await mealSwapRepository.findMealItemById(
      tenantId,
      itemId,
    );
    if (!mealItem) {
      throw ApiError.notFound("Meal item");
    }

    const origFoodId = mealItem.foodLibraryId;
    if (!origFoodId) {
      throw ApiError.badRequest(
        "Cannot swap custom food item not linked to the food library",
      );
    }

    const originalFood = await mealSwapRepository.findFoodById(
      tenantId,
      origFoodId,
    );
    if (!originalFood) {
      throw ApiError.notFound("Original food library item");
    }

    const targetFood = await mealSwapRepository.findFoodById(
      tenantId,
      targetFoodId,
    );
    if (!targetFood) {
      throw ApiError.notFound("Target food library item");
    }

    // Calculate scaled quantity
    const suggestedQuantity = scaleQuantity(
      originalFood,
      targetFood,
      strategy,
      mealItem.quantity,
    );

    // Calculate score
    let score = 0;
    const categories = await mealSwapRepository.getFoodCategories(tenantId);

    // Check direct equivalents
    const equivalents = await prisma.foodEquivalent.findFirst({
      where: {
        OR: [
          { sourceFoodId: origFoodId, targetFoodId },
          { sourceFoodId: targetFoodId, targetFoodId: origFoodId },
        ],
      },
    });

    if (equivalents) {
      score = equivalents.similarityScore;
    } else {
      const catRel = getCategoryRelationship(
        originalFood,
        targetFood,
        categories,
      );
      score = calculateMatchScore(originalFood, targetFood, catRel);
    }

    // Calculate macros per serving
    const size = targetFood.servingSize || 100;
    const mult = suggestedQuantity / size;

    const updatePayload = {
      foodLibraryId: targetFoodId,
      foodName: targetFood.foodName,
      quantity: suggestedQuantity,
      unit: targetFood.defaultUnit,
      calories: targetFood.calories ? targetFood.calories * mult : null,
      protein: targetFood.protein ? targetFood.protein * mult : null,
      carbs: targetFood.carbs ? targetFood.carbs * mult : null,
      fat: targetFood.fat ? targetFood.fat * mult : null,
    };

    const auditPayload = {
      tenantId,
      originalFoodId: origFoodId,
      targetFoodId,
      swapStrategy: strategy,
      scope: "SINGLE_ITEM",
      matchScore: score,
      quantityBefore: mealItem.quantity,
      quantityAfter: suggestedQuantity,
      performedBy,
    };

    return mealSwapRepository.applySingleSwap(
      itemId,
      updatePayload,
      auditPayload,
    );
  },

  /**
   * Apply bulk swap on a Diet Plan
   */
  async applyBulkPlanSwap(tenantId, dietPlanId, payload, performedBy) {
    const { originalFoodId, targetFoodId, swapStrategy, cycleId, cycleDayId } =
      payload;

    const dietPlan = await mealSwapRepository.findDietPlanById(
      tenantId,
      dietPlanId,
    );
    if (!dietPlan) {
      throw ApiError.notFound("Diet plan");
    }

    const originalFood = await mealSwapRepository.findFoodById(
      tenantId,
      originalFoodId,
    );
    if (!originalFood) {
      throw ApiError.notFound("Original food library item");
    }

    const targetFood = await mealSwapRepository.findFoodById(
      tenantId,
      targetFoodId,
    );
    if (!targetFood) {
      throw ApiError.notFound("Target food library item");
    }

    // Calculate score
    let score = 0;
    const categories = await mealSwapRepository.getFoodCategories(tenantId);
    const equivalents = await prisma.foodEquivalent.findFirst({
      where: {
        OR: [
          { sourceFoodId: originalFoodId, targetFoodId },
          { sourceFoodId: targetFoodId, targetFoodId: originalFoodId },
        ],
      },
    });

    if (equivalents) {
      score = equivalents.similarityScore;
    } else {
      const catRel = getCategoryRelationship(
        originalFood,
        targetFood,
        categories,
      );
      score = calculateMatchScore(originalFood, targetFood, catRel);
    }

    const calculateNewItemFn = (origQuantity) => {
      const suggestedQuantity = scaleQuantity(
        originalFood,
        targetFood,
        swapStrategy,
        origQuantity,
      );
      const size = targetFood.servingSize || 100;
      const mult = suggestedQuantity / size;

      return {
        foodName: targetFood.foodName,
        quantity: suggestedQuantity,
        unit: targetFood.defaultUnit,
        calories: targetFood.calories ? targetFood.calories * mult : null,
        protein: targetFood.protein ? targetFood.protein * mult : null,
        carbs: targetFood.carbs ? targetFood.carbs * mult : null,
        fat: targetFood.fat ? targetFood.fat * mult : null,
      };
    };

    return mealSwapRepository.applyBulkPlanSwap({
      tenantId,
      dietPlanId,
      originalFoodId,
      targetFoodId,
      swapStrategy,
      performedBy,
      cycleId,
      cycleDayId,
      calculateNewItemFn,
      score,
    });
  },

  /**
   * Apply bulk swap on a Diet Plan Template
   */
  async applyBulkTemplateSwap(tenantId, templateId, payload, performedBy) {
    const { originalFoodId, targetFoodId, swapStrategy, cycleId, cycleDayId } =
      payload;

    const template = await mealSwapRepository.findTemplateById(
      tenantId,
      templateId,
    );
    if (!template) {
      throw ApiError.notFound("Diet plan template");
    }

    const originalFood = await mealSwapRepository.findFoodById(
      tenantId,
      originalFoodId,
    );
    if (!originalFood) {
      throw ApiError.notFound("Original food library item");
    }

    const targetFood = await mealSwapRepository.findFoodById(
      tenantId,
      targetFoodId,
    );
    if (!targetFood) {
      throw ApiError.notFound("Target food library item");
    }

    // Calculate score
    let score = 0;
    const categories = await mealSwapRepository.getFoodCategories(tenantId);
    const equivalents = await prisma.foodEquivalent.findFirst({
      where: {
        OR: [
          { sourceFoodId: originalFoodId, targetFoodId },
          { sourceFoodId: targetFoodId, targetFoodId: originalFoodId },
        ],
      },
    });

    if (equivalents) {
      score = equivalents.similarityScore;
    } else {
      const catRel = getCategoryRelationship(
        originalFood,
        targetFood,
        categories,
      );
      score = calculateMatchScore(originalFood, targetFood, catRel);
    }

    const calculateNewItemFn = (origQuantity) => {
      const suggestedQuantity = scaleQuantity(
        originalFood,
        targetFood,
        swapStrategy,
        origQuantity,
      );
      const size = targetFood.servingSize || 100;
      const mult = suggestedQuantity / size;

      return {
        foodName: targetFood.foodName,
        quantity: suggestedQuantity,
        unit: targetFood.defaultUnit,
        calories: targetFood.calories ? targetFood.calories * mult : null,
        protein: targetFood.protein ? targetFood.protein * mult : null,
        carbs: targetFood.carbs ? targetFood.carbs * mult : null,
        fat: targetFood.fat ? targetFood.fat * mult : null,
      };
    };

    return mealSwapRepository.applyBulkTemplateSwap({
      tenantId,
      templateId,
      originalFoodId,
      targetFoodId,
      swapStrategy,
      performedBy,
      cycleId,
      cycleDayId,
      calculateNewItemFn,
      score,
    });
  },
};
