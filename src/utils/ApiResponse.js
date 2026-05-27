// src/utils/ApiResponse.js
// ─────────────────────────────────────────────────────────────────────────────
// Standardised JSON response envelope.
// Every controller must use sendSuccess / sendError helpers so the API surface
// is consistent for all consumers (web, mobile, integrations).
//
// Success shape:
//   { success: true,  message, data, meta }
//
// Error shape:
//   { success: false, message, errors }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a standardised success response.
 *
 * @param {import('express').Response} res
 * @param {number}  statusCode  - HTTP 2xx status code.
 * @param {string}  message     - Human-readable success message.
 * @param {*}       [data=null] - Response payload.
 * @param {object}  [meta={}]   - Pagination or additional metadata.
 */
export function sendSuccess(res, statusCode, message, data = null, meta = {}) {
  const body = {
    success: true,
    message,
  };

  if (data !== null && data !== undefined) {
    body.data = data;
  }

  if (Object.keys(meta).length > 0) {
    body.meta = meta;
  }

  return res.status(statusCode).json(body);
}

/**
 * Sends a standardised error response.
 * This helper is invoked by the global error middleware — controllers should
 * throw ApiError instead of calling this directly.
 *
 * @param {import('express').Response} res
 * @param {number}   statusCode - HTTP 4xx / 5xx status code.
 * @param {string}   message    - Human-readable error message.
 * @param {Array}    [errors=[]] - Field-level validation errors.
 */
export function sendError(res, statusCode, message, errors = []) {
  const body = {
    success: false,
    message,
  };

  if (errors.length > 0) {
    body.errors = errors;
  }

  return res.status(statusCode).json(body);
}
