// src/modules/billing/plan.service.js
// Business logic for plan operations.

import { planRepository } from './repositories/plan.repository.js';
import { PlanNotFoundError, BillingBusinessError } from './billing.errors.js';

export const planService = {
  /**
   * Retrieves all public active plans.
   *
   * @param {object} [options]
   * @returns {Promise<Array<object>>}
   */
  async getActivePlans(options = {}) {
    return planRepository.findAll({ includeInactive: false, includeDeleted: false, ...options });
  },

  /**
   * Retrieves a plan by ID.
   *
   * @param {string} id
   * @param {object} [options]
   * @returns {Promise<object>}
   * @throws {PlanNotFoundError}
   */
  async getPlanById(id, options = {}) {
    const plan = await planRepository.findById(id, options);
    if (!plan) {
      throw new PlanNotFoundError(`Plan with ID ${id} not found`);
    }
    return plan;
  },

  /**
   * Retrieves a plan by its code.
   *
   * @param {string} code
   * @param {object} [options]
   * @returns {Promise<object>}
   * @throws {PlanNotFoundError}
   */
  async getPlanByCode(code, options = {}) {
    const plan = await planRepository.findByCode(code, options);
    if (!plan) {
      throw new PlanNotFoundError(`Plan with code ${code} not found`);
    }
    return plan;
  },

  /**
   * Calculates plan cost for a billing cycle and currency.
   * Abstracts direct DB column checks to support future PlanPrice models.
   *
   * @param {string} planId
   * @param {string} billingCycle - 'MONTHLY' | 'YEARLY'
   * @param {string} [currency='INR']
   * @param {object} [options]
   * @returns {Promise<{ amount: number, currency: string }>}
   */
  async calculatePlanCost(planId, billingCycle, currency = 'INR', options = {}) {
    const plan = await this.getPlanById(planId, options);

    if (plan.currency !== currency) {
      throw new BillingBusinessError(`Currency mismatch. Plan supports ${plan.currency}, requested ${currency}`);
    }

    let price = null;
    if (billingCycle === 'MONTHLY') {
      price = plan.priceMonthly;
    } else if (billingCycle === 'YEARLY') {
      price = plan.priceYearly;
    } else {
      throw new BillingBusinessError(`Unsupported billing cycle: ${billingCycle}`);
    }

    if (price === null || price === undefined) {
      throw new BillingBusinessError(`Plan does not support ${billingCycle} billing`);
    }

    return {
      amount: Number(price),
      currency: plan.currency,
    };
  },
};
