// src/modules/automation/automation.validation.js
import { z } from 'zod';

export const automationValidation = {
  // Stubs for future controller endpoints
  createAutomationSchema: z.object({
    body: z.object({
      clientId: z.string().cuid('Invalid client ID format'),
      dietPlanId: z.string().cuid('Invalid diet plan ID format'),
      startDate: z.string().datetime().optional().nullable(),
    }),
  }),

  automationIdParamSchema: z.object({
    params: z.object({
      id: z.string().cuid('Invalid automation ID format'),
    }),
  }),
};
