// src/modules/diet-plan-templates/diet-plan-template.mapper.js
// Serialization mapping for DietPlanTemplate, DietPlanTemplateMeal, and DietPlanTemplateMealItem.

export function mapTemplateMealItem(item) {
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

export function mapTemplateMeal(meal) {
  if (!meal) return null;
  return {
    id: meal.id,
    templateId: meal.templateId,
    name: meal.name,
    mealOrder: meal.mealOrder,
    mealTime: meal.mealTime || null,
    notes: meal.notes || null,
    items: meal.items ? meal.items.map(mapTemplateMealItem) : [],
  };
}

export function mapTemplate(tpl) {
  if (!tpl) return null;
  return {
    id: tpl.id,
    title: tpl.title,
    description: tpl.description || null,
    goal: tpl.goal || null,
    dailyCalories: tpl.dailyCalories || null,
    proteinGrams: tpl.proteinGrams || null,
    carbGrams: tpl.carbGrams || null,
    fatGrams: tpl.fatGrams || null,
    totalCalories: tpl.totalCalories || 0,
    totalProtein: tpl.totalProtein || 0,
    totalCarbs: tpl.totalCarbs || 0,
    totalFat: tpl.totalFat || 0,
    isPublic: tpl.isPublic,
    createdBy: tpl.createdBy,
    createdAt: tpl.createdAt,
    updatedAt: tpl.updatedAt,
    creator: tpl.creator
      ? {
          id: tpl.creator.id,
          firstName: tpl.creator.firstName,
          lastName: tpl.creator.lastName,
          fullName: `${tpl.creator.firstName} ${tpl.creator.lastName}`,
          email: tpl.creator.email,
        }
      : null,
    meals: tpl.meals ? tpl.meals.map(mapTemplateMeal) : [], // wait, it's mapTemplateMeal! Let's correct this.
  };
}

export function mapTemplateList(templates) {
  return templates.map((tpl) => ({
    id: tpl.id,
    title: tpl.title,
    description: tpl.description || null,
    goal: tpl.goal || null,
    dailyCalories: tpl.dailyCalories || null,
    proteinGrams: tpl.proteinGrams || null,
    carbGrams: tpl.carbGrams || null,
    fatGrams: tpl.fatGrams || null,
    totalCalories: tpl.totalCalories || 0,
    totalProtein: tpl.totalProtein || 0,
    totalCarbs: tpl.totalCarbs || 0,
    totalFat: tpl.totalFat || 0,
    isPublic: tpl.isPublic,
    createdBy: tpl.createdBy,
    createdAt: tpl.createdAt,
    updatedAt: tpl.updatedAt,
    creator: tpl.creator
      ? {
          id: tpl.creator.id,
          firstName: tpl.creator.firstName,
          lastName: tpl.creator.lastName,
          fullName: `${tpl.creator.firstName} ${tpl.creator.lastName}`,
          email: tpl.creator.email,
        }
      : null,
  }));
}
