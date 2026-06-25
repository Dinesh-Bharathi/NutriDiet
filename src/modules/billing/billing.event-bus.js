// src/modules/billing/billing.event-bus.js
// Billing Event Bus abstraction. Decouples services from transport mechanism.

import { EventEmitter } from 'events';
import logger from '../../config/logger.js';

class BillingEventBus {
  constructor() {
    this.emitter = new EventEmitter();
    // Increase limit to avoid memory leak warnings on high listener counts
    this.emitter.setMaxListeners(100);
  }

  /**
   * Publishes a domain event.
   *
   * @param {string} eventName - Name of the domain event (e.g. 'TrialStarted')
   * @param {object} payload - Event payload details
   */
  publish(eventName, payload) {
    logger.info(`[BillingEventBus] Publishing event: ${eventName}`, { payload });
    // Emit asynchronously to prevent blocking the publisher's execution flow
    process.nextTick(() => {
      this.emitter.emit(eventName, payload);
    });
  }

  /**
   * Subscribes a handler to a domain event.
   *
   * @param {string} eventName
   * @param {Function} handler
   */
  subscribe(eventName, handler) {
    this.emitter.on(eventName, handler);
  }

  /**
   * Unsubscribes a handler from a domain event.
   *
   * @param {string} eventName
   * @param {Function} handler
   */
  unsubscribe(eventName, handler) {
    this.emitter.off(eventName, handler);
  }
}

export const billingEventBus = new BillingEventBus();
