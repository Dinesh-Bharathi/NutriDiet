// src/modules/billing/repositories/invoice.repository.js
// Database access for invoices.

import { BaseRepository } from './base.repository.js';

class InvoiceRepository extends BaseRepository {
  constructor() {
    super('invoice');
  }

  /**
   * Atomically creates an invoice along with its line items.
   *
   * @param {string} tenantId
   * @param {object} data - { invoiceNumber, amount, currency, dueDate, billingEmail, pdfUrl, subscriptionId, items: [{ description, amount, quantity }] }
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async create(tenantId, data, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    const { items, ...invoiceData } = data;

    return this.execute(async () => {
      return db.invoice.create({
        data: {
          ...invoiceData,
          tenantId,
          items: items ? {
            create: items.map(item => ({
              description: item.description,
              amount: item.amount,
              quantity: item.quantity ?? 1,
            })),
          } : undefined,
        },
        include: {
          items: true,
        },
      });
    }, 'Failed to create invoice');
  }

  /**
   * Finds an invoice by ID. Enforces tenant isolation.
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
      return db.invoice.findFirst({
        where: {
          id,
          tenantId,
          deletedAt: null,
        },
        include: {
          items: true,
          payments: true,
        },
      });
    }, 'Failed to retrieve invoice');
  }

  /**
   * Finds an invoice by its public invoice number. Enforces tenant isolation.
   *
   * @param {string} tenantId
   * @param {string} invoiceNumber
   * @param {object} [options]
   * @returns {Promise<object|null>}
   */
  async findByInvoiceNumber(tenantId, invoiceNumber, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.invoice.findFirst({
        where: {
          invoiceNumber,
          tenantId,
          deletedAt: null,
        },
        include: {
          items: true,
        },
      });
    }, 'Failed to retrieve invoice by number');
  }

  /**
   * Optimized existence check by invoice number.
   *
   * @param {string} tenantId
   * @param {string} invoiceNumber
   * @param {object} [options]
   * @returns {Promise<boolean>}
   */
  async existsByInvoiceNumber(tenantId, invoiceNumber, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    return this.execute(async () => {
      const count = await db.invoice.count({
        where: {
          invoiceNumber,
          tenantId,
          deletedAt: null,
        },
      });
      return count > 0;
    }, 'Failed to check invoice existence by invoice number');
  }

  /**
   * Updates an invoice status (e.g. PAID, VOID) and logs payment timestamps if applicable.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {string} status - InvoiceStatus value
   * @param {object} [extraData] - Additional fields like paidAt, pdfUrl, metadata
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async updateStatus(tenantId, id, status, extraData = {}, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    return this.execute(async () => {
      // Verify tenant ownership first
      const existing = await db.invoice.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) {
        throw new Error('Record not found');
      }

      return db.invoice.update({
        where: { id },
        data: {
          status,
          ...extraData,
        },
        include: {
          items: true,
        },
      });
    }, 'Failed to update invoice status');
  }

  /**
   * Lists invoices with pagination and status filters.
   *
   * @param {string} tenantId
   * @param {object} filters - { status, subscriptionId }
   * @param {object} pagination - { page, limit }
   * @param {object} [options]
   * @returns {Promise<[Array<object>, number]>}
   */
  async findManyAndCount(tenantId, filters = {}, pagination = {}, options = {}) {
    this.validateTenantId(tenantId);
    const db = this.getClient(options);
    const { status, subscriptionId } = filters;
    const { page = 1, limit = 10 } = pagination;

    const where = {
      tenantId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (subscriptionId) {
      where.subscriptionId = subscriptionId;
    }

    const { skip, take } = this.getPaginationParams(page, limit);

    return this.execute(async () => {
      const [items, total] = await Promise.all([
        db.invoice.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
          },
        }),
        db.invoice.count({ where }),
      ]);
      return [items, total];
    }, 'Failed to list invoices');
  }
}

export const invoiceRepository = new InvoiceRepository();
