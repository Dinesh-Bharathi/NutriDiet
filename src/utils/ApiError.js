// src/utils/ApiError.js
// ─────────────────────────────────────────────────────────────────────────────
// Custom error class for all operational errors in the application.
// By setting isOperational = true we distinguish between expected business
// errors (validation failures, not-found, auth) and unexpected programmer
// errors (null pointer, schema mismatches) in the global error handler.
// ─────────────────────────────────────────────────────────────────────────────
import { HTTP_STATUS } from '../config/constants.js';

export class ApiError extends Error {
  /**
   * @param {number}   statusCode  - HTTP status code.
   * @param {string}   message     - Human-readable error message.
   * @param {Array}    [errors=[]] - Optional array of field-level error objects.
   * @param {string}   [stack='']  - Optional pre-built stack trace.
   */
  constructor(statusCode, message, errors = [], stack = '') {
    super(message);

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.isOperational = true;       // Signals: expected / handled error

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // ── Convenience factory methods ───────────────────────────────────────────

  static badRequest(message = 'Bad request', errors = []) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message);
  }

  static notFound(resource = 'Resource') {
    return new ApiError(HTTP_STATUS.NOT_FOUND, `${resource} not found`);
  }

  static conflict(message = 'Resource already exists') {
    return new ApiError(HTTP_STATUS.CONFLICT, message);
  }

  static unprocessable(message = 'Unprocessable entity', errors = []) {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, errors);
  }

  static tooManyRequests(message = 'Too many requests, please try again later') {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
}

export default ApiError;
