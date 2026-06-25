// src/modules/billing/razorpay.service.js
// Service wrapper for the Razorpay API Node SDK. Handles orders, subscriptions, and webhooks.

import Razorpay from 'razorpay';
import crypto from 'crypto';
import env from '../../config/env.js';
import logger from '../../config/logger.js';

// Resolve if we are running in sandbox mock mode (e.g. key is a fallback mock value)
const isMockMode = env.RAZORPAY_KEY_ID.startsWith('rzp_test_mock') || env.RAZORPAY_KEY_SECRET.startsWith('mockkey');

let razorpayClient = null;
if (!isMockMode) {
  try {
    razorpayClient = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
    logger.info('[RazorpayService] Initialized live Razorpay SDK client.');
  } catch (err) {
    logger.error(`[RazorpayService] Failed to initialize live client: ${err.message}. Falling back to Mock Mode.`);
    razorpayClient = null;
  }
} else {
  logger.info('[RazorpayService] Running in Sandbox Mock Mode (no live API requests will be fired).');
}

export const razorpayService = {
  /**
   * Helper to check if we are in mock sandbox mode.
   * @returns {boolean}
   */
  isMock() {
    return isMockMode || !razorpayClient;
  },

  /**
   * Creates a Razorpay Order for manual invoice checkout.
   * Note: Razorpay expects amounts in minor currency units (e.g. Paise for INR, Cents for USD).
   *
   * @param {number} amount - Amount in standard currency units (e.g. 999.00 INR)
   * @param {string} currency - e.g. 'INR'
   * @param {string} receiptId - Associated invoice/transaction CUID
   * @returns {Promise<object>} Order payload
   */
  async createOrder(amount, currency = 'INR', receiptId) {
    const amountInPaise = Math.round(amount * 100);

    if (this.isMock()) {
      logger.info(`[RazorpayService] [Mock] Created Order for amount ${amount} ${currency} (Receipt: ${receiptId})`);
      return {
        id: `order_mock_${Math.random().toString(36).substring(2, 11)}`,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency,
        receipt: receiptId,
        status: 'created',
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    try {
      return await razorpayClient.orders.create({
        amount: amountInPaise,
        currency,
        receipt: receiptId,
      });
    } catch (err) {
      logger.error(`[RazorpayService] createOrder failed: ${err.message}`);
      throw err;
    }
  },

  /**
   * Creates a Razorpay Subscription for automatic recurring billing.
   *
   * @param {string} planId - Razorpay Plan ID (e.g. plan_N12345)
   * @param {string} tenantId - Tenant ID context
   * @param {number} totalCount - Total billing periods (e.g. 12 for 1 year monthly)
   * @returns {Promise<object>} Subscription payload
   */
  async createSubscription(planId, tenantId, totalCount = 12) {
    if (this.isMock()) {
      logger.info(`[RazorpayService] [Mock] Created Subscription for plan ${planId} (Tenant: ${tenantId})`);
      return {
        id: `sub_mock_${Math.random().toString(36).substring(2, 11)}`,
        entity: 'subscription',
        plan_id: planId,
        status: 'created',
        current_start: Math.floor(Date.now() / 1000),
        current_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
        total_count: totalCount,
        customer_id: `cust_mock_${Math.random().toString(36).substring(2, 11)}`,
      };
    }

    try {
      return await razorpayClient.subscriptions.create({
        plan_id: planId,
        total_count: totalCount,
        quantity: 1,
        customer_notify: 1,
        notes: {
          tenantId,
        },
      });
    } catch (err) {
      logger.error(`[RazorpayService] createSubscription failed: ${err.message}`);
      throw err;
    }
  },

  /**
   * Cancels a subscription in Razorpay at period end or immediately.
   *
   * @param {string} gatewaySubscriptionId - Razorpay subscription ID (e.g. sub_N12345)
   * @param {boolean} immediate - Cancel immediately vs. cancel at period end
   * @returns {Promise<object>} Cancel response payload
   */
  async cancelSubscription(gatewaySubscriptionId, immediate = false) {
    if (this.isMock() || gatewaySubscriptionId.startsWith('sub_mock_')) {
      logger.info(`[RazorpayService] [Mock] Cancelled Subscription ${gatewaySubscriptionId} (Immediate: ${immediate})`);
      return {
        id: gatewaySubscriptionId,
        entity: 'subscription',
        status: 'cancelled',
        cancel_at_end: !immediate,
      };
    }

    try {
      return await razorpayClient.subscriptions.cancel(gatewaySubscriptionId, {
        cancel_at_end: !immediate,
      });
    } catch (err) {
      logger.error(`[RazorpayService] cancelSubscription failed: ${err.message}`);
      throw err;
    }
  },

  /**
   * Verifies the cryptographic HMAC signature of incoming webhooks.
   *
   * @param {string} rawBody - Raw HTTP request body string
   * @param {string} signature - x-razorpay-signature header value
   * @param {string} webhookSecret - Secret key associated with webhook configuration
   * @returns {boolean} True if signature matches
   */
  verifyWebhookSignature(rawBody, signature, webhookSecret) {
    if (this.isMock() && signature === 'mock_verify_signature') {
      return true;
    }

    try {
      const generatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      return generatedSignature === signature;
    } catch (err) {
      logger.error(`[RazorpayService] Webhook signature verification failed: ${err.message}`);
      return false;
    }
  },
};
