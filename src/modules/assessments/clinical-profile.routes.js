import { Router } from 'express';
import { ROLES } from '../../config/constants.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { clinicalProfileController } from './clinical-profile.controller.js';
import {
  clinicalProfileClientSchema,
  createAnthropometricRecordSchema,
  createGoalProfileSchema,
  createLabMarkerDefinitionSchema,
  createLabResultSchema,
  riskFlagParamSchema,
  updateSectionStatusSchema,
  upsertClinicalProfileSchema,
  upsertLifestyleProfileSchema,
  upsertMedicalHistorySchema,
  snapshotHistorySchema,
  snapshotByIdSchema,
  compareSnapshotsSchema,
} from './clinical-profile.validation.js';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);
router.use(requireMinRole(ROLES.ASSISTANT));

router.get(
  '/clients/:clientId/clinical-profile',
  validate(clinicalProfileClientSchema),
  asyncHandler(clinicalProfileController.getClinicalProfile)
);

router.post(
  '/clients/:clientId/clinical-profile',
  validate(upsertClinicalProfileSchema),
  asyncHandler(clinicalProfileController.upsertClinicalProfile)
);

router.patch(
  '/clients/:clientId/clinical-profile/sections/:section/status',
  validate(updateSectionStatusSchema),
  asyncHandler(clinicalProfileController.updateSectionStatus)
);

router.get(
  '/clients/:clientId/clinical-profile/anthropometrics',
  validate(clinicalProfileClientSchema),
  asyncHandler(clinicalProfileController.getAnthropometricRecords)
);

router.post(
  '/clients/:clientId/clinical-profile/anthropometrics',
  validate(createAnthropometricRecordSchema),
  asyncHandler(clinicalProfileController.createAnthropometricRecord)
);

router.get(
  '/clients/:clientId/clinical-profile/medical-history',
  validate(clinicalProfileClientSchema),
  asyncHandler(clinicalProfileController.getMedicalHistory)
);

router.post(
  '/clients/:clientId/clinical-profile/medical-history',
  validate(upsertMedicalHistorySchema),
  asyncHandler(clinicalProfileController.replaceMedicalHistory)
);

router.patch(
  '/clients/:clientId/clinical-profile/medical-history',
  validate(upsertMedicalHistorySchema),
  asyncHandler(clinicalProfileController.replaceMedicalHistory)
);

router.patch(
  '/clients/:clientId/clinical-profile/lifestyle',
  validate(upsertLifestyleProfileSchema),
  asyncHandler(clinicalProfileController.upsertLifestyleProfile)
);

router.get(
  '/clients/:clientId/clinical-profile/lifestyle',
  validate(clinicalProfileClientSchema),
  asyncHandler(clinicalProfileController.getLifestyleProfile)
);

router.get(
  '/clients/:clientId/clinical-profile/goals',
  validate(clinicalProfileClientSchema),
  asyncHandler(clinicalProfileController.getGoalProfiles)
);

router.post(
  '/clients/:clientId/clinical-profile/goals',
  validate(createGoalProfileSchema),
  asyncHandler(clinicalProfileController.createGoalProfile)
);

router.patch(
  '/clients/:clientId/clinical-profile/goals',
  validate(createGoalProfileSchema),
  asyncHandler(clinicalProfileController.createGoalProfile)
);

router.get(
  '/clients/:clientId/clinical-profile/labs',
  validate(clinicalProfileClientSchema),
  asyncHandler(clinicalProfileController.getLabResults)
);

router.post(
  '/clients/:clientId/clinical-profile/labs',
  validate(createLabResultSchema),
  asyncHandler(clinicalProfileController.createLabResult)
);

router.get(
  '/clients/:clientId/clinical-profile/risk-flags',
  validate(clinicalProfileClientSchema),
  asyncHandler(clinicalProfileController.getRiskFlags)
);

router.patch(
  '/clinical-profile/risk-flags/:riskFlagId',
  validate(riskFlagParamSchema),
  asyncHandler(clinicalProfileController.updateRiskFlagStatus)
);

router.post(
  '/clients/:clientId/clinical-profile/snapshot',
  validate(clinicalProfileClientSchema),
  asyncHandler(clinicalProfileController.generateSnapshot)
);

router.get(
  '/clients/:clientId/snapshots',
  validate(snapshotHistorySchema),
  asyncHandler(clinicalProfileController.getSnapshotHistory)
);

router.get(
  '/clients/:clientId/snapshots/compare',
  validate(compareSnapshotsSchema),
  asyncHandler(clinicalProfileController.compareSnapshots)
);

router.get(
  '/clients/:clientId/snapshots/:snapshotId',
  validate(snapshotByIdSchema),
  asyncHandler(clinicalProfileController.getSnapshotById)
);

router.get(
  '/clients/:clientId/clinical-profile/snapshot',
  validate(clinicalProfileClientSchema),
  asyncHandler(clinicalProfileController.getLatestSnapshot)
);

router.get(
  '/clinical-profile/lab-marker-definitions',
  asyncHandler(clinicalProfileController.getLabMarkerDefinitions)
);

router.post(
  '/clinical-profile/lab-marker-definitions',
  validate(createLabMarkerDefinitionSchema),
  asyncHandler(clinicalProfileController.createLabMarkerDefinition)
);

export default router;
