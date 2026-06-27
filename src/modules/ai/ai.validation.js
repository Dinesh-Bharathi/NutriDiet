// src/modules/ai/ai.validation.js
// ─────────────────────────────────────────────────────────────────────────────
// Zod validation schemas for AI-related endpoints.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from 'zod';

export const chatSchema = z.object({
  body: z.object({
    message: z
      .string({ required_error: 'message is required' })
      .min(1, 'message cannot be empty'),
    history: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant', 'system'], {
            invalid_type_error: 'role must be user, assistant, or system',
          }),
          content: z
            .string({ required_error: 'content is required' })
            .min(1, 'content cannot be empty'),
        })
      )
      .optional()
      .default([]),
  }),
});
