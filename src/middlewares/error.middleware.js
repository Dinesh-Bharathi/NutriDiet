// src/middlewares/error.middleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Global error handling middleware.
// Must be registered LAST in the Express middleware stack.
//
// Handles:
//  - Operational ApiErrors  → structured JSON response
//  - Prisma known errors    → mapped to appropriate HTTP codes
//  - JWT errors             → 401 Unauthorized
//  - Unknown programmer errors → 500, log full stack in production
// ─────────────────────────────────────────────────────────────────────────────
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
const { JsonWebTokenError, TokenExpiredError } = jwt;
import ApiError from '../utils/ApiError.js';
import { sendError } from '../utils/ApiResponse.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Maps Prisma client known request errors to ApiErrors.
 *
 * @param {Prisma.PrismaClientKnownRequestError} err
 * @returns {ApiError}
 */
function handlePrismaError(err) {
  switch (err.code) {
    case 'P2002': {
      // Unique constraint violation
      const fields = err.meta?.target?.join(', ') ?? 'field';
      return ApiError.conflict(`A record with this ${fields} already exists`);
    }
    case 'P2025':
      // Record not found (e.g. update/delete on non-existent row)
      return ApiError.notFound('Record');
    case 'P2003':
      return ApiError.badRequest('Related record not found (foreign key constraint)');
    case 'P2014':
      return ApiError.badRequest('Invalid relationship data');
    default:
      logger.error('Unhandled Prisma error', { code: err.code, meta: err.meta });
      return ApiError.internal('A database error occurred');
  }
}

/**
 * Express global error handler.
 * Signature must be (err, req, res, next) — 4 arguments — for Express to
 * treat it as an error-handling middleware.
 */
// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, next) {
  let error = err;

  // ── Prisma known request errors ──────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  }

  // ── Prisma validation errors ─────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientValidationError) {
    error = ApiError.badRequest('Invalid data provided to the database layer');
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err instanceof TokenExpiredError) {
    error = ApiError.unauthorized('Token has expired, please login again');
  }

  if (err instanceof JsonWebTokenError) {
    error = ApiError.unauthorized('Invalid token');
  }

  // ── Ensure we have an ApiError at this point ──────────────────────────────
  if (!(error instanceof ApiError)) {
    const statusCode = err.statusCode ?? HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const message = env.IS_PRODUCTION
      ? 'An unexpected error occurred'
      : (err.message || 'An unexpected error occurred');

    error = new ApiError(statusCode, message);
  }

  // ── Log the error ─────────────────────────────────────────────────────────
  if (error.statusCode >= 500) {
    logger.error('Server error', {
      message: error.message,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
      stack: error.stack,
    });
  } else {
    logger.warn('Client error', {
      message: error.message,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
    });
  }

  // ── Send response ─────────────────────────────────────────────────────────
  return sendError(
    res,
    error.statusCode,
    error.message,
    error.errors ?? [],
  );
}
