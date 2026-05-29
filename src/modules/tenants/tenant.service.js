// src/modules/tenants/tenant.service.js
// Business logic for tenant operations.
import { tenantRepository } from './tenant.repository.js';
import ApiError from '../../utils/ApiError.js';

export const tenantService = {
  /**
   * Updates the theme of the tenant.
   *
   * @param {string} tenantId
   * @param {object} dto - { themeId }
   * @returns {Promise<object>}
   */
  async updateTheme(tenantId, dto) {
    const updatedTenant = await tenantRepository.updateTheme(tenantId, dto.themeId);
    if (!updatedTenant) {
      throw ApiError.notFound('Tenant');
    }
    return updatedTenant;
  },
};
