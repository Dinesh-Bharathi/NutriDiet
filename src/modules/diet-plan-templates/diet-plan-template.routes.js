// src/modules/diet-plan-templates/diet-plan-template.routes.js
// Diet plan template routes.
import { Router } from 'express';
import { dietPlanTemplateController } from './diet-plan-template.controller.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
  queryTemplatesSchema,
  templateParamSchema,
  applyTemplateSchema,
  createTemplateMealSchema,
  updateTemplateMealSchema,
  templateMealParamSchema,
  createTemplateMealItemSchema,
  updateTemplateMealItemSchema,
  templateMealItemParamSchema,
} from './diet-plan-template.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();
const templateMealRouter = Router();
const templateMealItemRouter = Router();

// Secure all template routes
const middlewares = [authenticate, resolveTenant, requireMinRole(ROLES.ASSISTANT)];
router.use(...middlewares);
templateMealRouter.use(...middlewares);
templateMealItemRouter.use(...middlewares);

// ─── Template Router (/diet-plan-templates) ──────────────────────────────────
// POST /api/v1/diet-plan-templates - Create template
router.post(
  '/',
  validate(createTemplateSchema),
  asyncHandler(dietPlanTemplateController.createTemplate)
);

// GET /api/v1/diet-plan-templates - List templates
router.get(
  '/',
  validate(queryTemplatesSchema),
  asyncHandler(dietPlanTemplateController.getTemplates)
);

// GET /api/v1/diet-plan-templates/:id - Get template details
router.get(
  '/:id',
  validate(templateParamSchema),
  asyncHandler(dietPlanTemplateController.getTemplateById)
);

// PATCH /api/v1/diet-plan-templates/:id - Update template details
router.patch(
  '/:id',
  validate(updateTemplateSchema),
  asyncHandler(dietPlanTemplateController.updateTemplate)
);

// DELETE /api/v1/diet-plan-templates/:id - Soft delete template
router.delete(
  '/:id',
  validate(templateParamSchema),
  asyncHandler(dietPlanTemplateController.deleteTemplate)
);

// POST /api/v1/diet-plan-templates/:id/apply - Apply template to a client
router.post(
  '/:id/apply',
  validate(applyTemplateSchema),
  asyncHandler(dietPlanTemplateController.applyTemplateToClient)
);

// POST /api/v1/diet-plan-templates/:id/meals - Create a template meal
router.post(
  '/:id/meals',
  validate(createTemplateMealSchema),
  asyncHandler(dietPlanTemplateController.createMeal)
);

// ─── Template Meal Router (/template-meals) ──────────────────────────────────
// PATCH /api/v1/template-meals/:mealId
templateMealRouter.patch(
  '/:mealId',
  validate(updateTemplateMealSchema),
  asyncHandler(dietPlanTemplateController.updateMeal)
);

// DELETE /api/v1/template-meals/:mealId
templateMealRouter.delete(
  '/:mealId',
  validate(templateMealParamSchema),
  asyncHandler(dietPlanTemplateController.deleteMeal)
);

// POST /api/v1/template-meals/:mealId/items - Create a template meal item
templateMealRouter.post(
  '/:mealId/items',
  validate(createTemplateMealItemSchema),
  asyncHandler(dietPlanTemplateController.createMealItem)
);

// ─── Template Meal Item Router (/template-meal-items) ─────────────────────────
// PATCH /api/v1/template-meal-items/:itemId
templateMealItemRouter.patch(
  '/:itemId',
  validate(updateTemplateMealItemSchema),
  asyncHandler(dietPlanTemplateController.updateMealItem)
);

// DELETE /api/v1/template-meal-items/:itemId
templateMealItemRouter.delete(
  '/:itemId',
  validate(templateMealItemParamSchema),
  asyncHandler(dietPlanTemplateController.deleteMealItem)
);

export { templateMealRouter, templateMealItemRouter };
export default router;
