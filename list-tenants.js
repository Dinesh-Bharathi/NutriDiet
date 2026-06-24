import prisma from "./src/lib/prisma.js";

async function run() {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        pdfTemplateConfig: true
      }
    });
    console.log("Tenants:");
    console.log(JSON.stringify(tenants, null, 2));

    const dietPlans = await prisma.dietPlan.findMany({
      take: 5,
      select: {
        id: true,
        title: true,
        tenantId: true
      }
    });
    console.log("Diet Plans (Up to 5):");
    console.log(JSON.stringify(dietPlans, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
