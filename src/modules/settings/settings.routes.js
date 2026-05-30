// src/modules/settings/settings.routes.js
import { Router } from 'express';
import { settingsController } from './settings.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

// Apply base authentication and tenancy middlewares
router.use(authenticate);
router.use(resolveTenant);

// GET /api/v1/settings/localization-options
// Accessible by any logged-in user (including clients)
router.get(
  '/localization-options',
  requireMinRole(ROLES.CLIENT),
  asyncHandler(settingsController.getLocalizationOptions)
);

// GET /api/v1/settings/tenant
// Accessible by practitioners / assistants
router.get(
  '/tenant',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(settingsController.getTenantSettings)
);

// PATCH /api/v1/settings/tenant
// Requires admin level or above to change corporate configurations
router.patch(
  '/tenant',
  requireMinRole(ROLES.ADMIN),
  asyncHandler(settingsController.updateTenantSettings)
);

export default router;
