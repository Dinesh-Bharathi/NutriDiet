// src/modules/diet-plans/diet-plan.mapper.js
// Diet plan response serialization.

export function mapMealItem(item) {
  if (!item) return null;
  return {
    id: item.id,
    mealId: item.mealId,
    foodName: item.foodName,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.calories || 0,
    protein: item.protein || 0,
    carbs: item.carbs || 0,
    fat: item.fat || 0,
    notes: item.notes || null,
  };
}

export function mapMeal(meal) {
  if (!meal) return null;
  return {
    id: meal.id,
    dietPlanId: meal.dietPlanId,
    name: meal.name,
    mealOrder: meal.mealOrder,
    mealTime: meal.mealTime || null,
    notes: meal.notes || null,
    items: meal.items ? meal.items.map(mapMealItem) : [],
  };
}

export function mapDietPlan(dietPlan) {
  if (!dietPlan) return null;
  return {
    id: dietPlan.id,
    clientId: dietPlan.clientId,
    assessmentId: dietPlan.assessmentId || null,
    title: dietPlan.title,
    description: dietPlan.description || null,
    goal: dietPlan.goal || null,
    dailyCalories: dietPlan.dailyCalories || null,
    proteinGrams: dietPlan.proteinGrams || null,
    carbGrams: dietPlan.carbGrams || null,
    fatGrams: dietPlan.fatGrams || null,
    startDate: dietPlan.startDate ? dietPlan.startDate.toISOString().split('T')[0] : null,
    endDate: dietPlan.endDate ? dietPlan.endDate.toISOString().split('T')[0] : null,
    status: dietPlan.status,
    createdAt: dietPlan.createdAt,
    updatedAt: dietPlan.updatedAt,
    creator: dietPlan.creator
      ? {
          id: dietPlan.creator.id,
          firstName: dietPlan.creator.firstName,
          lastName: dietPlan.creator.lastName,
          fullName: `${dietPlan.creator.firstName} ${dietPlan.creator.lastName}`,
          email: dietPlan.creator.email,
        }
      : null,
    meals: dietPlan.meals ? dietPlan.meals.map(mapMeal) : [],
  };
}

export function mapDietPlanList(dietPlans) {
  return dietPlans.map(mapDietPlan);
}
