// src/modules/billing/billing.controller.js
// Express controllers for billing operations.

import { planService } from './plan.service.js';
import { subscriptionService } from './subscription.service.js';
import { invoiceService } from './invoice.service.js';
import { webhookService } from './webhook.service.js';
import { paymentService } from './payment.service.js';
import { razorpayService } from './razorpay.service.js';
import { subscriptionRepository } from './repositories/subscription.repository.js';
import { invoiceRepository } from './repositories/invoice.repository.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { HTTP_STATUS } from '../../config/constants.js';
import {
  ActiveSubscriptionCollisionError,
  InvalidSubscriptionTransitionError,
  InvoiceAlreadyPaidError,
  PlanNotFoundError,
  SubscriptionNotFoundError,
  InvoiceNotFoundError,
  PaymentNotFoundError,
} from './billing.errors.js';

/**
 * Centrally maps domain business errors to express HTTP exceptions.
 */
function handleControllerError(err) {
  if (err instanceof ActiveSubscriptionCollisionError) {
    return ApiError.conflict(err.message);
  }
  if (err instanceof InvalidSubscriptionTransitionError) {
    return ApiError.badRequest(err.message);
  }
  if (err instanceof InvoiceAlreadyPaidError) {
    return ApiError.badRequest(err.message);
  }
  if (
    err instanceof PlanNotFoundError ||
    err instanceof SubscriptionNotFoundError ||
    err instanceof InvoiceNotFoundError ||
    err instanceof PaymentNotFoundError
  ) {
    return ApiError.notFound(err.message);
  }
  return err; // Bubbles up standard exceptions to Express handler
}

