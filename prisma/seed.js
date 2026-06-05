// prisma/seed.js
//
// Phase 6 SSoT-Aligned Seed Orchestrator.
//
// EXECUTION ORDER (strict FK dependency chain):
//  1. clear      → wipe all tables in FK-safe reverse order
//  2. tenants    → root multi-tenancy entities
//  3. users      → staff accounts per tenant
//  4. foodLib    → food catalogue (required by meal items)
//  5. clients    → client records linked to users/tenants
//  6. assessments → V1 Assessment log + full V2 SSoT clinical fan-out:
//                    ClientClinicalProfile
//                    AssessmentSectionStatus (x4)
//                    ClientAnthropometricRecord
//                    ClientCondition / ClientAllergy / ClientMedication / ClientSupplement
//                    ClientGoalProfile  ← DietPlan.goalProfileId requires this
//                    ClientLifestyleProfile
//  7. templates  → diet plan templates for the template library
//  8. dietPlans  → active client diet plans (wired to goalProfileId)
//  9. checkIns   → weekly client progress check-ins
//
// Lab results & risk flags are seeded as optional post-seed extensions
// (not included in base seed — add via seed-labs.js when required).

import { clearDatabase }    from './seed/clear-database.js';
import { seedTenants }      from './seed/seed-tenants.js';
import { seedUsers }        from './seed/seed-users.js';
import { seedFoodLibrary }  from './seed/seed-food-library.js';
import { seedClients }      from './seed/seed-clients.js';
import { seedAssessments }  from './seed/seed-assessments.js';
import { seedTemplates }    from './seed/seed-templates.js';
import { seedDietPlans }    from './seed/seed-diet-plans.js';
import { seedCheckIns }     from './seed/seed-checkins.js';
import prisma               from '../src/lib/prisma.js';

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(  '║   NUTRI-DIET SEED ENGINE  —  Phase 6 SSoT Aligned   ║');
  console.log(  '╚══════════════════════════════════════════════════════╝\n');

  // ── Step 1: Clear ──────────────────────────────────────────────────────────
  await clearDatabase();
  console.log();

  // ── Step 2: Tenants ────────────────────────────────────────────────────────
  const tenants = await seedTenants();
  console.log();

  // ── Step 3: Users ──────────────────────────────────────────────────────────
  const users = await seedUsers(tenants);
  console.log();

  // ── Step 4: Food Library ───────────────────────────────────────────────────
  const foodLibraryResults = await seedFoodLibrary(tenants);
  console.log();

  // ── Step 5: Clients ────────────────────────────────────────────────────────
  const clients = await seedClients(tenants, users);
  console.log();

  // ── Step 6: Assessments + Full V2 SSoT Clinical Fan-Out ───────────────────
  //    Returns: { t1Assessments, t2Assessments, t1Profiles, t2Profiles,
  //               t1GoalProfiles, t2GoalProfiles }
  //    t1GoalProfiles / t2GoalProfiles are keyed by clientId and MUST be
  //    passed to seedDietPlans so the goalProfileId FK is correctly wired.
  const assessmentResults = await seedAssessments(tenants, users, clients);
  console.log();

  // ── Step 7: Diet Plan Templates ───────────────────────────────────────────
  await seedTemplates(tenants, users, foodLibraryResults);
  console.log();

  // ── Step 8: Active Client Diet Plans ──────────────────────────────────────
  //    BREAKING CHANGE from pre-Phase-6: seedDietPlans now receives
  //    assessmentResults so it can wire DietPlan.goalProfileId correctly.
  const dietPlans = await seedDietPlans(
    tenants,
    users,
    clients,
    assessmentResults,       // ← carries goalProfiles keyed by clientId
    foodLibraryResults,
  );
  console.log();

  // ── Step 9: Client Check-Ins ──────────────────────────────────────────────
  await seedCheckIns(tenants, users, clients, dietPlans);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(  '║         SEED COMPLETED SUCCESSFULLY ✓                ║');
  console.log(  '╚══════════════════════════════════════════════════════╝\n');
}

main()
  .catch((e) => {
    console.error('\n[SEED ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
