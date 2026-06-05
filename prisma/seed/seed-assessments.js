// prisma/seed/seed-assessments.js
//
// Phase 6 SSoT-Aligned Assessment Seeder.
//
// ARCHITECTURE:
//  Every call to prisma.assessment.create mirrors EXACTLY what
//  assessment.service.js#createAssessment() does in a transaction:
//
//  V1 (flat log):  Assessment record
//  V2 (SSoT):      ClientClinicalProfile  (upsert)
//                  AssessmentSectionStatus (4 sections: ANTHROPOMETRICS, MEDICAL, LIFESTYLE, LABS)
//                  ClientAnthropometricRecord
//                  ClientCondition[]       (parsed from medicalConditions CSV)
//                  ClientAllergy[]         (parsed from allergies CSV)
//                  ClientMedication[]      (parsed from medications CSV)
//                  ClientGoalProfile       (sets goalType → active goal for DietPlan FK)
//                  ClientLifestyleProfile  (upsert)
//
// Returns: { t1Assessments, t2Assessments, t1Profiles, t2Profiles }
//          t1Profiles / t2Profiles are the ClientClinicalProfile rows keyed by clientId.

import prisma from '../../src/lib/prisma.js';

function calcBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 100) / 100;
}

function parseCsv(str) {
  if (!str) return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment intake fixtures – mirrors clinical intake form fields.
// ─────────────────────────────────────────────────────────────────────────────

const T1_INTAKE = [
  {
    title: 'Initial Health Profile — Aarav',
    heightCm: 178,
    weightKg: 85,
    waistCm: 94,
    hipCm: 100,
    bodyFatPercent: 22,
    goal: 'Fat Loss & Endurance Build',
    goalType: 'WEIGHT_LOSS',
    targetWeightKg: 78,
    activityLevel: 'MODERATELY_ACTIVE',
    waterIntakeLiters: 2.5,
    sleepHours: 7,
    medicalConditions: 'Mild hypertension',
    allergies: 'Peanuts',
    medications: null,
    supplements: 'Vitamin D',
    foodPreferences: 'Chicken, fish, local grains',
    foodRestrictions: 'No peanut oils',
    notes: 'Motivated client aiming to lower visceral fat.',
  },
  {
    title: 'Diabetes Nutrition Intake — Ananya',
    heightCm: 162,
    weightKg: 78,
    waistCm: 88,
    hipCm: 102,
    bodyFatPercent: 30,
    goal: 'Diabetes Management & Glycemic Control',
    goalType: 'MEDICAL_NUTRITION',
    targetWeightKg: 70,
    activityLevel: 'SEDENTARY',
    waterIntakeLiters: 1.8,
    sleepHours: 6.5,
    medicalConditions: 'Type-2 Diabetes',
    allergies: null,
    medications: 'Metformin 500mg',
    supplements: null,
    foodPreferences: 'Vegetarian, cooked dishes',
    foodRestrictions: 'Low glycemic carbs',
    notes: 'Needs predictable carb distributions and tight glycemic control.',
  },
  {
    title: 'Sports Performance Review — Kabir',
    heightCm: 184,
    weightKg: 74,
    waistCm: 82,
    hipCm: 95,
    bodyFatPercent: 12,
    goal: 'Sports Performance & Carb Loading Strategy',
    goalType: 'PERFORMANCE',
    targetWeightKg: 74,
    activityLevel: 'VERY_ACTIVE',
    waterIntakeLiters: 3.5,
    sleepHours: 8,
    medicalConditions: null,
    allergies: 'Shellfish',
    medications: 'Multivitamin',
    supplements: 'Creatine, BCAA',
    foodPreferences: 'High carb, lean meats, pasta',
    foodRestrictions: 'Strictly avoid shellfish',
    notes: 'Active runner preparing for autumn half marathon.',
  },
  {
    title: 'Lifestyle Assessment — Diya',
    heightCm: 168,
    weightKg: 64,
    waistCm: 72,
    hipCm: 96,
    bodyFatPercent: 26,
    goal: 'Fat Loss & Muscle Toning',
    goalType: 'WEIGHT_LOSS',
    targetWeightKg: 58,
    activityLevel: 'LIGHTLY_ACTIVE',
    waterIntakeLiters: 2,
    sleepHours: 7.5,
    medicalConditions: null,
    allergies: null,
    medications: null,
    supplements: 'Iron supplement',
    foodPreferences: 'Eggs, dairy, vegetables, lean poultry',
    foodRestrictions: null,
    notes: 'Wants to reduce body fat to 22%.',
  },
  {
    title: 'Baseline Assessment — Rohan',
    heightCm: 175,
    weightKg: 92,
    waistCm: 102,
    hipCm: 108,
    bodyFatPercent: 28,
    goal: 'Weight Loss & Caloric Deficit Induction',
    goalType: 'WEIGHT_LOSS',
    targetWeightKg: 80,
    activityLevel: 'SEDENTARY',
    waterIntakeLiters: 1.5,
    sleepHours: 6,
    medicalConditions: 'High cholesterol',
    allergies: 'Gluten sensitivity',
    medications: null,
    supplements: 'Omega-3',
    foodPreferences: 'Red meat, dairy, rice',
    foodRestrictions: 'Minimize wheat and gluten',
    notes: 'Slightly high baseline cholesterol; focus on healthy fats.',
  },
];

const T2_INTAKE = [
  {
    title: 'Athletic Assessment — Lachlan',
    heightCm: 188,
    weightKg: 90,
    waistCm: 88,
    hipCm: 104,
    bodyFatPercent: 14,
    goal: 'Sports Performance & Surplus Energy',
    goalType: 'PERFORMANCE',
    targetWeightKg: 92,
    activityLevel: 'EXTRA_ACTIVE',
    waterIntakeLiters: 4,
    sleepHours: 8.5,
    medicalConditions: null,
    allergies: null,
    medications: null,
    supplements: 'Creatine monohydrate',
    foodPreferences: 'Beef, eggs, potatoes, oats',
    foodRestrictions: null,
    notes: 'Rugby forward looking to increase strength parameters.',
  },
  {
    title: 'Vegetarian Intake Review — Charlotte',
    heightCm: 165,
    weightKg: 70,
    waistCm: 78,
    hipCm: 98,
    bodyFatPercent: 28,
    goal: 'Fat Loss & Balanced Nutrition',
    goalType: 'WEIGHT_LOSS',
    targetWeightKg: 62,
    activityLevel: 'MODERATELY_ACTIVE',
    waterIntakeLiters: 2.2,
    sleepHours: 7,
    medicalConditions: null,
    allergies: null,
    medications: null,
    supplements: 'B12 supplement, Iron',
    foodPreferences: 'Dairy, tofu, legumes, vegetables',
    foodRestrictions: 'No meat, fish or poultry',
    notes: 'Vegetarian aiming to ensure adequate iron and protein.',
  },
  {
    title: 'Hypertrophy Assessment — Oliver',
    heightCm: 180,
    weightKg: 77,
    waistCm: 84,
    hipCm: 98,
    bodyFatPercent: 15,
    goal: 'Muscle Gain & Caloric Surplus',
    goalType: 'MUSCLE_GAIN',
    targetWeightKg: 84,
    activityLevel: 'VERY_ACTIVE',
    waterIntakeLiters: 3,
    sleepHours: 8,
    medicalConditions: null,
    allergies: null,
    medications: null,
    supplements: 'Whey protein, Creatine',
    foodPreferences: 'High protein shakes, rice, chicken',
    foodRestrictions: null,
    notes: 'Targeting 5kg of lean muscle gain over 6 months.',
  },
  {
    title: 'Gluten Sensitivity Profile — Amelia',
    heightCm: 160,
    weightKg: 58,
    waistCm: 68,
    hipCm: 92,
    bodyFatPercent: 24,
    goal: 'Gluten-Free Weight Maintenance',
    goalType: 'MAINTENANCE',
    targetWeightKg: 57,
    activityLevel: 'LIGHTLY_ACTIVE',
    waterIntakeLiters: 2,
    sleepHours: 7,
    medicalConditions: 'Mild coeliac disease',
    allergies: 'Wheat, Gluten',
    medications: null,
    supplements: null,
    foodPreferences: 'Rice products, fruits, lean meats',
    foodRestrictions: 'Strictly gluten-free',
    notes: 'Ensure all meal plans are fully wheat-free.',
  },
  {
    title: 'Baseline Assessment — William',
    heightCm: 177,
    weightKg: 88,
    waistCm: 98,
    hipCm: 106,
    bodyFatPercent: 27,
    goal: 'Fat Loss & Lifestyle Modification',
    goalType: 'WEIGHT_LOSS',
    targetWeightKg: 78,
    activityLevel: 'SEDENTARY',
    waterIntakeLiters: 1.5,
    sleepHours: 6.5,
    medicalConditions: 'Mild fatty liver',
    allergies: null,
    medications: null,
    supplements: null,
    foodPreferences: 'Meat, fast food (reducing)',
    foodRestrictions: 'Reduce refined sugars and saturated fats',
    notes: 'High motivation to shift from processed food diet.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Core atomic seeder — mirrors assessment.service.js#createAssessment()
// ─────────────────────────────────────────────────────────────────────────────

async function seedClientAssessment(tenantId, client, dietitianId, intake) {
  const bmi = calcBmi(intake.heightCm, intake.weightKg);
  const assessmentDate = new Date();

  // ── 1. V1 Assessment log (immutable intake record) ────────────────────────
  // NOTE: No $transaction wrapper — seed scripts don't need ACID atomicity.
  // The clearDatabase() step handles any partial state on re-runs. Using
  // a transaction caused P2028 timeouts due to the number of sequential
  // slow round-trips on a remote seed database connection.
  const assessment = await prisma.assessment.create({
    data: {
      tenantId,
      clientId: client.id,
      createdBy: dietitianId,
      title: intake.title,
      assessmentDate,
      heightCm: intake.heightCm ?? null,
      weightKg: intake.weightKg ?? null,
      bmi,
      goal: intake.goal ?? null,
      goalType: intake.goalType ?? null,
      activityLevel: intake.activityLevel ?? null,
      waterIntakeLiters: intake.waterIntakeLiters ?? null,
      sleepHours: intake.sleepHours ?? null,
      medicalConditions: intake.medicalConditions ?? null,
      allergies: intake.allergies ?? null,
      medications: intake.medications ?? null,
      foodPreferences: intake.foodPreferences ?? null,
      foodRestrictions: intake.foodRestrictions ?? null,
      notes: intake.notes ?? null,
    },
  });

  // ── 2. Bootstrap V2 ClientClinicalProfile ────────────────────────────────
  const existing = await prisma.clientClinicalProfile.findFirst({
    where: { tenantId, clientId: client.id, deletedAt: null },
  });

  let profile;
  if (!existing) {
    profile = await prisma.clientClinicalProfile.create({
      data: {
        tenantId,
        clientId: client.id,
        createdById: dietitianId,
        latestAssessmentId: assessment.id,
        summaryNotes: intake.notes ?? null,
        sectionStatuses: {
          create: ['ANTHROPOMETRICS', 'MEDICAL', 'LIFESTYLE', 'LABS'].map((section) => ({
            tenantId,
            clientId: client.id,
            assessmentId: assessment.id,
            section,
            status: 'COMPLETED',
            completedAt: assessmentDate,
            completedById: dietitianId,
          })),
        },
      },
    });
  } else {
    await prisma.clientClinicalProfile.update({
      where: { id: existing.id },
      data: { latestAssessmentId: assessment.id },
    });
    profile = existing;
  }

  const profileId = profile.id;

  // ── 3. Anthropometric Record ──────────────────────────────────────────────
  await prisma.clientAnthropometricRecord.create({
    data: {
      tenantId,
      clientId: client.id,
      profileId,
      assessmentId: assessment.id,
      measuredAt: assessmentDate,
      heightCm: intake.heightCm ?? null,
      weightKg: intake.weightKg ?? null,
      bmi,
      waistCm: intake.waistCm ?? null,
      hipCm: intake.hipCm ?? null,
      bodyFatPercent: intake.bodyFatPercent ?? null,
      notes: 'Initial Intake Baseline',
    },
  });

  // ── 4. Conditions ─────────────────────────────────────────────────────────
  const conditions = parseCsv(intake.medicalConditions);
  if (conditions.length > 0) {
    await prisma.clientCondition.createMany({
      data: conditions.map((name) => ({
        tenantId,
        clientId: client.id,
        profileId,
        assessmentId: assessment.id,
        name,
        status: 'ACTIVE',
      })),
    });
  }

  // ── 5. Allergies ──────────────────────────────────────────────────────────
  const allergies = parseCsv(intake.allergies);
  if (allergies.length > 0) {
    await prisma.clientAllergy.createMany({
      data: allergies.map((allergen) => ({
        tenantId,
        clientId: client.id,
        profileId,
        assessmentId: assessment.id,
        allergen,
        severity: 'MODERATE',
      })),
    });
  }

  // ── 6. Medications ────────────────────────────────────────────────────────
  const medications = parseCsv(intake.medications);
  if (medications.length > 0) {
    await prisma.clientMedication.createMany({
      data: medications.map((name) => ({
        tenantId,
        clientId: client.id,
        profileId,
        assessmentId: assessment.id,
        name,
      })),
    });
  }

  // ── 7. Supplements ────────────────────────────────────────────────────────
  const supplements = parseCsv(intake.supplements);
  if (supplements.length > 0) {
    await prisma.clientSupplement.createMany({
      data: supplements.map((name) => ({
        tenantId,
        clientId: client.id,
        profileId,
        assessmentId: assessment.id,
        name,
      })),
    });
  }

  // ── 8. GoalProfile (SSoT for DietPlan.goalProfileId FK) ──────────────────
  await prisma.clientGoalProfile.updateMany({
    where: { tenantId, profileId, status: 'ACTIVE' },
    data: { status: 'SUPERSEDED', endedAt: assessmentDate },
  });

  const versionCount = await prisma.clientGoalProfile.count({
    where: { tenantId, profileId },
  });

  const goalProfile = await prisma.clientGoalProfile.create({
    data: {
      tenantId,
      clientId: client.id,
      profileId,
      assessmentId: assessment.id,
      goalType: intake.goalType,
      targetWeightKg: intake.targetWeightKg ?? null,
      targetDate: intake.targetDate ?? null,
      status: 'ACTIVE',
      notes: intake.goal ?? null,
      versionNumber: versionCount + 1,
      startedAt: assessmentDate,
    },
  });

  // ── 9. LifestyleProfile (upsert — 1:1 per client) ────────────────────────
  await prisma.clientLifestyleProfile.upsert({
    where: { profileId },
    create: {
      tenantId,
      clientId: client.id,
      profileId,
      assessmentId: assessment.id,
      activityLevel: intake.activityLevel ?? null,
      sleepHours: intake.sleepHours ?? null,
      hydrationLiters: intake.waterIntakeLiters ?? null,
    },
    update: {
      assessmentId: assessment.id,
      activityLevel: intake.activityLevel ?? null,
      sleepHours: intake.sleepHours ?? null,
      hydrationLiters: intake.waterIntakeLiters ?? null,
    },
  });

  return { assessment, profile, goalProfile };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export
// ─────────────────────────────────────────────────────────────────────────────

export async function seedAssessments(tenants, users, clients) {
  console.log('Seeding assessments + V2 clinical profiles (SSoT fan-out)...');

  const { tenant1, tenant2 } = tenants;
  const { t1Clients, t2Clients } = clients;
  const t1DietitianId = users.t1.dietitian.id;
  const t2DietitianId = users.t2.dietitian.id;

  const t1Assessments = [];
  const t2Assessments = [];
  const t1Profiles = {}; // keyed by clientId
  const t2Profiles = {}; // keyed by clientId
  const t1GoalProfiles = {}; // keyed by clientId
  const t2GoalProfiles = {}; // keyed by clientId

  // Tenant 1
  for (let i = 0; i < t1Clients.length; i++) {
    const { assessment, profile, goalProfile } = await seedClientAssessment(
      tenant1.id,
      t1Clients[i],
      t1DietitianId,
      T1_INTAKE[i],
    );
    t1Assessments.push(assessment);
    t1Profiles[t1Clients[i].id] = profile;
    t1GoalProfiles[t1Clients[i].id] = goalProfile;
  }

  // Tenant 2
  for (let i = 0; i < t2Clients.length; i++) {
    const { assessment, profile, goalProfile } = await seedClientAssessment(
      tenant2.id,
      t2Clients[i],
      t2DietitianId,
      T2_INTAKE[i],
    );
    t2Assessments.push(assessment);
    t2Profiles[t2Clients[i].id] = profile;
    t2GoalProfiles[t2Clients[i].id] = goalProfile;
  }

  console.log(
    `✓ Assessments seeded: ${t1Assessments.length} (T1) + ${t2Assessments.length} (T2)`,
  );
  console.log(
    `✓ Clinical profiles seeded: ${Object.keys(t1Profiles).length} (T1) + ${Object.keys(t2Profiles).length} (T2)`,
  );

  return {
    t1Assessments,
    t2Assessments,
    t1Profiles,
    t2Profiles,
    t1GoalProfiles,
    t2GoalProfiles,
  };
}
