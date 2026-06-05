import ApiError from '../../utils/ApiError.js';
import { clinicalProfileRepository } from './clinical-profile.repository.js';
import { riskFlagService } from './risk-flag.service.js';
import { SECTION_STATUS } from './clinical-profile.constants.js';
import prisma from '../../lib/prisma.js';
import { progressService } from '../progress/progress.service.js';

function calculateBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 100) / 100;
}

function joinNames(items, field = 'name') {
  if (!items || items.length === 0) return null;
  return items.map((item) => item[field]).filter(Boolean).join(', ');
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

function getObjectFieldDelta(before, after) {
  const delta = typeof before === 'number' && typeof after === 'number' ? Math.round((after - before) * 100) / 100 : null;
  return {
    before: before ?? null,
    after: after ?? null,
    delta,
  };
}

function mapItemsById(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}

function compareSectionStatuses(beforeStatuses = [], afterStatuses = []) {
  const beforeMap = new Map(beforeStatuses.map((status) => [status.section, status]));
  const afterMap = new Map(afterStatuses.map((status) => [status.section, status]));
  const sections = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()]));

  return sections.map((section) => {
    const before = beforeMap.get(section);
    const after = afterMap.get(section);

    return {
      section,
      before: before?.status ?? null,
      after: after?.status ?? null,
      changed: before?.status !== after?.status,
    };
  });
}

function compareGoals(beforeGoals = [], afterGoals = []) {
  const beforeMap = mapItemsById(beforeGoals);
  const afterMap = mapItemsById(afterGoals);

  const added = afterGoals.filter((goal) => !beforeMap.has(goal.id));
  const removed = beforeGoals.filter((goal) => !afterMap.has(goal.id));
  const completed = afterGoals.filter(
    (goal) => beforeMap.has(goal.id) && beforeMap.get(goal.id).status !== 'COMPLETED' && goal.status === 'COMPLETED'
  );
  const changed = afterGoals
    .filter((goal) => {
      if (!beforeMap.has(goal.id)) return false;
      const previous = beforeMap.get(goal.id);
      return (
        previous.goalType !== goal.goalType ||
        previous.status !== goal.status ||
        previous.targetWeightKg !== goal.targetWeightKg ||
        String(previous.targetDate) !== String(goal.targetDate) ||
        previous.notes !== goal.notes ||
        previous.versionNumber !== goal.versionNumber ||
        String(previous.startedAt) !== String(goal.startedAt) ||
        String(previous.endedAt) !== String(goal.endedAt)
      );
    })
    .map((goal) => ({ before: beforeMap.get(goal.id), after: goal }));

  return {
    added,
    removed,
    completed,
    changed,
  };
}

function compareLabs(beforeLabs = [], afterLabs = []) {
  const beforeMap = mapItemsById(beforeLabs);
  const afterMap = mapItemsById(afterLabs);

  const added = afterLabs.filter((lab) => !beforeMap.has(lab.id));
  const removed = beforeLabs.filter((lab) => !afterMap.has(lab.id));
  const valueChanges = afterLabs
    .filter((lab) => {
      const previous = beforeMap.get(lab.id);
      if (!previous) return false;
      return (
        previous.valueNumeric !== lab.valueNumeric ||
        previous.valueText !== lab.valueText ||
        previous.unit !== lab.unit ||
        previous.markerKey !== lab.markerKey ||
        previous.markerName !== lab.markerName
      );
    })
    .map((lab) => {
      const previous = beforeMap.get(lab.id);
      return {
        id: lab.id,
        markerKey: lab.markerKey,
        markerName: lab.markerName,
        before: {
          valueNumeric: previous.valueNumeric ?? null,
          valueText: previous.valueText ?? null,
          unit: previous.unit ?? null,
          severity: previous.severity ?? null,
          resultDate: previous.resultDate ?? null,
        },
        after: {
          valueNumeric: lab.valueNumeric ?? null,
          valueText: lab.valueText ?? null,
          unit: lab.unit ?? null,
          severity: lab.severity ?? null,
          resultDate: lab.resultDate ?? null,
        },
        numericDelta:
          typeof previous.valueNumeric === 'number' && typeof lab.valueNumeric === 'number'
            ? Math.round((lab.valueNumeric - previous.valueNumeric) * 100) / 100
            : null,
      };
    });
  const severityChanges = afterLabs
    .filter((lab) => {
      const previous = beforeMap.get(lab.id);
      return previous && previous.severity !== lab.severity;
    })
    .map((lab) => ({
      id: lab.id,
      markerKey: lab.markerKey,
      markerName: lab.markerName,
      before: beforeMap.get(lab.id).severity,
      after: lab.severity,
    }));

  return {
    added,
    removed,
    valueChanges,
    severityChanges,
  };
}

