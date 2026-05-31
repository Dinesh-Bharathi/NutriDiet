// src/modules/meal-swaps/meal-swap.validation.js
import { z } from 'zod';

const SwapStrategyEnum = z.enum([
  'BALANCED_MATCH',
  'PROTEIN_MATCH',
  'CARB_MATCH',
  'FAT_MATCH',
  'CALORIE_MATCH'
]);

const FutureConstraintsSchema = z.object({
  tags: z.array(z.string()).optional(),
  preferences: z.array(z.string()).optional(),
  restrictions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
}).optional();

// GET /api/v1/meals/:mealId/items/:itemId/swaps
export const getSwapCandidatesSchema = z.object({
  params: z.object({
    mealId: z.string({ required_error: 'Meal ID is required' }),
    itemId: z.string({ required_error: 'Meal Item ID is required' }),
  }),
  query: z.object({
    strategy: SwapStrategyEnum.default('BALANCED_MATCH'),
    tags: z.string().transform(val => val ? val.split(',') : undefined).optional(),
    allergies: z.string().transform(val => val ? val.split(',') : undefined).optional(),
    preferences: z.string().transform(val => val ? val.split(',') : undefined).optional(),
    restrictions: z.string().transform(val => val ? val.split(',') : undefined).optional(),
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

// POST /api/v1/meals/:mealId/items/:itemId/swaps/apply
export const applySingleSwapSchema = z.object({
  params: z.object({
    mealId: z.string({ required_error: 'Meal ID is required' }),
    itemId: z.string({ required_error: 'Meal Item ID is required' }),
  }),
  body: z.object({
    targetFoodId: z.string({ required_error: 'Target Food ID is required' }),
    swapStrategy: SwapStrategyEnum.default('BALANCED_MATCH'),
    constraints: FutureConstraintsSchema,
  }),
});

// POST /api/v1/diet-plans/:dietPlanId/swaps/apply
export const applyBulkPlanSwapSchema = z.object({
  params: z.object({
    dietPlanId: z.string({ required_error: 'Diet Plan ID is required' }),
  }),
  body: z.object({
    originalFoodId: z.string({ required_error: 'Original Food ID is required' }),
    targetFoodId: z.string({ required_error: 'Target Food ID is required' }),
    swapStrategy: SwapStrategyEnum.default('BALANCED_MATCH'),
    cycleId: z.string().optional(),
    cycleDayId: z.string().optional(),
    constraints: FutureConstraintsSchema,
  }),
});

// POST /api/v1/diet-plan-templates/:templateId/swaps/apply
export const applyBulkTemplateSwapSchema = z.object({
  params: z.object({
    templateId: z.string({ required_error: 'Template ID is required' }),
  }),
  body: z.object({
    originalFoodId: z.string({ required_error: 'Original Food ID is required' }),
    targetFoodId: z.string({ required_error: 'Target Food ID is required' }),
    swapStrategy: SwapStrategyEnum.default('BALANCED_MATCH'),
    cycleId: z.string().optional(),
    cycleDayId: z.string().optional(),
    constraints: FutureConstraintsSchema,
  }),
});
