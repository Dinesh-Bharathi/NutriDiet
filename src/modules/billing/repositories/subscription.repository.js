// src/modules/billing/repositories/subscription.repository.js
// Database access for tenant subscriptions.

import { BaseRepository } from './base.repository.js';

class SubscriptionRepository extends BaseRepository {
  constructor() {
    super('subscription');
  }

  /**
   * Creates a subscription for a tenant.
   *
   * @param {string} tenantId
   * @param {object} data
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async create(tenantId, data, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.subscription.create({
        data: {
          ...data,
          tenantId,
        },
        include: {
          plan: true,
        },
      });
    }, 'Failed to create subscription');
  }

  /**
   * Finds a subscription by ID. Enforces tenant isolation.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} [options]
   * @returns {Promise<object|null>}
   */
  async findById(tenantId, id, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.subscription.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        include: {
          plan: true,
        },
      });
    }, 'Failed to retrieve subscription');
  }

  /**
   * Retrieves the currently active or trialing subscription for a tenant.
   *
   * @param {string} tenantId
   * @param {object} [options]
   * @returns {Promise<object|null>}
   */
  async findActiveByTenant(tenantId, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.subscription.findFirst({
        where: {
          tenantId,
          status: {
            in: ['active', 'trialing', 'past_due'],
          },
          deletedAt: null,
        },
        orderBy: {
          currentPeriodEnd: 'desc',
        },
        include: {
          plan: true,
        },
      });
    }, 'Failed to retrieve active subscription');
  }

  /**
   * Finds a subscription by gatewaySubscriptionId (webhook ingestion mapping).
   * Note: tenantId is not passed here since we are mapping from incoming webhook.
   *
   * @param {string} gatewaySubscriptionId
   * @param {object} [options]
   * @returns {Promise<object|null>}
   */
  async findByGatewaySubscriptionId(gatewaySubscriptionId, options = {}) {
    if (!gatewaySubscriptionId) return null;
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.subscription.findFirst({
        where: {
          gatewaySubscriptionId,
          deletedAt: null,
        },
        include: {
          plan: true,
        },
      });
    }, 'Failed to retrieve subscription by gateway subscription ID');
  }

  /**
   * Updates an existing subscription. Enforces tenant isolation.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} data
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async update(tenantId, id, data, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    return this.execute(async () => {
      // Find first to verify tenant ownership before update
      const existing = await db.subscription.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) {
        throw new Error('Record not found');
      }

      return db.subscription.update({
        where: { id },
        data,
        include: {
          plan: true,
        },
      });
    }, 'Failed to update subscription');
  }

  /**
   * Lists subscriptions with pagination and status filters.
   *
   * @param {string} tenantId
   * @param {object} filters - { planId, status }
   * @param {object} pagination - { page, limit }
   * @param {object} [options]
   * @returns {Promise<[Array<object>, number]>}
   */
  async findManyAndCount(tenantId, filters = {}, pagination = {}, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    const { planId, status } = filters;
    const { page = 1, limit = 10 } = pagination;

    const where = {
      tenantId,
      deletedAt: null,
    };

    if (planId) {
      where.planId = planId;
    }

    if (status) {
      where.status = status;
    }

    const { skip, take } = this.getPaginationParams(page, limit);

    return this.execute(async () => {
      const [items, total] = await Promise.all([
        db.subscription.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            plan: true,
          },
        }),
        db.subscription.count({ where }),
      ]);
      return [items, total];
    }, 'Failed to list subscriptions');
  }
}

export const subscriptionRepository = new SubscriptionRepository();
