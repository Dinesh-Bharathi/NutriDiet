// src/modules/tenants/tenant.routes.js
// Tenant route declarations.
import { Router } from 'express';
import { tenantController } from './tenant.controller.js';
import { updateThemeSchema } from './tenant.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { adminOrAbove } from '../../middlewares/rbac.middleware.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

// POST /api/v1/tenant/theme
// Restricts access to authenticated users of active tenants with OWNER or ADMIN role
router.post(
  '/theme',
  authenticate,
  resolveTenant,
  adminOrAbove,
  validate(updateThemeSchema),
  asyncHandler(tenantController.updateTheme),
);

export default router;
