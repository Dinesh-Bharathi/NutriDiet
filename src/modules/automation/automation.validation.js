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

  updateAutomationSettingsSchema: z.object({
    params: z.object({
      id: z.string().cuid('Invalid automation ID format'),
    }),
    body: z.object({
      waterEnabled: z.boolean().optional(),
      waterFrequencyType: z.enum(['FREQUENCY', 'CUSTOM']).optional(),
      waterIntervalHours: z.number().int().positive().nullable().optional(),
      waterCustomTimes: z.any().nullable().optional(),
      sleepEnabled: z.boolean().optional(),
      sleepTime: z.string().nullable().optional(),
    }),
  }),
};
