// src/modules/clients/client.validation.js
// Zod validation schemas for client management routes.
import { z } from 'zod';
import { GENDER, PAGINATION } from '../../config/constants.js';
import { CLIENT_STATUS, ONBOARDING_STATUS } from './client.constants.js';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const genderEnum = z.nativeEnum(GENDER);
const statusEnum = z.nativeEnum(CLIENT_STATUS);
const onboardingStatusEnum = z.nativeEnum(ONBOARDING_STATUS);

// Common phone validation
const phoneSchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (val) => {
      if (!val) return true;
      const parsed = parsePhoneNumberFromString(val);
      return parsed && parsed.isValid();
    },
    {
      message: 'Invalid international phone number format (E.164 required)',
    }
  );

// Schema for client creation
export const createClientSchema = z.object({
  body: z.object({
    firstName: z
      .string({ required_error: 'First name is required' })
      .min(1, 'First name is required')
      .max(100),
    lastName: z
      .string({ required_error: 'Last name is required' })
      .min(1, 'Last name is required')
      .max(100),
    email: z
      .string()
      .email('Invalid email address')
      .toLowerCase()
      .nullable()
      .optional(),
    phone: phoneSchema,
    gender: genderEnum.nullable().optional(),
    dateOfBirth: z
      .preprocess((val) => (val ? new Date(val) : null), z.date())
      .nullable()
      .optional(),
    notes: z.string().nullable().optional(),
    dietitianId: z.string().nullable().optional(),
    status: statusEnum.optional().default(CLIENT_STATUS.ACTIVE),
    onboardingStatus: onboardingStatusEnum.optional().default(ONBOARDING_STATUS.PENDING),

    // Localization / Address / Automation Foundation
    addressLine1: z.string().max(200).nullable().optional(),
    addressLine2: z.string().max(200).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    state: z.string().max(100).nullable().optional(),
    country: z
      .string()
      .length(2, 'Country must be a 2-character ISO code')
      .toUpperCase()
      .nullable()
      .optional(),
    timezone: z.string().nullable().optional(),
    locale: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z|a-z]{2,4})?$/, 'Invalid locale format (e.g., en-US)')
      .nullable()
      .optional(),
    remindersEnabled: z.boolean().optional().default(true),
  }),
});

// Schema for updating a client
export const updateClientSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Client ID is required'),
  }),
  body: z.object({
    firstName: z.string().min(1, 'First name cannot be empty').max(100).optional(),
    lastName: z.string().min(1, 'Last name cannot be empty').max(100).optional(),
    email: z
      .string()
      .email('Invalid email address')
      .toLowerCase()
      .nullable()
      .optional(),
    phone: phoneSchema,
    gender: genderEnum.nullable().optional(),
    dateOfBirth: z
      .preprocess((val) => (val ? new Date(val) : null), z.date())
      .nullable()
      .optional(),
    notes: z.string().nullable().optional(),
    dietitianId: z.string().nullable().optional(),
    status: statusEnum.optional(),
    onboardingStatus: onboardingStatusEnum.optional(),

    // Localization / Address / Automation Foundation
    addressLine1: z.string().max(200).nullable().optional(),
    addressLine2: z.string().max(200).nullable().optional(),
    city: z.string().max(100).nullable().optional(),
    state: z.string().max(100).nullable().optional(),
    country: z
      .string()
      .length(2, 'Country must be a 2-character ISO code')
      .toUpperCase()
      .nullable()
      .optional(),
    timezone: z.string().nullable().optional(),
    locale: z
      .string()
      .regex(/^[a-z]{2}(-[A-Z|a-z]{2,4})?$/, 'Invalid locale format (e.g., en-US)')
      .nullable()
      .optional(),
    remindersEnabled: z.boolean().optional(),
  }),
});

// Schema for client search, pagination and filtering query parameters
export const queryClientsSchema = z.object({
  query: z.object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .default(PAGINATION.DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(PAGINATION.MAX_LIMIT)
      .default(PAGINATION.DEFAULT_LIMIT),
    search: z.string().optional(),
    status: statusEnum.optional(),
    onboardingStatus: onboardingStatusEnum.optional(),
    dietitianId: z.string().optional(),
    sortBy: z.string().optional(),
  }),
});

// Schema for getting a single client or soft-deleting a client
export const clientParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Client ID is required'),
  }),
});

// Schema for attaching an avatar to a client
export const attachAvatarSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Client ID is required'),
  }),
  body: z.object({
    fileAssetId: z.string().min(1, 'Valid FileAsset ID is required'),
  }),
});