function compareRiskFlags(beforeFlags = [], afterFlags = []) {
  const beforeMap = mapItemsById(beforeFlags);

  const added = afterFlags.filter((flag) => !beforeMap.has(flag.id));
  const resolved = afterFlags.filter((flag) => {
    const previous = beforeMap.get(flag.id);
    return previous && previous.status !== 'RESOLVED' && flag.status === 'RESOLVED';
  });
  const statusChanges = afterFlags
    .filter((flag) => {
      const previous = beforeMap.get(flag.id);
      return previous && previous.status !== flag.status;
    })
    .map((flag) => ({
      before: beforeMap.get(flag.id).status,
      after: flag.status,
      flag,
    }));

  return {
    added,
    resolved,
    statusChanges,
  };
}

function compareMedicalHistoryCategory(beforeItems = [], afterItems = []) {
  const beforeMap = mapItemsById(beforeItems);
  const afterMap = mapItemsById(afterItems);

  return {
    added: afterItems.filter((item) => !beforeMap.has(item.id)),
    removed: beforeItems.filter((item) => !afterMap.has(item.id)),
  };
}

function buildSnapshotComparison(beforeSnapshot = {}, afterSnapshot = {}) {
  return {
    anthropometrics: {
      heightCm: getObjectFieldDelta(beforeSnapshot.anthropometrics?.heightCm ?? null, afterSnapshot.anthropometrics?.heightCm ?? null),
      weightKg: getObjectFieldDelta(beforeSnapshot.anthropometrics?.weightKg ?? null, afterSnapshot.anthropometrics?.weightKg ?? null),
      bmi: getObjectFieldDelta(beforeSnapshot.anthropometrics?.bmi ?? null, afterSnapshot.anthropometrics?.bmi ?? null),
      bodyFatPercent: getObjectFieldDelta(
        beforeSnapshot.anthropometrics?.bodyFatPercent ?? null,
        afterSnapshot.anthropometrics?.bodyFatPercent ?? null
      ),
      leanMassKg: getObjectFieldDelta(
        beforeSnapshot.anthropometrics?.leanMassKg ?? null,
        afterSnapshot.anthropometrics?.leanMassKg ?? null
      ),
      waistCm: getObjectFieldDelta(beforeSnapshot.anthropometrics?.waistCm ?? null, afterSnapshot.anthropometrics?.waistCm ?? null),
      hipCm: getObjectFieldDelta(beforeSnapshot.anthropometrics?.hipCm ?? null, afterSnapshot.anthropometrics?.hipCm ?? null),
      chestCm: getObjectFieldDelta(beforeSnapshot.anthropometrics?.chestCm ?? null, afterSnapshot.anthropometrics?.chestCm ?? null),
      armCm: getObjectFieldDelta(beforeSnapshot.anthropometrics?.armCm ?? null, afterSnapshot.anthropometrics?.armCm ?? null),
      thighCm: getObjectFieldDelta(beforeSnapshot.anthropometrics?.thighCm ?? null, afterSnapshot.anthropometrics?.thighCm ?? null),
      neckCm: getObjectFieldDelta(beforeSnapshot.anthropometrics?.neckCm ?? null, afterSnapshot.anthropometrics?.neckCm ?? null),
    },
    sectionStatuses: compareSectionStatuses(beforeSnapshot.sectionStatuses, afterSnapshot.sectionStatuses),
    goals: compareGoals(beforeSnapshot.goals, afterSnapshot.goals),
    labs: compareLabs(beforeSnapshot.labs, afterSnapshot.labs),
    riskFlags: compareRiskFlags(beforeSnapshot.riskFlags, afterSnapshot.riskFlags),
    medicalHistory: {
      conditions: compareMedicalHistoryCategory(beforeSnapshot.medicalHistory?.conditions, afterSnapshot.medicalHistory?.conditions),
      allergies: compareMedicalHistoryCategory(beforeSnapshot.medicalHistory?.allergies, afterSnapshot.medicalHistory?.allergies),
      medications: compareMedicalHistoryCategory(beforeSnapshot.medicalHistory?.medications, afterSnapshot.medicalHistory?.medications),
      supplements: compareMedicalHistoryCategory(beforeSnapshot.medicalHistory?.supplements, afterSnapshot.medicalHistory?.supplements),
      digestiveIssues: compareMedicalHistoryCategory(beforeSnapshot.medicalHistory?.digestiveIssues, afterSnapshot.medicalHistory?.digestiveIssues),
    },
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

  async getSnapshotHistory(tenantId, clientId, userId) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    return clinicalProfileRepository.findSnapshotsByClient(tenantId, profile.clientId);
  },

  async getSnapshotById(tenantId, clientId, snapshotId, userId) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    const snapshot = await clinicalProfileRepository.findSnapshotById(
      tenantId,
      profile.clientId,
      snapshotId
    );

    if (!snapshot) {
      throw ApiError.notFound('Assessment snapshot');
    }

    return snapshot;
  },

  async compareSnapshots(tenantId, clientId, baselineSnapshotId, comparisonSnapshotId, userId) {
    const profile = await this.ensureProfile(tenantId, clientId, userId);
    if (baselineSnapshotId === comparisonSnapshotId) {
      throw ApiError.badRequest('Baseline and comparison snapshot IDs must differ');
    }

    const [baselineSnapshot, comparisonSnapshot] = await Promise.all([
      clinicalProfileRepository.findSnapshotById(tenantId, profile.clientId, baselineSnapshotId),
      clinicalProfileRepository.findSnapshotById(tenantId, profile.clientId, comparisonSnapshotId),
    ]);

    if (!baselineSnapshot || !comparisonSnapshot) {
      throw ApiError.notFound('Assessment snapshot');
    }

    return buildSnapshotComparison(baselineSnapshot.snapshot, comparisonSnapshot.snapshot);
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

    if (result.isAbnormal || result.severity === 'HIGH' || result.severity === 'CRITICAL') {
      await riskFlagService.generateSystemRisk(tenantId, clientId, profile.id, {
        type: 'ABNORMAL_LAB',
        severity: result.severity === 'CRITICAL' ? 'CRITICAL' : (result.severity === 'HIGH' ? 'HIGH' : 'MODERATE'),
        reason: `Abnormal Lab Result: ${result.markerName} (${result.valueNumeric ?? result.valueText} ${result.unit ?? ''})`,
        sourceDomain: 'LAB_RESULT',
        sourceRecordId: result.id,
      });
    }

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

  async updateRiskFlagStatus(tenantId, riskFlagId, status, userId, resolutionNote = null) {
    if (status === 'ACKNOWLEDGED') {
      await riskFlagService.acknowledgeRisk(tenantId, riskFlagId, userId);
    } else if (status === 'RESOLVED') {
      await riskFlagService.resolveRisk(tenantId, riskFlagId, userId, resolutionNote);
    } else {
      const count = await clinicalProfileRepository.updateRiskFlagStatus(tenantId, riskFlagId, status);
      if (count === 0) {
        throw ApiError.notFound('Risk flag');
      }
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

  async getAggregatedOverview(tenantId, clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      include: {
        dietitian: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    if (!client) {
      throw ApiError.notFound('Client');
    }

    const profile = await prisma.clientClinicalProfile.findUnique({
      where: {
        tenantId_clientId: {
          tenantId,
          clientId,
        },
      },
      include: {
        conditions: true,
        allergies: true,
        medications: true,
        supplements: true,
      },
    });
    const latestAnthro = profile
      ? await clinicalProfileRepository.getLatestAnthropometricRecord(tenantId, profile.id)
      : null;

    const activeGoal = profile
      ? await prisma.clientGoalProfile.findFirst({
          where: { tenantId, clientId, profileId: profile.id, status: 'ACTIVE', deletedAt: null },
          orderBy: { createdAt: 'desc' }
        })
      : null;

    const latestCheckIn = await prisma.clientCheckIn.findFirst({
      where: { tenantId, clientId, deletedAt: null },
      orderBy: { checkInDate: 'desc' },
      select: { id: true, checkInDate: true, status: true, weightKg: true, waistCm: true }
    });

    const progressSummary = await progressService.getClientProgressSummary(tenantId, clientId);

    let completionPercentage = 0;
    if (profile) {
      const sections = await clinicalProfileRepository.getSectionStatuses(tenantId, profile.id);
      const completedCount = sections.filter(s => s.status === 'COMPLETED').length;
      completionPercentage = sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0;
    }

    const checkInsTimeline = await prisma.clientCheckIn.findMany({
      where: { tenantId, clientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, createdAt: true, status: true }
    });

    const timeline = [
      ...checkInsTimeline.map(ci => ({
        type: 'CHECK_IN',
        date: ci.createdAt,
        description: `Check-in ${ci.status.toLowerCase()}`
      }))
    ].sort((a, b) => b.date - a.date).slice(0, 5);

    return {
      client: {
        id: client.id,
        fullName: client.fullName,
        avatar: client.avatarAssetId
          ? {
              id: client.avatarAssetId,
              visibility: "PROTECTED",
              hasAvatar: true,
            }
          : null,
        status: client.status,
        onboardingStatus: client.onboardingStatus,
        dateOfBirth: client.dateOfBirth,
        gender: client.gender,
      },
      currentMetrics: latestAnthro ? {
        weightKg: latestAnthro.weightKg,
        bmi: latestAnthro.bmi ? Number(latestAnthro.bmi.toFixed(2)) : null,
        waistCm: latestAnthro.waistCm,
        measuredAt: latestAnthro.measuredAt,
      } : null,
      activeGoal: activeGoal ? {
        goalType: activeGoal.goalType,
        targetWeightKg: activeGoal.targetWeightKg,
      } : null,
      latestCheckIn: latestCheckIn ? {
        id: latestCheckIn.id,
        date: latestCheckIn.checkInDate,
        status: latestCheckIn.status
      } : null,
      assignedPractitioner: client.dietitian ? {
        id: client.dietitian.id,
        name: client.dietitian.fullName,
      } : null,
      progressSummary: {
        netChange: progressSummary?.netChange ?? null,
        waistChange: progressSummary?.waistChange ?? null,
      },
      readiness: {
        score: completionPercentage,
        status: completionPercentage === 100 ? 'READY' : 'INCOMPLETE'
      },
      completion: {
        percentage: completionPercentage
      },
      activityTimeline: timeline,
    };
  },

  async getActiveGoal(tenantId, clientId) {
    return prisma.clientGoalProfile.findFirst({
      where: { tenantId, clientId, status: 'ACTIVE', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getGoalProfileById(tenantId, clientId, id) {
    return prisma.clientGoalProfile.findFirst({
      where: { id, tenantId, clientId, deletedAt: null },
    });
  },
};
