// backend/tests/verify-ai-mutations.js
// Integration test to verify AI ReAct tool calling for database update mutations (weight, goals, meal logs).

import prisma from '../src/lib/prisma.js';
import { aiService } from '../src/modules/ai/ai.service.js';

async function run() {
  console.log("--- Starting AI Mutations Tool Verification ---");

  try {
    // 1. Resolve active tenant
    const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } });
    if (!tenant) {
      throw new Error("No active tenant found in database. Run seeders first.");
    }
    console.log(`Using Tenant: ${tenant.name} (ID: ${tenant.id})`);

    // 2. Create a temporary test client & clinical profile
    const testEmail = `test_mutate_${Date.now()}@example.com`;
    const client = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: "Marie",
        lastName: "Curie",
        email: testEmail,
        status: "ACTIVE",
      }
    });
    console.log(`Created test client: ${client.firstName} ${client.lastName} (ID: ${client.id})`);

    const clinicalProfile = await prisma.clientClinicalProfile.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        summaryNotes: "Initial clinical notes.",
      }
    });

    // We will establish an initial height of 160cm so that BMI calculation works
    await prisma.clientAnthropometricRecord.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        profileId: clinicalProfile.id,
        heightCm: 160.0,
        weightKg: 60.0,
        bmi: 23.4,
      }
    });

    // 3. Test Mutation 1: Update client weight to 55kg and height to 165cm
    const messagesWeight = [
      {
        role: "system",
        content: `You are NutriDiet AI.
If the user asks you to list all clients, find/search a client, fetch details of a specific client, or update a client's metrics/profile (weight, height, goal, clinical notes, meal log) by name/email, you must request a tool call. To request a tool, output exactly:
- [TOOL: update_anthropometrics:<email>:<weightKg>:<heightCm>] to update/log a new weight and/or height measurement (use "null" for unspecified values). E.g., [TOOL: update_anthropometrics:dineshdb6998@gmail.com:75:180].
Do not output anything else in that turn. Once the tool output is provided to you, summarize the results for the user.`
      },
      {
        role: "user",
        content: `Log a new weight of 55kg and height of 165cm for client Marie Curie (email: ${testEmail}).`
      }
    ];

    console.log(`\n[Test 1] Dispatching 'Log new weight of 55kg and height of 165cm' query...`);
    const replyWeight = await aiService.chatWithAI(messagesWeight, tenant.id);
    console.log("AI Final Reply (Weight/Height Update):");
    console.log(replyWeight);

    // Verify record exists in PostgreSQL
    const freshRecord = await prisma.clientAnthropometricRecord.findFirst({
      where: { clientId: client.id, tenantId: tenant.id },
      orderBy: { measuredAt: 'desc' }
    });
    console.log(`Verifying Database record: Weight = ${freshRecord?.weightKg} kg, Height = ${freshRecord?.heightCm} cm, BMI = ${freshRecord?.bmi?.toFixed(1)}`);
    if (freshRecord?.weightKg !== 55.0 || freshRecord?.heightCm !== 165.0) {
      throw new Error("Failed to verify that weight 55kg and height 165cm were successfully saved to PostgreSQL.");
    }
    console.log("✅ Success: Anthropometrics update mutation tool worked perfectly!");

    // 4. Test Mutation 2: Update goal to WEIGHT_LOSS:52kg
    const messagesGoal = [
      {
        role: "system",
        content: `You are NutriDiet AI.
If the user asks you to list all clients, find/search a client, fetch details of a specific client, or update a client's metrics/profile (weight, goal, clinical notes, meal log) by name/email, you must request a tool call. To request a tool, output exactly:
- [TOOL: update_goal:<email>:<goalType>:<targetWeightKg>] to set a new active goal (goalType must be one of: WEIGHT_LOSS, WEIGHT_GAIN, MAINTENANCE, MUSCLE_GAIN, PERFORMANCE, MEDICAL_NUTRITION, GENERAL_WELLNESS). E.g., [TOOL: update_goal:dineshdb6998@gmail.com:WEIGHT_GAIN:80].
Do not output anything else in that turn. Once the tool output is provided to you, summarize the results for the user.`
      },
      {
        role: "user",
        content: `Set the goal of Marie Curie (email: ${testEmail}) to WEIGHT_LOSS with target weight 52kg.`
      }
    ];

    console.log(`\n[Test 2] Dispatching 'Set goal to WEIGHT_LOSS with target weight 52kg' query...`);
    const replyGoal = await aiService.chatWithAI(messagesGoal, tenant.id);
    console.log("AI Final Reply (Goal Update):");
    console.log(replyGoal);

    // Verify goal exists in PostgreSQL
    const activeGoal = await prisma.clientGoalProfile.findFirst({
      where: { clientId: client.id, tenantId: tenant.id, status: 'ACTIVE' }
    });
    console.log(`Verifying Database record: Goal = ${activeGoal?.goalType}, Target Weight = ${activeGoal?.targetWeightKg} kg`);
    if (activeGoal?.goalType !== 'WEIGHT_LOSS' || activeGoal?.targetWeightKg !== 52.0) {
      throw new Error("Failed to verify that goal updates were saved to PostgreSQL.");
    }
    console.log("✅ Success: Goal update mutation tool worked perfectly!");

    // 5. Cleanup
    console.log("\nCleaning up test client records...");
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
