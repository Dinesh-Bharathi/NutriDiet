// prisma/seed/seed-assessments.js
import prisma from "../../src/lib/prisma.js";

export async function seedAssessments(tenants, users, clients) {
  const { tenant1, tenant2 } = tenants;
  const { t1Clients, t2Clients } = clients;

  const t1DietitianId = users.t1.dietitian.id;
  const t2DietitianId = users.t2.dietitian.id;

  const assessments = [];

  // Tenant 1 Assessments
  const t1Data = [
    {
      title: "Initial Health Profile - Aarav",
      heightCm: 178,
      weightKg: 85,
      goal: "Fat Loss & Endurance Build",
      activityLevel: "MODERATELY_ACTIVE",
      waterIntakeLiters: 2.5,
      sleepHours: 7,
      medicalConditions: "Mild hypertension managed with exercise",
      allergies: "Peanuts",
      medications: "None",
      foodPreferences: "Prefers chicken, fish, local grains",
      foodRestrictions: "No peanut oils",
      notes: "Motivated client aiming to lower visceral fat.",
    },
    {
      title: "Diabetes Nutrition Intake - Ananya",
      heightCm: 162,
      weightKg: 78,
      goal: "Diabetes Management & Glycemic Control",
      activityLevel: "SEDENTARY",
      waterIntakeLiters: 1.8,
      sleepHours: 6.5,
      medicalConditions: "Type-2 Diabetes diagnosed 2 years ago",
      allergies: "None",
      medications: "Metformin 500mg daily",
      foodPreferences: "Vegetarian, prefers cooked dishes",
      foodRestrictions: "Low sugar, low glycemic index carbs only",
      notes: "Needs highly predictable carb distributions.",
    },
    {
      title: "Sports Performance Review - Kabir",
      heightCm: 184,
      weightKg: 74,
      goal: "Sports Performance & Carb Loading Strategy",
      activityLevel: "VERY_ACTIVE",
      waterIntakeLiters: 3.5,
      sleepHours: 8,
      medicalConditions: "None",
      allergies: "Shellfish",
      medications: "Multivitamin",
      foodPreferences: "High carb, lean meats, pasta",
      foodRestrictions: "Strictly avoid shellfish",
      notes: "Active runner preparing for autumn race.",
    },
    {
      title: "Lifestyle Assessment - Diya",
      heightCm: 168,
      weightKg: 64,
      goal: "Fat Loss & Muscle Toning",
      activityLevel: "LIGHTLY_ACTIVE",
      waterIntakeLiters: 2,
      sleepHours: 7.5,
      medicalConditions: "None",
      allergies: "None",
      medications: "None",
      foodPreferences: "Prefers eggs, dairy, vegetables, lean poultry",
      foodRestrictions: "None",
      notes: "Wants to reduce body fat to 22%.",
    },
    {
      title: "Baseline Assessment - Rohan",
      heightCm: 175,
      weightKg: 92,
      goal: "Weight Loss & Caloric Deficit Induction",
      activityLevel: "SEDENTARY",
      waterIntakeLiters: 1.5,
      sleepHours: 6,
      medicalConditions: "High cholesterol",
      allergies: "Gluten sensitivity (mild)",
      medications: "None",
      foodPreferences: "Red meat, dairy, rice",
      foodRestrictions: "Minimize wheat and gluten",
      notes: "Slightly high baseline cholesterol; focus on healthy fats.",
    },
  ];

  for (let i = 0; i < t1Clients.length; i++) {
    const client = t1Clients[i];
    const data = t1Data[i];
    const bmi = Number((data.weightKg / (data.heightCm / 100) ** 2).toFixed(2));

    const assessment = await prisma.assessment.create({
      data: {
        tenantId: tenant1.id,
        clientId: client.id,
        createdBy: t1DietitianId,
        title: data.title,
        assessmentDate: new Date(),
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        bmi,
        goal: data.goal,
        activityLevel: data.activityLevel,
        waterIntakeLiters: data.waterIntakeLiters,
        sleepHours: data.sleepHours,
        medicalConditions: data.medicalConditions,
        allergies: data.allergies,
        medications: data.medications,
        foodPreferences: data.foodPreferences,
        foodRestrictions: data.foodRestrictions,
        notes: data.notes,
      },
    });
    assessments.push(assessment);
  }

  // Tenant 2 Assessments
  const t2Data = [
    {
      title: "Athletic Assessment - Lachlan",
      heightCm: 188,
      weightKg: 90,
      goal: "Sports Performance & Surplus Energy",
      activityLevel: "EXTRA_ACTIVE",
      waterIntakeLiters: 4,
      sleepHours: 8.5,
      medicalConditions: "None",
      allergies: "None",
      medications: "Creatine monohydrate",
      foodPreferences: "Beef, eggs, potatoes, oats",
      foodRestrictions: "None",
      notes: "Rugby forward looking to increase strength parameters.",
    },
    {
      title: "Vegetarian Intake Review - Charlotte",
      heightCm: 165,
      weightKg: 70,
      goal: "Fat Loss & Balanced Nutrition",
      activityLevel: "MODERATELY_ACTIVE",
      waterIntakeLiters: 2.2,
      sleepHours: 7,
      medicalConditions: "None",
      allergies: "None",
      medications: "B12 supplement",
      foodPreferences: "Dairy, tofu, legumes, vegetables",
      foodRestrictions: "No meat, fish, or poultry",
      notes: "Vegetarian aiming to ensure adequate iron and protein.",
    },
    {
      title: "Hypertrophy Assessment - Oliver",
      heightCm: 180,
      weightKg: 77,
      goal: "Muscle Gain & Caloric Surplus",
      activityLevel: "VERY_ACTIVE",
      waterIntakeLiters: 3,
      sleepHours: 8,
      medicalConditions: "None",
      allergies: "None",
      medications: "None",
      foodPreferences: "High protein shakes, rice, chicken",
      foodRestrictions: "None",
      notes: "Targeting 5kg of muscle gain over the next 6 months.",
    },
    {
      title: "Gluten Sensitivity Profile - Amelia",
      heightCm: 160,
      weightKg: 58,
      goal: "Gluten Free Weight Maintenance",
      activityLevel: "LIGHTLY_ACTIVE",
      waterIntakeLiters: 2,
      sleepHours: 7,
      medicalConditions: "Mild coeliac disease",
      allergies: "Wheat, Gluten",
      medications: "None",
      foodPreferences: "Rice products, fruits, lean meats",
      foodRestrictions: "Strictly gluten-free",
      notes: "Ensure all meal plans are fully wheat-free.",
    },
    {
      title: "Baseline Assessment - William",
      heightCm: 177,
      weightKg: 88,
      goal: "Fat Loss & Lifestyle Modification",
      activityLevel: "SEDENTARY",
      waterIntakeLiters: 1.5,
      sleepHours: 6.5,
      medicalConditions: "Mild fatty liver",
      allergies: "None",
      medications: "None",
      foodPreferences: "Meat, fast food (trying to reduce)",
      foodRestrictions: "Reduce refined sugars and saturated fats",
      notes: "High motivation to shift from processed food diet.",
    },
  ];

  for (let i = 0; i < t2Clients.length; i++) {
    const client = t2Clients[i];
    const data = t2Data[i];
    const bmi = Number((data.weightKg / (data.heightCm / 100) ** 2).toFixed(2));

    const assessment = await prisma.assessment.create({
      data: {
        tenantId: tenant2.id,
        clientId: client.id,
        createdBy: t2DietitianId,
        title: data.title,
        assessmentDate: new Date(),
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        bmi,
        goal: data.goal,
        activityLevel: data.activityLevel,
        waterIntakeLiters: data.waterIntakeLiters,
        sleepHours: data.sleepHours,
        medicalConditions: data.medicalConditions,
        allergies: data.allergies,
        medications: data.medications,
        foodPreferences: data.foodPreferences,
        foodRestrictions: data.foodRestrictions,
        notes: data.notes,
      },
    });
    assessments.push(assessment);
  }

  return assessments;
}
