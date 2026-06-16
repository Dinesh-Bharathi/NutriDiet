import prisma from '../../lib/prisma.js';

export const whatsappRepository = {
  /**
   * Find connection status & details by tenantId.
   *
   * @param {string} tenantId
   * @returns {Promise<object|null>}
   */
  async findByTenantId(tenantId) {
    return prisma.whatsAppConnection.findUnique({
      where: { tenantId },
    });
  },

  /**
   * Create or update WhatsApp connection for the tenant.
   *
   * @param {string} tenantId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async upsert(tenantId, data) {
    return prisma.whatsAppConnection.upsert({
      where: { tenantId },
      update: data,
      create: {
        ...data,
        tenantId,
      },
    });
  },

  /**
   * Update fields on an existing WhatsApp connection.
   *
   * @param {string} tenantId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(tenantId, data) {
    return prisma.whatsAppConnection.update({
      where: { tenantId },
      data,
    });
  },
};
