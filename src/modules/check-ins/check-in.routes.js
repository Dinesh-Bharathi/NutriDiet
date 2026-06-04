// src/modules/check-ins/check-in.routes.js
// Client check-ins routes.
import { Router } from 'express';
import { checkInController } from './check-in.controller.js';
import {
  updateCheckInSchema,
  reviewCheckInSchema,
  queryAllCheckInsSchema,
  checkInParamSchema,
} from './check-in.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
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

// GET /api/v1/check-ins - Global list of check-ins (filtered, paginated, sorted)
router.get(
  '/',
  validate(queryAllCheckInsSchema),
  asyncHandler(checkInController.getAllCheckIns)
);

// GET /api/v1/check-ins/queue - Server-side paginated + searched practitioner queue
// MUST be declared before /:id so Express does not interpret "queue" as a param value
router.get(
  '/queue',
  asyncHandler(checkInController.getPractitionerQueue)
);

// GET /api/v1/check-ins/:id - Retrieve a check-in's details
router.get(
  '/:id',
  validate(checkInParamSchema),
  asyncHandler(checkInController.getCheckInById)
);

// PATCH /api/v1/check-ins/:id - Update check-in metrics/fields
router.patch(
  '/:id',
  validate(updateCheckInSchema),
  asyncHandler(checkInController.updateCheckIn)
);

// POST /api/v1/check-ins/:id/review - Review workflow
router.post(
  '/:id/review',
  validate(reviewCheckInSchema),
  asyncHandler(checkInController.reviewCheckIn)
);

// DELETE /api/v1/check-ins/:id - Soft-delete a check-in
router.delete(
  '/:id',
  validate(checkInParamSchema),
  asyncHandler(checkInController.deleteCheckIn)
);

export default router;
