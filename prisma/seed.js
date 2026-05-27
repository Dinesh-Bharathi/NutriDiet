// prisma/seed.js
// ─────────────────────────────────────────────────────────────────────────────
// Database seed script.
// Run with: npm run db:seed
//
// Creates a demo tenant and an OWNER user for local development.
// DO NOT run against production databases.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // ── Demo Tenant ────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-clinic" },
    update: {},
    create: {
      name: "Demo Wellness Clinic",
      slug: "demo-clinic",
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      email: "admin@demo-clinic.com",
      phone: "+1-555-000-0000",
    },
  });

  console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

  // ── Owner User ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Admin@123456", 12);

  const owner = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "owner@demo-clinic.com",
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "owner@demo-clinic.com",
      passwordHash,
      firstName: "Demo",
      lastName: "Owner",
      role: "OWNER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`✅ Owner user created: ${owner.email} (${owner.id})`);

  // ── Demo Dietitian ─────────────────────────────────────────────────────────
  const dietitianHash = await bcrypt.hash("Dietitian@123", 12);

  const dietitian = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "dietitian@demo-clinic.com",
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "dietitian@demo-clinic.com",
      passwordHash: dietitianHash,
      firstName: "Sarah",
      lastName: "Mitchell",
      role: "DIETITIAN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  console.log(
    `✅ Dietitian user created: ${dietitian.email} (${dietitian.id})`,
  );

  // ── Demo Client ────────────────────────────────────────────────────────────
  const client = await prisma.client.upsert({
    where: { id: "seed-client-001" },
    update: {},
    create: {
      id: "seed-client-001",
      tenantId: tenant.id,
      dietitianId: dietitian.id,
      firstName: "Alex",
      lastName: "Thompson",
      email: "alex@example.com",
      phone: "+1-555-123-4567",
      gender: "MALE",
      dateOfBirth: new Date("1990-03-15"),
    },
  });

  console.log(
    `✅ Demo client created: ${client.firstName} ${client.lastName} (${client.id})`,
  );

  console.log("\n🎉 Seed complete!");
  console.log("\n📋 Credentials:");
  console.log(`   Owner:     owner@demo-clinic.com / Admin@123456`);
  console.log(`   Dietitian: dietitian@demo-clinic.com / Dietitian@123`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
