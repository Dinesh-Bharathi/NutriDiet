// src/modules/food-library/food-library.mapper.js
// Serialization mapping for FoodLibrary records.

export const mapFoodItem = (food) => {
  if (!food) return null;

  return {
    id: food.id,
    foodName: food.foodName,
    sourceType: food.isSystem ? 'SYSTEM' : 'CUSTOM',
    defaultQuantity: food.defaultQuantity,
    defaultUnit: food.defaultUnit,
    servingSize: food.servingSize,
    servingUnit: food.servingUnit,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    categoryId: food.categoryId || null,
    searchKeywords: food.searchKeywords || null,
    commonName: food.commonName || null,
    brandName: food.brandName || null,
    status: food.status || 'ACTIVE',
    createdAt: food.createdAt.toISOString(),
    updatedAt: food.updatedAt.toISOString(),
    category: food.category ? {
      id: food.category.id,
      name: food.category.name,
      description: food.category.description,
      isSystem: food.category.isSystem,
    } : null,
    tags: food.tagMappings ? food.tagMappings.map((m) => ({
      id: m.tag.id,
      name: m.tag.name,
      description: m.tag.description,
      isSystem: m.tag.isSystem,
    })) : [],
    servings: food.servings ? food.servings.map((s) => ({
      id: s.id,
      name: s.name,
      grams: s.grams,
      unitType: s.unitType,
      isDefault: s.isDefault,
      displayOrder: s.displayOrder,
    })) : [],
  };
};

export const mapFoodList = (foods) => {
  if (!Array.isArray(foods)) return [];
  return foods.map(mapFoodItem);
};
