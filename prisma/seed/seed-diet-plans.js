// prisma/seed/seed-diet-plans.js
//
// Phase 6 SSoT-Aligned Diet Plan Seeder.
//
// CRITICAL FIX: DietPlan MUST carry a goalProfileId FK pointing to a
// ClientGoalProfile row. The diet-plan.service.js enforces this at runtime
// (throws 400 if no active goal profile exists). This seeder receives
// goalProfiles (keyed by clientId) from seedAssessments output and wires
// the FK correctly.
//
// DATA MODEL REFRESHER:
//   DietPlan → goalProfileId → ClientGoalProfile
//   DietPlan → assessmentId → Assessment (optional)
//   DietPlan → DietPlanCycle → DietPlanCycleDay → DietPlanMeal → DietPlanMealItem
//
// NOTE: No `goal` field exists on DietPlan schema — macros/goal come from
// goalProfile. The `totalCalories / totalProtein / totalCarbs / totalFat` are
// aggregated from meal items in production via recalculatePlanNutrition(); in
// the seed we compute them statically for demo consistency.

import prisma from '../../src/lib/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
// Macro targets by goal type
// ─────────────────────────────────────────────────────────────────────────────

function getMacroTarget(goalType) {
  switch (goalType) {
    case 'MUSCLE_GAIN':
    case 'PERFORMANCE':
      return { cal: 2400, protein: 170, carbs: 260, fat: 65 };
    case 'MEDICAL_NUTRITION':
      return { cal: 1600, protein: 110, carbs: 140, fat: 55 };
    case 'MAINTENANCE':
      return { cal: 1900, protein: 130, carbs: 200, fat: 60 };
    case 'WEIGHT_LOSS':
    default:
      return { cal: 1750, protein: 140, carbs: 155, fat: 50 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Day meal plan fixtures (shared across all tenants / clients — realistic demo)
// ─────────────────────────────────────────────────────────────────────────────

function buildDayMeals(cal, protein, carbs, fat) {
  return [
    {
      dayNumber: 1,
      dayLabel: 'Day A — Training Day',
      description: 'Higher carbohydrate loading for active training sessions.',
      plannedCalories: cal + 120,
      plannedProtein: protein + 5,
      plannedCarbs: carbs + 30,
      plannedFat: fat - 5,
      meals: [
        {
          name: 'BREAKFAST',
          mealOrder: 1,
          mealTime: '07:30',
          notes: 'High-energy pre-training fuel.',
          items: [
            { foodName: 'Steel Cut Oats', qty: 80, unit: 'g' },
            { foodName: 'Whey Protein Isolate', qty: 30, unit: 'g' },
            { foodName: 'Fresh Blueberries', qty: 100, unit: 'g' },
          ],
        },
        {
          name: 'MID_MORNING',
          mealOrder: 2,
          mealTime: '10:30',
          notes: 'Light carb bridge between meals.',
          items: [
            { foodName: 'Fresh Apple Red', qty: 1, unit: 'piece' },
            { foodName: 'Raw Almonds', qty: 20, unit: 'g' },
          ],
        },
        {
          name: 'LUNCH',
          mealOrder: 3,
          mealTime: '13:00',
          notes: 'Clean post-activity recovery meal.',
          items: [
            { foodName: 'Grilled Chicken Breast', qty: 160, unit: 'g' },
            { foodName: 'Organic Brown Rice', qty: 200, unit: 'g' },
            { foodName: 'Steamed Broccoli', qty: 120, unit: 'g' },
          ],
        },
        {
          name: 'EVENING_SNACK',
          mealOrder: 4,
          mealTime: '16:30',
          notes: 'Protein & fast-carb pre-workout snack.',
          items: [
            { foodName: 'Greek Yogurt 0% Fat', qty: 200, unit: 'g' },
            { foodName: 'Fresh Blueberries', qty: 60, unit: 'g' },
          ],
        },
        {
          name: 'DINNER',
          mealOrder: 5,
          mealTime: '20:00',
          notes: 'Balanced recovery dinner with omega-3.',
          items: [
            { foodName: 'Atlantic Salmon Fillet', qty: 130, unit: 'g' },
            { foodName: 'Sweet Potato', qty: 150, unit: 'g' },
            { foodName: 'Baby Spinach', qty: 100, unit: 'g' },
          ],
        },
      ],
    },
    {
      dayNumber: 2,
      dayLabel: 'Day B — Rest Day',
      description: 'Lower carbohydrate, higher fat recovery structure.',
      plannedCalories: cal - 100,
      plannedProtein: protein - 5,
      plannedCarbs: carbs - 30,
      plannedFat: fat + 5,
      meals: [
        {
          name: 'BREAKFAST',
          mealOrder: 1,
          mealTime: '08:00',
          notes: 'Healthy fats and quality protein start.',
          items: [
            { foodName: 'Whole Eggs Large', qty: 3, unit: 'eggs' },
            { foodName: 'Egg Whites Liquid', qty: 100, unit: 'g' },
            { foodName: 'Avocado Hass', qty: 75, unit: 'g' },
          ],
        },
        {
          name: 'MID_MORNING',
          mealOrder: 2,
          mealTime: '11:00',
          notes: 'Slow-release energy snack.',
          items: [
            { foodName: 'Cottage Cheese 2%', qty: 150, unit: 'g' },
            { foodName: 'Raw Almonds', qty: 28, unit: 'g' },
          ],
        },
        {
          name: 'LUNCH',
          mealOrder: 3,
          mealTime: '13:00',
          notes: 'Leafy greens with lean protein.',
          items: [
            { foodName: 'Grilled Chicken Breast', qty: 150, unit: 'g' },
            { foodName: 'Baby Spinach', qty: 150, unit: 'g' },
            { foodName: 'Avocado Hass', qty: 75, unit: 'g' },
          ],
        },
        {
          name: 'EVENING_SNACK',
          mealOrder: 4,
          mealTime: '17:00',
          notes: 'Sustained release proteins.',
          items: [
            { foodName: 'Greek Yogurt 0% Fat', qty: 200, unit: 'g' },
            { foodName: 'Raw Almonds', qty: 20, unit: 'g' },
          ],
        },
        {
          name: 'DINNER',
          mealOrder: 5,
          mealTime: '20:00',
          notes: 'Anti-inflammatory, low carb evening meal.',
          items: [
            { foodName: 'Atlantic Salmon Fillet', qty: 120, unit: 'g' },
            { foodName: 'Steamed Broccoli', qty: 150, unit: 'g' },
            { foodName: 'Extra Firm Tofu', qty: 100, unit: 'g' },
          ],
        },
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-client plan seeder
// ─────────────────────────────────────────────────────────────────────────────

async function seedClientDietPlan(tenantId, client, dietitianId, assessment, goalProfile, foodMap) {
  const macros = getMacroTarget(goalProfile.goalType);
  const { cal, protein, carbs, fat } = macros;

  // ── 1. DietPlan (SSoT FK: goalProfileId) ───────────────────────────────────
  const plan = await prisma.dietPlan.create({
    data: {
      tenantId,
      clientId: client.id,
      assessmentId: assessment?.id ?? null,
      goalProfileId: goalProfile.id,          // ← CRITICAL SSoT FK
      createdBy: dietitianId,
      title: `Active Nutrition Strategy — ${client.firstName}`,
      description: `Personalised macro allocation for ${client.firstName} ${client.lastName} (${goalProfile.goalType}).`,
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
    },
  });

  // ── 2. DietPlanCycle ────────────────────────────────────────────────────────
  const cycle = await prisma.dietPlanCycle.create({
    data: {
      dietPlanId: plan.id,
      name: 'Main Rotation Cycle',
      description: 'Alternating Day A (training) and Day B (rest) meal structure.',
      startDay: 1,
    },
  });

  // ── 3. CycleDays + Meals + MealItems ────────────────────────────────────────
  const dayMeals = buildDayMeals(cal, protein, carbs, fat);

  for (const dData of dayMeals) {
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
          cycleDayId: day.id,
          name: mData.name,
          mealOrder: mData.mealOrder,
          mealTime: mData.mealTime,
          notes: mData.notes,
        },
      });

      for (const iData of mData.items) {
        const matched = foodMap[iData.foodName];
        const factor = iData.qty / (matched?.defaultQuantity || 100);

        await prisma.dietPlanMealItem.create({
          data: {
            mealId: meal.id,
            foodLibraryId: matched?.id ?? null,
            foodName: iData.foodName,
            sourceType: matched ? 'SYSTEM' : 'CUSTOM',
            quantity: iData.qty,
            unit: iData.unit,
            calories: matched?.calories ? Number((matched.calories * factor).toFixed(1)) : null,
            protein: matched?.protein ? Number((matched.protein * factor).toFixed(1)) : null,
            carbs: matched?.carbs ? Number((matched.carbs * factor).toFixed(1)) : null,
            fat: matched?.fat ? Number((matched.fat * factor).toFixed(1)) : null,
          },
        });
      }
    }
  }

  return plan;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDietPlans(tenants, users, clients, assessmentResults, foodLibraryResults) {
  console.log('Seeding client diet plans (SSoT goalProfileId wiring)...');

  const { tenant1, tenant2 } = tenants;
  const { t1Clients, t2Clients } = clients;
  const { t1Assessments, t2Assessments, t1GoalProfiles, t2GoalProfiles } = assessmentResults;

  const t1DietitianId = users.t1.dietitian.id;
  const t2DietitianId = users.t2.dietitian.id;

  const dietPlans = [];

  for (const tenant of [tenant1, tenant2]) {
    const tenantId = tenant.id;
    const isT1 = tenantId === tenant1.id;
    const clientList = isT1 ? t1Clients : t2Clients;
    const assessments = isT1 ? t1Assessments : t2Assessments;
    const goalProfiles = isT1 ? t1GoalProfiles : t2GoalProfiles;
    const dietitianId = isT1 ? t1DietitianId : t2DietitianId;

    // Build food name → FoodLibrary row lookup map for this tenant
    const foodMap = (foodLibraryResults[tenantId]?.foods ?? []).reduce((acc, f) => {
      acc[f.foodName] = f;
      return acc;
    }, {});

    for (let i = 0; i < clientList.length; i++) {
      const client = clientList[i];
      const assessment = assessments[i] ?? null;
      const goalProfile = goalProfiles[client.id];

      if (!goalProfile) {
        console.warn(`  ⚠ No goal profile found for client ${client.firstName} — skipping diet plan.`);
        continue;
      }

      const plan = await seedClientDietPlan(
        tenantId,
        client,
        dietitianId,
        assessment,
        goalProfile,
        foodMap,
      );
      dietPlans.push(plan);
    }
  }

  console.log(`✓ Diet plans seeded: ${dietPlans.length} total`);
  return dietPlans;
}
