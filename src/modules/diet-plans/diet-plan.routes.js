// src/modules/diet-plans/diet-plan.routes.js
// Diet plans, meals, and meal items routes.
import { Router } from 'express';
import { dietPlanController } from './diet-plan.controller.js';
import {
  dietPlanParamSchema,
  updateDietPlanSchema,
  createMealSchema,
  updateMealSchema,
  mealParamSchema,
  createMealItemSchema,
  updateMealItemSchema,
  mealItemParamSchema,
} from './diet-plan.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

// Create routers
const dietPlanRouter = Router();
const mealRouter = Router();
const mealItemRouter = Router();

// Apply common middlewares to all three routers
const middlewares = [authenticate, resolveTenant, requireMinRole(ROLES.ASSISTANT)];
dietPlanRouter.use(...middlewares);
mealRouter.use(...middlewares);
mealItemRouter.use(...middlewares);

// ─── Diet Plan Router (/diet-plans) ──────────────────────────────────────────
// GET /api/v1/diet-plans/:id
dietPlanRouter.get(
  '/:id',
  validate(dietPlanParamSchema),
  asyncHandler(dietPlanController.getDietPlanById)
);

// PATCH /api/v1/diet-plans/:id
dietPlanRouter.patch(
  '/:id',
  validate(updateDietPlanSchema),
  asyncHandler(dietPlanController.updateDietPlan)
);

// DELETE /api/v1/diet-plans/:id
dietPlanRouter.delete(
  '/:id',
  validate(dietPlanParamSchema),
  asyncHandler(dietPlanController.deleteDietPlan)
);

// POST /api/v1/diet-plans/:id/meals
dietPlanRouter.post(
  '/:id/meals',
  validate(createMealSchema),
  asyncHandler(dietPlanController.createMeal)
);

// POST /api/v1/diet-plans/:id/save-template
import { clonePlanToTemplateSchema } from '../diet-plan-templates/diet-plan-template.validation.js';
import { dietPlanTemplateController } from '../diet-plan-templates/diet-plan-template.controller.js';
dietPlanRouter.post(
  '/:id/save-template',
  validate(clonePlanToTemplateSchema),
  asyncHandler(dietPlanTemplateController.createTemplateFromPlan)
);

// ─── Meal Router (/meals) ───────────────────────────────────────────────────
// PATCH /api/v1/meals/:mealId
mealRouter.patch(
  '/:mealId',
  validate(updateMealSchema),
  asyncHandler(dietPlanController.updateMeal)
);

// DELETE /api/v1/meals/:mealId
mealRouter.delete(
  '/:mealId',
  validate(mealParamSchema),
  asyncHandler(dietPlanController.deleteMeal)
);

// POST /api/v1/meals/:mealId/items
mealRouter.post(
  '/:mealId/items',
  validate(createMealItemSchema),
  asyncHandler(dietPlanController.createMealItem)
);

// ─── Meal Item Router (/meal-items) ──────────────────────────────────────────
// PATCH /api/v1/meal-items/:itemId
mealItemRouter.patch(
  '/:itemId',
  validate(updateMealItemSchema),
  asyncHandler(dietPlanController.updateMealItem)
);

// DELETE /api/v1/meal-items/:itemId
mealItemRouter.delete(
  '/:itemId',
  validate(mealItemParamSchema),
  asyncHandler(dietPlanController.deleteMealItem)
);

// Export routers
export { mealRouter, mealItemRouter };
export default dietPlanRouter;
