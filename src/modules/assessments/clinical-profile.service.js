import ApiError from '../../utils/ApiError.js';
import { clinicalProfileRepository } from './clinical-profile.repository.js';
import { SECTION_STATUS } from './clinical-profile.constants.js';

function calculateBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 100) / 100;
}

function joinNames(items, field = 'name') {
  if (!items || items.length === 0) return null;
  return items.map((item) => item[field]).filter(Boolean).join(', ');
}

function buildLegacyUpdateFromAnthropometrics(data) {
  const legacy = {};
  if (data.heightCm !== undefined) legacy.heightCm = data.heightCm;
  if (data.weightKg !== undefined) legacy.weightKg = data.weightKg;
  if (data.bmi !== undefined) {
    legacy.bmi = data.bmi;
  } else if (data.heightCm !== undefined || data.weightKg !== undefined) {
    legacy.bmi = calculateBmi(data.heightCm, data.weightKg);
  }
  return legacy;
}

function buildLegacyUpdateFromMedical(data) {
  return {
    medicalConditions: joinNames(data.conditions),
    allergies: joinNames(data.allergies),
    medications: joinNames(data.medications),
  };
}

function buildLegacyUpdateFromLifestyle(data) {
  const legacy = {};
  if (data.activityLevel !== undefined) legacy.activityLevel = data.activityLevel;
  if (data.hydrationLiters !== undefined) legacy.waterIntakeLiters = data.hydrationLiters;
  if (data.sleepHours !== undefined) legacy.sleepHours = data.sleepHours;
  return legacy;
}

function buildLegacySummary(snapshotParts) {
  const latest = snapshotParts.latestAnthropometrics;
  const medical = snapshotParts.medicalHistory;
  const lifestyle = snapshotParts.lifestyle;
  const activeGoal = snapshotParts.goals.find((goal) => goal.status === 'ACTIVE') ?? null;

  return {
    heightCm: latest?.heightCm ?? null,
    weightKg: latest?.weightKg ?? null,
    bmi: latest?.bmi ?? null,
    goal: activeGoal?.notes ?? activeGoal?.goalType ?? null,
    activityLevel: lifestyle?.activityLevel ?? null,
    waterIntakeLiters: lifestyle?.hydrationLiters ?? null,
    sleepHours: lifestyle?.sleepHours ?? null,
    medicalConditions: joinNames(medical.conditions),
    allergies: joinNames(medical.allergies, 'allergen'),
    medications: joinNames(medical.medications),
  };
}

function mapMedicalInput(data) {
  return {
    assessmentId: data.assessmentId,
    conditions: data.conditions ?? [],
    allergies: data.allergies ?? [],
    medications: data.medications ?? [],
    supplements: data.supplements ?? [],
    digestiveIssues: data.digestiveIssues ?? [],
  };
}

