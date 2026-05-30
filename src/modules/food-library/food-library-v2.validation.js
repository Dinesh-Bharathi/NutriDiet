// src/modules/food-library/food-library-v2.validation.js
import { z } from 'zod';

const CUID_REGEX = /^[c|d|e][a-z0-9]{24}$/; // Standard CUID validation format

export const categoryParamSchema = z.object({
  params: z.object({
    id: z.string().regex(CUID_REGEX, 'Invalid Category ID'),
  }),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required').max(100),
    description: z.string().max(500).optional(),
    parentCategoryId: z.string().regex(CUID_REGEX, 'Invalid Parent Category ID').optional().nullable(),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    parentCategoryId: z.string().regex(CUID_REGEX, 'Invalid Parent Category ID').optional().nullable(),
  }),
});

export const tagParamSchema = z.object({
  params: z.object({
    id: z.string().regex(CUID_REGEX, 'Invalid Tag ID'),
  }),
});

export const createTagSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Tag name is required').max(100),
    description: z.string().max(500).optional(),
  }),
});

export const updateTagSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
  }),
});

export const foodParamSchema = z.object({
  params: z.object({
    id: z.string().regex(CUID_REGEX, 'Invalid Food ID'),
  }),
});

export const servingParamSchema = z.object({
  params: z.object({
    id: z.string().regex(CUID_REGEX, 'Invalid Serving ID'),
  }),
});

const ServingUnitTypes = ['GRAM', 'CUP', 'BOWL', 'TBSP', 'TSP', 'PIECE', 'SLICE', 'SCOOP', 'SERVING'];

export const createServingSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Serving name/label is required').max(100),
    grams: z.number().positive('Grams must be a positive number'),
    unitType: z.enum(ServingUnitTypes, {
      errorMap: () => ({ message: `Unit type must be one of: ${ServingUnitTypes.join(', ')}` }),
    }),
    isDefault: z.boolean().default(false).optional(),
    displayOrder: z.number().int().min(1).default(1).optional(),
  }),
});

export const updateServingSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    grams: z.number().positive().optional(),
    unitType: z.enum(ServingUnitTypes).optional(),
    isDefault: z.boolean().optional(),
    displayOrder: z.number().int().min(1).optional(),
  }),
});

const EquivalencyTypes = ['PROTEIN', 'CARB', 'FAT', 'CALORIE'];

export const createEquivalentSchema = z.object({
  body: z.object({
    targetFoodId: z.string().regex(CUID_REGEX, 'Invalid Target Food ID'),
    equivalencyType: z.enum(EquivalencyTypes, {
      errorMap: () => ({ message: `Equivalency type must be one of: ${EquivalencyTypes.join(', ')}` }),
    }),
    similarityScore: z.number().int().min(0).max(100).default(100).optional(),
  }),
});

export const equivalentParamSchema = z.object({
  params: z.object({
    id: z.string().regex(CUID_REGEX, 'Invalid Equivalent ID'),
  }),
});

export const searchFoodsSchema = z.object({
  query: z.object({
    query: z.string().optional(),
    categoryId: z.string().regex(CUID_REGEX, 'Invalid Category ID').optional(),
    tagIds: z.string().optional(), // Can parse comma-separated IDs
    minCalories: z.coerce.number().min(0).optional(),
    maxCalories: z.coerce.number().min(0).optional(),
    minProtein: z.coerce.number().min(0).optional(),
    maxProtein: z.coerce.number().min(0).optional(),
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  }),
});
