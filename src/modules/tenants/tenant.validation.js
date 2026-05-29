// src/modules/tenants/tenant.validation.js
// Zod schemas for all tenant-related endpoints.
import { z } from 'zod';

// POST /api/v1/tenant/theme
export const updateThemeSchema = z.object({
  body: z.object({
    themeId: z.string({
      required_error: 'themeId is required',
    })
      .min(1, 'themeId cannot be empty')
      .nullable(),
  }),
});
