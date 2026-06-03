import prisma from "../src/lib/prisma.js";
import { seedFoodLibrary } from "./seed/seed-food-library.js";
import { seedTenants } from "./seed/seed-tenants.js";
import { seedUsers } from "./seed/seed-users.js";

async function main() {
  console.log("=== STARTING DATABASE SEED ENGINE ===\n");

  // 2. Tenants
  const tenants = await seedTenants();
  console.log("");

  // 3. Users
  const users = await seedUsers(tenants);
  console.log("");

  // 4. Food Library
  const foodLibraryResults = await seedFoodLibrary(tenants);
  console.log("");
}

main()
  .catch((e) => {
    console.error("Delete execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
