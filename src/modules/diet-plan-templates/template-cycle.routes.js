// src/modules/diet-plan-templates/template-cycle.routes.js
import { Router } from 'express';
import { templateCycleController } from './template-cycle.controller.js';
import {
  createTemplateCycleSchema,
  updateTemplateCycleSchema,
  templateCycleParamSchema,
} from './template-cycle.validation.js';
import {
  createCycleDaySchema,
  updateCycleDaySchema,
  cycleDayParamSchema,
} from '../diet-plans/cycle.validation.js';
import { templateParamSchema } from './diet-plan-template.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

const middlewares = [authenticate, resolveTenant, requireMinRole(ROLES.ASSISTANT)];
router.use(...middlewares);

// Template Cycles
router.post(
  '/diet-plan-templates/:id/cycles',
  validate(templateParamSchema),
  validate(createTemplateCycleSchema),
  asyncHandler(templateCycleController.createCycle)
);

router.get(
  '/diet-plan-templates/:id/cycles',
  validate(templateParamSchema),
  asyncHandler(templateCycleController.getCycles)
);

router.patch(
  '/template-cycles/:cycleId',
  validate(templateCycleParamSchema),
  validate(updateTemplateCycleSchema),
  asyncHandler(templateCycleController.updateCycle)
);

router.delete(
  '/template-cycles/:cycleId',
  validate(templateCycleParamSchema),
  asyncHandler(templateCycleController.deleteCycle)
);

// Template Cycle Days
router.post(
  '/template-cycles/:cycleId/days',
  validate(templateCycleParamSchema),
  validate(createCycleDaySchema),
  asyncHandler(templateCycleController.createCycleDay)
);

router.get(
  '/template-cycles/:cycleId/days',
  validate(templateCycleParamSchema),
  asyncHandler(templateCycleController.getCycleDays)
);

router.patch(
  '/template-cycle-days/:dayId',
  validate(cycleDayParamSchema),
  validate(updateCycleDaySchema),
  asyncHandler(templateCycleController.updateCycleDay)
);

router.delete(
  '/template-cycle-days/:dayId',
  validate(cycleDayParamSchema),
  asyncHandler(templateCycleController.deleteCycleDay)
);

export default router;
