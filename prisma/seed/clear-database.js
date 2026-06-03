// prisma/seed/clear-database.js
import prisma from '../../src/lib/prisma.js';

export async function clearDatabase() {
  console.log('Clearing database business data...');

  // Assessment V2 foundation models (children first)
  await prisma.assessmentSnapshot.deleteMany();
  await prisma.clientRiskFlag.deleteMany();
  await prisma.clientLabResult.deleteMany();
  await prisma.clientGoalProfile.deleteMany();
  await prisma.clientLifestyleProfile.deleteMany();
  await prisma.clientDigestiveIssue.deleteMany();
  await prisma.clientSupplement.deleteMany();
  await prisma.clientMedication.deleteMany();
  await prisma.clientAllergy.deleteMany();
  await prisma.clientCondition.deleteMany();
  await prisma.clientAnthropometricRecord.deleteMany();
  await prisma.assessmentSectionStatus.deleteMany();
  await prisma.clientClinicalProfile.deleteMany();

  // Food library dependencies
  await prisma.foodEquivalent.deleteMany();
  await prisma.foodServing.deleteMany();
  await prisma.foodTagMapping.deleteMany();
  await prisma.mealSwapHistory.deleteMany();

  // Diet plan meals & cycles
  await prisma.dietPlanMealItem.deleteMany();
  await prisma.dietPlanMeal.deleteMany();
  await prisma.dietPlanCycleDay.deleteMany();
  await prisma.dietPlanCycle.deleteMany();

  // Diet plan templates
  await prisma.dietPlanTemplateMealItem.deleteMany();
  await prisma.dietPlanTemplateMeal.deleteMany();
  await prisma.templateCycleDay.deleteMany();
  await prisma.templateCycle.deleteMany();

  // Core business entities
  await prisma.clientCheckIn.deleteMany();
  await prisma.dietPlan.deleteMany();
  await prisma.dietPlanTemplate.deleteMany();
  await prisma.labMarkerDefinition.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // Tenant-scoped library data
  await prisma.foodLibrary.deleteMany();
  await prisma.foodTag.deleteMany();
  await prisma.foodCategory.deleteMany();
  await prisma.tenant.deleteMany();

  console.log('Database successfully cleared.');
}
