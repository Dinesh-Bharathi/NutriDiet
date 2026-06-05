// prisma/seed/clear-database.js
// Deletes all rows from every table in strict FK-dependency order.
// Rule: children before parents, same as a topological sort of the FK graph.
import prisma from '../../src/lib/prisma.js';

export async function clearDatabase() {
  console.log('Clearing database — deleting in FK-safe order...');

  // ── Tier 1: Deepest leaf nodes (no children) ─────────────────────────────

  // Clinical profile deep children
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

  // ── Tier 2: Clinical Profile root (depends on Assessment + Client + Tenant) ─
  await prisma.clientClinicalProfile.deleteMany();

  // ── Tier 3: Food library junction / leaf nodes ────────────────────────────
  await prisma.foodEquivalent.deleteMany();
  await prisma.foodServing.deleteMany();
  await prisma.foodTagMapping.deleteMany();
  await prisma.mealSwapHistory.deleteMany();

  // ── Tier 4: Diet plan meal items & cycle days ─────────────────────────────
  await prisma.dietPlanMealItem.deleteMany();
  await prisma.dietPlanMeal.deleteMany();
  await prisma.dietPlanCycleDay.deleteMany();
  await prisma.dietPlanCycle.deleteMany();

  // ── Tier 5: Template meal items & cycle days ──────────────────────────────
  await prisma.dietPlanTemplateMealItem.deleteMany();
  await prisma.dietPlanTemplateMeal.deleteMany();
  await prisma.templateCycleDay.deleteMany();
  await prisma.templateCycle.deleteMany();

  // ── Tier 6: Core business aggregates ─────────────────────────────────────
  await prisma.clientCheckIn.deleteMany();
  await prisma.dietPlan.deleteMany();
  await prisma.dietPlanTemplate.deleteMany();
  await prisma.labMarkerDefinition.deleteMany();
  await prisma.assessment.deleteMany();

  // ── Tier 7: File assets (FK → User + Tenant; Client.avatarAssetId → FileAsset) ─
  // Must clear BEFORE clients/users so ClientAvatar relation is null first
  await prisma.fileAsset.deleteMany();

  // ── Tier 8: Clients, refresh tokens, users ────────────────────────────────
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // ── Tier 9: Tenant-scoped library data ───────────────────────────────────
  await prisma.foodLibrary.deleteMany();
  await prisma.foodTag.deleteMany();
  await prisma.foodCategory.deleteMany();
  await prisma.tenant.deleteMany();

  console.log('✓ Database cleared successfully.');
}
