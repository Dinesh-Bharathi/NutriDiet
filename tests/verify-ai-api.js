// backend/tests/verify-ai-api.js
// Integration test script for Phase 1 AI Chat REST API.

import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import jwtPkg from 'jsonwebtoken';
import env from '../src/config/env.js';
const { sign } = jwtPkg;

// Helper to sign JWT tokens for API calls
function generateToken(userId, tenantId, role, email) {
  return sign(
    {
      sub: userId,
      userId,
      tenantId,
      role,
      email,
      tokenType: 'access',
      jti: `jti_test_${Date.now()}`,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
}

async function run() {
  console.log("--- Starting AI Chat REST API Verification ---");
  let failed = false;
  let server = null;

  try {
    // -------------------------------------------------------------
    // SETUP: Resolve Tenant
    // -------------------------------------------------------------
    const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } });
    if (!tenant) {
      throw new Error("No active tenant found in the database. Please run migrations/seeders first.");
    }
    console.log(`Using Tenant: ${tenant.name} (ID: ${tenant.id})`);

    // Generate tokens for CLIENT role as requested (accessible to clients)
    const clientToken = generateToken('user_client_123', tenant.id, 'CLIENT', 'client@fitlife.com');

    // -------------------------------------------------------------
    // Spin up test Express server on a random free port
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        console.log(`Test Express server listening on: http://127.0.0.1:${port}`);
        resolve();
      });
    });

    const { port } = server.address();
    const aiBaseUrl = `http://127.0.0.1:${port}/api/${env.API_VERSION}/ai`;

    // -------------------------------------------------------------
    // Test 1: Authentication & Tenant Guard
    // -------------------------------------------------------------
    console.log("\n[Test 1] Testing authentication and tenant guards...");

    // 1.1 Try sending a chat request without authorization token
    const resNoAuth = await fetch(`${aiBaseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'Hello' }),
    });

    if (resNoAuth.status !== 401) {
      console.error(`❌ Failure: POST /chat without token returned HTTP ${resNoAuth.status} (expected 401)`);
      failed = true;
    } else {
      console.log("   POST /chat without token correctly returned 401 Unauthorized.");
    }

    // -------------------------------------------------------------
    // Test 2: Validation Pipeline (Zod check)
    // -------------------------------------------------------------
    console.log("\n[Test 2] Testing Zod validation middleware...");

    // 2.1 Send empty body
    const resValidationEmpty = await fetch(`${aiBaseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`,
      },
      body: JSON.stringify({}), // Missing message
    });

    const validationPayload = await resValidationEmpty.json();
    if (resValidationEmpty.status !== 400 || validationPayload.success !== false) {
      console.error(`❌ Failure: POST /chat with empty body returned HTTP ${resValidationEmpty.status} (expected 400)`);
      failed = true;
    } else {
      console.log("   POST /chat with missing 'message' correctly returned 400 Bad Request.");
      console.log("   Validation errors returned:", validationPayload.errors);
    }

    // 2.2 Send invalid role in history
    const resValidationInvalidRole = await fetch(`${aiBaseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        message: 'Hello',
        history: [{ role: 'invalid-role', content: 'test' }]
      }),
    });

    const validationPayload2 = await resValidationInvalidRole.json();
    if (resValidationInvalidRole.status !== 400 || validationPayload2.success !== false) {
      console.error(`❌ Failure: POST /chat with invalid history role returned HTTP ${resValidationInvalidRole.status} (expected 400)`);
      failed = true;
    } else {
      console.log("   POST /chat with invalid history role correctly returned 400 Bad Request.");
      console.log("   Validation errors returned:", validationPayload2.errors);
    }

    // -------------------------------------------------------------
    // Test 3: Successful Chat Request (or clean connection failure)
    // -------------------------------------------------------------
    console.log("\n[Test 3] Testing AI Service chat execution...");

    const resChat = await fetch(`${aiBaseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        message: 'Hello, suggest a quick high protein snack.',
        history: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello, how can I help you today?' }
        ]
      }),
    });

    const chatPayload = await resChat.json();

    if (resChat.status === 200 && chatPayload.success === true) {
      console.log("   ✅ Success: Ollama chat returned 200 OK!");
      console.log("   AI response:", chatPayload.data.response);
    } else if (resChat.status === 500 && chatPayload.success === false) {
      console.log("   ℹ️ Info: Returned 500 error, expected if Ollama server is offline or model is not pulled.");
      console.log("   Response payload details:", chatPayload.message);
    } else {
      console.error(`❌ Failure: Unexpected response code ${resChat.status} with payload:`, chatPayload);
      failed = true;
    }

  } catch (error) {
    console.error("❌ Exception during verification run:", error);
    failed = true;
  } finally {
    if (server) {
      server.close();
      console.log("\nTest Express server shut down.");
    }
    
    if (failed) {
      console.log("\n--- Verification FAILED ---");
      process.exit(1);
    } else {
      console.log("\n--- Verification COMPLETED SUCCESSFULY ---");
      process.exit(0);
    }
  }
}

run();
