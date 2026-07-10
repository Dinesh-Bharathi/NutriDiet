// backend/tests/verify-ai-tools.js
// Integration test to verify AI ReAct tool calling for database client queries.

import prisma from '../src/lib/prisma.js';
import { aiService } from '../src/modules/ai/ai.service.js';

async function run() {
  console.log("--- Starting AI Tool Calling Verification ---");

  try {
    // 1. Resolve active tenant
    const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } });
    if (!tenant) {
      throw new Error("No active tenant found in database. Run seeders first.");
    }
    console.log(`Using Tenant: ${tenant.name} (ID: ${tenant.id})`);

    // 2. Create a temporary test client
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

    // 3. Ask AI to list clients
    const messages = [
      {
        role: "system",
        content: `You are NutriDiet AI.
If the user asks you to list all clients or find/search a client by name/email, you must request a tool call. To request a tool, output exactly:
- [TOOL: list_clients] to list all clients.
- [TOOL: search_clients:<query>] to search for a client. E.g., [TOOL: search_clients:dinesh].
Do not output anything else in that turn. Once the tool output is provided to you, summarize the results for the user.`
      },
      {
        role: "user",
        content: "Please list all our clients registered in the system."
      }
    ];

    console.log("\n[Test] Dispatching query 'Please list all our clients registered in the system.' to Ollama ReAct agent...");
    const reply = await aiService.chatWithAI(messages, tenant.id);

    console.log("-----------------------------------------------------------------");
    console.log("AI Final Reply:");
    console.log(reply);
    console.log("-----------------------------------------------------------------");

    // Assert that the AI successfully lists the client we created
    if (!reply.toLowerCase().includes("alexander") && !reply.toLowerCase().includes("fleming")) {
      throw new Error("AI agent failed to find or list the newly created client 'Alexander Fleming'.");
    }

    console.log("✅ Success: AI ReAct Agent successfully invoked list_clients and summarized results!");

    // 4. Cleanup
    console.log("\nCleaning up test client...");
    await prisma.client.delete({ where: { id: client.id } });
    console.log("Cleanup finished.");

  } catch (error) {
    console.error("❌ Test Failed:", error);
    process.exit(1);
  }
}

run();
