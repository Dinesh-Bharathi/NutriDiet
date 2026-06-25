// src/modules/billing/repositories/base.repository.js
// Shared repository base — persistence utilities.

import prisma from '../../../lib/prisma.js';
import { handlePrismaError, RepositoryValidationError } from './billing.errors.js';
import { buildPrismaSkipTake } from '../../../utils/pagination.js';

export class BaseRepository {
  /**
   * @param {string} modelName - The name of the Prisma model (e.g. 'subscription', 'invoice')
   */
  constructor(modelName) {
    this.modelName = modelName;
  }

  /**
   * Dynamic execution client selector for transaction boundaries.
   *
   * @param {object} [options]
   * @param {object} [options.tx] - Optional Prisma transaction client
   * @returns {object} Prisma database client context
   */
  getClient(options) {
    return options?.tx || prisma;
  }

  /**
   * Enforces that tenantId parameter is a valid non-empty string.
   *
   * @param {string} tenantId
   * @throws {RepositoryValidationError}
   */
  validateTenantId(tenantId) {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new RepositoryValidationError('Operation aborted: Valid Tenant ID must be provided');
    }
  }

  /**
   * Safely wraps database operations, translating engine errors to domain exceptions.
   *
   * @param {Function} operation - Async function performing db queries
   * @param {string} customMessage - Description for error tracing
   * @returns {Promise<any>}
   */
  async execute(operation, customMessage) {
    try {
      return await operation();
    } catch (error) {
      handlePrismaError(error, customMessage);
    }
  }

  /**
   * Common soft-delete logic for tenant-owned records.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} [options]
   * @returns {Promise<number>} Number of affected records
   */
  async softDelete(tenantId, id, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    return this.execute(async () => {
      const result = await db[this.modelName].updateMany({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });
      return result.count;
    }, `Failed to soft delete record in ${this.modelName}`);
  }

  /**
   * Common existence check by ID for tenant-owned records.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} [options]
   * @returns {Promise<boolean>} True if record exists and is not soft-deleted
   */
  async existsById(tenantId, id, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    return this.execute(async () => {
      const count = await db[this.modelName].count({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
      });
      return count > 0;
    }, `Failed to check existence by ID in ${this.modelName}`);
  }

  /**
   * Shared pagination converter.
   *
   * @param {number} page
   * @param {number} limit
   * @returns {{ skip: number, take: number }}
   */
  getPaginationParams(page, limit) {
    return buildPrismaSkipTake(page, limit);
  }
}
