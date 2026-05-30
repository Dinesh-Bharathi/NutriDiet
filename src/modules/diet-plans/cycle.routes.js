// src/modules/diet-plans/cycle.routes.js
import { Router } from 'express';
import { cycleController } from './cycle.controller.js';
import {
  createCycleSchema,
  updateCycleSchema,
  createCycleDaySchema,
  updateCycleDaySchema,
  cycleParamSchema,
  cycleDayParamSchema,
} from './cycle.validation.js';
import { dietPlanParamSchema } from './diet-plan.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

const middlewares = [authenticate, resolveTenant, requireMinRole(ROLES.ASSISTANT)];
router.use(...middlewares);

// Diet Plan Cycles
router.post(
  '/diet-plans/:id/cycles',
  validate(dietPlanParamSchema),
  validate(createCycleSchema),
  asyncHandler(cycleController.createCycle)
);

router.get(
  '/diet-plans/:id/cycles',
  validate(dietPlanParamSchema),
  asyncHandler(cycleController.getCycles)
);

router.get(
  '/diet-plans/:id/cycles/:cycleId',
  validate(dietPlanParamSchema),
  validate(cycleParamSchema),
  asyncHandler(cycleController.getCycle)
);

router.patch(
  '/cycles/:cycleId',
  validate(cycleParamSchema),
  validate(updateCycleSchema),
  asyncHandler(cycleController.updateCycle)
);

router.delete(
  '/cycles/:cycleId',
  validate(cycleParamSchema),
  asyncHandler(cycleController.deleteCycle)
);

// Cycle Days
router.post(
  '/cycles/:cycleId/days',
  validate(cycleParamSchema),
  validate(createCycleDaySchema),
  asyncHandler(cycleController.createCycleDay)
);

router.get(
  '/cycles/:cycleId/days',
  validate(cycleParamSchema),
  asyncHandler(cycleController.getCycleDays)
);

router.patch(
  '/cycle-days/:dayId',
  validate(cycleDayParamSchema),
  validate(updateCycleDaySchema),
  asyncHandler(cycleController.updateCycleDay)
);

router.delete(
  '/cycle-days/:dayId',
  validate(cycleDayParamSchema),
  asyncHandler(cycleController.deleteCycleDay)
);

// Calendar Preview
router.get(
  '/diet-plans/:id/calendar-preview',
  validate(dietPlanParamSchema),
  asyncHandler(cycleController.getCalendarPreview)
);

export default router;
