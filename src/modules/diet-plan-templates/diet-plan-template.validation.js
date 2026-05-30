// src/modules/diet-plan-templates/diet-plan-template.validation.js
// Zod schemas for Diet Plan Templates request validation.
import { z } from 'zod';
import { MEAL_TYPE, DIET_PLAN_STATUS } from '../diet-plans/diet-plan.constants.js';
import { PAGINATION } from '../../config/constants.js';

const mealTypeEnum = z.nativeEnum(MEAL_TYPE);
const statusEnum = z.nativeEnum(DIET_PLAN_STATUS);

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

export const createTemplateSchema = z.object({
  body: z.object({
    title: z.string({ required_error: 'Title is required' }).min(1, 'Title cannot be empty').max(200),
    description: z.string().max(1000).nullable().optional(),
    goal: z.string().max(1000).nullable().optional(),
    dailyCalories: optionalInt(0, 'Daily calories'),
    proteinGrams: optionalFloat(0, 'Protein'),
    carbGrams: optionalFloat(0, 'Carbohydrates'),
    fatGrams: optionalFloat(0, 'Fat'),
    isPublic: z.boolean().default(false),
  }),
});

export const updateTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    goal: z.string().max(1000).nullable().optional(),
    dailyCalories: optionalInt(0, 'Daily calories'),
    proteinGrams: optionalFloat(0, 'Protein'),
    carbGrams: optionalFloat(0, 'Carbohydrates'),
    fatGrams: optionalFloat(0, 'Fat'),
    isPublic: z.boolean().optional(),
  }),
});

export const queryTemplatesSchema = z.object({
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

export const templateParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
});

// Clone existing Diet Plan to Template schema
export const clonePlanToTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Diet Plan ID is required'),
  }),
  body: z.object({
    title: z.string({ required_error: 'Template title is required' }).min(1, 'Template title cannot be empty').max(200),
    description: z.string().max(1000).nullable().optional(),
    isPublic: z.boolean().default(false),
  }),
});

// Apply Template schema
export const applyTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    clientId: z.string({ required_error: 'Client ID is required' }).min(1, 'Client ID cannot be empty'),
    startDate: z.preprocess((val) => (val ? new Date(val) : null), z.date().nullable()).optional(),
    endDate: z.preprocess((val) => (val ? new Date(val) : null), z.date().nullable()).optional(),
    status: statusEnum.default(DIET_PLAN_STATUS.DRAFT),
  }),
});

// Template Meals
export const createTemplateMealSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    name: mealTypeEnum,
    mealOrder: z.number({ required_error: 'Meal order is required' }).int().min(1),
    mealTime: z.string().max(50).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  }),
});

export const updateTemplateMealSchema = z.object({
  params: z.object({
    mealId: z.string().min(1, 'Template Meal ID is required'),
  }),
  body: z.object({
    name: mealTypeEnum.optional(),
    mealOrder: z.number().int().min(1).optional(),
    mealTime: z.string().max(50).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  }),
});

// Template Meal Items
export const createTemplateMealItemSchema = z.object({
  params: z.object({
    mealId: z.string().min(1, 'Template Meal ID is required'),
  }),
  body: z.object({
    foodLibraryId: z.string().nullable().optional(),
    foodName: z.string().min(1).max(200).optional(),
    quantity: requiredFloat(0.01, 'Quantity'),
    unit: z.string().min(1).max(50).optional(),
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

export const updateTemplateMealItemSchema = z.object({
  params: z.object({
    itemId: z.string().min(1, 'Template Meal Item ID is required'),
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

export const templateMealParamSchema = z.object({
  params: z.object({
    mealId: z.string().min(1, 'Template Meal ID is required'),
  }),
});

export const templateMealItemParamSchema = z.object({
  params: z.object({
    itemId: z.string().min(1, 'Template Meal Item ID is required'),
  }),
});
