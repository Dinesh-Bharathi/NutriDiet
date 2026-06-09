import { get, set } from '../../lib/redis.js';
import { dashboardRepository } from './dashboard.repository.js';

export const dashboardService = {
  async getOverview(tenantId, userId) {
    const cacheKey = `dashboard:overview:${tenantId || 'global'}:${userId || 'system'}`;

    // Try to get cached data from Redis
    try {
      console.log(`[Redis] Checking cache for key: ${cacheKey}`);
      const cachedData = await get(cacheKey);
      if (cachedData) {
        console.log(`[Redis] Cache HIT for key: ${cacheKey}`);
        console.log('[Redis] Cache value retrieved:', JSON.stringify(cachedData).substring(0, 300) + '...');
        return cachedData;
      }
      console.log(`[Redis] Cache MISS for key: ${cacheKey}`);
    } catch (err) {
      console.error(`[Redis] Error reading from cache for key: ${cacheKey}`, err);
    }

    // Cache miss: query database
    const [
      kpis,
      clientGrowth30,
      clientGrowth90,
      clinicalActivity,
      dietPlanActivity,
      checkInActivity,
      goalDistribution,
      actionCenter,
    ] = await Promise.all([
      dashboardRepository.getKpis(tenantId),
      dashboardRepository.getClientGrowth(tenantId, 30),
      dashboardRepository.getClientGrowth(tenantId, 90),
      dashboardRepository.getClinicalActivity(tenantId, 90),
      dashboardRepository.getDietPlanActivity(tenantId),
      dashboardRepository.getCheckInActivity(tenantId, 90),
      dashboardRepository.getGoalDistribution(tenantId),
      dashboardRepository.getActionCenterItems(tenantId, userId),
    ]);

    const overviewData = {
      kpis,
      charts: {
        clientGrowth: {
          data30: clientGrowth30,
          data90: clientGrowth90,
        },
        clinicalActivity,
        dietPlanActivity,
        checkInActivity,
        goalDistribution,
      },
      actionCenter,
    };

    // Save to cache (TTL = 300 seconds / 5 minutes)
    try {
      console.log(`[Redis] Saving to cache for key: ${cacheKey}`);
      console.log('[Redis] Value being saved:', JSON.stringify(overviewData).substring(0, 300) + '...');
      await set(cacheKey, overviewData, 300);
      console.log(`[Redis] Successfully cached key: ${cacheKey}`);
    } catch (err) {
      console.error(`[Redis] Error saving to cache for key: ${cacheKey}`, err);
    }

    return overviewData;
  },
};
