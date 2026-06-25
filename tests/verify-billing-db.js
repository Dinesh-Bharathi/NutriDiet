import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log("--- Starting Billing Database Foundation Verification ---");
  let failed = false;

  try {
    // 1. Verify plans seeding
    console.log("[Test 1] Verifying seeded plans...");
    const plans = await prisma.plan.findMany({
      orderBy: { priceMonthly: 'asc' }
    });
    console.log("Seeded plans found in DB:", plans.map(p => `${p.code} (Custom: ${p.isCustom})`));

    const expectedCodes = ['FREE_TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
    for (const code of expectedCodes) {
      if (!plans.some(p => p.code === code)) {
        console.log(`❌ Failure: Plan ${code} is missing!`);
        failed = true;
      }
    }
    if (!failed) console.log("✅ All expected plans are present.");

    // 2. Resolve target tenant
    console.log("\n[Test 2] Resolving target tenant...");
    const tenant = await prisma.tenant.findFirst({
      where: { deletedAt: null }
    });
    if (!tenant) {
      console.log("❌ Failure: No active tenant found in the database!");
      failed = true;
      return;
    }
    console.log(`Using tenant: ${tenant.name} (ID: ${tenant.id}, Default Plan: ${tenant.plan})`);

    // 3. Test insert mock subscription, invoice, items, and payments
    console.log("\n[Test 3] Testing record creation (Subscription -> Invoice -> Items -> Payments)...");
    
    const starterPlan = plans.find(p => p.code === 'STARTER');
    
    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: starterPlan.id,
        status: 'active',
        billingCycle: 'MONTHLY',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      }
    });
    console.log(`✅ Subscription created: ID = ${subscription.id}, Status = ${subscription.status}, BillingCycle = ${subscription.billingCycle}`);

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        subscriptionId: subscription.id,
        invoiceNumber: 'ND-2026-999999', // Unique sequential number
        status: 'DRAFT',
        amount: 999.00,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    });
    console.log(`✅ Invoice created: ID = ${invoice.id}, InvoiceNumber = ${invoice.invoiceNumber}, Status = ${invoice.status}`);

    // Create line item
    const lineItem = await prisma.invoiceLineItem.create({
      data: {
        invoiceId: invoice.id,
        description: 'Starter Plan - June 2026 Subscription',
        amount: 999.00,
        quantity: 1,
      }
    });
    console.log(`✅ Invoice Line Item created: ID = ${lineItem.id}, Amount = ${lineItem.amount}`);

    // Create payment attempt
    const payment = await prisma.payment.create({
      data: {
        tenantId: tenant.id,
        invoiceId: invoice.id,
        amount: 999.00,
        status: 'PENDING',
        gateway: 'SYSTEM',
        gatewayOrderId: 'order_mock_123',
      }
    });
    console.log(`✅ Payment attempt recorded: ID = ${payment.id}, Status = ${payment.status}`);

    // Create webhook event
    const webhook = await prisma.webhookEvent.create({
      data: {
        gateway: 'RAZORPAY',
        eventId: 'evt_mock_999999',
        eventType: 'payment.captured',
        payload: { paymentId: 'pay_mock_123', amount: 99900 },
        status: 'RECEIVED',
      }
    });
    console.log(`✅ Webhook event recorded: ID = ${webhook.id}, EventType = ${webhook.eventType}`);

    // Clean up created mock entities to leave production DB completely clean
    console.log("\n[Cleanup] Cleaning up mock verification records...");
    await prisma.webhookEvent.delete({ where: { id: webhook.id } });
    await prisma.payment.delete({ where: { id: payment.id } });
    await prisma.invoiceLineItem.delete({ where: { id: lineItem.id } });
    await prisma.invoice.delete({ where: { id: invoice.id } });
    await prisma.subscription.delete({ where: { id: subscription.id } });
    console.log("✅ Cleanup finished successfully.");

  } catch (err) {
    console.error("❌ Exception during verification:", err);
    failed = true;
  } finally {
    await prisma.$disconnect();
  }

  if (failed) {
    console.log("\n❌ VERIFICATION FAILED.");
    process.exit(1);
  } else {
    console.log("\n✅ ALL BILLING DATABASE FOUNDATION VERIFICATION TESTS PASSED SUCCESSFULLY.");
    process.exit(0);
  }
}

run();
