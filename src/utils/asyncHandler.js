// src/utils/asyncHandler.js
// ─────────────────────────────────────────────────────────────────────────────
// Wraps an async Express route handler so unhandled promise rejections are
// forwarded to the global error middleware via next(err).
//
// Without this wrapper every async controller would need its own try/catch,
// creating boilerplate and making it easy to accidentally swallow errors.
//
// Usage:
//   router.get('/resource', asyncHandler(async (req, res) => { ... }));
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Function} fn - An async Express route handler.
 * @returns {Function}  - Express-compatible middleware.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
