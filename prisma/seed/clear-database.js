// prisma/seed/clear-database.js
import prisma from '../../src/lib/prisma.js';

export async function clearDatabase() {
  console.log('Clearing database business data...');

  // Safe deletion order due to foreign key constraints
  await prisma.foodEquivalent.deleteMany();
  await prisma.foodServing.deleteMany();
  await prisma.foodTagMapping.deleteMany();
  
  await prisma.dietPlanMealItem.deleteMany();
  await prisma.dietPlanMeal.deleteMany();
  await prisma.dietPlanCycleDay.deleteMany();
  await prisma.dietPlanCycle.deleteMany();
  
  await prisma.dietPlanTemplateMealItem.deleteMany();
  await prisma.dietPlanTemplateMeal.deleteMany();
  await prisma.templateCycleDay.deleteMany();
  await prisma.templateCycle.deleteMany();
  
  await prisma.clientCheckIn.deleteMany();
  await prisma.dietPlan.deleteMany();
  await prisma.dietPlanTemplate.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.foodLibrary.deleteMany();
  await prisma.foodTag.deleteMany();
  await prisma.foodCategory.deleteMany();
  await prisma.tenant.deleteMany();

  console.log('Database successfully cleared.');
}
