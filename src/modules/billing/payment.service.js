// src/modules/billing/payment.service.js
// Business logic for payments.

import prisma from '../../lib/prisma.js';
import { paymentRepository } from './repositories/payment.repository.js';
import { invoiceService } from './invoice.service.js';
import { billingEventBus } from './billing.event-bus.js';
import { PaymentNotFoundError, BillingBusinessError } from './billing.errors.js';

export const paymentService = {
  /**
   * Logs a new payment attempt.
   *
   * @param {string} tenantId
   * @param {string} invoiceId
   * @param {object} data - { amount, currency, gateway, gatewayOrderId }
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async createPaymentAttempt(tenantId, invoiceId, data, options = {}) {
    const db = options.tx || prisma;

    // Verify invoice exists and belongs to tenant
    const invoice = await invoiceService.getInvoiceById(tenantId, invoiceId, { tx: db });

    return paymentRepository.create(
      tenantId,
      {
        invoiceId,
        amount: data.amount ?? invoice.amount,
        currency: data.currency ?? invoice.currency,
        status: 'PENDING',
        gateway: data.gateway ?? 'RAZORPAY',
        gatewayOrderId: data.gatewayOrderId,
      },
      { tx: db }
    );
  },

  /**
   * Verifies and records a successful payment, triggers invoice settlement.
   *
   * @param {string} tenantId
   * @param {string} paymentId
   * @param {object} gatewayDetails - { gatewayPaymentId, gatewaySignature }
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async verifyAndRecordPayment(tenantId, paymentId, gatewayDetails, options = {}) {
    const db = options.tx || prisma;

    const runVerification = async (tx) => {
      const payment = await paymentRepository.findById(tenantId, paymentId, { tx });
      if (!payment) {
        throw new PaymentNotFoundError(`Payment attempt ${paymentId} not found`);
      }

      // Idempotency Guard: if already SUCCESSFUL, return immediately
      if (payment.status === 'SUCCESSFUL') {
        return payment;
      }

      // Update payment record status
      const updatedPayment = await paymentRepository.updateStatus(
        tenantId,
        paymentId,
        'SUCCESSFUL',
        {
          gatewayPaymentId: gatewayDetails.gatewayPaymentId,
          gatewaySignature: gatewayDetails.gatewaySignature,
        },
        { tx }
      );

      // Trigger invoice settlement (handles invoice state machine and activation events)
      await invoiceService.payInvoice(tenantId, payment.invoiceId, updatedPayment.id, { tx });

      billingEventBus.publish('PaymentSuccessful', {
        tenantId,
        paymentId: updatedPayment.id,
        invoiceId: payment.invoiceId,
        amount: Number(updatedPayment.amount),
      });

      return updatedPayment;
    };

    if (options.tx) {
      return runVerification(options.tx);
    } else {
      return prisma.$transaction(async (tx) => {
        return runVerification(tx);
      }, { timeout: 20000 });
    }
  },

  /**
   * Logs a failed payment attempt.
   *
   * @param {string} tenantId
   * @param {string} paymentId
   * @param {string} errorCode
   * @param {string} errorMessage
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async recordPaymentFailure(tenantId, paymentId, errorCode, errorMessage, options = {}) {
    const db = options.tx || prisma;

    const runFailure = async (tx) => {
      const payment = await paymentRepository.findById(tenantId, paymentId, { tx });
      if (!payment) {
        throw new PaymentNotFoundError(`Payment attempt ${paymentId} not found`);
      }

      // Do not overwrite successful payments
      if (payment.status === 'SUCCESSFUL') {
        throw new BillingBusinessError('Cannot fail an already successful payment');
      }

      const updatedPayment = await paymentRepository.updateStatus(
        tenantId,
        paymentId,
        'FAILED',
        {
          errorMessage: `[${errorCode}] ${errorMessage}`,
        },
        { tx }
      );

      billingEventBus.publish('PaymentFailed', {
        tenantId,
        paymentId: updatedPayment.id,
        invoiceId: payment.invoiceId,
        errorCode,
        errorMessage,
      });

      return updatedPayment;
    };

    if (options.tx) {
      return runFailure(options.tx);
    } else {
      return prisma.$transaction(async (tx) => {
        return runFailure(tx);
      }, { timeout: 20000 });
    }
  },

  /**
   * Lists payments with pagination.
   *
   * @param {string} tenantId
   * @param {object} filters
   * @param {object} pagination
   * @param {object} [options]
   * @returns {Promise<{ payments: Array<object>, pagination: object }>}
   */
  async listPayments(tenantId, filters = {}, pagination = {}, options = {}) {
    const [items, total] = await paymentRepository.findManyAndCount(tenantId, filters, pagination, options);
    return {
      payments: items,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total,
        totalPages: Math.ceil(total / (pagination.limit || 10)),
      },
    };
  },
};
