import { HTTP_STATUS } from '../../config/constants.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { clinicalProfileService } from './clinical-profile.service.js';
import { readinessService } from './readiness.service.js';
import {
  mapAnthropometricRecord,
  mapAssessmentSnapshot,
  mapAssessmentSnapshotHistoryItem,
  mapClinicalProfile,
  mapGoalProfile,
  mapLabMarkerDefinition,
  mapLabResult,
  mapLifestyleProfile,
  mapMedicalHistory,
  mapRiskFlag,
  mapSectionStatus,
} from './clinical-profile.mapper.js';

function userContext(req) {
  return {
    tenantId: req.user.tenantId,
    userId: req.user.userId,
  };
}

function mapSnapshotResponse(snapshot) {
  return {
    profile: mapClinicalProfile(snapshot.profile),
    sectionStatuses: snapshot.sectionStatuses.map(mapSectionStatus),
    latestAnthropometrics: snapshot.latestAnthropometrics
      ? mapAnthropometricRecord(snapshot.latestAnthropometrics)
      : null,
    medicalHistory: mapMedicalHistory(snapshot.medicalHistory),
    lifestyle: mapLifestyleProfile(snapshot.lifestyle),
    goals: snapshot.goals.map(mapGoalProfile),
    labResults: snapshot.labResults.map(mapLabResult),
    riskFlags: snapshot.riskFlags.map(mapRiskFlag),
    latestSnapshot: mapAssessmentSnapshot(snapshot.latestSnapshot),
    legacySummary: snapshot.legacySummary,
  };
}

