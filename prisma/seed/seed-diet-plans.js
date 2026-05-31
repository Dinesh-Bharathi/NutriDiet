// prisma/seed/seed-diet-plans.js
import prisma from '../../src/lib/prisma.js';

export async function seedDietPlans(tenants, users, clients, foodLibraryResults) {
  console.log('Seeding client diet plans...');
  const { tenant1, tenant2 } = tenants;
  const { t1Clients, t2Clients } = clients;

  const t1DietitianId = users.t1.dietitian.id;
  const t2DietitianId = users.t2.dietitian.id;

  const dietPlans = [];

  for (const tenant of [tenant1, tenant2]) {
    const tenantId = tenant.id;
    const dietitianId = tenantId === tenant1.id ? t1DietitianId : t2DietitianId;
    const clientList = tenantId === tenant1.id ? t1Clients : t2Clients;

    // Helper to find food from seeded results
    const foodMap = foodLibraryResults[tenantId].foods.reduce((acc, f) => {
      acc[f.foodName] = f;
      return acc;
    }, {});

    // For each client, create 1 active plan
    for (const client of clientList) {
      // Find associated assessment
      const assessment = await prisma.assessment.findFirst({
        where: { clientId: client.id, tenantId }
      });

      // Target calories/macros based on goal
      let cal = 1800;
      let protein = 140;
      let carbs = 160;
      let fat = 50;

      if (assessment?.goal?.includes('Gain') || assessment?.goal?.includes('Sports')) {
        cal = 2200;
        protein = 160;
        carbs = 230;
        fat = 60;
      } else if (assessment?.goal?.includes('Diabetes')) {
        cal = 1600;
        protein = 110;
        carbs = 140;
        fat = 55;
      }

      const plan = await prisma.dietPlan.create({
        data: {
          tenantId,
          clientId: client.id,
          assessmentId: assessment?.id || null,
          title: `Active Nutrition Strategy - ${client.firstName}`,
          description: `Custom macro allocation for ${client.firstName} ${client.lastName}.`,
          goal: assessment?.goal || 'General Health',
          dailyCalories: cal,
          proteinGrams: protein,
          carbGrams: carbs,
          fatGrams: fat,
          totalCalories: cal,
          totalProtein: protein,
          totalCarbs: carbs,
          totalFat: fat,
          status: 'ACTIVE',
          versionNumber: 1,
          startDate: new Date('2026-05-01'),
          cycleStartDate: new Date('2026-05-01'),
          createdBy: dietitianId,
        },
      });

      // Create DietPlanCycle
      const cycle = await prisma.dietPlanCycle.create({
        data: {
          dietPlanId: plan.id,
          name: 'Main Diet Cycle',
          description: 'Rotating Day A and Day B meals schedule.',
        },
      });

      // Create Day A and Day B
      const daysData = [
        {
          dayNumber: 1,
          dayLabel: 'Day A (Training Day)',
          description: 'Focused carb reloading structure.',
          plannedCalories: cal + 100,
          plannedProtein: protein + 5,
          plannedCarbs: carbs + 25,
          plannedFat: fat - 5,
          meals: [
            {
              name: 'BREAKFAST',
              mealOrder: 1,
              mealTime: '08:00',
              notes: 'Consume post early morning hydration.',
              items: [
                { foodName: 'Steel Cut Oats', qty: 80, unit: 'g' },
                { foodName: 'Whey Protein Isolate', qty: 30, unit: 'g' },
                { foodName: 'Fresh Blueberries', qty: 100, unit: 'g' }
              ]
            },
            {
              name: 'LUNCH',
              mealOrder: 2,
              mealTime: '13:00',
              notes: 'Clean post-activity recovery meal.',
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
              notes: 'Protein snack.',
              items: [
                { foodName: 'Greek Yogurt 0% Fat', qty: 200, unit: 'g' },
                { foodName: 'Fresh Apple Red', qty: 1, unit: 'medium' }
              ]
            },
            {
              name: 'DINNER',
              mealOrder: 4,
              mealTime: '20:30',
              notes: 'Balanced evening dinner.',
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
          description: 'Focused lean recovery structure.',
          plannedCalories: cal - 100,
          plannedProtein: protein - 5,
          plannedCarbs: carbs - 25,
          plannedFat: fat + 5,
          meals: [
            {
              name: 'BREAKFAST',
              mealOrder: 1,
              mealTime: '08:30',
              notes: 'Healthy fats startup.',
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
              notes: 'Leafy green lean protein mix.',
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
              notes: 'Sustained release proteins.',
              items: [
                { foodName: 'Cottage Cheese 2%', qty: 200, unit: 'g' },
                { foodName: 'Raw Almonds', qty: 28, unit: 'g' }
              ]
            },
            {
              name: 'DINNER',
              mealOrder: 4,
              mealTime: '20:00',
              notes: 'Slow absorbing dinner.',
              items: [
                { foodName: 'Extra Firm Tofu', qty: 200, unit: 'g' },
                { foodName: 'Steamed Broccoli', qty: 150, unit: 'g' },
                { foodName: 'Peanut Butter Smooth', qty: 16, unit: 'g' }
              ]
            }
          ]
        }
      ];

      for (const dData of daysData) {
        const day = await prisma.dietPlanCycleDay.create({
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
          const meal = await prisma.dietPlanMeal.create({
            data: {
              dietPlanId: plan.id,
              name: mData.name,
              mealOrder: mData.mealOrder,
              mealTime: mData.mealTime,
              notes: mData.notes,
              cycleDayId: day.id,
            },
          });

          for (const iData of mData.items) {
            const matchedFood = foodMap[iData.foodName];
            const factor = iData.qty / (matchedFood?.defaultQuantity || 100);
            const calories = matchedFood?.calories ? Number((matchedFood.calories * factor).toFixed(1)) : null;
            const protein = matchedFood?.protein ? Number((matchedFood.protein * factor).toFixed(1)) : null;
            const carbs = matchedFood?.carbs ? Number((matchedFood.carbs * factor).toFixed(1)) : null;
            const fat = matchedFood?.fat ? Number((matchedFood.fat * factor).toFixed(1)) : null;

            await prisma.dietPlanMealItem.create({
              data: {
                mealId: meal.id,
                foodLibraryId: matchedFood?.id || null,
                foodName: iData.foodName,
                sourceType: 'CUSTOM',
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

      dietPlans.push(plan);
    }
  }

  console.log('Client diet plans seeded successfully.');
  return dietPlans;
}
