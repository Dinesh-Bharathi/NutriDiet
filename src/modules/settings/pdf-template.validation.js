// src/modules/settings/pdf-template.validation.js
import { z } from 'zod';

export const pdfTemplateSchema = z.object({
  logoAssetId: z.string().nullable().optional(),
  logoUrl: z.string().url('Invalid logo URL').nullable().optional().or(z.literal('')),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Primary color must be a valid hex color code (e.g. #1447e6)'),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Secondary color must be a valid hex color code (e.g. #f5f5f5)'),
  headerContent: z.record(z.any()).nullable().optional(),
  footerContent: z.record(z.any()).nullable().optional(),
  footerPlacement: z.enum(['EVERY_PAGE', 'LAST_PAGE_ONLY'], {
    errorMap: () => ({ message: 'Footer placement must be EVERY_PAGE or LAST_PAGE_ONLY' }),
  }),
});
