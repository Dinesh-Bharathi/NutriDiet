// src/modules/billing/repositories/plan.repository.js
// Database access for global billing plans.

import { BaseRepository } from './base.repository.js';

class PlanRepository extends BaseRepository {
  constructor() {
    super('plan');
  }

  /**
   * Retrieves all plans. By default filters active and non-deleted plans.
   *
   * @param {object} [options]
   * @param {boolean} [options.includeDeleted=false]
   * @param {boolean} [options.includeInactive=false]
   * @param {object} [options.tx]
   * @returns {Promise<Array<object>>}
   */
  async findAll(options = {}) {
    const db = this.getClient(options);
    const { includeDeleted = false, includeInactive = false } = options;

    const where = {};
    if (!includeDeleted) {
      where.deletedAt = null;
    }
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.execute(async () => {
      return db.plan.findMany({
        where,
        orderBy: { name: 'asc' },
      });
    }, 'Failed to retrieve plans');
  }

  /**
   * Finds a plan by its ID.
   *
   * @param {string} id
   * @param {object} [options]
   * @returns {Promise<object|null>}
   */
  async findById(id, options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.plan.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });
    }, 'Failed to find plan by ID');
  }

  /**
   * Finds a plan by its unique code (e.g. 'FREE_TRIAL', 'STARTER').
   *
   * @param {string} code
   * @param {object} [options]
   * @returns {Promise<object|null>}
   */
  async findByCode(code, options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.plan.findFirst({
        where: {
          code,
          deletedAt: null,
        },
      });
    }, 'Failed to find plan by code');
  }

  /**
   * Optimized existence check by plan ID.
   *
   * @param {string} id
   * @param {object} [options]
   * @returns {Promise<boolean>}
   */
  async existsById(id, options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      const count = await db.plan.count({
        where: {
          id,
          deletedAt: null,
        },
      });
      return count > 0;
    }, 'Failed to check plan existence by ID');
  }

  /**
   * Optimized existence check by plan code.
   *
   * @param {string} code
   * @param {object} [options]
   * @returns {Promise<boolean>}
   */
  async existsByCode(code, options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      const count = await db.plan.count({
        where: {
          code,
          deletedAt: null,
        },
      });
      return count > 0;
    }, 'Failed to check plan existence by code');
  }

  /**
   * Admin/System-level creation of a subscription plan.
   *
   * @param {object} data
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async create(data, options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.plan.create({
        data,
      });
    }, 'Failed to create plan');
  }

  /**
   * Admin/System-level update of a subscription plan.
   *
   * @param {string} id
   * @param {object} data
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async update(id, data, options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.plan.update({
        where: { id },
        data,
      });
    }, 'Failed to update plan');
  }

  /**
   * Soft deletes a global subscription plan (overriding base softDelete to remove tenant checks).
   *
   * @param {string} id
   * @param {object} [options]
   * @returns {Promise<number>}
   */
  async softDelete(id, options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      const result = await db.plan.updateMany({
        where: {
          id,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });
      return result.count;
    }, 'Failed to soft delete plan');
  }
}

export const planRepository = new PlanRepository();
