// src/modules/progress/progress.routes.js
// Progress and reviews dashboard routes.
import { Router } from 'express';
import { progressController } from './progress.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

// Apply authentication, tenant verification, and practitioner RBAC checks
router.use(authenticate);
router.use(resolveTenant);
router.use(requireMinRole(ROLES.ASSISTANT));

// GET /api/v1/reviews/dashboard - Fetch reviews dashboard widgets & analytics
router.get(
  '/dashboard',
  asyncHandler(progressController.getReviewDashboard)
);

export default router;
