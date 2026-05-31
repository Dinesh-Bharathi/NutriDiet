// prisma/seed/seed-food-library.js
import prisma from '../../src/lib/prisma.js';

export async function seedFoodLibrary(tenants) {
  console.log('Seeding food library...');
  const { tenant1, tenant2 } = tenants;

  const results = {};

  for (const tenant of [tenant1, tenant2]) {
    const tenantId = tenant.id;

    // 1. Create categories
    const categories = {};
    const categoryNames = ['Proteins', 'Carbohydrates', 'Vegetables', 'Fruits', 'Dairy', 'Supplements'];
    for (const name of categoryNames) {
      categories[name] = await prisma.foodCategory.create({
        data: {
          tenantId,
          name,
          description: `${name} food category`,
          isSystem: false,
        },
      });
    }

    // 2. Create tags
    const tags = {};
    const tagNames = ['High Protein', 'Vegan', 'Vegetarian', 'Keto', 'Gluten Free', 'Low Carb'];
    for (const name of tagNames) {
      tags[name] = await prisma.foodTag.create({
        data: {
          tenantId,
          name,
          description: `${name} dietary tag`,
          isSystem: false,
        },
      });
    }

    // 3. Create 22 foods with servings and tags
    const foodsList = [
      {
        foodName: 'Grilled Chicken Breast',
        commonName: 'Chicken Breast',
        brandName: 'Fresh Farms',
        category: 'Proteins',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        searchKeywords: 'chicken, breast, white meat, poultry',
        tagsList: ['High Protein', 'Keto', 'Gluten Free', 'Low Carb'],
        servings: [
          { name: '1 Piece', grams: 150, unitType: 'PIECE', isDefault: true, displayOrder: 1 },
          { name: '1 Serving', grams: 100, unitType: 'SERVING', isDefault: false, displayOrder: 2 },
        ],
      },
      {
        foodName: 'Atlantic Salmon Fillet',
        commonName: 'Salmon',
        brandName: 'SeaPride',
        category: 'Proteins',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 208,
        protein: 20,
        carbs: 0,
        fat: 13,
        searchKeywords: 'salmon, fish, omega 3, seafood',
        tagsList: ['High Protein', 'Keto', 'Gluten Free', 'Low Carb'],
        servings: [
          { name: '1 Fillet', grams: 120, unitType: 'PIECE', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Extra Firm Tofu',
        commonName: 'Tofu',
        brandName: 'Organic Soy',
        category: 'Proteins',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 94,
        protein: 10,
        carbs: 2.3,
        fat: 5,
        searchKeywords: 'tofu, soy, vegan protein, bean curd',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free', 'Low Carb'],
        servings: [
          { name: '1 Block', grams: 250, unitType: 'PIECE', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Organic Brown Rice',
        commonName: 'Brown Rice',
        brandName: 'GrainMaster',
        category: 'Carbohydrates',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 111,
        protein: 2.6,
        carbs: 23,
        fat: 0.9,
        searchKeywords: 'rice, brown, whole grain, carbs',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free'],
        servings: [
          { name: '1 Cup', grams: 195, unitType: 'CUP', isDefault: true, displayOrder: 1 },
          { name: '1 Bowl', grams: 250, unitType: 'BOWL', isDefault: false, displayOrder: 2 },
        ],
      },
      {
        foodName: 'Steel Cut Oats',
        commonName: 'Oats',
        brandName: 'Quaker',
        category: 'Carbohydrates',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 379,
        protein: 13.1,
        carbs: 67.7,
        fat: 6.5,
        searchKeywords: 'oats, oatmeal, porridge, breakfast, fiber',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free'],
        servings: [
          { name: '1 Cup cooked', grams: 234, unitType: 'CUP', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Sweet Potato',
        commonName: 'Sweet Potato',
        brandName: 'Earths Best',
        category: 'Carbohydrates',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 86,
        protein: 1.6,
        carbs: 20,
        fat: 0.1,
        searchKeywords: 'sweet potato, yam, root vegetable, carbs',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free'],
        servings: [
          { name: '1 Medium', grams: 150, unitType: 'PIECE', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Steamed Broccoli',
        commonName: 'Broccoli',
        brandName: 'Fresh Farms',
        category: 'Vegetables',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 35,
        protein: 2.4,
        carbs: 7,
        fat: 0.4,
        searchKeywords: 'broccoli, green, steamed, fiber',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free', 'Keto', 'Low Carb'],
        servings: [
          { name: '1 Cup', grams: 150, unitType: 'CUP', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Baby Spinach',
        commonName: 'Spinach',
        brandName: 'GreenLeaf',
        category: 'Vegetables',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 23,
        protein: 2.9,
        carbs: 3.6,
        fat: 0.4,
        searchKeywords: 'spinach, leafy green, iron, salad',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free', 'Keto', 'Low Carb'],
        servings: [
          { name: '1 Bowl', grams: 100, unitType: 'BOWL', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Avocado Hass',
        commonName: 'Avocado',
        brandName: 'Sunny Valley',
        category: 'Vegetables',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 160,
        protein: 2,
        carbs: 8.5,
        fat: 14.7,
        searchKeywords: 'avocado, fat, healthy fats, guacamole',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free', 'Keto', 'Low Carb'],
        servings: [
          { name: '1 Medium', grams: 150, unitType: 'PIECE', isDefault: true, displayOrder: 1 },
          { name: 'Half Avocado', grams: 75, unitType: 'SLICE', isDefault: false, displayOrder: 2 },
        ],
      },
      {
        foodName: 'Fresh Banana',
        commonName: 'Banana',
        brandName: 'Dole',
        category: 'Fruits',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 89,
        protein: 1.1,
        carbs: 22.8,
        fat: 0.3,
        searchKeywords: 'banana, fruit, yellow, potassium',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free'],
        servings: [
          { name: '1 Medium', grams: 118, unitType: 'PIECE', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Fresh Blueberries',
        commonName: 'Blueberries',
        brandName: 'BerrySweet',
        category: 'Fruits',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 57,
        protein: 0.7,
        carbs: 14.5,
        fat: 0.3,
        searchKeywords: 'blueberries, berries, antioxidants, fruit',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free'],
        servings: [
          { name: '1 Cup', grams: 148, unitType: 'CUP', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Greek Yogurt 0% Fat',
        commonName: 'Greek Yogurt',
        brandName: 'Fage',
        category: 'Dairy',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 57,
        protein: 10.3,
        carbs: 4,
        fat: 0,
        searchKeywords: 'greek yogurt, yogurt, nonfat, protein, dairy',
        tagsList: ['High Protein', 'Vegetarian', 'Gluten Free', 'Low Carb'],
        servings: [
          { name: '1 Cup', grams: 200, unitType: 'CUP', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Whey Protein Isolate',
        commonName: 'Whey Protein',
        brandName: 'Optimum Nutrition',
        category: 'Supplements',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 375,
        protein: 80,
        carbs: 6.6,
        fat: 3.3,
        searchKeywords: 'whey, protein powder, isolate, supplement',
        tagsList: ['High Protein', 'Gluten Free', 'Low Carb'],
        servings: [
          { name: '1 Scoop', grams: 30, unitType: 'SCOOP', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Almond Milk Unsweetened',
        commonName: 'Almond Milk',
        brandName: 'Silk',
        category: 'Dairy',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 15,
        protein: 0.4,
        carbs: 0.6,
        fat: 1.1,
        searchKeywords: 'almond milk, nut milk, dairy free, unsweetened',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free', 'Keto', 'Low Carb'],
        servings: [
          { name: '1 Cup', grams: 240, unitType: 'CUP', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Whole Eggs Large',
        commonName: 'Eggs',
        brandName: 'Happy Egg',
        category: 'Proteins',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 143,
        protein: 12.6,
        carbs: 0.7,
        fat: 9.5,
        searchKeywords: 'eggs, whole eggs, yolk, protein, egg',
        tagsList: ['High Protein', 'Vegetarian', 'Gluten Free', 'Keto', 'Low Carb'],
        servings: [
          { name: '1 Large Egg', grams: 50, unitType: 'PIECE', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Egg Whites Liquid',
        commonName: 'Egg Whites',
        brandName: 'Egg Beaters',
        category: 'Proteins',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 52,
        protein: 11,
        carbs: 0.7,
        fat: 0.2,
        searchKeywords: 'egg whites, liquid egg whites, lean protein',
        tagsList: ['High Protein', 'Vegetarian', 'Gluten Free', 'Low Carb'],
        servings: [
          { name: '1 Cup', grams: 240, unitType: 'CUP', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Quinoa Grain Raw',
        commonName: 'Quinoa',
        brandName: 'Ancient Harvest',
        category: 'Carbohydrates',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 368,
        protein: 14,
        carbs: 64,
        fat: 6,
        searchKeywords: 'quinoa, pseudograin, ancient grain, gluten free',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free'],
        servings: [
          { name: '1 Cup cooked', grams: 185, unitType: 'CUP', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Raw Almonds',
        commonName: 'Almonds',
        brandName: 'NuttyCo',
        category: 'Proteins',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 579,
        protein: 21,
        carbs: 22,
        fat: 49,
        searchKeywords: 'almonds, nuts, healthy fat, snack',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free', 'Keto', 'Low Carb'],
        servings: [
          { name: '1 Serving (28g)', grams: 28, unitType: 'SERVING', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Organic Chia Seeds',
        commonName: 'Chia Seeds',
        brandName: 'Superfoods',
        category: 'Supplements',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 486,
        protein: 17,
        carbs: 42,
        fat: 31,
        searchKeywords: 'chia seeds, chia, fiber, omega 3',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free', 'Keto', 'Low Carb'],
        servings: [
          { name: '1 Tablespoon', grams: 12, unitType: 'TBSP', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Peanut Butter Smooth',
        commonName: 'Peanut Butter',
        brandName: 'Skippy',
        category: 'Dairy',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 588,
        protein: 25,
        carbs: 20,
        fat: 50,
        searchKeywords: 'peanut butter, peanut, spread, healthy fats',
        tagsList: ['Vegetarian', 'Gluten Free'],
        servings: [
          { name: '1 Tablespoon', grams: 16, unitType: 'TBSP', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Fresh Apple Red',
        commonName: 'Apple',
        brandName: 'Dole',
        category: 'Fruits',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 52,
        protein: 0.3,
        carbs: 14,
        fat: 0.2,
        searchKeywords: 'apple, red apple, fruit, fiber',
        tagsList: ['Vegan', 'Vegetarian', 'Gluten Free'],
        servings: [
          { name: '1 Medium', grams: 182, unitType: 'PIECE', isDefault: true, displayOrder: 1 },
        ],
      },
      {
        foodName: 'Cottage Cheese 2%',
        commonName: 'Cottage Cheese',
        brandName: 'Daisy',
        category: 'Dairy',
        defaultQuantity: 100,
        defaultUnit: 'g',
        servingSize: 100,
        servingUnit: 'g',
        calories: 98,
        protein: 11,
        carbs: 3.4,
        fat: 2.3,
        searchKeywords: 'cottage cheese, cheese, dairy, casein',
        tagsList: ['High Protein', 'Vegetarian', 'Gluten Free', 'Low Carb'],
        servings: [
          { name: '1 Cup', grams: 220, unitType: 'CUP', isDefault: true, displayOrder: 1 },
        ],
      }
    ];

    const seededFoods = [];
    for (const foodItem of foodsList) {
      const food = await prisma.foodLibrary.create({
        data: {
          tenantId,
          foodName: foodItem.foodName,
          commonName: foodItem.commonName,
          brandName: foodItem.brandName,
          isSystem: false,
          defaultQuantity: foodItem.defaultQuantity,
          defaultUnit: foodItem.defaultUnit,
          servingSize: foodItem.servingSize,
          servingUnit: foodItem.servingUnit,
          calories: foodItem.calories,
          protein: foodItem.protein,
          carbs: foodItem.carbs,
          fat: foodItem.fat,
          categoryId: categories[foodItem.category].id,
          searchKeywords: foodItem.searchKeywords,
          status: 'ACTIVE',
        },
      });

      // Seeding Servings
      for (const s of foodItem.servings) {
        await prisma.foodServing.create({
          data: {
            foodId: food.id,
            name: s.name,
            grams: s.grams,
            unitType: s.unitType,
            isDefault: s.isDefault,
            displayOrder: s.displayOrder,
          },
        });
      }

      // Seeding Tag Mapping
      for (const tagName of foodItem.tagsList) {
        await prisma.foodTagMapping.create({
          data: {
            foodId: food.id,
            tagId: tags[tagName].id,
          },
        });
      }

      seededFoods.push(food);
    }

    results[tenantId] = {
      categories,
      tags,
      foods: seededFoods,
    };
  }

  console.log('Food library seeded successfully.');
  return results;
}