export const clinicalProfileController = {
  async getClinicalProfile(req, res) {
    const { tenantId, userId } = userContext(req);
    const snapshot = await clinicalProfileService.getSnapshot(tenantId, req.params.clientId, userId);
    const readinessScore = await readinessService.calculateReadinessScore(tenantId, snapshot.profile);

    return sendSuccess(res, HTTP_STATUS.OK, 'Clinical profile retrieved successfully', {
      clinicalProfile: mapSnapshotResponse(snapshot),
      readinessScore,
    });
  },

  async upsertClinicalProfile(req, res) {
    const { tenantId, userId } = userContext(req);
    const profile = await clinicalProfileService.ensureProfile(
      tenantId,
      req.params.clientId,
      userId,
      req.body
    );

    return sendSuccess(res, HTTP_STATUS.CREATED, 'Clinical profile saved successfully', {
      profile: mapClinicalProfile(profile),
    });
  },

  async updateSectionStatus(req, res) {
    const { tenantId, userId } = userContext(req);
    const status = await clinicalProfileService.updateSectionStatus(
      tenantId,
      req.params.clientId,
      userId,
      req.params.section,
      req.body
    );

    return sendSuccess(res, HTTP_STATUS.OK, 'Assessment section status updated successfully', {
      sectionStatus: mapSectionStatus(status),
    });
  },

  async createAnthropometricRecord(req, res) {
    const { tenantId, userId } = userContext(req);
    const record = await clinicalProfileService.createAnthropometricRecord(
      tenantId,
      req.params.clientId,
      userId,
      req.body
    );

    return sendSuccess(res, HTTP_STATUS.CREATED, 'Anthropometric record created successfully', {
      anthropometricRecord: mapAnthropometricRecord(record),
    });
  },

  async getAnthropometricRecords(req, res) {
    const { tenantId, userId } = userContext(req);
    const records = await clinicalProfileService.getAnthropometricRecords(
      tenantId,
      req.params.clientId,
      userId
    );

    return sendSuccess(res, HTTP_STATUS.OK, 'Anthropometric records retrieved successfully', {
      anthropometricRecords: records.map(mapAnthropometricRecord),
    });
  },

  async getMedicalHistory(req, res) {
    const { tenantId, userId } = userContext(req);
    const history = await clinicalProfileService.getMedicalHistory(tenantId, req.params.clientId, userId);

    return sendSuccess(res, HTTP_STATUS.OK, 'Medical history retrieved successfully', {
      medicalHistory: mapMedicalHistory(history),
    });
  },

  async replaceMedicalHistory(req, res) {
    const { tenantId, userId } = userContext(req);
    const history = await clinicalProfileService.replaceMedicalHistory(
      tenantId,
      req.params.clientId,
      userId,
      req.body
    );

    return sendSuccess(res, HTTP_STATUS.OK, 'Medical history saved successfully', {
      medicalHistory: mapMedicalHistory(history),
    });
  },

  async upsertLifestyleProfile(req, res) {
    const { tenantId, userId } = userContext(req);
    const lifestyle = await clinicalProfileService.upsertLifestyleProfile(
      tenantId,
      req.params.clientId,
      userId,
      req.body
    );

    return sendSuccess(res, HTTP_STATUS.OK, 'Lifestyle profile saved successfully', {
      lifestyle: mapLifestyleProfile(lifestyle),
    });
  },

  async getLifestyleProfile(req, res) {
    const { tenantId, userId } = userContext(req);
    const lifestyle = await clinicalProfileService.getLifestyleProfile(
      tenantId,
      req.params.clientId,
      userId
    );

    return sendSuccess(res, HTTP_STATUS.OK, 'Lifestyle profile retrieved successfully', {
      lifestyle: mapLifestyleProfile(lifestyle),
    });
  },

  async getGoalProfiles(req, res) {
    const { tenantId, userId } = userContext(req);
    const goals = await clinicalProfileService.getGoalProfiles(tenantId, req.params.clientId, userId);

    return sendSuccess(res, HTTP_STATUS.OK, 'Goal profiles retrieved successfully', {
      goals: goals.map(mapGoalProfile),
    });
  },

  async createGoalProfile(req, res) {
    const { tenantId, userId } = userContext(req);
    const goal = await clinicalProfileService.createGoalProfile(
      tenantId,
      req.params.clientId,
      userId,
      req.body
    );

    return sendSuccess(res, HTTP_STATUS.CREATED, 'Goal profile created successfully', {
      goal: mapGoalProfile(goal),
    });
  },

  async getLabMarkerDefinitions(req, res) {
    const { tenantId } = userContext(req);
    const definitions = await clinicalProfileService.getLabMarkerDefinitions(tenantId);

    return sendSuccess(res, HTTP_STATUS.OK, 'Lab marker definitions retrieved successfully', {
      labMarkerDefinitions: definitions.map(mapLabMarkerDefinition),
    });
  },

  async createLabMarkerDefinition(req, res) {
    const { tenantId } = userContext(req);
    const definition = await clinicalProfileService.createLabMarkerDefinition(tenantId, req.body);

    return sendSuccess(res, HTTP_STATUS.CREATED, 'Lab marker definition created successfully', {
      labMarkerDefinition: mapLabMarkerDefinition(definition),
    });
  },

  async getLabResults(req, res) {
    const { tenantId, userId } = userContext(req);
    const results = await clinicalProfileService.getLabResults(tenantId, req.params.clientId, userId);

    return sendSuccess(res, HTTP_STATUS.OK, 'Lab results retrieved successfully', {
      labResults: results.map(mapLabResult),
    });
  },

  async createLabResult(req, res) {
    const { tenantId, userId } = userContext(req);
    const result = await clinicalProfileService.createLabResult(
      tenantId,
      req.params.clientId,
      userId,
      req.body
    );

    return sendSuccess(res, HTTP_STATUS.CREATED, 'Lab result created successfully', {
      labResult: mapLabResult(result),
    });
  },

  async getRiskFlags(req, res) {
    const { tenantId, userId } = userContext(req);
    const flags = await clinicalProfileService.getRiskFlags(tenantId, req.params.clientId, userId);

    return sendSuccess(res, HTTP_STATUS.OK, 'Risk flags retrieved successfully', {
      riskFlags: flags.map(mapRiskFlag),
    });
  },

  async updateRiskFlagStatus(req, res) {
    const { tenantId, userId } = userContext(req);
    await clinicalProfileService.updateRiskFlagStatus(
      tenantId,
      req.params.riskFlagId,
      req.body.status,
      userId,
      req.body.resolutionNote
    );

    return sendSuccess(res, HTTP_STATUS.OK, 'Risk flag status updated successfully');
  },

  async generateSnapshot(req, res) {
    const { tenantId, userId } = userContext(req);
    const snapshot = await clinicalProfileService.generateSnapshot(tenantId, req.params.clientId, userId);

    return sendSuccess(res, HTTP_STATUS.CREATED, 'Assessment snapshot generated successfully', {
      assessmentSnapshot: mapAssessmentSnapshot(snapshot),
    });
  },

  async getSnapshotHistory(req, res) {
    const { tenantId, userId } = userContext(req);
    const snapshots = await clinicalProfileService.getSnapshotHistory(
      tenantId,
      req.params.clientId,
      userId
    );

    return sendSuccess(res, HTTP_STATUS.OK, 'Assessment snapshot history retrieved successfully', {
      snapshots: snapshots.map(mapAssessmentSnapshotHistoryItem),
    });
  },

  async compareSnapshots(req, res) {
    const { tenantId, userId } = userContext(req);
    const comparison = await clinicalProfileService.compareSnapshots(
      tenantId,
      req.params.clientId,
      req.query.baselineSnapshotId,
      req.query.comparisonSnapshotId,
      userId
    );

    return sendSuccess(res, HTTP_STATUS.OK, 'Assessment snapshot comparison retrieved successfully', {
      snapshotComparison: comparison,
    });
  },

  async getSnapshotById(req, res) {
    const { tenantId, userId } = userContext(req);
    const snapshot = await clinicalProfileService.getSnapshotById(
      tenantId,
      req.params.clientId,
      req.params.snapshotId,
      userId
    );

    return sendSuccess(res, HTTP_STATUS.OK, 'Assessment snapshot retrieved successfully', {
      assessmentSnapshot: mapAssessmentSnapshot(snapshot),
    });
  },

  async getLatestSnapshot(req, res) {
    const { tenantId, userId } = userContext(req);
    const snapshot = await clinicalProfileService.getSnapshot(tenantId, req.params.clientId, userId);

    return sendSuccess(res, HTTP_STATUS.OK, 'Assessment snapshot retrieved successfully', {
      assessmentSnapshot: mapAssessmentSnapshot(snapshot.latestSnapshot),
    });
  },
};
