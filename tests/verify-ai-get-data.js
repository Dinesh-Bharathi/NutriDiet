// backend/tests/verify-ai-get-data.js
// Integration test to verify AI ReAct tool calling for specific client biometrics query.

import prisma from '../src/lib/prisma.js';
import { aiService } from '../src/modules/ai/ai.service.js';

async function run() {
  console.log("--- Starting AI get_client_data Tool Verification ---");

  try {
    // 1. Resolve active tenant
    const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } });
    if (!tenant) {
      throw new Error("No active tenant found in database. Run seeders first.");
    }
    console.log(`Using Tenant: ${tenant.name} (ID: ${tenant.id})`);

    // 2. Create a temporary test client & biometrics
    const testEmail = `test_tool_${Date.now()}@example.com`;
    const client = await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: "Alexander",
        lastName: "Fleming",
        email: testEmail,
        status: "ACTIVE",
      }
    });
    console.log(`Created test client: ${client.firstName} ${client.lastName} (ID: ${client.id})`);

    const clinicalProfile = await prisma.clientClinicalProfile.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        summaryNotes: "Test clinical profile notes.",
      }
    });

    await prisma.clientAnthropometricRecord.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        profileId: clinicalProfile.id,
        heightCm: 180.0,
        weightKg: 85.5,
        bmi: 26.4,
      }
    });

    // 3. Ask AI about the client's weight
    const messages = [
      {
        role: "system",
        content: `You are NutriDiet AI.
If the user asks you to list all clients, find/search a client, or fetch details/biometrics (like weight) of a specific client by name/email, you must request a tool call. To request a tool, output exactly:
- [TOOL: list_clients] to list all clients.
- [TOOL: search_clients:<query>] to search for a client. E.g., [TOOL: search_clients:dinesh].
- [TOOL: get_client_data:<email>] to fetch details of a specific client by their email (including weight, goal, BMI, height). E.g., [TOOL: get_client_data:dineshdb6998@gmail.com].
Do not output anything else in that turn. Once the tool output is provided to you, summarize the results for the user.`
      },
      // Give context that Alexander Fleming's email is testEmail
      {
        role: "user",
        content: `The email of client Alexander Fleming is ${testEmail}. What is his latest weight?`
      }
    ];

    console.log(`\n[Test] Dispatching query 'What is Alexander Fleming's latest weight?' to Ollama ReAct agent...`);
    const reply = await aiService.chatWithAI(messages, tenant.id);

    console.log("-----------------------------------------------------------------");
    console.log("AI Final Reply:");
    console.log(reply);
    console.log("-----------------------------------------------------------------");

    // Assert that the AI successfully lists the weight we created
    if (!reply.toLowerCase().includes("85.5")) {
      throw new Error("AI agent failed to retrieve or state the correct weight of 85.5 kg.");
    }

    console.log("✅ Success: AI ReAct Agent successfully invoked get_client_data and returned the latest weight!");

    // 4. Cleanup
    console.log("\nCleaning up test client records...");
    await prisma.clientAnthropometricRecord.deleteMany({ where: { clientId: client.id } });
    await prisma.clientClinicalProfile.delete({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
    console.log("Cleanup finished.");

  } catch (error) {
    console.error("❌ Test Failed:", error);
    process.exit(1);
  }
}

run();
