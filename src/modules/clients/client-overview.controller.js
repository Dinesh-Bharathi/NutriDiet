// src/modules/clients/client-overview.controller.js
// Thin HTTP adapter for client overview data. Zero database logic lives here.
import { clinicalProfileService } from '../assessments/clinical-profile.service.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const clientOverviewController = {
  /**
   * GET /api/v1/clients/:clientId/overview
   * Retrieves aggregated clinical and demographic summary for a client.
   */
  async getOverview(req, res) {
    const { tenantId } = req.user;
    const { clientId } = req.params;

    const data = await clinicalProfileService.getAggregatedOverview(tenantId, clientId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Client overview retrieved successfully',
      data
    );
  }
};
