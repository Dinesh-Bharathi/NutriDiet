import { dashboardService } from './dashboard.service.js';

export const dashboardController = {
  async getOverview(req, res) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id || req.user?.userId;

    const data = await dashboardService.getOverview(tenantId, userId);

    res.status(200).json({
      success: true,
      data,
    });
  },
};
