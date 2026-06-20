// src/modules/diet-plans/diet-plan.mapper.js
// Diet plan response serialization.

export function mapMealItem(item) {
  if (!item) return null;
  return {
    id: item.id,
    mealId: item.mealId,
    foodLibraryId: item.foodLibraryId || null,
    sourceType: item.sourceType || 'CUSTOM',
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
    totalCalories: dietPlan.totalCalories || 0,
    totalProtein: dietPlan.totalProtein || 0,
    totalCarbs: dietPlan.totalCarbs || 0,
    totalFat: dietPlan.totalFat || 0,
    instructions: dietPlan.instructions || null,
    recommendations: dietPlan.recommendations || null,
    lifestyleAdvice: dietPlan.lifestyleAdvice || null,
    hydration: dietPlan.hydration || null,
    supplementNotes: dietPlan.supplementNotes || null,
    mealPrepNotes: dietPlan.mealPrepNotes || null,
    versionNumber: dietPlan.versionNumber || 1,
    startDate: dietPlan.startDate ? dietPlan.startDate.toISOString() : null,
    endDate: dietPlan.endDate ? dietPlan.endDate.toISOString() : null,
    cycleStartDate: dietPlan.cycleStartDate ? dietPlan.cycleStartDate.toISOString() : null,
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
    cycles: dietPlan.cycles ? dietPlan.cycles.map(cycle => ({
      id: cycle.id,
      name: cycle.name,
      description: cycle.description,
      startDay: cycle.startDay,
      days: cycle.days ? cycle.days.map(day => ({
        id: day.id,
        dayNumber: day.dayNumber,
        dayLabel: day.dayLabel,
        description: day.description,
        isActive: day.isActive,
        plannedCalories: day.plannedCalories,
        plannedProtein: day.plannedProtein,
        plannedCarbs: day.plannedCarbs,
        plannedFat: day.plannedFat,
        meals: day.meals ? day.meals.map(mapMeal) : [],
      })) : [],
    })) : [],
    resolvedCycleDay: dietPlan.resolvedCycleDay || null,
  };
}

export function mapDietPlanList(dietPlans) {
  return dietPlans.map(mapDietPlan);
}
