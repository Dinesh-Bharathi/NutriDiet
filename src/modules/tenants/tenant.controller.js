// src/modules/tenants/tenant.controller.js
// Thin HTTP adapters for tenant endpoints.
import { tenantService } from './tenant.service.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const tenantController = {
  /**
   * POST /api/v1/tenant/theme
   * Updates the theme ID of the authenticated user's tenant.
   */
  async updateTheme(req, res) {
    const tenantId = req.user.tenantId;
    const updatedTenant = await tenantService.updateTheme(tenantId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Tenant theme updated successfully',
      {
        tenant: {
          id: updatedTenant.id,
          name: updatedTenant.name,
          slug: updatedTenant.slug,
          plan: updatedTenant.plan,
          themeId: updatedTenant.themeId,
        },
      },
    );
  },
};
