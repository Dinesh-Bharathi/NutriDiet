// src/modules/billing/repositories/webhook.repository.js
// Database access for webhook events.

import { BaseRepository } from './base.repository.js';

class WebhookRepository extends BaseRepository {
  constructor() {
    super('webhookEvent');
  }

  /**
   * Records a new webhook event.
   *
   * @param {object} data - { gateway, eventId, eventType, payload, tenantId }
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async create(data, options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.webhookEvent.create({
        data,
      });
    }, 'Failed to record webhook event');
  }

  /**
   * Retrieves a webhook event by ID.
   *
   * @param {string} id
   * @param {object} [options]
   * @returns {Promise<object|null>}
   */
  async findById(id, options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.webhookEvent.findUnique({
        where: { id },
      });
    }, 'Failed to find webhook event by ID');
  }

  /**
   * Finds a webhook event by gateway event ID (idempotency check).
   *
   * @param {string} gateway
   * @param {string} eventId
   * @param {object} [options]
   * @returns {Promise<object|null>}
   */
  async findByEventId(gateway, eventId, options = {}) {
    if (!gateway || !eventId) return null;
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.webhookEvent.findFirst({
        where: {
          gateway,
          eventId,
        },
      });
    }, 'Failed to find webhook event by event ID');
  }

  /**
   * Transitions a webhook event status to 'PROCESSING'.
   *
   * @param {string} id
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async markProcessing(id, options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.webhookEvent.update({
        where: { id },
        data: {
          status: 'PROCESSING',
        },
      });
    }, 'Failed to mark webhook as processing');
  }

  /**
   * Transitions a webhook event status to 'PROCESSED'.
   *
   * @param {string} id
   * @param {Date} [processedAt] - When the event was completed
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async markProcessed(id, processedAt = new Date(), options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.webhookEvent.update({
        where: { id },
        data: {
          status: 'PROCESSED',
          processedAt,
        },
      });
    }, 'Failed to mark webhook as processed');
  }

  /**
   * Transitions a webhook event status to 'FAILED' with diagnostics details.
   *
   * @param {string} id
   * @param {string} errorText - Diagnostic details
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async markFailed(id, errorText, options = {}) {
    const db = this.getClient(options);
    return this.execute(async () => {
      return db.webhookEvent.update({
        where: { id },
        data: {
          status: 'FAILED',
          errorText,
        },
      });
    }, 'Failed to mark webhook as failed');
  }
}

export const webhookRepository = new WebhookRepository();
