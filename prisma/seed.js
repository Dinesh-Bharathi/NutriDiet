// prisma/seed.js
import { clearDatabase } from './seed/clear-database.js';
import { seedTenants } from './seed/seed-tenants.js';
import { seedUsers } from './seed/seed-users.js';
import { seedFoodLibrary } from './seed/seed-food-library.js';
import { seedClients } from './seed/seed-clients.js';
import { seedAssessments } from './seed/seed-assessments.js';
import { seedTemplates } from './seed/seed-templates.js';
import { seedDietPlans } from './seed/seed-diet-plans.js';
import { seedCheckIns } from './seed/seed-checkins.js';
import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('=== STARTING DATABASE SEED ENGINE ===\n');

  // 1. Clear database
  await clearDatabase();
  console.log('');

  // 2. Tenants
  const tenants = await seedTenants();
  console.log('');

  // 3. Users
  const users = await seedUsers(tenants);
  console.log('');

  // 4. Food Library
  const foodLibraryResults = await seedFoodLibrary(tenants);
  console.log('');

  // 5. Clients
  const clients = await seedClients(tenants, users);
  console.log('');

  // 6. Assessments
  await seedAssessments(tenants, users, clients);
  console.log('');

  // 7. Diet Plan Templates
  await seedTemplates(tenants, users, foodLibraryResults);
  console.log('');

  // 8. Active Diet Plans
  const dietPlans = await seedDietPlans(tenants, users, clients, foodLibraryResults);
  console.log('');

  // 9. Client Check-Ins (Progress Progression Data)
  await seedCheckIns(tenants, users, clients, dietPlans);

  console.log('\n=== DATABASE SEED COMPLETED SUCCESSFULLY ===');
}

main()
  .catch((e) => {
    console.error('Seed execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
