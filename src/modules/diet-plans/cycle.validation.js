// src/modules/diet-plans/cycle.validation.js
import { z } from 'zod';

export const createCycleSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().max(500).optional(),
    startDay: z.number().int().min(1).default(1).optional(),
  }),
});

export const updateCycleSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    startDay: z.number().int().min(1).optional(),
  }),
});

export const createCycleDaySchema = z.object({
  body: z.object({
    dayNumber: z.number().int().min(1, 'Day number must be >= 1'),
    dayLabel: z.string().min(1, 'Day label is required').max(100),
    description: z.string().max(500).optional(),
    isActive: z.boolean().default(true).optional(),
    plannedCalories: z.number().int().min(0).default(0).optional(),
    plannedProtein: z.number().min(0).default(0).optional(),
    plannedCarbs: z.number().min(0).default(0).optional(),
    plannedFat: z.number().min(0).default(0).optional(),
  }),
});

export const updateCycleDaySchema = z.object({
  body: z.object({
    dayNumber: z.number().int().min(1).optional(),
    dayLabel: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
    plannedCalories: z.number().int().min(0).optional(),
    plannedProtein: z.number().min(0).optional(),
    plannedCarbs: z.number().min(0).optional(),
    plannedFat: z.number().min(0).optional(),
  }),
});

export const cycleParamSchema = z.object({
  params: z.object({
    cycleId: z.string().cuid('Invalid Cycle ID'),
  }),
});

export const cycleDayParamSchema = z.object({
  params: z.object({
    dayId: z.string().cuid('Invalid Day ID'),
  }),
});
