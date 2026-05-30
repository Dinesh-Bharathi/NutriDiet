// src/modules/check-ins/check-in.validation.js
// Zod schemas for client check-in requests.
import { z } from 'zod';
import { CHECK_IN_STATUS, CHECK_IN_SORT_FIELDS } from './check-in.constants.js';
import { PAGINATION } from '../../config/constants.js';

const checkInStatusEnum = z.nativeEnum(CHECK_IN_STATUS);

// Helper for numeric inputs that can be optional/nullable
const optionalNumeric = (min, max, label) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z
      .number({ invalid_type_error: `${label} must be a number` })
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`)
      .nullable()
  ).optional();

export const createCheckInSchema = z.object({
  params: z.object({
    clientId: z.string().min(1, 'Client ID is required'),
  }),
  body: z.object({
    dietPlanId: z.string().nullable().optional(),
    checkInDate: z
      .preprocess((val) => (val ? new Date(val) : new Date()), z.date())
      .default(() => new Date()),
    status: checkInStatusEnum.default(CHECK_IN_STATUS.SUBMITTED),
    requiresFollowUp: z.boolean().default(false),
    weightKg: optionalNumeric(2, 500, 'Weight'),
    waistCm: optionalNumeric(0, 500, 'Waist circumference'),
    hipCm: optionalNumeric(0, 500, 'Hip circumference'),
    chestCm: optionalNumeric(0, 500, 'Chest circumference'),
    armCm: optionalNumeric(0, 200, 'Arm circumference'),
    thighCm: optionalNumeric(0, 200, 'Thigh circumference'),
    waterIntakeLiters: optionalNumeric(0, 20, 'Water intake'),
    sleepHours: optionalNumeric(0, 24, 'Sleep hours'),
    exerciseDays: optionalNumeric(0, 7, 'Exercise days'),
    energyLevel: optionalNumeric(1, 5, 'Energy level'),
    stressLevel: optionalNumeric(1, 5, 'Stress level'),
    moodLevel: optionalNumeric(1, 5, 'Mood level'),
    planAdherence: optionalNumeric(1, 5, 'Plan adherence'),
    adherenceNotes: z.string().max(2000).nullable().optional(),
    clientNotes: z.string().max(5000).nullable().optional(),
  }),
});

export const updateCheckInSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Check-in ID is required'),
  }),
  body: z.object({
    dietPlanId: z.string().nullable().optional(),
    checkInDate: z
      .preprocess((val) => (val ? new Date(val) : null), z.date().nullable())
      .optional(),
    status: checkInStatusEnum.optional(),
    requiresFollowUp: z.boolean().optional(),
    weightKg: optionalNumeric(2, 500, 'Weight'),
    waistCm: optionalNumeric(0, 500, 'Waist circumference'),
    hipCm: optionalNumeric(0, 500, 'Hip circumference'),
    chestCm: optionalNumeric(0, 500, 'Chest circumference'),
    armCm: optionalNumeric(0, 200, 'Arm circumference'),
    thighCm: optionalNumeric(0, 200, 'Thigh circumference'),
    waterIntakeLiters: optionalNumeric(0, 20, 'Water intake'),
    sleepHours: optionalNumeric(0, 24, 'Sleep hours'),
    exerciseDays: optionalNumeric(0, 7, 'Exercise days'),
    energyLevel: optionalNumeric(1, 5, 'Energy level'),
    stressLevel: optionalNumeric(1, 5, 'Stress level'),
    moodLevel: optionalNumeric(1, 5, 'Mood level'),
    planAdherence: optionalNumeric(1, 5, 'Plan adherence'),
    adherenceNotes: z.string().max(2000).nullable().optional(),
    clientNotes: z.string().max(5000).nullable().optional(),
    practitionerNotes: z.string().max(5000).nullable().optional(),
  }),
});

export const reviewCheckInSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Check-in ID is required'),
  }),
  body: z.object({
    practitionerNotes: z.string().max(5000).nullable().optional(),
    status: z.literal(CHECK_IN_STATUS.REVIEWED, {
      required_error: 'Status must be REVIEWED',
    }),
  }),
});

export const queryCheckInsSchema = z.object({
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
    status: checkInStatusEnum.optional(),
    fromDate: z
      .preprocess((val) => (val ? new Date(val) : null), z.date().nullable())
      .optional(),
    toDate: z
      .preprocess((val) => (val ? new Date(val) : null), z.date().nullable())
      .optional(),
    sortBy: z.enum(CHECK_IN_SORT_FIELDS).default('checkInDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const queryAllCheckInsSchema = z.object({
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
    status: checkInStatusEnum.optional(),
    requiresFollowUp: z
      .preprocess(
        (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
        z.boolean()
      )
      .optional(),
    fromDate: z
      .preprocess((val) => (val ? new Date(val) : null), z.date().nullable())
      .optional(),
    toDate: z
      .preprocess((val) => (val ? new Date(val) : null), z.date().nullable())
      .optional(),
    sortBy: z.enum(CHECK_IN_SORT_FIELDS).default('checkInDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const checkInParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Check-in ID is required'),
  }),
});
