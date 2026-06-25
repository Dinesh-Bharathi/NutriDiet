// src/modules/billing/subscription.service.js
// Business logic for subscription operations.

import prisma from '../../lib/prisma.js';
import logger from '../../config/logger.js';
import { subscriptionRepository } from './repositories/subscription.repository.js';
import { planService } from './plan.service.js';
import { billingEventBus } from './billing.event-bus.js';
import {
  SubscriptionNotFoundError,
  ActiveSubscriptionCollisionError,
  InvalidSubscriptionTransitionError,
  BillingBusinessError,
} from './billing.errors.js';

const VALID_TRANSITIONS = {
  trialing: ['active', 'expired', 'cancelled'],
  active: ['past_due', 'cancelled'],
  past_due: ['active', 'suspended'],
  cancelled: ['active'],
  expired: ['active'],
  suspended: ['active'],
};

/**
 * Validates status transitions against subscription state machine.
 */
function validateTransition(currentStatus, nextStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(nextStatus)) {
    throw new InvalidSubscriptionTransitionError(
      `Invalid subscription transition from ${currentStatus} to ${nextStatus}`
    );
  }
}

/**
 * Resolves period duration in days based on billing cycle.
 */
function getCycleDays(cycle) {
  switch (cycle) {
    case 'MONTHLY': return 30;
    case 'QUARTERLY': return 90;
    case 'HALF_YEARLY': return 180;
    case 'YEARLY': return 365;
    default: return 30;
  }
}

