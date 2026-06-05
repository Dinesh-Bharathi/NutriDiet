// prisma/seed/seed-templates.js
import prisma from '../../src/lib/prisma.js';

export async function seedTemplates(tenants, users, foodLibraryResults) {
  console.log('Seeding templates...');
  const { tenant1, tenant2 } = tenants;

  const t1DietitianId = users.t1.dietitian.id;
  const t2DietitianId = users.t2.dietitian.id;

  const templates = [];

  for (const tenant of [tenant1, tenant2]) {
    const tenantId = tenant.id;
    const creatorId = tenantId === tenant1.id ? t1DietitianId : t2DietitianId;

    // Helper to find food from seeded results
    const foodMap = foodLibraryResults[tenantId].foods.reduce((acc, f) => {
      acc[f.foodName] = f;
      return acc;
    }, {});

    // Define 3 templates
    const templatesData = [
      {
        title: 'High Protein 2000 kcal',
        description: 'Designed for active individuals looking to build lean muscle mass.',
        goalType: 'MUSCLE_GAIN',
        dailyCalories: 2000,
        proteinGrams: 160,
        carbGrams: 180,
        fatGrams: 60,
        cycles: [
          {
            name: 'Training / Rest Split',
            description: 'Alternate between training day (Day A) and rest day (Day B) nutrition.',
            days: [
              {
                dayNumber: 1,
                dayLabel: 'Day A (Training Day)',
                description: 'High carb, high protein setup around exercise window.',
                plannedCalories: 2100,
                plannedProtein: 165,
                plannedCarbs: 210,
                plannedFat: 55,
                meals: [
                  {
                    name: 'BREAKFAST',
                    mealOrder: 1,
                    mealTime: '08:00',
                    notes: 'Eat within 1 hour of waking up',
                    items: [
                      { foodName: 'Steel Cut Oats', qty: 75, unit: 'g' },
                      { foodName: 'Whey Protein Isolate', qty: 30, unit: 'g' },
                      { foodName: 'Fresh Blueberries', qty: 100, unit: 'g' }
                    ]
                  },
                  {
                    name: 'LUNCH',
                    mealOrder: 2,
                    mealTime: '13:00',
                    notes: 'Post workout carbohydrate loading meal',
                    items: [
                      { foodName: 'Grilled Chicken Breast', qty: 150, unit: 'g' },
                      { foodName: 'Organic Brown Rice', qty: 200, unit: 'g' },
                      { foodName: 'Steamed Broccoli', qty: 120, unit: 'g' }
                    ]
                  },
                  {
                    name: 'EVENING_SNACK',
                    mealOrder: 3,
                    mealTime: '17:00',
                    notes: 'Quick snack for sustained energy',
                    items: [
                      { foodName: 'Greek Yogurt 0% Fat', qty: 200, unit: 'g' },
                      { foodName: 'Fresh Apple Red', qty: 1, unit: 'medium' }
                    ]
                  },
                  {
                    name: 'DINNER',
                    mealOrder: 4,
                    mealTime: '20:30',
                    notes: 'Balanced evening dinner',
                    items: [
                      { foodName: 'Atlantic Salmon Fillet', qty: 120, unit: 'g' },
                      { foodName: 'Sweet Potato', qty: 150, unit: 'g' },
                      { foodName: 'Baby Spinach', qty: 100, unit: 'g' }
                    ]
                  }
                ]
              },
              {
                dayNumber: 2,
                dayLabel: 'Day B (Rest Day)',
                description: 'Lower carbs, slightly higher fats to promote muscle recovery.',
                plannedCalories: 1900,
                plannedProtein: 155,
                plannedCarbs: 150,
                plannedFat: 65,
                meals: [
                  {
                    name: 'BREAKFAST',
                    mealOrder: 1,
                    mealTime: '08:30',
                    notes: 'High fat, high protein startup',
                    items: [
                      { foodName: 'Whole Eggs Large', qty: 3, unit: 'eggs' },
                      { foodName: 'Egg Whites Liquid', qty: 100, unit: 'g' },
                      { foodName: 'Avocado Hass', qty: 75, unit: 'g' }
                    ]
                  },
                  {
                    name: 'LUNCH',
                    mealOrder: 2,
                    mealTime: '13:00',
                    notes: 'Lean protein recovery salad',
                    items: [
                      { foodName: 'Grilled Chicken Breast', qty: 150, unit: 'g' },
                      { foodName: 'Baby Spinach', qty: 150, unit: 'g' },
                      { foodName: 'Avocado Hass', qty: 75, unit: 'g' }
                    ]
                  },
                  {
                    name: 'EVENING_SNACK',
                    mealOrder: 3,
                    mealTime: '17:00',
                    notes: 'Protein snack',
                    items: [
                      { foodName: 'Cottage Cheese 2%', qty: 200, unit: 'g' },
                      { foodName: 'Raw Almonds', qty: 28, unit: 'g' }
                    ]
                  },
                  {
                    name: 'DINNER',
                    mealOrder: 4,
                    mealTime: '20:00',
                    notes: 'Slow-digesting evening meal',
                    items: [
                      { foodName: 'Extra Firm Tofu', qty: 200, unit: 'g' },
                      { foodName: 'Steamed Broccoli', qty: 150, unit: 'g' },
                      { foodName: 'Peanut Butter Smooth', qty: 16, unit: 'g' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        title: 'Fat Loss 1800 kcal',
        description: 'Optimized for healthy weight reduction without compromising lean tissue.',
        goalType: 'WEIGHT_LOSS',
        dailyCalories: 1800,
        proteinGrams: 150,
        carbGrams: 150,
        fatGrams: 50,
        cycles: [
          {
            name: 'Caloric Deficit Cycle',
            description: '2-day rotating caloric deficit schedule.',
            days: [
              {
                dayNumber: 1,
                dayLabel: 'Day A',
                description: 'First Deficit Day',
                plannedCalories: 1800,
                plannedProtein: 150,
                plannedCarbs: 150,
                plannedFat: 50,
                meals: [
                  {
                    name: 'BREAKFAST',
                    mealOrder: 1,
                    mealTime: '08:00',
                    items: [
                      { foodName: 'Greek Yogurt 0% Fat', qty: 250, unit: 'g' },
                      { foodName: 'Fresh Blueberries', qty: 150, unit: 'g' }
                    ]
                  },
                  {
                    name: 'LUNCH',
                    mealOrder: 2,
                    mealTime: '13:00',
                    items: [
                      { foodName: 'Grilled Chicken Breast', qty: 150, unit: 'g' },
                      { foodName: 'Sweet Potato', qty: 100, unit: 'g' },
                      { foodName: 'Steamed Broccoli', qty: 150, unit: 'g' }
                    ]
                  },
                  {
                    name: 'EVENING_SNACK',
                    mealOrder: 3,
                    mealTime: '17:00',
                    items: [
                      { foodName: 'Cottage Cheese 2%', qty: 150, unit: 'g' }
                    ]
                  },
                  {
                    name: 'DINNER',
                    mealOrder: 4,
                    mealTime: '20:00',
                    items: [
                      { foodName: 'Atlantic Salmon Fillet', qty: 120, unit: 'g' },
                      { foodName: 'Baby Spinach', qty: 150, unit: 'g' }
                    ]
                  }
                ]
              },
              {
                dayNumber: 2,
                dayLabel: 'Day B',
                description: 'Second Deficit Day',
                plannedCalories: 1800,
                plannedProtein: 150,
                plannedCarbs: 150,
                plannedFat: 50,
                meals: [
                  {
                    name: 'BREAKFAST',
                    mealOrder: 1,
                    mealTime: '08:00',
                    items: [
                      { foodName: 'Egg Whites Liquid', qty: 240, unit: 'g' },
                      { foodName: 'Whole Eggs Large', qty: 1, unit: 'egg' },
                      { foodName: 'Baby Spinach', qty: 100, unit: 'g' }
                    ]
                  },
                  {
                    name: 'LUNCH',
                    mealOrder: 2,
                    mealTime: '13:00',
                    items: [
                      { foodName: 'Extra Firm Tofu', qty: 200, unit: 'g' },
                      { foodName: 'Organic Brown Rice', qty: 150, unit: 'g' },
                      { foodName: 'Steamed Broccoli', qty: 100, unit: 'g' }
                    ]
                  },
                  {
                    name: 'EVENING_SNACK',
                    mealOrder: 3,
                    mealTime: '17:00',
                    items: [
                      { foodName: 'Whey Protein Isolate', qty: 30, unit: 'g' }
                    ]
                  },
                  {
                    name: 'DINNER',
                    mealOrder: 4,
                    mealTime: '20:00',
                    items: [
                      { foodName: 'Grilled Chicken Breast', qty: 150, unit: 'g' },
                      { foodName: 'Avocado Hass', qty: 50, unit: 'g' },
                      { foodName: 'Steamed Broccoli', qty: 150, unit: 'g' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        title: 'Vegetarian Balance Plan',
        description: 'A nutritionally complete, plant-based routine focusing on protein synergy.',
        goalType: 'MEDICAL_NUTRITION',
        dailyCalories: 1750,
        proteinGrams: 105,
        carbGrams: 190,
        fatGrams: 60,
        cycles: [
          {
            name: 'Balanced Rotation',
            description: 'Standard 2-day rotation schedule.',
            days: [
              {
                dayNumber: 1,
                dayLabel: 'Day A',
                description: 'Soy & Dairy Focused Day',
                plannedCalories: 1750,
                plannedProtein: 105,
                plannedCarbs: 190,
                plannedFat: 60,
                meals: [
                  {
                    name: 'BREAKFAST',
                    mealOrder: 1,
                    mealTime: '08:00',
                    items: [
                      { foodName: 'Greek Yogurt 0% Fat', qty: 200, unit: 'g' },
                      { foodName: 'Fresh Blueberries', qty: 100, unit: 'g' },
                      { foodName: 'Raw Almonds', qty: 15, unit: 'g' }
                    ]
                  },
                  {
                    name: 'LUNCH',
                    mealOrder: 2,
                    mealTime: '13:00',
                    items: [
                      { foodName: 'Extra Firm Tofu', qty: 250, unit: 'g' },
                      { foodName: 'Quinoa Grain Raw', qty: 75, unit: 'g' },
                      { foodName: 'Baby Spinach', qty: 100, unit: 'g' }
                    ]
                  },
                  {
                    name: 'EVENING_SNACK',
                    mealOrder: 3,
                    mealTime: '16:30',
                    items: [
                      { foodName: 'Cottage Cheese 2%', qty: 150, unit: 'g' }
                    ]
                  },
                  {
                    name: 'DINNER',
                    mealOrder: 4,
                    mealTime: '19:30',
                    items: [
                      { foodName: 'Whole Eggs Large', qty: 2, unit: 'eggs' },
                      { foodName: 'Avocado Hass', qty: 75, unit: 'g' },
                      { foodName: 'Steamed Broccoli', qty: 150, unit: 'g' }
                    ]
                  }
                ]
              },
              {
                dayNumber: 2,
                dayLabel: 'Day B',
                description: 'Seed & Grain Focused Day',
                plannedCalories: 1750,
                plannedProtein: 105,
                plannedCarbs: 190,
                plannedFat: 60,
                meals: [
                  {
                    name: 'BREAKFAST',
                    mealOrder: 1,
                    mealTime: '08:00',
                    items: [
                      { foodName: 'Steel Cut Oats', qty: 75, unit: 'g' },
                      { foodName: 'Almond Milk Unsweetened', qty: 240, unit: 'g' },
                      { foodName: 'Organic Chia Seeds', qty: 12, unit: 'g' }
                    ]
                  },
                  {
                    name: 'LUNCH',
                    mealOrder: 2,
                    mealTime: '13:00',
                    items: [
                      { foodName: 'Extra Firm Tofu', qty: 200, unit: 'g' },
                      { foodName: 'Organic Brown Rice', qty: 200, unit: 'g' },
                      { foodName: 'Steamed Broccoli', qty: 100, unit: 'g' }
                    ]
                  },
                  {
                    name: 'EVENING_SNACK',
                    mealOrder: 3,
                    mealTime: '17:00',
                    items: [
                      { foodName: 'Greek Yogurt 0% Fat', qty: 150, unit: 'g' }
                    ]
                  },
                  {
                    name: 'DINNER',
                    mealOrder: 4,
                    mealTime: '20:00',
                    items: [
                      { foodName: 'Cottage Cheese 2%', qty: 200, unit: 'g' },
                      { foodName: 'Peanut Butter Smooth', qty: 16, unit: 'g' },
                      { foodName: 'Baby Spinach', qty: 100, unit: 'g' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ];

    for (const tData of templatesData) {
      const template = await prisma.dietPlanTemplate.create({
        data: {
          tenantId,
          createdBy: creatorId,
          title: tData.title,
          description: tData.description,
          goalType: tData.goalType ?? null,
          dailyCalories: tData.dailyCalories,
          proteinGrams: tData.proteinGrams,
          carbGrams: tData.carbGrams,
          fatGrams: tData.fatGrams,
          totalCalories: tData.dailyCalories,
          totalProtein: tData.proteinGrams,
          totalCarbs: tData.carbGrams,
          totalFat: tData.fatGrams,
          isPublic: true,
        },
      });

      for (const cData of tData.cycles) {
        const cycle = await prisma.templateCycle.create({
          data: {
            templateId: template.id,
            name: cData.name,
            description: cData.description,
          },
        });

        for (const dData of cData.days) {
          const day = await prisma.templateCycleDay.create({
            data: {
              cycleId: cycle.id,
              dayNumber: dData.dayNumber,
              dayLabel: dData.dayLabel,
              description: dData.description,
              isActive: true,
              plannedCalories: dData.plannedCalories,
              plannedProtein: dData.plannedProtein,
              plannedCarbs: dData.plannedCarbs,
              plannedFat: dData.plannedFat,
            },
          });

          for (const mData of dData.meals) {
            const meal = await prisma.dietPlanTemplateMeal.create({
              data: {
                templateId: template.id,
                name: mData.name,
                mealOrder: mData.mealOrder,
                mealTime: mData.mealTime,
                notes: mData.notes,
                cycleDayId: day.id,
              },
            });

            for (const iData of mData.items) {
              const matchedFood = foodMap[iData.foodName];
              
              // Calculate specific macro properties based on quantity vs default size
              const factor = iData.qty / (matchedFood?.defaultQuantity || 100);
              const calories = matchedFood?.calories ? Number((matchedFood.calories * factor).toFixed(1)) : null;
              const protein = matchedFood?.protein ? Number((matchedFood.protein * factor).toFixed(1)) : null;
              const carbs = matchedFood?.carbs ? Number((matchedFood.carbs * factor).toFixed(1)) : null;
              const fat = matchedFood?.fat ? Number((matchedFood.fat * factor).toFixed(1)) : null;

              await prisma.dietPlanTemplateMealItem.create({
                data: {
                  mealId: meal.id,
                  foodLibraryId: matchedFood?.id || null,
                  foodName: iData.foodName,
                  sourceType: matchedFood ? 'SYSTEM' : 'CUSTOM',
                  quantity: iData.qty,
                  unit: iData.unit,
                  calories,
                  protein,
                  carbs,
                  fat,
                },
              });
            }
          }
        }
      }

      templates.push(template);
    }
  }

  console.log('Templates seeded successfully.');
  return templates;
}
