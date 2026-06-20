import prisma from "../src/lib/prisma.js";

const tenantId = "cmqi703lc0001pfty618q1kp1"; // Empty by default as requested. Will auto-fallback to the first tenant.

async function run() {
  console.log("--- Starting Seed Food and Plan Script ---");
  try {
    // 1. Resolve Tenant ID
    let targetTenantId = tenantId;
    if (!targetTenantId) {
      console.log(
        "tenantId variable is empty. Finding the first tenant in the database...",
      );
      const firstTenant = await prisma.tenant.findFirst({
        where: { deletedAt: null },
      });
      if (!firstTenant) {
        throw new Error(
          "No tenants found in the database. Please create a tenant first.",
        );
      }
      targetTenantId = firstTenant.id;
      console.log(`Using tenant: ${firstTenant.name} (ID: ${firstTenant.id})`);
    } else {
      const tenant = await prisma.tenant.findUnique({
        where: { id: targetTenantId },
      });
      if (!tenant) {
        throw new Error(`Tenant with ID ${targetTenantId} not found.`);
      }
      console.log(`Using tenant: ${tenant.name} (ID: ${tenant.id})`);
    }

    // 2. Resolve Creator User
    const user = await prisma.user.findFirst({
      where: { tenantId: targetTenantId, deletedAt: null },
    });
    if (!user) {
      throw new Error(
        `No active user found for tenant ID ${targetTenantId}. Cannot seed diet plan template without a creator.`,
      );
    }
    const createdBy = user.id;
    console.log(
      `Using User: ${user.firstName} ${user.lastName} (ID: ${user.id}) as the creator.`,
    );

    // 3. Seed Food Categories
    const categoriesToSeed = [
      {
        name: "Grains & Cereals",
        description: "Oats, rice, bread, quinoa, etc.",
      },
      {
        name: "Proteins",
        description: "Chicken, fish, beef, eggs, tofu, etc.",
      },
      {
        name: "Fruits",
        description: "Apples, bananas, berries, avocados, etc.",
      },
      { name: "Vegetables", description: "Spinach, broccoli, carrots, etc." },
      { name: "Healthy Fats", description: "Nuts, seeds, olive oil, etc." },
      { name: "Dairy & Eggs", description: "Eggs, milk, yogurt, cheese, etc." },
    ];

    console.log("\nSeeding food categories...");
    const categoriesMap = {};
    for (const cat of categoriesToSeed) {
      const category = await prisma.foodCategory.upsert({
        where: {
          tenantId_name: {
            tenantId: targetTenantId,
            name: cat.name,
          },
        },
        update: { description: cat.description },
        create: {
          tenantId: targetTenantId,
          name: cat.name,
          description: cat.description,
        },
      });
      categoriesMap[cat.name] = category.id;
    }
    console.log(`Seeded ${Object.keys(categoriesMap).length} food categories.`);

    // 4. Seed Food Library Items
    const foodsToSeed = [
      {
        foodName: "Rolled Oats",
        defaultQuantity: 100,
        defaultUnit: "g",
        servingSize: 100,
        servingUnit: "g",
        calories: 389,
        protein: 16.9,
        carbs: 66.3,
        fat: 6.9,
        categoryName: "Grains & Cereals",
        searchKeywords: "oats, oatmeal, porridge, breakfast",
      },
      {
        foodName: "Chicken Breast",
        defaultQuantity: 100,
        defaultUnit: "g",
        servingSize: 100,
        servingUnit: "g",
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        categoryName: "Proteins",
        searchKeywords: "chicken, breast, white meat, poultry",
      },
      {
        foodName: "White Rice",
        defaultQuantity: 100,
        defaultUnit: "g",
        servingSize: 100,
        servingUnit: "g",
        calories: 130,
        protein: 2.7,
        carbs: 28,
        fat: 0.3,
        categoryName: "Grains & Cereals",
        searchKeywords: "rice, white rice, carb",
      },
      {
        foodName: "Salmon Fillet",
        defaultQuantity: 100,
        defaultUnit: "g",
        servingSize: 100,
        servingUnit: "g",
        calories: 208,
        protein: 20,
        carbs: 0,
        fat: 13,
        categoryName: "Proteins",
        searchKeywords: "salmon, fish, seafood, omega3",
      },
      {
        foodName: "Whole Egg",
        defaultQuantity: 1,
        defaultUnit: "piece",
        servingSize: 50,
        servingUnit: "g",
        calories: 78,
        protein: 6.3,
        carbs: 0.6,
        fat: 5.3,
        categoryName: "Dairy & Eggs",
        searchKeywords: "egg, eggs, whole egg, breakfast protein",
      },
      {
        foodName: "Avocado",
        defaultQuantity: 1,
        defaultUnit: "piece",
        servingSize: 100,
        servingUnit: "g",
        calories: 160,
        protein: 2,
        carbs: 8.5,
        fat: 15,
        categoryName: "Healthy Fats",
        searchKeywords: "avocado, fat, healthy fat",
      },
      {
        foodName: "Whey Protein",
        defaultQuantity: 1,
        defaultUnit: "scoop",
        servingSize: 30,
        servingUnit: "g",
        calories: 120,
        protein: 24,
        carbs: 3,
        fat: 1.5,
        categoryName: "Proteins",
        searchKeywords: "whey, protein, powder, shake",
      },
      {
        foodName: "Almonds",
        defaultQuantity: 1,
        defaultUnit: "oz",
        servingSize: 28,
        servingUnit: "g",
        calories: 164,
        protein: 6,
        carbs: 6,
        fat: 14,
        categoryName: "Healthy Fats",
        searchKeywords: "almonds, nuts, nut, snack",
      },
      {
        foodName: "Banana",
        defaultQuantity: 1,
        defaultUnit: "piece",
        servingSize: 118,
        servingUnit: "g",
        calories: 105,
        protein: 1.3,
        carbs: 27,
        fat: 0.3,
        categoryName: "Fruits",
        searchKeywords: "banana, fruit, potassium",
      },
      {
        foodName: "Spinach",
        defaultQuantity: 100,
        defaultUnit: "g",
        servingSize: 100,
        servingUnit: "g",
        calories: 23,
        protein: 2.9,
        carbs: 3.6,
        fat: 0.4,
        categoryName: "Vegetables",
        searchKeywords: "spinach, greens, vegetable, leafy green",
      },
    ];

    console.log("\nSeeding food library items...");
    const foodsMap = {};
    for (const food of foodsToSeed) {
      const existingFood = await prisma.foodLibrary.findFirst({
        where: {
          tenantId: targetTenantId,
          foodName: food.foodName,
          deletedAt: null,
        },
      });

      let seededFood;
      const categoryId = categoriesMap[food.categoryName] || null;

      if (existingFood) {
        seededFood = await prisma.foodLibrary.update({
          where: { id: existingFood.id },
          data: {
            defaultQuantity: food.defaultQuantity,
            defaultUnit: food.defaultUnit,
            servingSize: food.servingSize,
            servingUnit: food.servingUnit,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            categoryId,
            searchKeywords: food.searchKeywords,
          },
        });
        console.log(`- Updated food: ${food.foodName}`);
      } else {
        seededFood = await prisma.foodLibrary.create({
          data: {
            tenantId: targetTenantId,
            foodName: food.foodName,
            isSystem: false,
            defaultQuantity: food.defaultQuantity,
            defaultUnit: food.defaultUnit,
            servingSize: food.servingSize,
            servingUnit: food.servingUnit,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            categoryId,
            searchKeywords: food.searchKeywords,
            status: "ACTIVE",
          },
        });
        console.log(`- Created food: ${food.foodName}`);
      }
      foodsMap[food.foodName] = seededFood;
    }
    console.log(`Seeded ${Object.keys(foodsMap).length} food library items.`);

    // 5. Seed Diet Plan Template
    const templateTitle = "High-Protein Muscle Gain Plan";
    console.log(`\nChecking for existing template "${templateTitle}"...`);
    const existingTemplate = await prisma.dietPlanTemplate.findFirst({
      where: {
        tenantId: targetTenantId,
        title: templateTitle,
        deletedAt: null,
      },
    });

    if (existingTemplate) {
      console.log(
        `Found existing template (ID: ${existingTemplate.id}). Deleting for a clean, idempotent seed...`,
      );
      await prisma.dietPlanTemplate.delete({
        where: { id: existingTemplate.id },
      });
      console.log(
        "Deleted old template and all its associated meals and items.",
      );
    }

    console.log("Creating Diet Plan Template...");
    const template = await prisma.dietPlanTemplate.create({
      data: {
        tenantId: targetTenantId,
        title: templateTitle,
        description:
          "A meal plan template designed for individuals looking to build lean muscle mass with high-quality protein and balanced carbs and fats.",
        goalType: "MUSCLE_GAIN",
        dailyCalories: 2000,
        proteinGrams: 170,
        carbGrams: 175,
        fatGrams: 73,
        isPublic: true,
        createdBy: createdBy,
        meals: {
          create: [
            {
              name: "BREAKFAST",
              mealOrder: 1,
              mealTime: "08:00",
              notes: "Focus on complex carbs and protein.",
              items: {
                create: [
                  {
                    foodLibraryId: foodsMap["Rolled Oats"].id,
                    foodName: "Rolled Oats",
                    sourceType: "CUSTOM",
                    quantity: 80,
                    unit: "g",
                    calories: 311.2,
                    protein: 13.52,
                    carbs: 53.04,
                    fat: 5.52,
                    notes: "Cook in water or low-fat milk.",
                  },
                  {
                    foodLibraryId: foodsMap["Whole Egg"].id,
                    foodName: "Whole Egg",
                    sourceType: "CUSTOM",
                    quantity: 3,
                    unit: "piece",
                    calories: 234,
                    protein: 18.9,
                    carbs: 1.8,
                    fat: 15.9,
                    notes: "Scrambled or boiled.",
                  },
                  {
                    foodLibraryId: foodsMap["Banana"].id,
                    foodName: "Banana",
                    sourceType: "CUSTOM",
                    quantity: 1,
                    unit: "piece",
                    calories: 105,
                    protein: 1.3,
                    carbs: 27,
                    fat: 0.3,
                    notes: "Slice on oats or eat separately.",
                  },
                ],
              },
            },
            {
              name: "LUNCH",
              mealOrder: 2,
              mealTime: "13:00",
              notes:
                "Balanced meal with lean protein, complex carbs, and healthy fats.",
              items: {
                create: [
                  {
                    foodLibraryId: foodsMap["Chicken Breast"].id,
                    foodName: "Chicken Breast",
                    sourceType: "CUSTOM",
                    quantity: 200,
                    unit: "g",
                    calories: 330,
                    protein: 62,
                    carbs: 0,
                    fat: 7.2,
                    notes: "Grilled or baked with spices.",
                  },
                  {
                    foodLibraryId: foodsMap["White Rice"].id,
                    foodName: "White Rice",
                    sourceType: "CUSTOM",
                    quantity: 150,
                    unit: "g",
                    calories: 195,
                    protein: 4.05,
                    carbs: 42,
                    fat: 0.45,
                    notes: "Steamed.",
                  },
                  {
                    foodLibraryId: foodsMap["Spinach"].id,
                    foodName: "Spinach",
                    sourceType: "CUSTOM",
                    quantity: 100,
                    unit: "g",
                    calories: 23,
                    protein: 2.9,
                    carbs: 3.6,
                    fat: 0.4,
                    notes: "Steamed or sautéed.",
                  },
                  {
                    foodLibraryId: foodsMap["Avocado"].id,
                    foodName: "Avocado",
                    sourceType: "CUSTOM",
                    quantity: 0.5,
                    unit: "piece",
                    calories: 80,
                    protein: 1,
                    carbs: 4.25,
                    fat: 7.5,
                    notes: "Fresh.",
                  },
                ],
              },
            },
            {
              name: "EVENING_SNACK",
              mealOrder: 3,
              mealTime: "17:00",
              notes: "Quick protein boost.",
              items: {
                create: [
                  {
                    foodLibraryId: foodsMap["Whey Protein"].id,
                    foodName: "Whey Protein",
                    sourceType: "CUSTOM",
                    quantity: 1,
                    unit: "scoop",
                    calories: 120,
                    protein: 24,
                    carbs: 3,
                    fat: 1.5,
                    notes: "Mix with cold water.",
                  },
                  {
                    foodLibraryId: foodsMap["Almonds"].id,
                    foodName: "Almonds",
                    sourceType: "CUSTOM",
                    quantity: 1,
                    unit: "oz",
                    calories: 164,
                    protein: 6,
                    carbs: 6,
                    fat: 14,
                    notes: "Raw almonds.",
                  },
                ],
              },
            },
            {
              name: "DINNER",
              mealOrder: 4,
              mealTime: "20:00",
              notes:
                "Lean protein and healthy fats for sustained overnight recovery.",
              items: {
                create: [
                  {
                    foodLibraryId: foodsMap["Salmon Fillet"].id,
                    foodName: "Salmon Fillet",
                    sourceType: "CUSTOM",
                    quantity: 150,
                    unit: "g",
                    calories: 312,
                    protein: 30,
                    carbs: 0,
                    fat: 19.5,
                    notes: "Pan-seared.",
                  },
                  {
                    foodLibraryId: foodsMap["White Rice"].id,
                    foodName: "White Rice",
                    sourceType: "CUSTOM",
                    quantity: 100,
                    unit: "g",
                    calories: 130,
                    protein: 2.7,
                    carbs: 28,
                    fat: 0.3,
                    notes: "Steamed.",
                  },
                  {
                    foodLibraryId: foodsMap["Spinach"].id,
                    foodName: "Spinach",
                    sourceType: "CUSTOM",
                    quantity: 100,
                    unit: "g",
                    calories: 23,
                    protein: 2.9,
                    carbs: 3.6,
                    fat: 0.4,
                    notes: "Steamed.",
                  },
                ],
              },
            },
          ],
        },
      },
    });

    console.log(
      `Created Diet Plan Template: "${template.title}" (ID: ${template.id})`,
    );

    // 6. Recalculate Template nutrition macros
    console.log("Recalculating nutrition totals for the template...");
    const aggregations = await prisma.dietPlanTemplateMealItem.aggregate({
      where: {
        meal: {
          templateId: template.id,
        },
      },
      _sum: {
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
      },
    });

    const sum = aggregations._sum;
    const updatedTemplate = await prisma.dietPlanTemplate.update({
      where: { id: template.id },
      data: {
        totalCalories: Math.round(sum.calories || 0),
        totalProtein: sum.protein || 0,
        totalCarbs: sum.carbs || 0,
        totalFat: sum.fat || 0,
      },
    });

    console.log("Template Nutrition Totals updated successfully:");
    console.log(`- Total Calories: ${updatedTemplate.totalCalories} kcal`);
    console.log(`- Total Protein: ${updatedTemplate.totalProtein} g`);
    console.log(`- Total Carbs: ${updatedTemplate.totalCarbs} g`);
    console.log(`- Total Fat: ${updatedTemplate.totalFat} g`);
    console.log("\n--- Seeding Completed Successfully ---");
  } catch (error) {
    console.error("❌ Seeding failed with error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
