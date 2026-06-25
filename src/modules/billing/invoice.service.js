// src/modules/billing/invoice.service.js
// Business logic for invoices.

import prisma from '../../lib/prisma.js';
import { invoiceRepository } from './repositories/invoice.repository.js';
import { invoiceNumberService } from './invoice-number.service.js';
import { billingEventBus } from './billing.event-bus.js';
import { InvoiceNotFoundError, InvoiceAlreadyPaidError } from './billing.errors.js';

export const invoiceService = {
  /**
   * Generates a new invoice with atomic sequential numbering.
   *
   * @param {string} tenantId
   * @param {object} data - { subscriptionId, amount, currency, dueDate, billingEmail, items: [{ description, amount, quantity }] }
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async createInvoice(tenantId, data, options = {}) {
    const db = options.tx || prisma;
    const { items, ...invoiceData } = data;

    // Execute within transaction scope if none is active to guarantee atomic sequence lock
    const runCreation = async (txClient) => {
      const invoiceNumber = await invoiceNumberService.generateNextNumber({ tx: txClient });
      const createdInvoice = await invoiceRepository.create(
        tenantId,
        {
          ...invoiceData,
          invoiceNumber,
          items,
        },
        { tx: txClient }
      );

      billingEventBus.publish('InvoiceCreated', {
        tenantId,
        invoiceId: createdInvoice.id,
        amount: Number(createdInvoice.amount),
        dueDate: createdInvoice.dueDate,
      });

      return createdInvoice;
    };

    if (options.tx) {
      return runCreation(options.tx);
    } else {
      return prisma.$transaction(async (tx) => {
        return runCreation(tx);
      }, { timeout: 20000 });
    }
  },

  /**
   * Retrieves an invoice by ID.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} [options]
   * @returns {Promise<object>}
   * @throws {InvoiceNotFoundError}
   */
  async getInvoiceById(tenantId, id, options = {}) {
    const invoice = await invoiceRepository.findById(tenantId, id, options);
    if (!invoice) {
      throw new InvoiceNotFoundError(`Invoice with ID ${id} not found`);
    }
    return invoice;
  },

  /**
   * Retrieves an invoice by public invoice number.
   *
   * @param {string} tenantId
   * @param {string} invoiceNumber
   * @param {object} [options]
   * @returns {Promise<object>}
   * @throws {InvoiceNotFoundError}
   */
  async getInvoiceByNumber(tenantId, invoiceNumber, options = {}) {
    const invoice = await invoiceRepository.findByInvoiceNumber(tenantId, invoiceNumber, options);
    if (!invoice) {
      throw new InvoiceNotFoundError(`Invoice ${invoiceNumber} not found`);
    }
    return invoice;
  },

  /**
   * Settles an invoice. Enforces strict payment idempotency.
   *
   * @param {string} tenantId
   * @param {string} invoiceId
   * @param {string} [paymentId] - Optional payment transaction reference
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async payInvoice(tenantId, invoiceId, paymentId = null, options = {}) {
    const runPayment = async (tx) => {
      const invoice = await invoiceRepository.findById(tenantId, invoiceId, { tx });
      if (!invoice) {
        throw new InvoiceNotFoundError(`Invoice ${invoiceId} not found`);
      }

      // Idempotency Guard: return immediately if invoice is already PAID
      if (invoice.status === 'PAID') {
        return invoice;
      }

      const updated = await invoiceRepository.updateStatus(
        tenantId,
        invoiceId,
        'PAID',
        { paidAt: new Date() },
        { tx }
      );

      billingEventBus.publish('InvoicePaid', {
        tenantId,
        invoiceId: updated.id,
        subscriptionId: updated.subscriptionId,
        amount: Number(updated.amount),
        paymentId,
      });

      return updated;
    };

    if (options.tx) {
      return runPayment(options.tx);
    } else {
      return prisma.$transaction(async (tx) => {
        return runPayment(tx);
      }, { timeout: 20000 });
    }
  },

  /**
   * Voids an invoice.
   *
   * @param {string} tenantId
   * @param {string} invoiceId
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async voidInvoice(tenantId, invoiceId, options = {}) {
    const invoice = await this.getInvoiceById(tenantId, invoiceId, options);
    if (invoice.status === 'PAID') {
      throw new InvoiceAlreadyPaidError('Cannot void a paid invoice');
    }

    return invoiceRepository.updateStatus(tenantId, invoiceId, 'VOID', {}, options);
  },

  /**
   * Lists invoices with pagination.
   *
   * @param {string} tenantId
   * @param {object} filters
   * @param {object} pagination
   * @param {object} [options]
   * @returns {Promise<{ invoices: Array<object>, pagination: object }>}
   */
  async listInvoices(tenantId, filters = {}, pagination = {}, options = {}) {
    const [items, total] = await invoiceRepository.findManyAndCount(tenantId, filters, pagination, options);
    return {
      invoices: items,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total,
        totalPages: Math.ceil(total / (pagination.limit || 10)),
      },
    };
  },
};
