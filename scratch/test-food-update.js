// scratch/test-food-update.js
import prisma from '../src/lib/prisma.js';
import { foodLibraryRepository } from '../src/modules/food-library/food-library.repository.js';

async function main() {
  console.log('Initializing test variables...');
  
  // Find a tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found in database.');
    return;
  }
  const tenantId = tenant.id;
  console.log('Using tenantId:', tenantId);

  // Create a test category
  const category = await prisma.foodCategory.create({
    data: {
      tenantId,
      name: `Test Category ${Date.now()}`,
      description: 'Used for food library update integration testing',
    },
  });
  console.log('Created test category:', category.id);

  // Create a test tag
  const tag = await prisma.foodTag.create({
    data: {
      tenantId,
      name: `Test Tag ${Date.now()}`,
      description: 'Used for food library update integration testing',
    },
  });
  console.log('Created test tag:', tag.id);

  // 1. Create a food item using repository.create
  console.log('\nCreating test food item...');
  const foodData = {
    foodName: `Test Food ${Date.now()}`,
    sourceType: 'CUSTOM',
    defaultQuantity: 100,
    defaultUnit: 'g',
    servingSize: 100,
    servingUnit: 'g',
    calories: 150,
    protein: 5,
    carbs: 20,
    fat: 2,
    categoryId: category.id,
    tagIds: [tag.id],
  };

  const createdFood = await foodLibraryRepository.create(tenantId, foodData);
  console.log('Created Food details:');
  console.log('- ID:', createdFood.id);
  console.log('- categoryId:', createdFood.categoryId);
  console.log('- tags count:', createdFood.tagMappings?.length);

  // Verify tags inside mapping
  if (createdFood.tagMappings?.[0]?.tagId !== tag.id) {
    throw new Error('Created food is missing tag associations!');
  }

  // 2. Perform an update (PATCH simulation)
  console.log('\nUpdating food item fields...');
  const updateData = {
    commonName: 'Banana Cavendish',
    brandName: 'Chiquita',
    searchKeywords: 'banana, fruit, yellow',
    categoryId: null, // clear category
    tagIds: [], // clear tags
  };

  const updatedFood = await foodLibraryRepository.update(tenantId, createdFood.id, updateData);
  console.log('Updated Food details:');
  console.log('- commonName:', updatedFood.commonName);
  console.log('- brandName:', updatedFood.brandName);
  console.log('- searchKeywords:', updatedFood.searchKeywords);
  console.log('- categoryId:', updatedFood.categoryId);
  console.log('- tags count:', updatedFood.tagMappings?.length);

  // Assert updates
  if (updatedFood.commonName !== 'Banana Cavendish') throw new Error('commonName not updated!');
  if (updatedFood.brandName !== 'Chiquita') throw new Error('brandName not updated!');
  if (updatedFood.searchKeywords !== 'banana, fruit, yellow') throw new Error('searchKeywords not updated!');
  if (updatedFood.categoryId !== null) throw new Error('categoryId not cleared!');
  if (updatedFood.tagMappings?.length !== 0) throw new Error('tagIds not cleared!');

  console.log('\nUpdate persistence verified successfully!');

  // Cleanup
  console.log('\nCleaning up test records...');
  await prisma.foodTagMapping.deleteMany({ where: { foodId: createdFood.id } });
  await prisma.foodLibrary.delete({ where: { id: createdFood.id } });
  await prisma.foodTag.delete({ where: { id: tag.id } });
  await prisma.foodCategory.delete({ where: { id: category.id } });
  console.log('Cleanup complete.');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
