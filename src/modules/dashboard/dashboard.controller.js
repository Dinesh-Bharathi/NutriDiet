import { dashboardService } from './dashboard.service.js';

export const dashboardController = {
  async getOverview(req, res) {
    const { tenantId } = req;
    const userId = req.user?.id;

    const data = await dashboardService.getOverview(tenantId, userId);

    res.status(200).json({
      success: true,
      data,
    });
  },
};