export const subscriptionService = {
  /**
   * Starts a free trial for a tenant.
   *
   * @param {string} tenantId
   * @param {string} planCode
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async startTrial(tenantId, planCode, options = {}) {
    const db = options.tx || prisma;
    const plan = await planService.getPlanByCode(planCode, { tx: db });

    const runStartTrial = async (tx) => {
      // Check collision: tenant must not have an active subscription
      const existingActive = await subscriptionRepository.findActiveByTenant(tenantId, { tx });
      if (existingActive) {
        throw new ActiveSubscriptionCollisionError('Tenant already has an active subscription/trial');
      }

      const trialDays = plan.code === 'FREE_TRIAL' ? 14 : 7; // Trial duration logic
      const now = new Date();
      const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

      const sub = await subscriptionRepository.create(
        tenantId,
        {
          planId: plan.id,
          status: 'trialing',
          billingCycle: 'MONTHLY', // Default cycle for trials
          startDate: now,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          trialStart: now,
          trialEnd: trialEnd,
        },
        { tx }
      );

      billingEventBus.publish('TrialStarted', {
        tenantId,
        subscriptionId: sub.id,
        planId: plan.id,
        trialEnd,
      });

      return sub;
    };

    if (options.tx) {
      return runStartTrial(options.tx);
    } else {
      return prisma.$transaction(async (tx) => {
        return runStartTrial(tx);
      }, { timeout: 20000 });
    }
  },

  /**
   * Retrieves subscription by ID. Enforces tenant scope.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} [options]
   * @returns {Promise<object>}
   * @throws {SubscriptionNotFoundError}
   */
  async getSubscriptionById(tenantId, id, options = {}) {
    const sub = await subscriptionRepository.findById(tenantId, id, options);
    if (!sub) {
      throw new SubscriptionNotFoundError(`Subscription ${id} not found`);
    }
    return sub;
  },

  /**
   * Activates a subscription (e.g. captures first payment, transitions from trialing/expired).
   *
   * @param {string} tenantId
   * @param {string} subscriptionId
   * @param {object} [gatewayDetails]
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async activateSubscription(tenantId, subscriptionId, gatewayDetails = {}, options = {}) {
    const db = options.tx || prisma;

    const runActivation = async (tx) => {
      const sub = await subscriptionRepository.findById(tenantId, subscriptionId, { tx });
      if (!sub) {
        throw new SubscriptionNotFoundError(`Subscription ${subscriptionId} not found`);
      }

      // Idempotency Guard: if already active, return immediately without changes
      if (sub.status === 'active') {
        return sub;
      }

      validateTransition(sub.status, 'active');

      const now = new Date();
      const cycleDays = getCycleDays(sub.billingCycle);
      const periodEnd = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000);

      const updated = await subscriptionRepository.update(
        tenantId,
        subscriptionId,
        {
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          gatewaySubscriptionId: gatewayDetails.gatewaySubscriptionId ?? sub.gatewaySubscriptionId,
          gatewayCustomerId: gatewayDetails.gatewayCustomerId ?? sub.gatewayCustomerId,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
        { tx }
      );

      billingEventBus.publish('SubscriptionActivated', {
        tenantId,
        subscriptionId: updated.id,
        planId: updated.planId,
        periodEnd,
      });

      return updated;
    };

    if (options.tx) {
      return runActivation(options.tx);
    } else {
      return prisma.$transaction(async (tx) => {
        return runActivation(tx);
      }, { timeout: 20000 });
    }
  },

  /**
   * Renews a subscription for a new period.
   *
   * @param {string} tenantId
   * @param {string} subscriptionId
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async renewSubscription(tenantId, subscriptionId, options = {}) {
    const db = options.tx || prisma;

    const runRenewal = async (tx) => {
      const sub = await subscriptionRepository.findById(tenantId, subscriptionId, { tx });
      if (!sub) {
        throw new SubscriptionNotFoundError(`Subscription ${subscriptionId} not found`);
      }

      if (sub.status !== 'active' && sub.status !== 'past_due') {
        throw new BillingBusinessError(`Cannot renew subscription in status: ${sub.status}`);
      }

      const now = new Date();
      // Ensure period start date stacks from the end of the previous period to avoid loss of billed time
      const periodStart = sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
      const cycleDays = getCycleDays(sub.billingCycle);
      const periodEnd = new Date(periodStart.getTime() + cycleDays * 24 * 60 * 60 * 1000);

      const updated = await subscriptionRepository.update(
        tenantId,
        subscriptionId,
        {
          status: 'active', // Ensure state recovers from past_due
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
        { tx }
      );

      billingEventBus.publish('SubscriptionRenewed', {
        tenantId,
        subscriptionId: updated.id,
        planId: updated.planId,
        periodEnd,
      });

      return updated;
    };

    if (options.tx) {
      return runRenewal(options.tx);
    } else {
      return prisma.$transaction(async (tx) => {
        return runRenewal(tx);
      }, { timeout: 20000 });
    }
  },

  /**
   * Cancels a subscription. Marks cancelAtPeriodEnd or immediate cancellation.
   *
   * @param {string} tenantId
   * @param {string} subscriptionId
   * @param {boolean} [immediate=false]
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async cancelSubscription(tenantId, subscriptionId, immediate = false, options = {}) {
    const db = options.tx || prisma;

    const runCancellation = async (tx) => {
      const sub = await subscriptionRepository.findById(tenantId, subscriptionId, { tx });
      if (!sub) {
        throw new SubscriptionNotFoundError(`Subscription ${subscriptionId} not found`);
      }

      if (immediate) {
        validateTransition(sub.status, 'cancelled');
        const updated = await subscriptionRepository.update(
          tenantId,
          subscriptionId,
          {
            status: 'cancelled',
            endDate: new Date(),
            canceledAt: new Date(),
          },
          { tx }
        );

        billingEventBus.publish('SubscriptionCancelled', {
          tenantId,
          subscriptionId: updated.id,
          immediate: true,
        });

        return updated;
      } else {
        // Cancel at period end - status remains active, cancelAtPeriodEnd set to true
        const updated = await subscriptionRepository.update(
          tenantId,
          subscriptionId,
          {
            cancelAtPeriodEnd: true,
            canceledAt: new Date(),
          },
          { tx }
        );

        billingEventBus.publish('SubscriptionCancelled', {
          tenantId,
          subscriptionId: updated.id,
          immediate: false,
        });

        return updated;
      }
    };

    if (options.tx) {
      return runCancellation(options.tx);
    } else {
      return prisma.$transaction(async (tx) => {
        return runCancellation(tx);
      }, { timeout: 20000 });
    }
  },

  /**
   * Expires a free trial. Enforces idempotency.
   *
   * @param {string} tenantId
   * @param {string} subscriptionId
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async expireTrial(tenantId, subscriptionId, options = {}) {
    const db = options.tx || prisma;

    const runExpiration = async (tx) => {
      const sub = await subscriptionRepository.findById(tenantId, subscriptionId, { tx });
      if (!sub) {
        throw new SubscriptionNotFoundError(`Subscription ${subscriptionId} not found`);
      }

      // Idempotency Guard: if already expired, cancelled, or upgraded, exit gracefully
      if (sub.status === 'expired' || sub.status === 'cancelled' || sub.status === 'active') {
        return sub;
      }

      validateTransition(sub.status, 'expired');

      const updated = await subscriptionRepository.update(
        tenantId,
        subscriptionId,
        {
          status: 'expired',
          endDate: new Date(),
        },
        { tx }
      );

      billingEventBus.publish('TrialExpired', {
        tenantId,
        subscriptionId: updated.id,
        planId: updated.planId,
      });

      return updated;
    };

    if (options.tx) {
      return runExpiration(options.tx);
    } else {
      return prisma.$transaction(async (tx) => {
        return runExpiration(tx);
      }, { timeout: 20000 });
    }
  },

  /**
   * Lists subscriptions with pagination.
   *
   * @param {string} tenantId
   * @param {object} filters
   * @param {object} pagination
   * @param {object} [options]
   * @returns {Promise<{ subscriptions: Array<object>, pagination: object }>}
   */
  async listSubscriptions(tenantId, filters = {}, pagination = {}, options = {}) {
    const [items, total] = await subscriptionRepository.findManyAndCount(tenantId, filters, pagination, options);
    return {
      subscriptions: items,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total,
        totalPages: Math.ceil(total / (pagination.limit || 10)),
      },
    };
  },
};

