function mapDate(value) {
  return value ? value.toISOString() : null;
}

function mapCreator(user) {
  if (!user) return null;
  return {
    id: user.id,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
  };
}

export function mapClinicalProfile(profile) {
  if (!profile) return null;

  return {
    id: profile.id,
    clientId: profile.clientId,
    latestAssessmentId: profile.latestAssessmentId,
    summaryNotes: profile.summaryNotes,
    createdAt: mapDate(profile.createdAt),
    updatedAt: mapDate(profile.updatedAt),
    createdBy: mapCreator(profile.createdBy),
  };
}

export function mapSectionStatus(status) {
  return {
    id: status.id,
    section: status.section,
    status: status.status,
    completedAt: mapDate(status.completedAt),
    completedById: status.completedById,
    updatedAt: mapDate(status.updatedAt),
  };
}

export function mapAnthropometricRecord(record) {
  return {
    id: record.id,
    clientId: record.clientId,
    assessmentId: record.assessmentId,
    measuredAt: mapDate(record.measuredAt),
    heightCm: record.heightCm,
    weightKg: record.weightKg,
    bmi: record.bmi,
    bodyFatPercent: record.bodyFatPercent,
    leanMassKg: record.leanMassKg,
    waistCm: record.waistCm,
    hipCm: record.hipCm,
    chestCm: record.chestCm,
    armCm: record.armCm,
    thighCm: record.thighCm,
    neckCm: record.neckCm,
    notes: record.notes,
    createdAt: mapDate(record.createdAt),
  };
}

export function mapMedicalHistory(history) {
  return {
    conditions: history.conditions ?? [],
    allergies: history.allergies ?? [],
    medications: history.medications ?? [],
    supplements: history.supplements ?? [],
    digestiveIssues: history.digestiveIssues ?? [],
  };
}

export function mapLifestyleProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    assessmentId: profile.assessmentId,
    occupation: profile.occupation,
    workSchedule: profile.workSchedule,
    sleepHours: profile.sleepHours,
    stressLevel: profile.stressLevel,
    hydrationLiters: profile.hydrationLiters,
    trainingFrequency: profile.trainingFrequency,
    activityLevel: profile.activityLevel,
    mealTiming: profile.mealTiming,
    metadata: profile.metadata,
    updatedAt: mapDate(profile.updatedAt),
  };
}

export function mapGoalProfile(goal) {
  return {
    id: goal.id,
    assessmentId: goal.assessmentId,
    goalType: goal.goalType,
    targetWeightKg: goal.targetWeightKg,
    targetDate: mapDate(goal.targetDate),
    status: goal.status,
    notes: goal.notes,
    versionNumber: goal.versionNumber,
    startedAt: mapDate(goal.startedAt),
    endedAt: mapDate(goal.endedAt),
  };
}

export function mapLabMarkerDefinition(marker) {
  return {
    id: marker.id,
    tenantId: marker.tenantId,
    markerKey: marker.markerKey,
    name: marker.name,
    category: marker.category,
    defaultUnit: marker.defaultUnit,
    referenceRange: marker.referenceRange,
    sortOrder: marker.sortOrder,
    isSystem: marker.isSystem,
    isActive: marker.isActive,
  };
}

export function mapLabResult(result) {
  return {
    id: result.id,
    assessmentId: result.assessmentId,
    markerDefinitionId: result.markerDefinitionId,
    markerKey: result.markerKey,
    markerName: result.markerName,
    valueNumeric: result.valueNumeric,
    valueText: result.valueText,
    unit: result.unit,
    collectedDate: mapDate(result.collectedDate),
    resultDate: mapDate(result.resultDate),
    referenceRangeSnapshot: result.referenceRangeSnapshot,
    isAbnormal: result.isAbnormal,
    severity: result.severity,
    flagReason: result.flagReason,
    source: result.source,
    notes: result.notes,
    metadata: result.metadata,
    createdAt: mapDate(result.createdAt),
  };
}

export function mapRiskFlag(flag) {
  return {
    id: flag.id,
    assessmentId: flag.assessmentId,
    flagType: flag.flagType,
    severity: flag.severity,
    reason: flag.reason,
    sourceDomain: flag.sourceDomain,
    sourceRecordId: flag.sourceRecordId,
    status: flag.status,
    generatedAt: mapDate(flag.generatedAt),
    acknowledgedAt: mapDate(flag.acknowledgedAt),
    resolvedAt: mapDate(flag.resolvedAt),
    metadata: flag.metadata,
  };
}

export function mapAssessmentSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    clientId: snapshot.clientId,
    assessmentId: snapshot.assessmentId,
    version: snapshot.version,
    snapshot: snapshot.snapshot,
    sourceUpdatedAt: mapDate(snapshot.sourceUpdatedAt),
    generatedAt: mapDate(snapshot.generatedAt),
  };
}
