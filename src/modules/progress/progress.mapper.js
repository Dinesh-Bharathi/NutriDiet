// src/modules/progress/progress.mapper.js
// Serializes database and calculated progress analytics.
import { mapCheckInList } from '../check-ins/check-in.mapper.js';

export const progressMapper = {
  /**
   * Maps progress trend data to a clean response payload.
   *
   * @param {object} trends
   * @returns {object}
   */
  mapProgressTrends(trends) {
    return {
      weight: trends.weightTrends || [],
      bmi: trends.bmiTrends || [],
      measurements: trends.measurementTrends || [],
      lifestyle: trends.lifestyleTrends || [],
      adherence: trends.adherenceTrends || [],
    };
  },

  /**
   * Maps client progress summary.
   *
   * @param {object} summary
   * @returns {object}
   */
  mapProgressSummary(summary) {
    if (!summary) return null;

    return {
      currentWeight: summary.currentWeight,
      startingWeight: summary.startingWeight,
      netChange: summary.netChange,
      baselineDate: summary.baselineDate,
      latestDate: summary.latestDate,

      currentWaist: summary.currentWaist,
      startingWaist: summary.startingWaist,
      waistChange: summary.waistChange,
      waistTrend: summary.waistTrend,

      currentHip: summary.currentHip,
      startingHip: summary.startingHip,
      hipChange: summary.hipChange,
      hipTrend: summary.hipTrend,

      currentChest: summary.currentChest,
      startingChest: summary.startingChest,
      chestChange: summary.chestChange,
      chestTrend: summary.chestTrend,

      currentArm: summary.currentArm,
      startingArm: summary.startingArm,
      armChange: summary.armChange,
      armTrend: summary.armTrend,

      currentThigh: summary.currentThigh,
      startingThigh: summary.startingThigh,
      thighChange: summary.thighChange,
      thighTrend: summary.thighTrend,

      averageSleep: summary.averageSleep,
      averageWater: summary.averageWater,
      averageAdherence: summary.averageAdherence,
      lastCheckInDate: summary.lastCheckInDate,
      checkInCount: summary.checkInCount,
      riskSummary: summary.riskSummary,
    };
  },

  /**
   * Maps client progress snapshot.
   *
   * @param {object} snapshot
   * @returns {object}
   */
  mapProgressSnapshot(snapshot) {
    return {
      weightLost: snapshot.weightLost,
      waistLost: snapshot.waistLost,
      averageAdherence: snapshot.averageAdherence,
      averageSleep: snapshot.averageSleep,
      checkInCount: snapshot.checkInCount,
    };
  },

  /**
   * Maps review dashboard.
   *
   * @param {object} dashboard
   * @returns {object}
   */
  mapReviewDashboard(dashboard) {
    return {
      pendingReviews: mapCheckInList(dashboard.pendingReviews),
      requiresFollowUp: mapCheckInList(dashboard.requiresFollowUp),
      recentCheckIns: mapCheckInList(dashboard.recentCheckIns),
      lowAdherenceClients: dashboard.lowAdherenceClients.map((client) => ({
        clientId: client.clientId,
        fullName: client.fullName,
        latestWeight: client.latestWeight,
        averageAdherence: client.averageAdherence,
      })),
      weightStalledClients: dashboard.weightStalledClients.map((client) => ({
        clientId: client.clientId,
        fullName: client.fullName,
        latestWeight: client.latestWeight,
        weightChange: client.weightChange,
      })),
      reviewCompletionRate: dashboard.reviewCompletionRate,
    };
  },
};
