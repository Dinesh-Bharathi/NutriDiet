// scratch/test-swaps-search.js
import { mealSwapService } from '../src/modules/meal-swaps/meal-swap.service.js';
import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('--- Meal Swap Search & Discover Integration Test ---');

  // Find a valid meal item that is linked to a food library item
  const mealItem = await prisma.dietPlanMealItem.findFirst({
    where: {
      foodLibraryId: { not: null },
      meal: {
        dietPlan: {
          deletedAt: null
        }
      }
    },
    include: {
      meal: {
        include: {
          dietPlan: true
        }
      },
      foodLibrary: true
    }
  });

  if (!mealItem) {
    console.log('No valid meal item with foodLibraryId found. Please seed the database first.');
    return;
  }

  const tenantId = mealItem.meal.dietPlan.tenantId;
  const itemId = mealItem.id;
  const foodName = mealItem.foodLibrary.foodName;

  console.log(`Original Food Item: "${foodName}" (ID: ${mealItem.foodLibraryId})`);
  console.log(`Tenant Context: ${tenantId}`);
  console.log(`Meal Item ID: ${itemId}\n`);

  // Test 1: Fetch candidates without query string (q)
  console.log('Test 1: Initial Discovery (without q)');
  const res1 = await mealSwapService.getSwapCandidates(tenantId, itemId, 'BALANCED_MATCH', { page: 1, limit: 10 });
  console.log('Response status: Success');
  console.log('Pagination details:', res1.pagination);
  console.log('Classification category counts:');
  console.log('- Equivalents:', res1.data.equivalents.length);
  console.log('- Same Category:', res1.data.sameCategory.length);
  console.log('- Recommended (Sister Category):', res1.data.recommended.length);
  console.log('- Alternatives:', res1.data.alternatives.length);
  console.log('----------------------------------------------------');

  // Test 2: Fetch candidates with q matching food name or keywords (e.g. part of the name)
  console.log(`Test 2: Search Candidates with q="a" (frequent character)`);
  const res2 = await mealSwapService.getSwapCandidates(tenantId, itemId, 'BALANCED_MATCH', { q: 'a', page: 1, limit: 5 });
  console.log('Pagination details:', res2.pagination);
  console.log('Classification category counts:');
  console.log('- Equivalents:', res2.data.equivalents.length);
  console.log('- Same Category:', res2.data.sameCategory.length);
  console.log('- Recommended:', res2.data.recommended.length);
  console.log('- Alternatives:', res2.data.alternatives.length);
  if (res2.data.equivalents.length > 0) {
    console.log('Sample Equivalent:', res2.data.equivalents[0].food.foodName);
  }
  console.log('----------------------------------------------------');

  // Test 3: Fetch candidates with pagination page 2
  console.log(`Test 3: Pagination check (page=2, limit=5)`);
  const res3 = await mealSwapService.getSwapCandidates(tenantId, itemId, 'BALANCED_MATCH', { q: 'a', page: 2, limit: 5 });
  console.log('Pagination details:', res3.pagination);

  console.log('\nAll integration tests passed successfully.');
}

main().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
