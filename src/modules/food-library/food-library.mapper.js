// src/modules/food-library/food-library.mapper.js
// Serialization mapping for FoodLibrary records.

export const mapFoodItem = (food) => {
  if (!food) return null;

  return {
    id: food.id,
    foodName: food.foodName,
    sourceType: food.sourceType,
    defaultQuantity: food.defaultQuantity,
    defaultUnit: food.defaultUnit,
    servingSize: food.servingSize,
    servingUnit: food.servingUnit,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    createdAt: food.createdAt.toISOString(),
    updatedAt: food.updatedAt.toISOString(),
  };
};

export const mapFoodList = (foods) => {
  if (!Array.isArray(foods)) return [];
  return foods.map(mapFoodItem);
};
