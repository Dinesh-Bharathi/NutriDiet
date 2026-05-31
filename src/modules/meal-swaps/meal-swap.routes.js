// src/modules/meal-swaps/meal-swap.routes.js
import { Router } from 'express';
import { mealSwapController } from './meal-swap.controller.js';
import {
  getSwapCandidatesSchema,
  applySingleSwapSchema,
  applyBulkPlanSwapSchema,
  applyBulkTemplateSwapSchema
} from './meal-swap.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

// Apply core middlewares to all swap endpoints
router.use(authenticate);
router.use(resolveTenant);

/**
 * GET /api/v1/meals/:mealId/items/:itemId/swaps
 * Restricted to: CLIENT+ (preview only)
 */
router.get(
  '/meals/:mealId/items/:itemId/swaps',
  requireMinRole(ROLES.CLIENT),
  validate(getSwapCandidatesSchema),
  asyncHandler(mealSwapController.getSwapCandidates)
);

/**
 * POST /api/v1/meals/:mealId/items/:itemId/swaps/apply
 * Restricted to: ASSISTANT+
 */
router.post(
  '/meals/:mealId/items/:itemId/swaps/apply',
  requireMinRole(ROLES.ASSISTANT),
  validate(applySingleSwapSchema),
  asyncHandler(mealSwapController.applySingleSwap)
);

/**
 * POST /api/v1/diet-plans/:dietPlanId/swaps/apply
 * Restricted to: ASSISTANT+
 */
router.post(
  '/diet-plans/:dietPlanId/swaps/apply',
  requireMinRole(ROLES.ASSISTANT),
  validate(applyBulkPlanSwapSchema),
  asyncHandler(mealSwapController.applyBulkPlanSwap)
);

/**
 * POST /api/v1/diet-plan-templates/:templateId/swaps/apply
 * Restricted to: ASSISTANT+
 */
router.post(
  '/diet-plan-templates/:templateId/swaps/apply',
  requireMinRole(ROLES.ASSISTANT),
  validate(applyBulkTemplateSwapSchema),
  asyncHandler(mealSwapController.applyBulkTemplateSwap)
);

export default router;
