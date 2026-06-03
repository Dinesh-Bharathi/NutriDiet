import { dashboardRepository } from './dashboard.repository.js';

export const dashboardService = {
  async getOverview(tenantId, userId) {
    const [
      kpis,
      clientGrowth30,
      clientGrowth90,
      assessmentActivity,
      dietPlanActivity,
      checkInActivity,
      goalDistribution,
      actionCenter,
    ] = await Promise.all([
      dashboardRepository.getKpis(tenantId),
      dashboardRepository.getClientGrowth(tenantId, 30),
      dashboardRepository.getClientGrowth(tenantId, 90),
      dashboardRepository.getAssessmentActivity(tenantId, 90),
      dashboardRepository.getDietPlanActivity(tenantId),
      dashboardRepository.getCheckInActivity(tenantId, 90),
      dashboardRepository.getGoalDistribution(tenantId),
      dashboardRepository.getActionCenterItems(tenantId, userId),
    ]);

    return {
      kpis,
      charts: {
        clientGrowth: {
          data30: clientGrowth30,
          data90: clientGrowth90,
        },
        assessmentActivity,
        dietPlanActivity,
        checkInActivity,
        goalDistribution,
      },
      actionCenter,
    };
  },
};
