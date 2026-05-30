// src/modules/diet-plans/diet-plan.validation.js
// Zod schemas for diet plans, meals, and meal items request validation.
import { z } from 'zod';
import { DIET_PLAN_STATUS, MEAL_TYPE } from './diet-plan.constants.js';
import { PAGINATION } from '../../config/constants.js';

const dietPlanStatusEnum = z.nativeEnum(DIET_PLAN_STATUS);
const mealTypeEnum = z.nativeEnum(MEAL_TYPE);

// Preprocessor helpers for numeric values
const optionalInt = (min, label) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number({ invalid_type_error: `${label} must be a number` }).int(`${label} must be an integer`).min(min, `${label} must be at least ${min}`).nullable()
  ).optional();

const optionalFloat = (min, label) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number({ invalid_type_error: `${label} must be a number` }).min(min, `${label} must be at least ${min}`).nullable()
  ).optional();

const requiredFloat = (min, label) =>
  z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` }).min(min, `${label} must be at least ${min}`)
  );

// ─── Diet Plan Schemas ────────────────────────────────────────────────────────
export const createDietPlanSchema = z.object({
  params: z.object({
    clientId: z.string().min(1, 'Client ID is required'),
  }),
  body: z.object({
    title: z.string({ required_error: 'Title is required' }).min(1, 'Title cannot be empty').max(200, 'Title is too long'),
    description: z.string().max(1000).nullable().optional(),
    goal: z.string().max(1000).nullable().optional(),
    assessmentId: z.string().nullable().optional(),
    dailyCalories: optionalInt(0, 'Daily calories'),
    proteinGrams: optionalFloat(0, 'Protein'),
    carbGrams: optionalFloat(0, 'Carbohydrates'),
    fatGrams: optionalFloat(0, 'Fat'),
    startDate: z.preprocess((val) => (val ? new Date(val) : null), z.date().nullable()).optional(),
    endDate: z.preprocess((val) => (val ? new Date(val) : null), z.date().nullable()).optional(),
    status: dietPlanStatusEnum.default(DIET_PLAN_STATUS.DRAFT),
  }),
});

export const updateDietPlanSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Diet Plan ID is required'),
  }),
  body: z.object({
    title: z.string().min(1, 'Title cannot be empty').max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    goal: z.string().max(1000).nullable().optional(),
    assessmentId: z.string().nullable().optional(),
    dailyCalories: optionalInt(0, 'Daily calories'),
    proteinGrams: optionalFloat(0, 'Protein'),
    carbGrams: optionalFloat(0, 'Carbohydrates'),
    fatGrams: optionalFloat(0, 'Fat'),
    startDate: z.preprocess((val) => (val ? new Date(val) : null), z.date().nullable()).optional(),
    endDate: z.preprocess((val) => (val ? new Date(val) : null), z.date().nullable()).optional(),
    status: dietPlanStatusEnum.optional(),
  }),
});

export const queryDietPlansSchema = z.object({
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

export const dietPlanParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Diet Plan ID is required'),
  }),
});

// ─── Diet Plan Meal Schemas ───────────────────────────────────────────────────
export const createMealSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Diet Plan ID is required'),
  }),
  body: z.object({
    name: mealTypeEnum,
    mealOrder: z.number({ required_error: 'Meal order is required' }).int().min(1, 'Meal order must be at least 1'),
    mealTime: z.string().max(50).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    cycleDayId: z.string().cuid().nullable().optional(),
  }),
});

export const updateMealSchema = z.object({
  params: z.object({
    mealId: z.string().min(1, 'Meal ID is required'),
  }),
  body: z.object({
    name: mealTypeEnum.optional(),
    mealOrder: z.number().int().min(1).optional(),
    mealTime: z.string().max(50).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    cycleDayId: z.string().cuid().nullable().optional(),
  }),
});

export const mealParamSchema = z.object({
  params: z.object({
    mealId: z.string().min(1, 'Meal ID is required'),
  }),
});

// ─── Diet Plan Meal Item Schemas ──────────────────────────────────────────────
export const createMealItemSchema = z.object({
  params: z.object({
    mealId: z.string().min(1, 'Meal ID is required'),
  }),
  body: z.object({
    foodLibraryId: z.string().nullable().optional(),
    foodName: z.string().min(1, 'Food name cannot be empty').max(200).optional(),
    quantity: requiredFloat(0.01, 'Quantity'),
    unit: z.string().min(1, 'Unit cannot be empty').max(50).optional(),
    calories: optionalFloat(0, 'Calories'),
    protein: optionalFloat(0, 'Protein'),
    carbs: optionalFloat(0, 'Carbohydrates'),
    fat: optionalFloat(0, 'Fat'),
    notes: z.string().max(1000).nullable().optional(),
  }),
}).refine(
  (data) => data.body.foodLibraryId || (data.body.foodName && data.body.unit),
  {
    message: 'Food name and unit are required when not selecting from Food Library',
    path: ['body.foodName'],
  }
);

export const updateMealItemSchema = z.object({
  params: z.object({
    itemId: z.string().min(1, 'Meal Item ID is required'),
  }),
  body: z.object({
    foodLibraryId: z.string().nullable().optional(),
    foodName: z.string().min(1).max(200).optional(),
    quantity: optionalFloat(0.01, 'Quantity'),
    unit: z.string().min(1).max(50).optional(),
    calories: optionalFloat(0, 'Calories'),
    protein: optionalFloat(0, 'Protein'),
    carbs: optionalFloat(0, 'Carbohydrates'),
    fat: optionalFloat(0, 'Fat'),
    notes: z.string().max(1000).nullable().optional(),
  }),
});

export const mealItemParamSchema = z.object({
  params: z.object({
    itemId: z.string().min(1, 'Meal Item ID is required'),
  }),
});
