// src/modules/assessments/assessment.routes.js
// Client assessments routes.
import { Router } from 'express';
import { assessmentController } from './assessment.controller.js';
import {
  updateAssessmentSchema,
  assessmentParamSchema,
} from './assessment.validation.js';
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

// GET /api/v1/assessments/:id - Retrieve an assessment
router.get(
  '/:id',
  validate(assessmentParamSchema),
  asyncHandler(assessmentController.getAssessmentById)
);

// PATCH /api/v1/assessments/:id - Update an assessment
router.patch(
  '/:id',
  validate(updateAssessmentSchema),
  asyncHandler(assessmentController.updateAssessment)
);

// DELETE /api/v1/assessments/:id - Soft-delete an assessment
router.delete(
  '/:id',
  validate(assessmentParamSchema),
  asyncHandler(assessmentController.deleteAssessment)
);

export default router;
