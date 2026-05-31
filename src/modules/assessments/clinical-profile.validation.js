import { z } from 'zod';
import { ACTIVITY_LEVEL } from './assessment.constants.js';
import {
  ASSESSMENT_SECTIONS,
  CLIENT_GOAL_STATUS,
  CLIENT_GOAL_TYPE,
  LAB_RESULT_SEVERITY,
  RISK_FLAG_STATUS,
  SECTION_STATUS,
} from './clinical-profile.constants.js';

const optionalNumeric = (min, max, label) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number({ invalid_type_error: `${label} must be a number` }).min(min).max(max).nullable()
  ).optional();

const optionalDate = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : new Date(val)),
  z.date().nullable()
).optional();

const clientParam = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
});

const profileBody = z.object({
  latestAssessmentId: z.string().min(1).nullable().optional(),
  summaryNotes: z.string().max(5000).nullable().optional(),
});

const medicalEntry = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(255),
  status: z.string().max(100).nullable().optional(),
  severity: z.string().max(100).nullable().optional(),
  reaction: z.string().max(500).nullable().optional(),
  dosage: z.string().max(255).nullable().optional(),
  frequency: z.string().max(255).nullable().optional(),
  triggers: z.string().max(1000).nullable().optional(),
  diagnosedAt: optionalDate,
  startedAt: optionalDate,
  notes: z.string().max(2000).nullable().optional(),
});

export const clinicalProfileClientSchema = z.object({
  params: clientParam,
});

export const upsertClinicalProfileSchema = z.object({
  params: clientParam,
  body: profileBody.default({}),
});

export const updateSectionStatusSchema = z.object({
  params: clientParam.extend({
    section: z.nativeEnum(ASSESSMENT_SECTIONS),
  }),
  body: z.object({
    status: z.nativeEnum(SECTION_STATUS),
    assessmentId: z.string().min(1).nullable().optional(),
  }),
});

export const createAnthropometricRecordSchema = z.object({
  params: clientParam,
  body: z.object({
    assessmentId: z.string().min(1).nullable().optional(),
    measuredAt: optionalDate,
    heightCm: optionalNumeric(50, 250, 'Height'),
    weightKg: optionalNumeric(2, 500, 'Weight'),
    bodyFatPercent: optionalNumeric(0, 100, 'Body fat'),
    leanMassKg: optionalNumeric(0, 300, 'Lean mass'),
    waistCm: optionalNumeric(0, 300, 'Waist'),
    hipCm: optionalNumeric(0, 300, 'Hip'),
    chestCm: optionalNumeric(0, 300, 'Chest'),
    armCm: optionalNumeric(0, 150, 'Arm'),
    thighCm: optionalNumeric(0, 200, 'Thigh'),
    neckCm: optionalNumeric(0, 100, 'Neck'),
    notes: z.string().max(2000).nullable().optional(),
  }),
});

export const upsertMedicalHistorySchema = z.object({
  params: clientParam,
  body: z.object({
    assessmentId: z.string().min(1).nullable().optional(),
    conditions: z.array(medicalEntry).optional(),
    allergies: z.array(medicalEntry).optional(),
    medications: z.array(medicalEntry).optional(),
    supplements: z.array(medicalEntry).optional(),
    digestiveIssues: z.array(medicalEntry).optional(),
  }),
});

export const upsertLifestyleProfileSchema = z.object({
  params: clientParam,
  body: z.object({
    assessmentId: z.string().min(1).nullable().optional(),
    occupation: z.string().max(255).nullable().optional(),
    workSchedule: z.string().max(500).nullable().optional(),
    sleepHours: optionalNumeric(0, 24, 'Sleep hours'),
    stressLevel: z.number().int().min(1).max(10).nullable().optional(),
    hydrationLiters: optionalNumeric(0, 20, 'Hydration'),
    trainingFrequency: z.string().max(255).nullable().optional(),
    activityLevel: z.nativeEnum(ACTIVITY_LEVEL).nullable().optional(),
    mealTiming: z.string().max(1000).nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
  }),
});

export const createGoalProfileSchema = z.object({
  params: clientParam,
  body: z.object({
    assessmentId: z.string().min(1).nullable().optional(),
    goalType: z.nativeEnum(CLIENT_GOAL_TYPE),
    targetWeightKg: optionalNumeric(2, 500, 'Target weight'),
    targetDate: optionalDate,
    status: z.nativeEnum(CLIENT_GOAL_STATUS).optional(),
    notes: z.string().max(2000).nullable().optional(),
    startedAt: optionalDate,
  }),
});

export const createLabResultSchema = z.object({
  params: clientParam,
  body: z.object({
    assessmentId: z.string().min(1).nullable().optional(),
    markerDefinitionId: z.string().min(1).nullable().optional(),
    markerKey: z.string().min(1).max(120),
    markerName: z.string().min(1).max(255),
    valueNumeric: z.number().nullable().optional(),
    valueText: z.string().max(255).nullable().optional(),
    unit: z.string().max(80).nullable().optional(),
    collectedDate: optionalDate,
    resultDate: optionalDate,
    referenceRangeSnapshot: z.record(z.any()).nullable().optional(),
    isAbnormal: z.boolean().optional(),
    severity: z.nativeEnum(LAB_RESULT_SEVERITY).nullable().optional(),
    flagReason: z.string().max(1000).nullable().optional(),
    source: z.string().max(255).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
  }),
});

export const createLabMarkerDefinitionSchema = z.object({
  body: z.object({
    markerKey: z.string().min(1).max(120),
    name: z.string().min(1).max(255),
    category: z.string().max(120).nullable().optional(),
    defaultUnit: z.string().max(80).nullable().optional(),
    referenceRange: z.record(z.any()).nullable().optional(),
    sortOrder: z.number().int().min(1).optional(),
  }),
});

export const riskFlagParamSchema = z.object({
  params: z.object({
    riskFlagId: z.string().min(1, 'Risk flag ID is required'),
  }),
  body: z.object({
    status: z.nativeEnum(RISK_FLAG_STATUS),
  }),
});
