// src/modules/diet-plan-templates/template-cycle.validation.js
import { z } from 'zod';

export const createTemplateCycleSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().max(500).optional(),
  }),
});

export const updateTemplateCycleSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
  }),
});

export const templateCycleParamSchema = z.object({
  params: z.object({
    cycleId: z.string().cuid('Invalid Template Cycle ID'),
  }),
});
