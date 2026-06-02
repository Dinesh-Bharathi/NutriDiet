// src/modules/assessments/assessment.validation.js
// Zod schemas for client assessment requests.
import { z } from 'zod';
import { ACTIVITY_LEVEL, CLIENT_GOAL_TYPE } from './assessment.constants.js';
import { PAGINATION } from '../../config/constants.js';

const activityLevelEnum = z.nativeEnum(ACTIVITY_LEVEL);
const goalTypeEnum = z.nativeEnum(CLIENT_GOAL_TYPE);

// Helper for numeric inputs that can be optional/nullable
const optionalNumeric = (min, max, label) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number({ invalid_type_error: `${label} must be a number` }).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`).nullable()
  ).optional();

export const createAssessmentSchema = z.object({
  params: z.object({
    clientId: z.string().min(1, 'Client ID is required'),
  }),
  body: z.object({
    title: z
      .string({ required_error: 'Title is required' })
      .min(1, 'Title cannot be empty')
      .max(200, 'Title is too long'),
    assessmentDate: z
      .preprocess((val) => (val ? new Date(val) : new Date()), z.date())
      .default(() => new Date()),
    heightCm: optionalNumeric(50, 250, 'Height'),
    weightKg: optionalNumeric(2, 500, 'Weight'),
    goalType: goalTypeEnum,
    goal: z.string().max(1000).nullable().optional(),
    activityLevel: activityLevelEnum.nullable().optional(),
    waterIntakeLiters: optionalNumeric(0, 20, 'Water intake'),
    sleepHours: optionalNumeric(0, 24, 'Sleep hours'),
    medicalConditions: z.string().max(2000).nullable().optional(),
    allergies: z.string().max(2000).nullable().optional(),
    medications: z.string().max(2000).nullable().optional(),
    foodPreferences: z.string().max(2000).nullable().optional(),
    foodRestrictions: z.string().max(2000).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
  }),
});

export const updateAssessmentSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Assessment ID is required'),
  }),
  body: z.object({
    title: z.string().min(1, 'Title cannot be empty').max(200).optional(),
    assessmentDate: z
      .preprocess((val) => (val ? new Date(val) : null), z.date())
      .optional(),
    heightCm: optionalNumeric(50, 250, 'Height'),
    weightKg: optionalNumeric(2, 500, 'Weight'),
    goalType: goalTypeEnum,
    goal: z.string().max(1000).nullable().optional(),
    activityLevel: activityLevelEnum.nullable().optional(),
    waterIntakeLiters: optionalNumeric(0, 20, 'Water intake'),
    sleepHours: optionalNumeric(0, 24, 'Sleep hours'),
    medicalConditions: z.string().max(2000).nullable().optional(),
    allergies: z.string().max(2000).nullable().optional(),
    medications: z.string().max(2000).nullable().optional(),
    foodPreferences: z.string().max(2000).nullable().optional(),
    foodRestrictions: z.string().max(2000).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
  }),
});

export const queryAssessmentsSchema = z.object({
  params: z.object({
    clientId: z.string().min(1, 'Client ID is required'),
  }),
  query: z.object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .default(PAGINATION.DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(PAGINATION.MAX_LIMIT)
      .default(PAGINATION.DEFAULT_LIMIT),
  }),
});

export const assessmentParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Assessment ID is required'),
  }),
});
