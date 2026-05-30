// src/modules/clients/client.routes.js
// Client routes and middleware mappings.
import { Router } from 'express';
import { clientController } from './client.controller.js';
import {
  createClientSchema,
  updateClientSchema,
  queryClientsSchema,
  clientParamSchema,
} from './client.validation.js';
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

// POST /api/v1/clients - Create a client
router.post(
  '/',
  validate(createClientSchema),
  asyncHandler(clientController.createClient)
);

// GET /api/v1/clients - List/filter clients (paginated)
router.get(
  '/',
  validate(queryClientsSchema),
  asyncHandler(clientController.getClients)
);

// GET /api/v1/clients/:id - Retrieve a client
router.get(
  '/:id',
  validate(clientParamSchema),
  asyncHandler(clientController.getClientById)
);

// PATCH /api/v1/clients/:id - Update a client
router.patch(
  '/:id',
  validate(updateClientSchema),
  asyncHandler(clientController.updateClient)
);

// DELETE /api/v1/clients/:id - Soft-delete a client
router.delete(
  '/:id',
  validate(clientParamSchema),
  asyncHandler(clientController.deleteClient)
);

// ── Client Assessments Sub-Routes ───────────────────────────────────────────
import { assessmentController } from '../assessments/assessment.controller.js';
import {
  createAssessmentSchema,
  queryAssessmentsSchema,
} from '../assessments/assessment.validation.js';

// POST /api/v1/clients/:clientId/assessments - Create an assessment for a client
router.post(
  '/:clientId/assessments',
  validate(createAssessmentSchema),
  asyncHandler(assessmentController.createAssessment)
);

// GET /api/v1/clients/:clientId/assessments - List assessments for a client (paginated)
router.get(
  '/:clientId/assessments',
  validate(queryAssessmentsSchema),
  asyncHandler(assessmentController.getClientAssessments)
);

// ── Client Diet Plans Sub-Routes ──────────────────────────────────────────────
import { dietPlanController } from '../diet-plans/diet-plan.controller.js';
import {
  createDietPlanSchema,
  queryDietPlansSchema,
} from '../diet-plans/diet-plan.validation.js';

// POST /api/v1/clients/:clientId/diet-plans - Create a diet plan for a client
router.post(
  '/:clientId/diet-plans',
  validate(createDietPlanSchema),
  asyncHandler(dietPlanController.createDietPlan)
);

// GET /api/v1/clients/:clientId/diet-plans - List diet plans for a client (paginated)
router.get(
  '/:clientId/diet-plans',
  validate(queryDietPlansSchema),
  asyncHandler(dietPlanController.getClientDietPlans)
);

// GET /api/v1/clients/:clientId/diet-plan-for-date - Retrieve plan resolved for a specific date
router.get(
  '/:clientId/diet-plan-for-date',
  asyncHandler(dietPlanController.getDietPlanForDate)
);

// ── Client Check-Ins Sub-Routes ─────────────────────────────────────────────
import { checkInController } from '../check-ins/check-in.controller.js';
import {
  createCheckInSchema,
  queryCheckInsSchema,
} from '../check-ins/check-in.validation.js';

// POST /api/v1/clients/:clientId/check-ins - Create a check-in for a client
router.post(
  '/:clientId/check-ins',
  validate(createCheckInSchema),
  asyncHandler(checkInController.createCheckIn)
);

// GET /api/v1/clients/:clientId/check-ins - List check-ins for a client (paginated)
router.get(
  '/:clientId/check-ins',
  validate(queryCheckInsSchema),
  asyncHandler(checkInController.getClientCheckIns)
);

// ── Client Progress Tracking Sub-Routes ──────────────────────────────────────
import { progressController } from '../progress/progress.controller.js';

// GET /api/v1/clients/:clientId/progress - Chronological progress trends
router.get(
  '/:clientId/progress',
  asyncHandler(progressController.getClientProgress)
);

// GET /api/v1/clients/:clientId/progress-summary - Client progress summary
router.get(
  '/:clientId/progress-summary',
  asyncHandler(progressController.getClientProgressSummary)
);

// GET /api/v1/clients/:clientId/progress-snapshot - Client progress dashboard snapshot
router.get(
  '/:clientId/progress-snapshot',
  asyncHandler(progressController.getClientProgressSnapshot)
);

export default router;
