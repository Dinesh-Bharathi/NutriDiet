// backend/tests/verify-ai-context.js
// Integration test to verify Phase 1 AI Context Injection service.

import prisma from '../src/lib/prisma.js';
import { aiContextService } from '../src/modules/ai/ai-context.service.js';

async function run() {
  console.log("--- Starting AI Context Injection Verification ---");

  try {
    // 1. Resolve active tenant
    const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } });
    if (!tenant) {
      throw new Error("No active tenant found in database. Run seeders first.");
    }
    console.log(`Using Tenant: ${tenant.name} (ID: ${tenant.id})`);

    // 2. Create a temporary test client
    const testEmail = `test_agent_${Date.now()}@example.com`;
    const client = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: "Dinesh",
        lastName: "Bharathi",
        email: testEmail,
        gender: "MALE",
        dateOfBirth: new Date("1995-05-15"),
        timezone: "Asia/Kolkata",
      }
    });
    console.log(`Created test client: ${client.firstName} (ID: ${client.id})`);

    // 3. Create related clinical, goal, metrics, and lifestyle profiles
    const clinicalProfile = await prisma.clientClinicalProfile.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        summaryNotes: "Client shows mild lactose intolerance. Target weight is 80kg.",
      }
    });

    await prisma.clientGoalProfile.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        profileId: clinicalProfile.id,
        goalType: "WEIGHT_GAIN",
        targetWeightKg: 80.0,
        status: "ACTIVE",
        notes: "Targeting gradual lean muscle mass gain.",
      }
    });

    await prisma.clientAnthropometricRecord.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        profileId: clinicalProfile.id,
        heightCm: 175.0,
        weightKg: 74.0,
        bmi: 24.2,
        bodyFatPercent: 15.4,
      }
    });

    await prisma.clientLifestyleProfile.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        profileId: clinicalProfile.id,
        occupation: "Software Engineer",
        sleepHours: 7.5,
        stressLevel: 4,
        activityLevel: "MODERATELY_ACTIVE",
      }
    });

    // Create daily meal logs today to test consumed macros compiler
    await prisma.clientMealLog.createMany({
      data: [
        {
          tenantId: tenant.id,
          clientId: client.id,
          mealType: "BREAKFAST",
          foodName: "Eggs & Oatmeal",
          quantity: 1,
          unit: "serving",
          calories: 450.0,
          protein: 25.0,
          carbs: 45.0,
          fat: 15.0,
        },
        {
          tenantId: tenant.id,
          clientId: client.id,
          mealType: "LUNCH",
          foodName: "Grilled Chicken Salad",
          quantity: 1,
          unit: "serving",
          calories: 550.0,
          protein: 45.0,
          carbs: 20.0,
          fat: 25.0,
        }
      ]
    });

    console.log("Created all clinical, metric, and meal log entries.");

    // 4. Run the context compiler
    console.log("\n[Test] Compiling clinical context prompt...");
    const contextPrompt = await aiContextService.getClientContextPrompt(tenant.id, client.id);

    console.log("-----------------------------------------------------------------");
    console.log(contextPrompt);
    console.log("-----------------------------------------------------------------");

    // Basic assertions
    if (!contextPrompt.includes("Dinesh Bharathi")) throw new Error("Context prompt missing client name");
    if (!contextPrompt.includes("WEIGHT_GAIN")) throw new Error("Context prompt missing goal type");
    if (!contextPrompt.includes("Lactose intolerance")) {
      // Allow lowercase match
      if (!contextPrompt.toLowerCase().includes("lactose")) {
        throw new Error("Context prompt missing clinical notes");
      }
    }
    if (!contextPrompt.includes("Calories consumed today: 1000 kcal")) {
      throw new Error("Context prompt missing today's macro intake sum calculations");
    }

    console.log("✅ Success: Context compiled and assertions passed successfully!");

    // 5. Cleanup
    console.log("\nCleaning up test records...");
    await prisma.clientMealLog.deleteMany({ where: { clientId: client.id } });
    await prisma.clientLifestyleProfile.delete({ where: { clientId: client.id } });
    await prisma.clientAnthropometricRecord.deleteMany({ where: { clientId: client.id } });
    await prisma.clientGoalProfile.deleteMany({ where: { clientId: client.id } });
    await prisma.clientClinicalProfile.delete({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
    console.log("Cleanup finished.");

  } catch (error) {
    console.error("❌ Test Failed:", error);
    process.exit(1);
  }
}

run();