export const billingController = {
  /**
   * Retrieves list of active plans.
   */
  async getPlans(req, res, next) {
    try {
      const plans = await planService.getActivePlans();
      return sendSuccess(res, HTTP_STATUS.OK, 'Plans retrieved successfully', plans);
    } catch (err) {
      return next(handleControllerError(err));
    }
  },

  /**
   * Retrieves current active subscription for the tenant.
   */
  async getSubscription(req, res, next) {
    try {
      const sub = await subscriptionRepository.findActiveByTenant(req.tenant.id);
      if (!sub) {
        return sendSuccess(res, HTTP_STATUS.OK, 'No active subscription found', null);
      }
      return sendSuccess(res, HTTP_STATUS.OK, 'Active subscription retrieved successfully', sub);
    } catch (err) {
      return next(handleControllerError(err));
    }
  },

  /**
   * Initiates free trial.
   */
  async startTrial(req, res, next) {
    try {
      const sub = await subscriptionService.startTrial(req.tenant.id, req.body.planCode);
      return sendSuccess(res, HTTP_STATUS.CREATED, 'Trial started successfully', sub);
    } catch (err) {
      return next(handleControllerError(err));
    }
  },

  /**
   * Initiates subscription payment checkout (creates subscription/invoice/order/payment in one go).
   */
  async checkoutSubscription(req, res, next) {
    try {
      const { planCode, billingCycle } = req.body;
      
      // Find the target plan details to calculate cost
      const plan = await planService.getPlanByCode(planCode);
      const cost = await planService.calculatePlanCost(plan.id, billingCycle);
      
      // 1. Get or create active subscription
      let sub = await subscriptionRepository.findActiveByTenant(req.tenant.id);
      
      if (!sub) {
        // Create new trialing subscription
        sub = await subscriptionService.startTrial(req.tenant.id, planCode);
      }
      
      // If already active on the SAME plan and cycle, reject duplicate checkouts
      if (sub.status === 'active' && sub.planId === plan.id && sub.billingCycle === billingCycle) {
        throw new ActiveSubscriptionCollisionError('You are already actively subscribed to this plan tier.');
      }

      // 2. Find if there is an unpaid/draft invoice for this subscription matching the target plan
      const [existingInvoices] = await invoiceRepository.findManyAndCount(req.tenant.id, {
        subscriptionId: sub.id,
        status: 'DRAFT',
      }, { page: 1, limit: 100 });
      
      let invoice = existingInvoices.find(inv => 
        inv.metadata && 
        typeof inv.metadata === 'object' && 
        inv.metadata.targetPlanId === plan.id &&
        inv.metadata.targetBillingCycle === billingCycle
      );
      
      if (!invoice) {
        // Create new invoice for the subscription upgrade/purchase
        invoice = await invoiceService.createInvoice(req.tenant.id, {
          subscriptionId: sub.id,
          amount: cost.amount,
          currency: cost.currency,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'DRAFT',
          metadata: {
            targetPlanId: plan.id,
            targetBillingCycle: billingCycle,
          },
          items: [
            {
              description: `${plan.name} Plan - ${billingCycle} Subscription`,
              amount: cost.amount,
              quantity: 1,
            }
          ]
        });
      }
 
      // 3. Create Razorpay order
      const rzpOrder = await razorpayService.createOrder(
        Number(invoice.amount),
        invoice.currency,
        invoice.id
      );
 
      // 4. Create pending payment attempt
      const payment = await paymentService.createPaymentAttempt(req.tenant.id, invoice.id, {
        amount: Number(invoice.amount),
        currency: invoice.currency,
        gateway: 'RAZORPAY',
        gatewayOrderId: rzpOrder.id,
      });
 
      return sendSuccess(res, HTTP_STATUS.OK, 'Subscription checkout initiated successfully', {
        subscription: sub,
        invoice,
        order: rzpOrder,
        paymentId: payment.id,
        key: env.RAZORPAY_KEY_ID,
      });
    } catch (err) {
      return next(handleControllerError(err));
    }
  },

  /**
   * Cancels subscription (either at period end or immediately).
   */
  async cancelSubscription(req, res, next) {
    try {
      const activeSub = await subscriptionRepository.findActiveByTenant(req.tenant.id);
      if (!activeSub) {
        throw new SubscriptionNotFoundError('No active subscription found to cancel');
      }

      const cancelledSub = await subscriptionService.cancelSubscription(
        req.tenant.id,
        activeSub.id,
        req.body.immediate
      );

      return sendSuccess(res, HTTP_STATUS.OK, 'Subscription cancelled successfully', cancelledSub);
    } catch (err) {
      return next(handleControllerError(err));
    }
  },

  /**
   * Lists tenant invoices with pagination.
   */
  async listInvoices(req, res, next) {
    try {
      const result = await invoiceService.listInvoices(
        req.tenant.id,
        { status: req.query.status },
        { page: req.query.page, limit: req.query.limit }
      );

      return sendSuccess(
        res,
        HTTP_STATUS.OK,
        'Invoices retrieved successfully',
        result.invoices,
        result.pagination
      );
    } catch (err) {
      return next(handleControllerError(err));
    }
  },

  /**
   * Retrieves detail profile for a single invoice.
   */
  async getInvoiceById(req, res, next) {
    try {
      const invoice = await invoiceService.getInvoiceById(req.tenant.id, req.params.id);
      return sendSuccess(res, HTTP_STATUS.OK, 'Invoice retrieved successfully', invoice);
    } catch (err) {
      return next(handleControllerError(err));
    }
  },

  /**
   * Settle payment endpoint (Simulated capture or real signature verification).
   */
  async payInvoice(req, res, next) {
    try {
      const { paymentId, gatewayPaymentId, gatewaySignature } = req.body;
      let invoice;

      if (paymentId && gatewayPaymentId && gatewaySignature) {
        // Verify signature and record the payment
        await paymentService.verifyAndRecordPayment(req.tenant.id, paymentId, {
          gatewayPaymentId,
          gatewaySignature,
        });
        invoice = await invoiceService.getInvoiceById(req.tenant.id, req.params.id);
      } else {
        // Fallback for simulation/testing (backward-compatibility)
        const simulatedPaymentId = paymentId || `pay_simulated_${Date.now()}`;
        invoice = await invoiceService.payInvoice(req.tenant.id, req.params.id, simulatedPaymentId);
      }

      return sendSuccess(res, HTTP_STATUS.OK, 'Invoice paid successfully', invoice);
    } catch (err) {
      return next(handleControllerError(err));
    }
  },

  /**
   * Initiates Razorpay checkout order for an invoice.
   */
  async checkoutInvoice(req, res, next) {
    try {
      const invoice = await invoiceService.getInvoiceById(req.tenant.id, req.params.id);
      if (invoice.status === 'PAID') {
        throw new InvoiceAlreadyPaidError('Invoice is already paid');
      }

      // Generate a Razorpay order
      const rzpOrder = await razorpayService.createOrder(
        Number(invoice.amount),
        invoice.currency,
        invoice.id
      );

      // Log a pending payment attempt in the database
      const payment = await paymentService.createPaymentAttempt(req.tenant.id, invoice.id, {
        amount: Number(invoice.amount),
        currency: invoice.currency,
        gateway: 'RAZORPAY',
        gatewayOrderId: rzpOrder.id,
      });

      return sendSuccess(res, HTTP_STATUS.OK, 'Checkout initiated successfully', {
        order: rzpOrder,
        paymentId: payment.id,
        key: env.RAZORPAY_KEY_ID,
      });
    } catch (err) {
      return next(handleControllerError(err));
    }
  },

  /**
   * Razorpay webhook callback handler.
   */
  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);

      // Verify cryptographic signature
      const isValid = webhookService.verifySignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET);
      if (!isValid) {
        logger.warn('[BillingController] Webhook signature validation failed.');
        return next(ApiError.badRequest('Invalid signature'));
      }

      const eventId = req.body.id;
      const eventType = req.body.event;
      const rawPayload = req.body.payload;

      // Map Razorpay-specific payload formats to decoupled service structures
      let mappedPayload = {};
      if (eventType === 'payment.captured' && rawPayload?.payment?.entity) {
        const entity = rawPayload.payment.entity;
        mappedPayload = {
          gatewayPaymentId: entity.id,
          gatewayOrderId: entity.order_id,
          gatewaySignature: signature,
          tenantId: entity.notes?.tenantId,
        };
      } else if (eventType === 'subscription.charged' && rawPayload?.subscription?.entity) {
        mappedPayload = {
          gatewaySubscriptionId: rawPayload.subscription.entity.id,
          gatewayPaymentId: rawPayload.payment?.entity?.id,
        };
      } else if (eventType === 'subscription.cancelled' && rawPayload?.subscription?.entity) {
        mappedPayload = {
          gatewaySubscriptionId: rawPayload.subscription.entity.id,
        };
      }

      const result = await webhookService.processWebhook('RAZORPAY', eventId, eventType, mappedPayload);
      return sendSuccess(res, HTTP_STATUS.OK, 'Webhook processed successfully', result);
    } catch (err) {
      return next(handleControllerError(err));
    }
  },
};
