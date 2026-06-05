// src/middlewares/validate.middleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Zod-based request validation middleware factory.
//
// Usage in a route file:
//   import { validate } from '../../middlewares/validate.middleware.js';
//   import { createClientSchema } from '../../validators/client.validator.js';
//
//   router.post('/', validate(createClientSchema), asyncHandler(clientController.create));
//
// The schema can validate req.body, req.query, and/or req.params simultaneously.
// Field-level errors are normalised into the standard error array format.
// ─────────────────────────────────────────────────────────────────────────────

import ApiError from '../utils/ApiError.js';

/**
 * Normalises a ZodError into a flat array of { field, message } objects.
 *
 * @param {ZodError} zodError
 * @returns {Array<{ field: string, message: string }>}
 */
function normaliseZodErrors(zodError) {
  return zodError.errors.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));
}

/**
 * Creates a validation middleware from a Zod schema.
 * The schema should be a z.object() containing optional body / query / params keys.
 *
 * @param {import('zod').ZodSchema} schema
 * @returns {import('express').RequestHandler}
 *
 * @example
 * const mySchema = z.object({
 *   body: z.object({ name: z.string().min(1) }),
 *   query: z.object({ page: z.coerce.number().optional() }),
 * });
 * router.post('/', validate(mySchema), handler);
 */
export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const errors = normaliseZodErrors(result.error);
      return next(ApiError.badRequest('Validation failed', errors));
    }

    // Attach parsed (and typed) data back to the request
    if (result.data.body !== undefined) req.body = result.data.body;
    if (result.data.query !== undefined) req.query = result.data.query;
    if (result.data.params !== undefined) req.params = result.data.params;

    return next();
  };
}
