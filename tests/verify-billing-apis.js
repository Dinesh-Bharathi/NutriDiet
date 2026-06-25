// backend/tests/verify-billing-apis.js
// Integration test script for Phase 1D Billing & Subscription REST APIs.

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
  console.log("--- Starting Billing REST APIs Phase 1D Verification ---");
  let failed = false;
  let server = null;

  try {
    // -------------------------------------------------------------
    // SETUP: Resolve Tenant & Plans
    // -------------------------------------------------------------
    const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } });
    if (!tenant) {
      throw new Error("No active tenant found in the database. Please run seed-plans first.");
    }
    console.log(`Using Tenant: ${tenant.name} (ID: ${tenant.id})`);

    // Clean up any old subscription leftover states
    console.log("[Prep] Cleaning up old test entries...");
    await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: 'evt_verify_' } } });
    await prisma.payment.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.invoiceLineItem.deleteMany({ where: { invoice: { tenantId: tenant.id } } });
    await prisma.invoice.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.subscription.deleteMany({ where: { tenantId: tenant.id } });

    // Generate tokens for different roles
    const ownerToken = generateToken('user_owner_123', tenant.id, 'OWNER', 'owner@fitlife.com');
    const dietitianToken = generateToken('user_diet_123', tenant.id, 'DIETITIAN', 'diet@fitlife.com');

    // -------------------------------------------------------------
    // Spin up test server on random free port
    // -------------------------------------------------------------
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        console.log(`Test Express server listening on: http://127.0.0.1:${port}`);
        resolve();
      });
    });

    const { port } = server.address();
    const billingBaseUrl = `http://127.0.0.1:${port}/api/${env.API_VERSION}/billing`;

    // -------------------------------------------------------------
    // Test 1: Authentication & Role Guards (RBAC)
    // -------------------------------------------------------------
    console.log("\n[Test 1] Testing authentication and role guards...");

    // 1.1 Try retrieving plans without token
    const plansResNoAuth = await fetch(`${billingBaseUrl}/plans`);
    if (plansResNoAuth.status !== 401) {
      console.error(`❌ Failure: GET /plans without token returned HTTP ${plansResNoAuth.status} (expected 401)`);
      failed = true;
    } else {
      console.log("   GET /plans without token correctly returned 401 Unauthorized.");
    }

    // 1.2 Try launching trial with dietitian token (Owner/Admin required)
    const trialResRoleCheck = await fetch(`${billingBaseUrl}/subscription/trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dietitianToken}`,
      },
      body: JSON.stringify({ planCode: 'STARTER' }),
    });

    if (trialResRoleCheck.status !== 403) {
      console.error(`❌ Failure: POST /subscription/trial with DIETITIAN role returned HTTP ${trialResRoleCheck.status} (expected 403)`);
      failed = true;
    } else {
      console.log("   POST /subscription/trial with DIETITIAN role correctly returned 403 Forbidden.");
    }

    // -------------------------------------------------------------
    // Test 2: Validation Pipeline (Zod check)
    // -------------------------------------------------------------
    console.log("\n[Test 2] Testing Zod validation middleware...");

    const trialResValidation = await fetch(`${billingBaseUrl}/subscription/trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({}), // Missing planCode
    });

    const validationPayload = await trialResValidation.json();
    if (trialResValidation.status !== 400 || validationPayload.success !== false) {
      console.error(`❌ Failure: POST /subscription/trial with empty body returned HTTP ${trialResValidation.status} (expected 400)`);
      failed = true;
    } else {
      console.log("   POST /subscription/trial with missing body payload correctly returned 400 Bad Request.");
      console.log("   Validation errors returned:", validationPayload.errors);
    }

    // -------------------------------------------------------------
    // Test 3: Plan List Endpoint
    // -------------------------------------------------------------
    console.log("\n[Test 3] Testing GET /plans...");
    const plansRes = await fetch(`${billingBaseUrl}/plans`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` },
    });
    const plansBody = await plansRes.json();
    if (plansRes.status !== 200 || !plansBody.success || !plansBody.data.length) {
      console.error("❌ Failure: GET /plans failed!");
      failed = true;
    } else {
      console.log(`✅ GET /plans returned ${plansBody.data.length} active plans in standard envelope.`);
    }

    // -------------------------------------------------------------
    // Test 4: Subscription Trial Creation
    // -------------------------------------------------------------
    console.log("\n[Test 4] Testing POST /subscription/trial...");
    const trialRes = await fetch(`${billingBaseUrl}/subscription/trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ planCode: 'STARTER' }),
    });

    const trialBody = await trialRes.json();
    if (trialRes.status !== 201 || !trialBody.success) {
      console.error(`❌ Failure: POST /subscription/trial returned HTTP ${trialRes.status}`);
      failed = true;
    } else {
      console.log(`✅ Trial subscription initialized (ID: ${trialBody.data.id}, Status: ${trialBody.data.status})`);
    }

    // Check collision: starting trial again should return 409 Conflict
    const trialResCollision = await fetch(`${billingBaseUrl}/subscription/trial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ planCode: 'STARTER' }),
    });
    const collisionBody = await trialResCollision.json();
    if (trialResCollision.status !== 409) {
      console.error(`❌ Failure: Expected 409 Conflict on trial collision, got HTTP ${trialResCollision.status}`);
      failed = true;
    } else {
      console.log("   Re-initiating trial correctly returned 409 Conflict: " + collisionBody.message);
    }

    // -------------------------------------------------------------
    // Test 5: Invoice List & Settle Payment endpoint
    // -------------------------------------------------------------
    console.log("\n[Test 5] Testing Invoice Listing & Payment Simulation...");

    // Create a mock invoice directly to test list and pay endpoints
    const invoiceNum = 'INV-API-TEST-' + Date.now();
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        subscriptionId: trialBody.data.id,
        invoiceNumber: invoiceNum,
        amount: 999.00,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'DRAFT',
      },
    });

    // 5.1 GET /invoices
    const invoiceListRes = await fetch(`${billingBaseUrl}/invoices?page=1&limit=5`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` },
    });
    const invoiceListBody = await invoiceListRes.json();
    if (invoiceListRes.status !== 200 || !invoiceListBody.success || !invoiceListBody.meta) {
      console.error("❌ Failure: GET /invoices failed!");
      failed = true;
    } else {
      console.log("✅ GET /invoices returned paginated list with meta attributes:", invoiceListBody.meta);
    }

    // 5.2 POST /invoices/:id/pay
    const payRes = await fetch(`${billingBaseUrl}/invoices/${invoice.id}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ paymentId: 'pay_api_simulated_999' }),
    });

    const payBody = await payRes.json();
    if (payRes.status !== 200 || payBody.data.status !== 'PAID') {
      console.error(`❌ Failure: POST /invoices/:id/pay returned status ${payRes.status}`);
      failed = true;
    } else {
      console.log(`✅ Invoice paid successfully (ID: ${payBody.data.id}, Status: ${payBody.data.status})`);
    }

    // Wait for the asynchronous InvoicePaid event listener to process subscription auto-activation
    console.log("   Waiting 1s for asynchronous subscription auto-activation...");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check subscription is active now in service state (since payInvoice maps it)
    const subRes = await fetch(`${billingBaseUrl}/subscription`, {
      headers: { 'Authorization': `Bearer ${ownerToken}` },
    });
    const subBody = await subRes.json();
    if (subBody.data.status !== 'active') {
      console.error(`❌ Failure: Subscription status is ${subBody.data.status} (expected active)`);
      failed = true;
    } else {
      console.log("✅ Subscription successfully transitioned to active in database.");
    }

    // -------------------------------------------------------------
    // Test 6: Subscription Cancellation
    // -------------------------------------------------------------
    console.log("\n[Test 6] Testing POST /subscription/cancel...");
    const cancelRes = await fetch(`${billingBaseUrl}/subscription/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ immediate: false }),
    });

    const cancelBody = await cancelRes.json();
    if (cancelRes.status !== 200 || !cancelBody.data.cancelAtPeriodEnd) {
      console.error(`❌ Failure: Cancel endpoint failed to mark cancelAtPeriodEnd! Status = ${cancelRes.status}`);
      failed = true;
    } else {
      console.log("✅ Subscription marked for cancellation at period end successfully.");
    }

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log("\n[Cleanup] Cleaning up mock verification records...");
    await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.invoice.delete({ where: { id: invoice.id } });
    await prisma.subscription.delete({ where: { id: trialBody.data.id } });
    console.log("✅ Cleanup completed.");

  } catch (err) {
    console.error("❌ Exception during integration verification:", err);
    failed = true;
  } finally {
    if (server) {
      server.close();
      console.log("Test Express server stopped.");
    }
    await prisma.$disconnect();
  }

  if (failed) {
    console.log("\n❌ PHASE 1D API VERIFICATION FAILED.");
    process.exit(1);
  } else {
    console.log("\n✅ ALL PHASE 1D BILLING REST API TESTS PASSED SUCCESSFULLY.");
    process.exit(0);
  }
}

run();
