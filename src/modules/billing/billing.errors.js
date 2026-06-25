// src/modules/billing/billing.errors.js
// Custom business logic exceptions for the Billing domain.

export class BillingBusinessError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    this.isOperational = true; // Marks as an expected business logic error
  }
}

export class InvalidSubscriptionTransitionError extends BillingBusinessError {}
export class TrialExpiredError extends BillingBusinessError {}
export class InvoiceAlreadyPaidError extends BillingBusinessError {}
export class DuplicatePaymentError extends BillingBusinessError {}
export class ActiveSubscriptionCollisionError extends BillingBusinessError {}
export class PlanNotFoundError extends BillingBusinessError {}
export class SubscriptionNotFoundError extends BillingBusinessError {}
export class InvoiceNotFoundError extends BillingBusinessError {}
export class PaymentNotFoundError extends BillingBusinessError {}
