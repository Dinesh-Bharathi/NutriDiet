// src/modules/tenants/tenant.repository.js
// Database access for tenant operations.
import prisma from '../../lib/prisma.js';

export const tenantRepository = {
  /**
   * Updates the themeId of a tenant.
   *
   * @param {string} tenantId - The UUID/CUID of the tenant
   * @param {string} themeId - The new theme ID
   * @returns {Promise<object>} The updated tenant record
   */
  async updateTheme(tenantId, themeId) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { themeId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        themeId: true,
      },
    });
  },
};
