import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log("--- Seeding Plans ---");
  try {
    const plansToSeed = [
      {
        code: 'FREE_TRIAL',
        name: 'Free Trial',
        description: '14-day free trial, read-only mode after expiration',
        priceMonthly: 0,
        priceYearly: 0,
        currency: 'INR',
        isCustom: false,
        isActive: true,
      },
      {
        code: 'STARTER',
        name: 'Starter',
        description: 'For independent practitioners starting their practice',
        priceMonthly: 999,
        priceYearly: 9990,
        currency: 'INR',
        isCustom: false,
        isActive: true,
      },
      {
        code: 'PROFESSIONAL',
        name: 'Professional',
        description: 'Advanced features for growing practices and clinics',
        priceMonthly: 2999,
        priceYearly: 29990,
        currency: 'INR',
        isCustom: false,
        isActive: true,
      },
      {
        code: 'ENTERPRISE',
        name: 'Enterprise',
        description: 'Custom pricing and features for large organizations and multi-branch clinics',
        priceMonthly: null,
        priceYearly: null,
        currency: 'INR',
        isCustom: true,
        isActive: true,
      }
    ];

    for (const plan of plansToSeed) {
      const seeded = await prisma.plan.upsert({
        where: { code: plan.code },
        update: {
          name: plan.name,
          description: plan.description,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          currency: plan.currency,
          isCustom: plan.isCustom,
          isActive: plan.isActive,
        },
        create: plan
      });
      console.log(`Seeded plan: ${seeded.name} (Code: ${seeded.code}, ID: ${seeded.id})`);
    }
    console.log("Plans seeded successfully!");
  } catch (err) {
    console.error("Error seeding plans:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
