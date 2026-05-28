// src/modules/auth/auth.validation.js
// Zod schemas for all auth endpoints.
// Wrapped in z.object({ body, query, params }) for the validate() middleware.
import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const slugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
  .refine((s) => !s.startsWith('-') && !s.endsWith('-'), {
    message: 'Slug cannot start or end with a hyphen',
  });

// POST /api/v1/auth/register
export const registerSchema = z.object({
  body: z.object({
    tenantName: z.string().min(2, 'Business name is required').max(100),
    tenantSlug: slugSchema,
    firstName:  z.string().min(1, 'First name is required').max(100),
    lastName:   z.string().min(1, 'Last name is required').max(100),
    email:      z.string().email('Invalid email address').toLowerCase(),
    password:   passwordSchema,
  }),
});

// POST /api/v1/auth/login
// tenantSlug is required for multi-tenant login disambiguation.
export const loginSchema = z.object({
  body: z.object({
    email:      z.string().email('Invalid email address').toLowerCase(),
    password:   z.string().min(1, 'Password is required'),
    tenantSlug: z.string().min(1, 'Organisation slug is required'),
  }),
});

// POST /api/v1/auth/refresh
// refreshToken is optional in body — may come from httpOnly cookie.
export const refreshSchema = z.object({
  body: z
    .object({ refreshToken: z.string().optional() })
    .optional()
    .default({}),
});