// Listen for billing events to coordinate cross-service business processes.
billingEventBus.subscribe('InvoicePaid', async (event) => {
  try {
    if (event.subscriptionId) {
      // 1. Fetch the invoice to check for plan upgrade metadata
      const invoice = await prisma.invoice.findUnique({
        where: { id: event.invoiceId },
      });

      if (invoice && invoice.metadata && typeof invoice.metadata === 'object' && invoice.metadata.targetPlanId) {
        const { targetPlanId, targetBillingCycle } = invoice.metadata;
        const now = new Date();
        const cycleDays = getCycleDays(targetBillingCycle || 'MONTHLY');
        const periodEnd = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000);

        // Directly upgrade/change the subscription details
        await subscriptionRepository.update(event.tenantId, event.subscriptionId, {
          planId: targetPlanId,
          billingCycle: targetBillingCycle || 'MONTHLY',
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        });

        logger.info(`[SubscriptionService] Upgraded subscription ${event.subscriptionId} to plan ${targetPlanId} via Invoice ${event.invoiceId}`);
        
        billingEventBus.publish('SubscriptionActivated', {
          tenantId: event.tenantId,
          subscriptionId: event.subscriptionId,
          planId: targetPlanId,
          periodEnd,
        });
        return;
      }

      // Standard trial to active transition if no upgrade metadata is present
      await subscriptionService.activateSubscription(event.tenantId, event.subscriptionId, {
        gatewaySubscriptionId: event.gatewaySubscriptionId,
        gatewayCustomerId: event.gatewayCustomerId,
      });
    }
  } catch (err) {
    logger.error(`[SubscriptionService] Auto-activation on InvoicePaid failed: ${err.message}`);
  }
});
