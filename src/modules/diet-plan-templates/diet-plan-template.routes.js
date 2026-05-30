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
} from './diet-plan-template.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

// Secure all template routes
router.use(authenticate);
router.use(resolveTenant);
router.use(requireMinRole(ROLES.ASSISTANT));

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

export default router;
