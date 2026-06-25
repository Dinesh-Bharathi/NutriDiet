// backend/tests/verify-billing-repositories.js
// Verification script for Phase 1B Billing & Subscription Repositories.

import prisma from '../src/lib/prisma.js';
import { planRepository } from '../src/modules/billing/repositories/plan.repository.js';
import { subscriptionRepository } from '../src/modules/billing/repositories/subscription.repository.js';
import { invoiceRepository } from '../src/modules/billing/repositories/invoice.repository.js';
import { paymentRepository } from '../src/modules/billing/repositories/payment.repository.js';
import { webhookRepository } from '../src/modules/billing/repositories/webhook.repository.js';
import {
  RepositoryConflictError,
  RepositoryValidationError,
  RepositoryNotFoundError,
} from '../src/modules/billing/repositories/billing.errors.js';

async function run() {
  console.log("--- Starting Billing Repositories Phase 1B Verification ---");
  let failed = false;

  try {
    // -------------------------------------------------------------
    // SETUP: Resolve Tenant and Plans
    // -------------------------------------------------------------
    const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } });
    if (!tenant) {
      throw new Error("No active tenant found in the database. Please run seed-plans first.");
    }
    console.log(`Using Tenant: ${tenant.name} (ID: ${tenant.id})`);

    const starterPlan = await planRepository.findByCode('STARTER');
    if (!starterPlan) {
      throw new Error("Starter plan not found in DB. Make sure plans are seeded.");
    }
    console.log(`Found Plan: ${starterPlan.name} (ID: ${starterPlan.id})`);

    // -------------------------------------------------------------
    // Test 1: PlanRepository Methods
    // -------------------------------------------------------------
    console.log("\n[Test 1] Testing PlanRepository...");
    const plans = await planRepository.findAll();
    if (!plans || plans.length === 0) {
      console.error("❌ Failure: findAll returned empty list!");
      failed = true;
    } else {
      console.log(`✅ findAll returned ${plans.length} plans.`);
    }

    const planById = await planRepository.findById(starterPlan.id);
    if (!planById || planById.code !== 'STARTER') {
      console.error("❌ Failure: findById failed to retrieve STARTER plan.");
      failed = true;
    } else {
      console.log("✅ findById successfully retrieved plan.");
    }

    const existsPlanId = await planRepository.existsById(starterPlan.id);
    const existsPlanCode = await planRepository.existsByCode('STARTER');
    if (!existsPlanId || !existsPlanCode) {
      console.error("❌ Failure: existsById or existsByCode returned false for starter plan.");
      failed = true;
    } else {
      console.log("✅ existsById and existsByCode returned true for active plan.");
    }

    // -------------------------------------------------------------
    // Test 2: Composable Transactions (Commit & Rollback)
    // -------------------------------------------------------------
    console.log("\n[Test 2] Testing Transaction Composition and Rollback...");
    
    // First, verify rollback
    let rollbackSuccess = false;
    const gatewaySubIdRollback = 'sub_rollback_' + Date.now();
    try {
      await prisma.$transaction(async (tx) => {
        // Create subscription inside transaction
        const sub = await subscriptionRepository.create(tenant.id, {
          planId: starterPlan.id,
          status: 'active',
          billingCycle: 'MONTHLY',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          gatewaySubscriptionId: gatewaySubIdRollback,
        }, { tx });
        
        console.log(`   Inside transaction: Subscription created (ID: ${sub.id})`);
        
        // Force rollback by throwing an intentional error
        throw new Error("INTENTIONAL_ROLLBACK");
      });
    } catch (err) {
      if (err.message === "INTENTIONAL_ROLLBACK") {
        rollbackSuccess = true;
      } else {
        console.error("❌ Unexpected error during rollback test:", err);
      }
    }

    // Verify subscription was NOT created
    const rolledBackSub = await subscriptionRepository.findByGatewaySubscriptionId(gatewaySubIdRollback);
    if (rollbackSuccess && !rolledBackSub) {
      console.log("✅ Transaction successfully rolled back (no subscription record committed).");
    } else {
      console.error("❌ Failure: Transaction rollback failed or record was committed!");
      failed = true;
    }

    // -------------------------------------------------------------
    // Test 3: Tenant Isolation Checks
    // -------------------------------------------------------------
    console.log("\n[Test 3] Testing Tenant Isolation...");
    
    // Create committed entities to test isolation
    const gatewaySubId = 'sub_test_' + Date.now();
    const subscription = await subscriptionRepository.create(tenant.id, {
      planId: starterPlan.id,
      status: 'active',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      gatewaySubscriptionId: gatewaySubId,
    });
    console.log(`✅ Subscription created for isolation test (ID: ${subscription.id})`);

    // Verify validation guard throws on missing/invalid tenantId
    try {
      await subscriptionRepository.findById(null, subscription.id);
      console.error("❌ Failure: findById with null tenant ID did not throw!");
      failed = true;
    } catch (err) {
      if (err instanceof RepositoryValidationError) {
        console.log("✅ findById threw RepositoryValidationError on null tenant ID as expected.");
      } else {
        console.error("❌ Unexpected error on null tenant validation:", err);
        failed = true;
      }
    }

    // Verify that querying with a different tenant ID returns null
    const wrongTenantId = 'tenant_wrong_12345';
    const crossTenantSub = await subscriptionRepository.findById(wrongTenantId, subscription.id);
    if (crossTenantSub === null) {
      console.log("✅ Cross-tenant query correctly returned null.");
    } else {
      console.error("❌ Failure: Cross-tenant query retrieved another tenant's record!");
      failed = true;
    }

    // -------------------------------------------------------------
    // Test 4: Invoice Persistence and Retention Policy
    // -------------------------------------------------------------
    console.log("\n[Test 4] Testing Invoice Repository and Retention Policy...");
    const invoiceNum = 'INV-TEST-' + Date.now();
    const invoice = await invoiceRepository.create(tenant.id, {
      subscriptionId: subscription.id,
      invoiceNumber: invoiceNum,
      amount: 499.00,
      currency: 'INR',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      items: [
        { description: 'Starter Plan Monthly Fee', amount: 499.00, quantity: 1 }
      ]
    });
    console.log(`✅ Invoice created atomically with line items. (ID: ${invoice.id})`);
    
    // Check line items nested return contract
    if (invoice.items && invoice.items.length === 1 && invoice.items[0].description === 'Starter Plan Monthly Fee') {
      console.log("✅ Invoice line items returned correctly in decoupled contract.");
    } else {
      console.error("❌ Failure: Invoice line items missing or incorrect in return contract!");
      failed = true;
    }

    // Verify Invoice exists helper
    const invoiceExists = await invoiceRepository.existsByInvoiceNumber(tenant.id, invoiceNum);
    if (invoiceExists) {
      console.log("✅ existsByInvoiceNumber returned true.");
    } else {
      console.error("❌ Failure: existsByInvoiceNumber returned false for existing invoice!");
      failed = true;
    }

    // Verify Invoice Retention Policy:
    // Soft deleting subscription must NEVER delete the invoice.
    await subscriptionRepository.softDelete(tenant.id, subscription.id);
    console.log("   Soft-deleted subscription. Checking invoice retention...");

    const checkInvoiceRetention = await invoiceRepository.findById(tenant.id, invoice.id);
    if (checkInvoiceRetention && checkInvoiceRetention.deletedAt === null) {
      console.log("✅ Invoice retained intact after subscription soft deletion.");
    } else {
      console.error("❌ Failure: Invoice was deleted or affected when subscription was deleted!");
      failed = true;
    }

    // -------------------------------------------------------------
    // Test 5: Soft Delete Filtering
    // -------------------------------------------------------------
    console.log("\n[Test 5] Testing Soft Delete Filtering...");
    
    // Checking subscription soft delete
    const subAfterDelete = await subscriptionRepository.findById(tenant.id, subscription.id);
    const subExistsAfterDelete = await subscriptionRepository.existsById(tenant.id, subscription.id);
    if (subAfterDelete === null && !subExistsAfterDelete) {
      console.log("✅ Soft-deleted subscription filtered out from read queries and existence checks.");
    } else {
      console.error("❌ Failure: Soft-deleted subscription still visible in standard queries!");
      failed = true;
    }

    // -------------------------------------------------------------
    // Test 6: Payment Repository & Existence Helpers
    // -------------------------------------------------------------
    console.log("\n[Test 6] Testing Payment Repository & Existence Checks...");
    const payGatewayId = 'pay_' + Date.now();
    const payment = await paymentRepository.create(tenant.id, {
      invoiceId: invoice.id,
      amount: 499.00,
      status: 'PENDING',
      gateway: 'RAZORPAY',
      gatewayPaymentId: payGatewayId,
      gatewayOrderId: 'order_pay_123',
    });
    console.log(`✅ Payment record logged (ID: ${payment.id})`);

    const payExists = await paymentRepository.existsByGatewayPaymentId(payGatewayId);
    if (payExists) {
      console.log("✅ existsByGatewayPaymentId returned true.");
    } else {
      console.error("❌ Failure: existsByGatewayPaymentId returned false!");
      failed = true;
    }

    const matchedPayment = await paymentRepository.findByGatewayPaymentId(payGatewayId);
    if (matchedPayment && matchedPayment.id === payment.id) {
      console.log("✅ findByGatewayPaymentId retrieved correct payment.");
    } else {
      console.error("❌ Failure: findByGatewayPaymentId failed to find record.");
      failed = true;
    }

    // -------------------------------------------------------------
    // Test 7: Webhook Ingestion, Idempotency and State Transitions
    // -------------------------------------------------------------
    console.log("\n[Test 7] Testing Webhook Repository & Explicit Transitions...");
    const eventId = 'evt_' + Date.now();
    const webhook = await webhookRepository.create({
      gateway: 'RAZORPAY',
      eventId: eventId,
      eventType: 'payment.captured',
      payload: { paymentId: payGatewayId, amount: 49900 },
      status: 'RECEIVED',
    });
    console.log(`✅ Webhook event recorded (ID: ${webhook.id}, status: ${webhook.status})`);

    // Verify Idempotency unique constraint mapping (P2002 -> RepositoryConflictError)
    try {
      await webhookRepository.create({
        gateway: 'RAZORPAY',
        eventId: eventId,
        eventType: 'payment.captured',
        payload: { paymentId: payGatewayId, amount: 49900 },
        status: 'RECEIVED',
      });
      console.error("❌ Failure: Inserting duplicate webhook event did not throw!");
      failed = true;
    } catch (err) {
      if (err instanceof RepositoryConflictError) {
        console.log("✅ Duplicate webhook insertion threw RepositoryConflictError as expected.");
      } else {
        console.error("❌ Unexpected error on unique constraint test:", err);
        failed = true;
      }
    }

    // Transition: markProcessing
    const processingWebhook = await webhookRepository.markProcessing(webhook.id);
    if (processingWebhook && processingWebhook.status === 'PROCESSING') {
      console.log("✅ markProcessing transitioned webhook to PROCESSING.");
    } else {
      console.error("❌ Failure: markProcessing failed!");
      failed = true;
    }

    // Transition: markProcessed
    const processedWebhook = await webhookRepository.markProcessed(webhook.id);
    if (processedWebhook && processedWebhook.status === 'PROCESSED' && processedWebhook.processedAt) {
      console.log("✅ markProcessed transitioned webhook to PROCESSED with processedAt timestamp.");
    } else {
      console.error("❌ Failure: markProcessed failed!");
      failed = true;
    }

    // Transition: markFailed
    const failedWebhook = await webhookRepository.markFailed(webhook.id, 'Connection timed out');
    if (failedWebhook && failedWebhook.status === 'FAILED' && failedWebhook.errorText === 'Connection timed out') {
      console.log("✅ markFailed transitioned webhook to FAILED with errorText.");
    } else {
      console.error("❌ Failure: markFailed failed!");
      failed = true;
    }

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log("\n[Cleanup] Cleaning up mock verification records...");
    
    // We can delete everything cleanly using transaction or direct delete
    await prisma.webhookEvent.delete({ where: { id: webhook.id } });
    await prisma.payment.delete({ where: { id: payment.id } });
    
    // Cascade delete line items and delete invoice
    await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.invoice.delete({ where: { id: invoice.id } });
    
    // Clean up soft deleted subscription
    await prisma.subscription.delete({ where: { id: subscription.id } });
    
    console.log("✅ Cleanup completed. Remote database is pristine.");

  } catch (err) {
    console.error("❌ Exception during verification:", err);
    failed = true;
  } finally {
    await prisma.$disconnect();
  }

  if (failed) {
    console.log("\n❌ PHASE 1B VERIFICATION FAILED.");
    process.exit(1);
  } else {
    console.log("\n✅ ALL PHASE 1B BILLING REPOSITORY VERIFICATION TESTS PASSED SUCCESSFULLY.");
    process.exit(0);
  }
}

run();
