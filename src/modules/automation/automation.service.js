// src/modules/automation/automation.service.js
import { automationRepository } from './automation.repository.js';
import prisma from '../../lib/prisma.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';

export const automationService = {
  /**
   * Creates a new automation for a client, cancelling any existing active automation.
   * Runs in a transaction to ensure atomicity.
   *
   * @param {string} tenantId
   * @param {object} params
   * @returns {Promise<object>}
   */
  async createAutomation(tenantId, { clientId, dietPlanId, activatedBy, startDate }) {
    logger.info(`Creating new automation for client ${clientId} on tenant ${tenantId}`);

    return prisma.$transaction(async (tx) => {
      // Cancel all existing active automations for this client
      await tx.dietPlanAutomation.updateMany({
        where: {
          tenantId,
          clientId,
          status: 'ACTIVE',
        },
        data: {
          status: 'CANCELLED',
          stoppedAt: new Date(),
        },
      });

      // Create new active automation
      return tx.dietPlanAutomation.create({
        data: {
          tenantId,
          clientId,
          dietPlanId,
          activatedBy,
          startDate: startDate ? new Date(startDate) : null,
          activatedAt: new Date(),
          status: 'ACTIVE',
        },
      });
    });
  },

  /**
   * Pauses an active automation.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async pauseAutomation(tenantId, id) {
    const automation = await automationRepository.findById(tenantId, id);
    if (!automation) {
      throw ApiError.notFound('Automation not found');
    }

    if (automation.status !== 'ACTIVE') {
      throw ApiError.badRequest(`Cannot pause automation in status: ${automation.status}`);
    }

    logger.info(`Pausing automation ${id} on tenant ${tenantId}`);
    return automationRepository.updateStatus(tenantId, id, 'PAUSED');
  },

  /**
   * Resumes a paused automation.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async resumeAutomation(tenantId, id) {
    const automation = await automationRepository.findById(tenantId, id);
    if (!automation) {
      throw ApiError.notFound('Automation not found');
    }

    if (automation.status !== 'PAUSED') {
      throw ApiError.badRequest(`Cannot resume automation in status: ${automation.status}`);
    }

    logger.info(`Resuming automation ${id} on tenant ${tenantId}`);
    return automationRepository.updateStatus(tenantId, id, 'ACTIVE');
  },

  /**
   * Cancels a running automation.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async cancelAutomation(tenantId, id) {
    const automation = await automationRepository.findById(tenantId, id);
    if (!automation) {
      throw ApiError.notFound('Automation not found');
    }

    if (automation.status === 'CANCELLED' || automation.status === 'COMPLETED') {
      throw ApiError.badRequest(`Cannot cancel automation that is already ${automation.status}`);
    }

    logger.info(`Cancelling automation ${id} on tenant ${tenantId}`);
    return automationRepository.updateStatus(tenantId, id, 'CANCELLED');
  },

  /**
   * Retrieves automation status.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getAutomationStatus(tenantId, id) {
    const automation = await automationRepository.findById(tenantId, id);
    if (!automation) {
      throw ApiError.notFound('Automation not found');
    }
    return automation;
  },

  /**
   * Retrieves all automations for a client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<Array<object>>}
   */
  async getClientAutomations(tenantId, clientId) {
    return automationRepository.findManyByClient(tenantId, clientId);
  },
};
