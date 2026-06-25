// src/modules/billing/billing.routes.js
// Routing definitions for Billing & Subscription endpoints.

import { Router } from 'express';
import { billingController } from './billing.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { adminOrAbove, practitionerOrAbove } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  startTrialSchema,
  cancelSubscriptionSchema,
  listInvoicesSchema,
  getInvoiceByIdSchema,
  payInvoiceSchema,
  checkoutInvoiceSchema,
  checkoutSubscriptionSchema,
} from './billing.validation.js';

const router = Router();

// Retrieve global active plans
router.get(
  '/plans',
  authenticate,
  practitionerOrAbove,
  billingController.getPlans
);

// Get current active tenant subscription
router.get(
  '/subscription',
  authenticate,
  resolveTenant,
  practitionerOrAbove,
  billingController.getSubscription
);

// Initiate free trial (OWNER / ADMIN only)
router.post(
  '/subscription/trial',
  authenticate,
  resolveTenant,
  adminOrAbove,
  validate(startTrialSchema),
  billingController.startTrial
);

// Initiate checkout order for a subscription upgrade/purchase (OWNER / ADMIN only)
router.post(
  '/subscription/checkout',
  authenticate,
  resolveTenant,
  adminOrAbove,
  validate(checkoutSubscriptionSchema),
  billingController.checkoutSubscription
);

// Cancel active subscription (OWNER / ADMIN only)
router.post(
  '/subscription/cancel',
  authenticate,
  resolveTenant,
  adminOrAbove,
  validate(cancelSubscriptionSchema),
  billingController.cancelSubscription
);

// List tenant invoices paginated (OWNER / ADMIN only)
router.get(
  '/invoices',
  authenticate,
  resolveTenant,
  adminOrAbove,
  validate(listInvoicesSchema),
  billingController.listInvoices
);

// Retrieve individual invoice profile (OWNER / ADMIN only)
router.get(
  '/invoices/:id',
  authenticate,
  resolveTenant,
  adminOrAbove,
  validate(getInvoiceByIdSchema),
  billingController.getInvoiceById
);

// Settle simulated payment capture or verify signature (OWNER / ADMIN only)
router.post(
  '/invoices/:id/pay',
  authenticate,
  resolveTenant,
  adminOrAbove,
  validate(payInvoiceSchema),
  billingController.payInvoice
);

// Initiate Razorpay checkout order for an invoice (OWNER / ADMIN only)
router.post(
  '/invoices/:id/checkout',
  authenticate,
  resolveTenant,
  adminOrAbove,
  validate(checkoutInvoiceSchema),
  billingController.checkoutInvoice
);

// Inbound payment gateway webhook handler (unauthenticated, signature-verified in controller)
router.post(
  '/webhook',
  billingController.handleWebhook
);

export default router;
