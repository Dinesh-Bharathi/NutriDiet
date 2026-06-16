// src/modules/settings/settings.validation.js
import { z } from 'zod';
import countriesAndTimezones from 'countries-and-timezones';
import currencyCodes from 'currency-codes';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Load timezone lookup for validation
const rawTimezones = countriesAndTimezones.getAllTimezones();
const validTimezoneNames = new Set(Object.keys(rawTimezones));

// Load currency codes for validation
const validCurrencyCodes = new Set(currencyCodes.codes());

export const tenantSettingsSchema = z.object({
  name: z
    .string()
    .min(1, 'Practice name is required')
    .optional(),

  logoUrl: z
    .string()
    .url('Invalid logo URL')
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .optional(),

  countryCode: z
    .string()
    .length(2, 'Country code must be a 2-character ISO code')
    .toUpperCase()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val)),
    
  timezone: z
    .string()
    .refine((val) => validTimezoneNames.has(val), {
      message: 'Invalid timezone identifier',
    }),
    
  locale: z
    .string()
    .min(2, 'Locale must be at least 2 characters')
    .max(10, 'Locale must be at most 10 characters')
    .regex(/^[a-z]{2}(-[A-Z|a-z]{2,4})?$/, 'Invalid locale format (e.g., en-US, es-ES)'),
    
  currencyCode: z
    .string()
    .length(3, 'Currency code must be a 3-character ISO code')
    .toUpperCase()
    .refine((val) => validCurrencyCodes.has(val), {
      message: 'Invalid or unsupported currency code',
    }),
    
  measurementSystem: z.enum(['METRIC', 'IMPERIAL'], {
    errorMap: () => ({ message: 'Measurement system must be METRIC or IMPERIAL' }),
  }),

  practiceEmail: z
    .string()
    .email('Invalid email format')
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .optional(),

  practicePhone: z
    .string()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .refine((val) => {
      if (!val) return true;
      const parsed = parsePhoneNumberFromString(val);
      return parsed && parsed.isValid();
    }, {
      message: 'Invalid international phone number format (E.164 required)',
    })
    .optional(),

  addressLine1: z
    .string()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .optional(),

  addressLine2: z
    .string()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .optional(),

  city: z
    .string()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .optional(),

  state: z
    .string()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .optional(),

  country: z
    .string()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .optional(),

  postalCode: z
    .string()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val))
    .optional(),
});
