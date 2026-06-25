// src/modules/billing/webhook.service.js
// Business logic for webhook event routing.

import prisma from '../../lib/prisma.js';
import { webhookRepository } from './repositories/webhook.repository.js';
import { subscriptionRepository } from './repositories/subscription.repository.js';
import { paymentRepository } from './repositories/payment.repository.js';
import { paymentService } from './payment.service.js';
import { subscriptionService } from './subscription.service.js';
import { billingEventBus } from './billing.event-bus.js';
import { BillingBusinessError } from './billing.errors.js';
import logger from '../../config/logger.js';

export const webhookService = {
  /**
   * Safe signature verification logic (mocked for Phase 1C verification).
   *
   * @param {string} rawBody
   * @param {string} signature
   * @param {string} secret
   * @returns {boolean}
   */
  verifySignature(rawBody, signature, secret) {
    if (!signature || !secret) return false;
    // In future phases, Razorpay/Stripe crypto verification happens here.
    return true;
  },

  /**
   * Main entry point to ingest and route webhooks idempotently.
   *
   * @param {string} gateway - 'RAZORPAY' | 'STRIPE'
   * @param {string} eventId - Unique event identifier from gateway
   * @param {string} eventType - Type of event (e.g. 'payment.captured')
   * @param {object} payload - Parsed JSON event body
   * @returns {Promise<object>} Ingested webhook record
   */
  async processWebhook(gateway, eventId, eventType, payload) {
    // 1. Ingest event atomically to enforce idempotency
    const webhook = await prisma.$transaction(async (tx) => {
      const existing = await webhookRepository.findByEventId(gateway, eventId, { tx });
      if (existing) {
        // Idempotency Guard: event already processed or currently processing
        if (existing.status === 'PROCESSED' || existing.status === 'PROCESSING') {
          logger.info(`[WebhookService] Event ${eventId} ignored (already ${existing.status})`);
          return existing;
        }
        return existing;
      }

      const created = await webhookRepository.create(
        {
          gateway,
          eventId,
          eventType,
          payload,
          status: 'RECEIVED',
        },
        { tx }
      );

      billingEventBus.publish('WebhookReceived', {
        gateway,
        eventId,
        eventType,
      });

      return created;
    }, { timeout: 20000 });

    // If already processed/processing in prior transaction, exit immediately
    if (webhook.status === 'PROCESSED' || webhook.status === 'PROCESSING') {
      return webhook;
    }

    // 2. Process and route the webhook event
    try {
      // Transition to PROCESSING
      await webhookRepository.markProcessing(webhook.id);

      // Route event types
      if (eventType === 'payment.captured') {
        await this._handlePaymentCaptured(payload);
      } else if (eventType === 'subscription.charged') {
        await this._handleSubscriptionCharged(payload);
      } else if (eventType === 'subscription.cancelled') {
        await this._handleSubscriptionCancelled(payload);
      } else {
        logger.info(`[WebhookService] Event type ${eventType} has no routing handler; skipping.`);
      }

      // Transition to PROCESSED
      return webhookRepository.markProcessed(webhook.id);
    } catch (error) {
      logger.error(`[WebhookService] Webhook processing failed for event ${eventId}: ${error.message}`);
      // Transition to FAILED with diagnostics details
      return webhookRepository.markFailed(webhook.id, error.message);
    }
  },

  /**
   * Routing handler for payment.captured event.
   */
  async _handlePaymentCaptured(payload) {
    const { gatewayPaymentId, gatewayOrderId, gatewaySignature } = payload;

    // Find the associated payment attempt by gatewayOrderId or gatewayPaymentId
    let payment = await paymentRepository.findByGatewayPaymentId(gatewayPaymentId);
    if (!payment && gatewayOrderId) {
      // Fallback search by order ID
      const [paymentsList] = await paymentRepository.findManyAndCount(
        payload.tenantId, // Must be passed in payload or resolved
        { status: 'PENDING', gatewayOrderId }
      );
      payment = paymentsList[0];
    }

    if (!payment) {
      throw new BillingBusinessError(`Associated payment record not found for capture: ${gatewayPaymentId}`);
    }

    // Resolve tenantId from the matched record to preserve security boundary
    const tenantId = payment.tenantId;

    // Settle the payment
    await paymentService.verifyAndRecordPayment(tenantId, payment.id, {
      gatewayPaymentId,
      gatewaySignature,
    });
  },

  /**
   * Routing handler for subscription.charged event (recurring renewals).
   */
  async _handleSubscriptionCharged(payload) {
    const { gatewaySubscriptionId, gatewayPaymentId } = payload;
    const subscription = await subscriptionRepository.findByGatewaySubscriptionId(gatewaySubscriptionId);
    if (!subscription) {
      throw new BillingBusinessError(`Subscription ${gatewaySubscriptionId} not found for renewal`);
    }

    // Renew subscription dates
    await subscriptionService.renewSubscription(subscription.tenantId, subscription.id);
  },

  /**
   * Routing handler for subscription.cancelled event.
   */
  async _handleSubscriptionCancelled(payload) {
    const { gatewaySubscriptionId } = payload;
    const subscription = await subscriptionRepository.findByGatewaySubscriptionId(gatewaySubscriptionId);
    if (!subscription) {
      throw new BillingBusinessError(`Subscription ${gatewaySubscriptionId} not found for cancellation`);
    }

    // Cancel subscription immediately
    await subscriptionService.cancelSubscription(subscription.tenantId, subscription.id, true);
  },
};
