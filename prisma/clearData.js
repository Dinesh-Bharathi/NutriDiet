import prisma from "../src/lib/prisma.js";
import { clearDatabase } from "./seed/clear-database.js";

async function main() {
  console.log("=== STARTING DATABASE SEED ENGINE ===\n");

  // 1. Clear database
  await clearDatabase();
  console.log("Database cleared successfully");
}

main()
  .catch((e) => {
    console.error("Delete execution failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
