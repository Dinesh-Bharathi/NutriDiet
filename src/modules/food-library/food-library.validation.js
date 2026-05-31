// src/modules/food-library/food-library.validation.js
// Zod schemas for food library request validation.
import { z } from 'zod';
import { FOOD_SOURCE_TYPE } from './food-library.constants.js';
import { PAGINATION } from '../../config/constants.js';

const foodSourceTypeEnum = z.nativeEnum(FOOD_SOURCE_TYPE);

// Preprocessor helpers for numeric values
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

export const createFoodSchema = z.object({
  body: z.object({
    foodName: z.string({ required_error: 'Food name is required' }).min(1, 'Food name cannot be empty').max(200, 'Food name is too long'),
    sourceType: foodSourceTypeEnum.default(FOOD_SOURCE_TYPE.CUSTOM),
    defaultQuantity: requiredFloat(0.01, 'Default quantity'),
    defaultUnit: z.string({ required_error: 'Default unit is required' }).min(1, 'Default unit cannot be empty').max(50),
    servingSize: requiredFloat(0.01, 'Serving size'),
    servingUnit: z.string({ required_error: 'Serving unit is required' }).min(1, 'Serving unit cannot be empty').max(50),
    calories: optionalFloat(0, 'Calories'),
    protein: optionalFloat(0, 'Protein'),
    carbs: optionalFloat(0, 'Carbohydrates'),
    fat: optionalFloat(0, 'Fat'),
    commonName: z.string().max(200).nullable().optional(),
    brandName: z.string().max(200).nullable().optional(),
    searchKeywords: z.string().max(500).nullable().optional(),
    categoryId: z.string().nullable().optional(),
    tagIds: z.array(z.string()).optional(),
  }),
});

export const updateFoodSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Food ID is required'),
  }),
  body: z.object({
    foodName: z.string().min(1).max(200).optional(),
    sourceType: foodSourceTypeEnum.optional(),
    defaultQuantity: optionalFloat(0.01, 'Default quantity'),
    defaultUnit: z.string().min(1).max(50).optional(),
    servingSize: optionalFloat(0.01, 'Serving size'),
    servingUnit: z.string().min(1).max(50).optional(),
    calories: optionalFloat(0, 'Calories'),
    protein: optionalFloat(0, 'Protein'),
    carbs: optionalFloat(0, 'Carbohydrates'),
    fat: optionalFloat(0, 'Fat'),
    commonName: z.string().max(200).nullable().optional(),
    brandName: z.string().max(200).nullable().optional(),
    searchKeywords: z.string().max(500).nullable().optional(),
    categoryId: z.string().nullable().optional(),
    tagIds: z.array(z.string()).optional(),
  }),
});

export const queryFoodSchema = z.object({
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
    q: z.string().optional(),
    categoryId: z.string().optional(),
    tagIds: z.string().optional(),
    status: z.string().optional(),
    minCalories: z.coerce.number().optional(),
    maxCalories: z.coerce.number().optional(),
    minProtein: z.coerce.number().optional(),
    maxProtein: z.coerce.number().optional(),
  }),
});


export const searchFoodSchema = z.object({
  query: z.object({
    q: z.string({ required_error: 'Search query is required' }).min(1, 'Search query cannot be empty'),
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

export const foodParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Food ID is required'),
  }),
});
