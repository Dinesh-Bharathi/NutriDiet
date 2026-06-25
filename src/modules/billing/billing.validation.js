// src/modules/billing/billing.validation.js
// Zod validation schemas for billing and subscription API endpoints.

import { z } from 'zod';

// Validation schema for starting a trial
export const startTrialSchema = z.object({
  body: z.object({
    planCode: z
      .string({ required_error: 'planCode is required' })
      .min(1, 'planCode cannot be empty')
      .max(50),
  }),
});

// Validation schema for cancelling a subscription
export const cancelSubscriptionSchema = z.object({
  body: z.object({
    immediate: z.boolean().optional().default(false),
  }),
});

// Validation schema for listing invoices with query pagination and filtering
export const listInvoicesSchema = z.object({
  query: z.object({
    page: z.preprocess((val) => (val ? parseInt(val, 10) : 1), z.number().int().min(1)).optional().default(1),
    limit: z.preprocess((val) => (val ? parseInt(val, 10) : 10), z.number().int().min(1).max(100)).optional().default(10),
    status: z.enum(['DRAFT', 'SENT', 'PAID', 'VOID', 'UNPAID']).optional(),
  }),
});

// Validation schema for retrieving a single invoice by ID
export const getInvoiceByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
});

// Validation schema for payment capture simulation and verification
export const payInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
  body: z.object({
    paymentId: z.string().optional(),
    gatewayPaymentId: z.string().optional(),
    gatewaySignature: z.string().optional(),
  }),
});

// Validation schema for generating Razorpay Order for checkout
export const checkoutInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
});

// Validation schema for starting/paying a subscription
export const checkoutSubscriptionSchema = z.object({
  body: z.object({
    planCode: z.string().min(1, 'planCode is required'),
    billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  }),
});


