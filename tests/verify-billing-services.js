// backend/tests/verify-billing-services.js
// Verification script for Phase 1C Billing & Subscription Services.

import prisma from '../src/lib/prisma.js';
import { planService } from '../src/modules/billing/plan.service.js';
import { subscriptionService } from '../src/modules/billing/subscription.service.js';
import { invoiceService } from '../src/modules/billing/invoice.service.js';
import { paymentService } from '../src/modules/billing/payment.service.js';
import { webhookService } from '../src/modules/billing/webhook.service.js';
import { invoiceNumberService } from '../src/modules/billing/invoice-number.service.js';
import { billingEventBus } from '../src/modules/billing/billing.event-bus.js';
import { paymentRepository } from '../src/modules/billing/repositories/payment.repository.js';
import {
  InvalidSubscriptionTransitionError,
  ActiveSubscriptionCollisionError,
  InvoiceAlreadyPaidError,
} from '../src/modules/billing/billing.errors.js';

async function run() {
  console.log("--- Starting Billing Services Phase 1C Verification ---");
  let failed = false;

  try {
    // -------------------------------------------------------------
    // SETUP: Resolve Tenant
    // -------------------------------------------------------------
    const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } });
    if (!tenant) {
      throw new Error("No active tenant found in the database. Please run seed-plans first.");
    }
    console.log(`Using Tenant: ${tenant.name} (ID: ${tenant.id})`);

    // -------------------------------------------------------------
    // PREP: Clean up any leftover test subscriptions/invoices/payments
    // -------------------------------------------------------------
    console.log("[Prep] Cleaning up old test subscriptions...");
    await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: 'evt_verify_' } } });
    await prisma.payment.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.invoiceLineItem.deleteMany({ where: { invoice: { tenantId: tenant.id } } });
    await prisma.invoice.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.subscription.deleteMany({ where: { tenantId: tenant.id } });

    const starterPlan = await planService.getPlanByCode('STARTER');
    console.log(`Found Plan: ${starterPlan.name} (ID: ${starterPlan.id})`);

    // -------------------------------------------------------------
    // Test 1: PlanService Calculations
    // -------------------------------------------------------------
    console.log("\n[Test 1] Testing PlanService cost calculations...");
    const monthlyCost = await planService.calculatePlanCost(starterPlan.id, 'MONTHLY');
    const yearlyCost = await planService.calculatePlanCost(starterPlan.id, 'YEARLY');
    console.log(`✅ Calculated Monthly Cost: ${monthlyCost.amount} ${monthlyCost.currency}`);
    console.log(`✅ Calculated Yearly Cost: ${yearlyCost.amount} ${yearlyCost.currency}`);

    try {
      await planService.calculatePlanCost(starterPlan.id, 'MONTHLY', 'USD');
      console.error("❌ Failure: calculation with invalid currency did not throw!");
      failed = true;
    } catch (err) {
      console.log("   Currency mismatch correctly caught: " + err.message);
    }

    // -------------------------------------------------------------
    // Test 2: InvoiceNumberService Concurrency & Format
    // -------------------------------------------------------------
    console.log("\n[Test 2] Testing InvoiceNumberService concurrency and format...");
    
    // Generate two numbers concurrently
    const [num1, num2] = await Promise.all([
      invoiceNumberService.generateNextNumber(),
      invoiceNumberService.generateNextNumber(),
    ]);

    console.log(`   Generated Num 1: ${num1}`);
    console.log(`   Generated Num 2: ${num2}`);

    const formatRegex = /^ND-\d{4}-\d{6}$/;
    if (!formatRegex.test(num1) || !formatRegex.test(num2)) {
      console.error("❌ Failure: Generated invoice numbers do not match ND-YYYY-XXXXXX format!");
      failed = true;
    } else if (num1 === num2) {
      console.error("❌ Failure: Concurrent generation produced duplicate invoice numbers!");
      failed = true;
    } else {
      console.log("✅ Sequential format and concurrency lock check passed.");
    }

    // -------------------------------------------------------------
    // Test 3: Subscription Lifecycle & State Machine
    // -------------------------------------------------------------
    console.log("\n[Test 3] Testing Subscription Lifecycle and State Machine...");

    // Start a trial subscription
    const subscription = await subscriptionService.startTrial(tenant.id, 'STARTER');
    console.log(`✅ Started trial. (ID: ${subscription.id}, Status: ${subscription.status})`);

    // Collision check: try starting another trial
    try {
      await subscriptionService.startTrial(tenant.id, 'STARTER');
      console.error("❌ Failure: Active subscription collision did not throw!");
      failed = true;
    } catch (err) {
      if (err instanceof ActiveSubscriptionCollisionError) {
        console.log("✅ Correctly rejected trial collision: " + err.message);
      } else {
        console.error("❌ Unexpected error on trial collision test:", err);
        failed = true;
      }
    }

    // Test invalid transition (trialing -> suspended is forbidden)
    try {
      // Direct DB update to bypass to trialing status for testing if needed, but it is currently trialing.
      await subscriptionService.activateSubscription(tenant.id, subscription.id); // Valid trialing -> active
      console.log("✅ Successfully transitioned from trialing to active.");

      // Manually update status to past_due to trigger invalid transition on expireTrial
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'past_due' },
      });

      // Try past_due -> expired (invalid)
      await subscriptionService.expireTrial(tenant.id, subscription.id);
      console.error("❌ Failure: Invalid transition past_due -> expired did not throw!");
      failed = true;
    } catch (err) {
      if (err instanceof InvalidSubscriptionTransitionError) {
        console.log("✅ Correctly blocked invalid transition: " + err.message);
      } else {
        console.error("❌ Unexpected error on invalid transition test:", err);
        failed = true;
      }
    }

    // -------------------------------------------------------------
    // Test 4: Domain Event Bus
    // -------------------------------------------------------------
    console.log("\n[Test 4] Testing Decoupled Domain Event Bus...");
    let eventReceived = false;
    let eventPayload = null;

    const eventHandler = (payload) => {
      eventReceived = true;
      eventPayload = payload;
    };

    // Listen to TrialExpired event
    billingEventBus.subscribe('TrialExpired', eventHandler);

    // Reset status back to trialing manually in DB to test trial expiration event flow
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'trialing' },
    });

    // Fire expire trial
    await subscriptionService.expireTrial(tenant.id, subscription.id);
    
    // Wait brief tick for nextTick async dispatch
    await new Promise(resolve => setTimeout(resolve, 50));

    if (eventReceived && eventPayload && eventPayload.subscriptionId === subscription.id) {
      console.log("✅ BillingEventBus successfully delivered TrialExpired event asynchronously.");
    } else {
      console.error("❌ Failure: Event bus did not deliver event or payload mismatch!");
      failed = true;
    }

    billingEventBus.unsubscribe('TrialExpired', eventHandler);

    // -------------------------------------------------------------
    // Test 5: Service Operation Idempotency
    // -------------------------------------------------------------
    console.log("\n[Test 5] Testing Service Operation Idempotency...");

    // Setup active subscription for activation idempotency check
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'active' },
    });

    const activeSub1 = await subscriptionService.getSubscriptionById(tenant.id, subscription.id);
    const dateBefore = activeSub1.currentPeriodEnd.getTime();

    // Call activateSubscription again (should skip updates)
    const activeSub2 = await subscriptionService.activateSubscription(tenant.id, subscription.id);
    if (activeSub2.status === 'active' && activeSub2.currentPeriodEnd.getTime() === dateBefore) {
      console.log("✅ Subscription activation is idempotent (no period end overrides).");
    } else {
      console.error("❌ Failure: Subscription activation modified already active record!");
      failed = true;
    }

    // Invoice pay idempotency check
    const invoice = await invoiceService.createInvoice(tenant.id, {
      subscriptionId: subscription.id,
      amount: monthlyCost.amount,
      currency: monthlyCost.currency,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      items: [{ description: 'Starter Plan Monthly Charge', amount: monthlyCost.amount, quantity: 1 }]
    });
    console.log(`✅ Invoice created. (ID: ${invoice.id}, Status: ${invoice.status})`);

    // Settle invoice first time
    const invoicePaid1 = await invoiceService.payInvoice(tenant.id, invoice.id, 'pay_mock_123');
    console.log(`   Invoice settled first time. (Status: ${invoicePaid1.status}, PaidAt: ${invoicePaid1.paidAt})`);

    // Settle invoice second time
    const invoicePaid2 = await invoiceService.payInvoice(tenant.id, invoice.id, 'pay_mock_123');
    if (invoicePaid2.status === 'PAID' && invoicePaid2.paidAt.getTime() === invoicePaid1.paidAt.getTime()) {
      console.log("✅ Invoice payment is idempotent.");
    } else {
      console.error("❌ Failure: Second payment attempt modified paidAt timestamp!");
      failed = true;
    }

    // Webhook ingestion idempotency check
    const eventId = 'evt_verify_12345';

    // Create payment record in DB first so webhook captured logic resolves it successfully
    await paymentRepository.create(tenant.id, {
      invoiceId: invoice.id,
      amount: monthlyCost.amount,
      currency: monthlyCost.currency,
      status: 'PENDING',
      gateway: 'RAZORPAY',
      gatewayPaymentId: 'pay_capture_123',
      gatewayOrderId: 'order_capture_123',
    });

    const webhook1 = await webhookService.processWebhook('RAZORPAY', eventId, 'payment.captured', {
      gatewayPaymentId: 'pay_capture_123',
      gatewayOrderId: 'order_capture_123',
      tenantId: tenant.id,
    });
    console.log(`✅ Webhook processed first time. (Status: ${webhook1.status})`);

    const webhook2 = await webhookService.processWebhook('RAZORPAY', eventId, 'payment.captured', {
      gatewayPaymentId: 'pay_capture_123',
      gatewayOrderId: 'order_capture_123',
      tenantId: tenant.id,
    });
    if (webhook2.status === 'PROCESSED' && webhook2.processedAt.getTime() === webhook1.processedAt.getTime()) {
      console.log("✅ Webhook ingestion is idempotent (subsequent attempts ignored).");
    } else {
      console.error("❌ Failure: Duplicate webhook processing occurred!");
      failed = true;
    }

    // -------------------------------------------------------------
    // Test 6: Payment Attempt, Success and Fail Log flow
    // -------------------------------------------------------------
    console.log("\n[Test 6] Testing Payment Log workflows...");

    const newInvoice = await invoiceService.createInvoice(tenant.id, {
      subscriptionId: subscription.id,
      amount: 1500.00,
      currency: 'INR',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Create payment attempt
    const payment = await paymentService.createPaymentAttempt(tenant.id, newInvoice.id, {
      gatewayOrderId: 'order_new_invoice_123',
    });
    console.log(`✅ Payment attempt registered (ID: ${payment.id}, Status: ${payment.status})`);

    // Capture payment success
    const successfulPayment = await paymentService.verifyAndRecordPayment(tenant.id, payment.id, {
      gatewayPaymentId: 'pay_verify_success_999',
      gatewaySignature: 'sig_verify_success_999',
    });

    const settledInvoice = await invoiceService.getInvoiceById(tenant.id, newInvoice.id);
    if (successfulPayment.status === 'SUCCESSFUL' && settledInvoice.status === 'PAID') {
      console.log("✅ Payment verification succeeds, triggering atomic invoice settlement.");
    } else {
      console.error("❌ Failure: Payment verification did not transition invoice status to PAID!");
      failed = true;
    }

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log("\n[Cleanup] Cleaning up mock verification records...");
    
    await prisma.webhookEvent.deleteMany({ where: { eventId } });
    await prisma.payment.deleteMany({ where: { invoiceId: { in: [invoice.id, newInvoice.id] } } });
    await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: { in: [invoice.id, newInvoice.id] } } });
    await prisma.invoice.deleteMany({ where: { id: { in: [invoice.id, newInvoice.id] } } });
    await prisma.subscription.delete({ where: { id: subscription.id } });
    
    // Clean up sequence tracking
    await prisma.$executeRawUnsafe(`DELETE FROM invoice_sequences WHERE year = ${new Date().getFullYear()}`);

    console.log("✅ Cleanup completed. Remote database is pristine.");

  } catch (err) {
    console.error("❌ Exception during verification:", err);
    failed = true;
  } finally {
    await prisma.$disconnect();
  }

  if (failed) {
    console.log("\n❌ PHASE 1C VERIFICATION FAILED.");
    process.exit(1);
  } else {
    console.log("\n✅ ALL PHASE 1C BILLING SERVICES VERIFICATION TESTS PASSED SUCCESSFULLY.");
    process.exit(0);
  }
}

run();
