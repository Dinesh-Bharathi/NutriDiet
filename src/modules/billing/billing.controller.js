// src/modules/billing/billing.controller.js
// Express controllers for billing operations.

import { planService } from './plan.service.js';
import { subscriptionService } from './subscription.service.js';
import { invoiceService } from './invoice.service.js';
import { subscriptionRepository } from './repositories/subscription.repository.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import ApiError from '../../utils/ApiError.js';
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
   * Initiates a free trial for the authenticated tenant.
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
   * Settle payment endpoint (Simulated capture).
   */
  async payInvoice(req, res, next) {
    try {
      const simulatedPaymentId = req.body.paymentId || `pay_simulated_${Date.now()}`;
      const invoice = await invoiceService.payInvoice(req.tenant.id, req.params.id, simulatedPaymentId);
      return sendSuccess(res, HTTP_STATUS.OK, 'Invoice paid successfully', invoice);
    } catch (err) {
      return next(handleControllerError(err));
    }
  },
};
