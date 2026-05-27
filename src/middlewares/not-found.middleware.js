// src/middlewares/not-found.middleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Catch-all for unmatched routes.
// Must be registered AFTER all routes but BEFORE the error middleware.
// ─────────────────────────────────────────────────────────────────────────────
import ApiError from '../utils/ApiError.js';

/**
 * Generates a 404 ApiError for any request that falls through all routes.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export function notFoundMiddleware(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl}`));
}
