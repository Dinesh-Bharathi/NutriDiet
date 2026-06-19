// src/modules/automation/automation.repository.js
import prisma from '../../lib/prisma.js';

export const automationRepository = {
  /**
   * Creates a new diet plan automation.
   *
   * @param {string} tenantId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(tenantId, { clientId, dietPlanId, activatedBy, startDate, activatedAt }) {
    return prisma.dietPlanAutomation.create({
      data: {
        tenantId,
        clientId,
        dietPlanId,
        activatedBy,
        startDate: startDate ? new Date(startDate) : null,
        activatedAt: activatedAt ? new Date(activatedAt) : new Date(),
        status: 'ACTIVE',
      },
    });
  },

  /**
   * Finds the currently active automation for a client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<object|null>}
   */
  async findActiveByClient(tenantId, clientId) {
    return prisma.dietPlanAutomation.findFirst({
      where: {
        tenantId,
        clientId,
        status: 'ACTIVE',
      },
    });
  },

  /**
   * Cancels all active automations for a client.
   * Sets status to CANCELLED and stoppedAt to now.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<number>} Number of cancelled automations
   */
  async cancelAllActiveForClient(tenantId, clientId) {
    const result = await prisma.dietPlanAutomation.updateMany({
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
    return result.count;
  },

  /**
   * Updates status and optionally stoppedAt for a specific automation.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {string} status - AutomationStatus
   * @returns {Promise<object>}
   */
  async updateStatus(tenantId, id, status) {
    const data = { status };
    if (status === 'CANCELLED' || status === 'COMPLETED') {
      data.stoppedAt = new Date();
    }
    return prisma.dietPlanAutomation.update({
      where: {
        id,
        tenantId,
      },
      data,
    });
  },

  /**
   * Finds an automation by ID.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(tenantId, id) {
    return prisma.dietPlanAutomation.findFirst({
      where: {
        id,
        tenantId,
      },
    });
  },

  /**
   * Finds all automations for a client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<Array<object>>}
   */
  async findManyByClient(tenantId, clientId) {
    return prisma.dietPlanAutomation.findMany({
      where: {
        tenantId,
        clientId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },
};
