// src/utils/pagination.js
// ─────────────────────────────────────────────────────────────────────────────
// Pagination utilities used by repositories and controllers.
//
// All list endpoints must paginate. This module provides:
//  - parsePaginationParams  — safe parsing of page/limit from query strings
//  - buildPaginationMeta    — builds the meta block returned in every list response
//  - buildPrismaSkipTake    — converts page/limit to Prisma-compatible skip/take
// ─────────────────────────────────────────────────────────────────────────────
import { PAGINATION } from '../config/constants.js';

/**
 * Safely parses and clamps pagination parameters from an Express query object.
 *
 * @param {object} query - req.query
 * @returns {{ page: number, limit: number }}
 */
export function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT),
  );
  return { page, limit };
}

/**
 * Converts page/limit to Prisma skip/take values.
 *
 * @param {number} page
 * @param {number} limit
 * @returns {{ skip: number, take: number }}
 */
export function buildPrismaSkipTake(page, limit) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Builds the standard pagination meta block for list API responses.
 *
 * @param {object} params
 * @param {number} params.total   - Total number of matching records.
 * @param {number} params.page    - Current page.
 * @param {number} params.limit   - Items per page.
 * @returns {object} - Pagination meta object.
 */
export function buildPaginationMeta({ total, page, limit }) {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