export const clinicalProfileService = {
  async ensureProfile(tenantId, clientId, userId, data = {}) {
    const client = await clinicalProfileRepository.findClient(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    const existing = await clinicalProfileRepository.findProfileByClient(tenantId, clientId);
    if (existing) {
      const updates = {};
      if (data.latestAssessmentId !== undefined) {
        if (data.latestAssessmentId) {
          const assessment = await clinicalProfileRepository.findAssessmentById(
            tenantId,
            data.latestAssessmentId,
            clientId
          );
          if (!assessment) throw ApiError.notFound('Assessment');
        }
        updates.latestAssessmentId = data.latestAssessmentId;
      }
      if (data.summaryNotes !== undefined) updates.summaryNotes = data.summaryNotes;

      if (Object.keys(updates).length === 0) return existing;
      return clinicalProfileRepository.updateProfile(tenantId, existing.id, updates);
    }

    const latestAssessment = data.latestAssessmentId
      ? await clinicalProfileRepository.findAssessmentById(tenantId, data.latestAssessmentId, clientId)
      : await clinicalProfileRepository.findLatestAssessment(tenantId, clientId);

    if (data.latestAssessmentId && !latestAssessment) {
      throw ApiError.notFound('Assessment');
    }

    return clinicalProfileRepository.createProfile(tenantId, clientId, userId, {
      ...data,
      latestAssessmentId: latestAssessment?.id ?? null,
    });
  },

  async getSnapshot(tenantId, clientId, userId) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    const parts = await clinicalProfileRepository.getSnapshotParts(tenantId, profile);

    return {
      profile,
      ...parts,
      legacySummary: buildLegacySummary(parts),
    };
  },

  async updateSectionStatus(tenantId, clientId, userId, section, data) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    return clinicalProfileRepository.upsertSectionStatus(
      tenantId,
      profile,
      section,
      data.status,
      userId,
      data.assessmentId
    );
  },

  async createAnthropometricRecord(tenantId, clientId, userId, data) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    const previous = await clinicalProfileRepository.getLatestAnthropometricRecord(tenantId, profile.id);
    const heightCm = data.heightCm ?? previous?.heightCm ?? null;
    const weightKg = data.weightKg ?? previous?.weightKg ?? null;
    const bmi = calculateBmi(heightCm, weightKg);
    const record = await clinicalProfileRepository.createAnthropometricRecord(tenantId, profile, {
      ...data,
      bmi,
      measuredAt: data.measuredAt ?? new Date(),
    });

    await clinicalProfileRepository.updateLegacyAssessment(
      tenantId,
      data.assessmentId ?? profile.latestAssessmentId,
      buildLegacyUpdateFromAnthropometrics({ ...data, bmi })
    );

    await clinicalProfileRepository.upsertSectionStatus(
      tenantId,
      profile,
      'ANTHROPOMETRICS',
      SECTION_STATUS.COMPLETED,
      userId,
      data.assessmentId
    );

    return record;
  },

  async getAnthropometricRecords(tenantId, clientId, userId) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    return clinicalProfileRepository.getAnthropometricRecords(tenantId, profile.id);
  },

  async replaceMedicalHistory(tenantId, clientId, userId, data) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    const payload = mapMedicalInput(data);

    await clinicalProfileRepository.replaceMedicalHistory(tenantId, profile, payload);
    await clinicalProfileRepository.updateLegacyAssessment(
      tenantId,
      data.assessmentId ?? profile.latestAssessmentId,
      buildLegacyUpdateFromMedical(payload)
    );
    await clinicalProfileRepository.upsertSectionStatus(
      tenantId,
      profile,
      'MEDICAL',
      SECTION_STATUS.COMPLETED,
      userId,
      data.assessmentId
    );

    return clinicalProfileRepository.getMedicalHistory(tenantId, profile.id);
  },

  async getMedicalHistory(tenantId, clientId, userId) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    return clinicalProfileRepository.getMedicalHistory(tenantId, profile.id);
  },

  async upsertLifestyleProfile(tenantId, clientId, userId, data) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    const lifestyle = await clinicalProfileRepository.upsertLifestyleProfile(tenantId, profile, data);

    await clinicalProfileRepository.updateLegacyAssessment(
      tenantId,
      data.assessmentId ?? profile.latestAssessmentId,
      buildLegacyUpdateFromLifestyle(data)
    );
    await clinicalProfileRepository.upsertSectionStatus(
      tenantId,
      profile,
      'LIFESTYLE',
      SECTION_STATUS.COMPLETED,
      userId,
      data.assessmentId
    );

    return lifestyle;
  },

  async getLifestyleProfile(tenantId, clientId, userId) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    return clinicalProfileRepository.getLifestyleProfile(tenantId, profile.id);
  },

  async createGoalProfile(tenantId, clientId, userId, data) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    await clinicalProfileRepository.supersedeActiveGoals(tenantId, profile.id);
    const nextVersion = (await clinicalProfileRepository.countGoalProfiles(tenantId, profile.id)) + 1;
    const goal = await clinicalProfileRepository.createGoalProfile(tenantId, profile, data, nextVersion);

    await clinicalProfileRepository.updateLegacyAssessment(
      tenantId,
      data.assessmentId ?? profile.latestAssessmentId,
      { goal: data.notes ?? data.goalType }
    );

    return goal;
  },

  async getGoalProfiles(tenantId, clientId, userId) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    return clinicalProfileRepository.getGoalProfiles(tenantId, profile.id);
  },

  async getLabMarkerDefinitions(tenantId) {
    return clinicalProfileRepository.getLabMarkerDefinitions(tenantId);
  },

  async createLabMarkerDefinition(tenantId, data) {
    return clinicalProfileRepository.createLabMarkerDefinition(tenantId, data);
  },

  async createLabResult(tenantId, clientId, userId, data) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    const result = await clinicalProfileRepository.createLabResult(tenantId, profile, data);

    await clinicalProfileRepository.upsertSectionStatus(
      tenantId,
      profile,
      'LABS',
      SECTION_STATUS.COMPLETED,
      userId,
      data.assessmentId
    );

    return result;
  },

  async getLabResults(tenantId, clientId, userId) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    return clinicalProfileRepository.getLabResults(tenantId, profile.id);
  },

  async getRiskFlags(tenantId, clientId, userId) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    return clinicalProfileRepository.getRiskFlags(tenantId, profile.id);
  },

  async updateRiskFlagStatus(tenantId, riskFlagId, status) {
    const count = await clinicalProfileRepository.updateRiskFlagStatus(tenantId, riskFlagId, status);
    if (count === 0) {
      throw ApiError.notFound('Risk flag');
    }
  },

  async generateSnapshot(tenantId, clientId, userId) {
    const current = await this.getSnapshot(tenantId, clientId, userId);
    const sourceDates = [
      current.profile.updatedAt,
      current.latestAnthropometrics?.updatedAt,
      current.lifestyle?.updatedAt,
      ...current.goals.map((goal) => goal.updatedAt),
      ...current.labResults.map((result) => result.updatedAt),
      ...current.riskFlags.map((flag) => flag.updatedAt),
    ].filter(Boolean);

    const snapshot = {
      profile: {
        id: current.profile.id,
        clientId: current.profile.clientId,
        latestAssessmentId: current.profile.latestAssessmentId,
      },
      sectionStatuses: current.sectionStatuses,
      anthropometrics: current.latestAnthropometrics,
      medicalHistory: current.medicalHistory,
      lifestyle: current.lifestyle,
      goals: current.goals,
      labs: current.labResults,
      riskFlags: current.riskFlags,
      legacySummary: current.legacySummary,
    };

    const sourceUpdatedAt = sourceDates.length > 0
      ? new Date(Math.max(...sourceDates.map((date) => new Date(date).getTime())))
      : null;

    return clinicalProfileRepository.createSnapshot(
      tenantId,
      current.profile,
      userId,
      snapshot,
      sourceUpdatedAt
    );
  },
};
