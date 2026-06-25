// src/modules/billing/repositories/payment.repository.js
// Database access for payment transactions.

import { BaseRepository } from './base.repository.js';

class PaymentRepository extends BaseRepository {
  constructor() {
    super('payment');
  }

  /**
   * Logs a new payment attempt.
   *
   * @param {string} tenantId
   * @param {object} data - { invoiceId, amount, currency, status, gateway, gatewayPaymentId, gatewayOrderId, gatewaySignature, errorMessage, metadata }
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async create(tenantId, data, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.payment.create({
        data: {
          ...data,
          tenantId,
        },
      });
    }, 'Failed to create payment record');
  }

  /**
   * Retrieves a payment by ID. Enforces tenant isolation.
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
      return db.payment.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
      });
    }, 'Failed to retrieve payment record');
  }

  /**
   * Finds a payment by gatewayPaymentId (webhook ingestion mapping).
   * Note: tenantId is omitted here as it maps from incoming webhooks.
   *
   * @param {string} gatewayPaymentId
   * @param {object} [options]
   * @returns {Promise<object|null>}
   */
  async findByGatewayPaymentId(gatewayPaymentId, options = {}) {
    if (!gatewayPaymentId) return null;
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.payment.findFirst({
        where: {
          gatewayPaymentId,
          deletedAt: null,
        },
      });
    }, 'Failed to retrieve payment by gateway payment ID');
  }

  /**
   * Optimized existence check by gateway payment ID.
   *
   * @param {string} gatewayPaymentId
   * @param {object} [options]
   * @returns {Promise<boolean>}
   */
  async existsByGatewayPaymentId(gatewayPaymentId, options = {}) {
    if (!gatewayPaymentId) return false;
    const db = this.getClient(options);
    return this.execute(async () => {
      const count = await db.payment.count({
        where: {
          gatewayPaymentId,
          deletedAt: null,
        },
      });
      return count > 0;
    }, 'Failed to check payment existence by gateway payment ID');
  }

  /**
   * Updates payment transaction status. Enforces tenant isolation.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {string} status - PaymentStatus value
   * @param {object} [extraData] - Additional data: gatewaySignature, errorMessage, metadata
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async updateStatus(tenantId, id, status, extraData = {}, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    return this.execute(async () => {
      // Verify tenant ownership first
      const existing = await db.payment.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) {
        throw new Error('Record not found');
      }

      return db.payment.update({
        where: { id },
        data: {
          status,
          ...extraData,
        },
      });
    }, 'Failed to update payment status');
  }

  /**
   * Lists payments with pagination and filters.
   *
   * @param {string} tenantId
   * @param {object} filters - { status, invoiceId }
   * @param {object} pagination - { page, limit }
   * @param {object} [options]
   * @returns {Promise<[Array<object>, number]>}
   */
  async findManyAndCount(tenantId, filters = {}, pagination = {}, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    const { status, invoiceId } = filters;
    const { page = 1, limit = 10 } = pagination;

    const where = {
      tenantId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    const { skip, take } = this.getPaginationParams(page, limit);

    return this.execute(async () => {
      const [items, total] = await Promise.all([
        db.payment.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        db.payment.count({ where }),
      ]);
      return [items, total];
    }, 'Failed to list payments');
  }
}

export const paymentRepository = new PaymentRepository();
