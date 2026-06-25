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

// Settle simulated payment capture (OWNER / ADMIN only)
router.post(
  '/invoices/:id/pay',
  authenticate,
  resolveTenant,
  adminOrAbove,
  validate(payInvoiceSchema),
  billingController.payInvoice
);

export default router;
