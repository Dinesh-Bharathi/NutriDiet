// src/modules/progress/progress.service.js
// Read-only business logic for progress trends, client summaries, and reviews dashboard.
import { progressRepository } from './progress.repository.js';
import { clientRepository } from '../clients/client.repository.js';
import { PROGRESS_CONSTANTS } from './progress.constants.js';
import ApiError from '../../utils/ApiError.js';
import prisma from '../../lib/prisma.js';

/**
 * Calculates trend direction metadata.
 *
 * @param {number|null} change
 * @returns {'UP'|'DOWN'|'STABLE'}
 */
function getTrendDirection(change) {
  if (change === null || change === undefined) return 'STABLE';
  if (change < -0.01) return 'DOWN';
  if (change > 0.01) return 'UP';
  return 'STABLE';
}

/**
 * Processes list of check-ins into chronological weight trends.
 *
 * @param {Array<object>} checkIns - Sorted chronologically (asc)
 * @returns {Array<object>}
 */
function calculateWeightTrends(anthropometrics) {
  return anthropometrics
    .map((a, i) => {
      const currentVal = a.weightKg;
      if (currentVal === null || currentVal === undefined) return null;

      // Find previous weight value
      let prevVal = null;
      for (let j = i - 1; j >= 0; j--) {
        if (anthropometrics[j].weightKg !== null && anthropometrics[j].weightKg !== undefined) {
          prevVal = anthropometrics[j].weightKg;
          break;
        }
      }

      const change = prevVal !== null ? Math.round((currentVal - prevVal) * 100) / 100 : null;
      return {
        date: a.measuredAt.toISOString().split('T')[0],
        value: currentVal,
        change,
        trend: getTrendDirection(change),
      };
    })
    .filter(Boolean);
}

/**
 * Processes list of check-ins into chronological BMI trends.
 *
 * @param {Array<object>} checkIns - Sorted chronologically (asc)
 * @param {number|null} heightCm
 * @returns {Array<object>}
 */
function calculateBmiTrends(anthropometrics) {
  return anthropometrics
    .map((a, i) => {
      const currentBmi = a.bmi;
      if (currentBmi === null || currentBmi === undefined) return null;

      // Find previous BMI value
      let prevBmi = null;
      for (let j = i - 1; j >= 0; j--) {
        if (anthropometrics[j].bmi !== null && anthropometrics[j].bmi !== undefined) {
          prevBmi = anthropometrics[j].bmi;
          break;
        }
      }

      const change = prevBmi !== null ? Math.round((currentBmi - prevBmi) * 100) / 100 : null;
      return {
        date: a.measuredAt.toISOString().split('T')[0],
        value: currentBmi,
        change,
        trend: getTrendDirection(change),
      };
    })
    .filter(Boolean);
}

/**
 * Processes list of check-ins into chronological body measurement trends.
 *
 * @param {Array<object>} checkIns - Sorted chronologically (asc)
 * @returns {Array<object>}
 */
function calculateMeasurementTrends(anthropometrics) {
  const keys = ['waistCm', 'hipCm', 'chestCm', 'armCm', 'thighCm'];
  return anthropometrics.map((a, i) => {
    const item = {
      date: a.measuredAt.toISOString().split('T')[0],
    };

    keys.forEach((key) => {
      const currentVal = a[key];
      const label = key.replace('Cm', ''); // 'waist', 'hip', etc.

      if (currentVal !== null && currentVal !== undefined) {
        item[label] = currentVal;

        // Find previous measurement value
        let prevVal = null;
        for (let j = i - 1; j >= 0; j--) {
          if (anthropometrics[j][key] !== null && anthropometrics[j][key] !== undefined) {
            prevVal = anthropometrics[j][key];
            break;
          }
        }

        const change = prevVal !== null ? Math.round((currentVal - prevVal) * 100) / 100 : null;
        item[`${label}Change`] = change;
        item[`${label}Trend`] = getTrendDirection(change);
      } else {
        item[label] = null;
        item[`${label}Change`] = null;
        item[`${label}Trend`] = 'STABLE';
      }
    });

    return item;
  });
}

/**
 * Builds a polymorphic, chronologically-sorted lifestyle timeline by unioning
 * the Assessment T=0 baseline with subsequent check-in self-reports.
 *
 * This severs the Progress UI's hard dependency on `client_check_ins` so a
 * client with exactly 1 Assessment and 0 check-ins renders the SSoT baseline
 * on the Lifestyle chart immediately after intake.
 *
 * Output shape matches the LifestyleTrendChart contract:
 *   { date: string, sleepHours: number|null, waterIntakeLiters: number|null, source: 'ASSESSMENT'|'CHECK_IN' }
 *
 * @param {Array<object>} assessments - Assessment records with sleepHours / waterIntakeLiters
 * @param {Array<object>} checkIns    - Check-in records with sleepHours / waterIntakeLiters
 * @returns {Array<object>}
 */
function buildLifestyleTimeline(assessments, checkIns) {
  const assessmentPoints = assessments
    .filter((a) => (a.sleepHours !== null && a.sleepHours !== undefined) || (a.waterIntakeLiters !== null && a.waterIntakeLiters !== undefined))
    .map((a) => ({
      date: new Date(a.assessmentDate).toISOString().split('T')[0],
      sleepHours: a.sleepHours ?? null,
      waterIntakeLiters: a.waterIntakeLiters ?? null,
      exerciseDays: null,
      source: 'ASSESSMENT',
    }));

  const checkInPoints = checkIns
    .filter((c) => (c.sleepHours !== null && c.sleepHours !== undefined) || (c.waterIntakeLiters !== null && c.waterIntakeLiters !== undefined))
    .map((c) => ({
      date: new Date(c.checkInDate).toISOString().split('T')[0],
      sleepHours: c.sleepHours ?? null,
      waterIntakeLiters: c.waterIntakeLiters ?? null,
      exerciseDays: c.exerciseDays ?? null,
      source: 'CHECK_IN',
    }));

  return [...assessmentPoints, ...checkInPoints]
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Processes list of check-ins into chronological plan adherence trends.
 *
 * @param {Array<object>} checkIns - Sorted chronologically (asc)
 * @returns {Array<object>}
 */
function calculateAdherenceTrends(checkIns) {
  return checkIns.map((c) => ({
    date: c.checkInDate.toISOString().split('T')[0],
    value: c.planAdherence ?? null,
    notes: c.adherenceNotes || null,
  }));
}

export const progressService = {
  /**
   * Retrieves chronological trends for weight, measurements, sleep, water, and adherence.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<object>}
   */
  async getClientProgress(tenantId, clientId) {
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    // Fetch both data sources in parallel for efficiency
    const [anthropometrics, checkIns, assessments] = await Promise.all([
      progressRepository.findClientAnthropometricRecords(tenantId, clientId, 'asc'),
      progressRepository.findClientCheckIns(tenantId, clientId, 'asc'),
      prisma.assessment.findMany({
        where: { tenantId, clientId, deletedAt: null },
        orderBy: { assessmentDate: 'asc' },
        select: { assessmentDate: true, sleepHours: true, waterIntakeLiters: true },
      }),
    ]);

    return {
      weightTrends: calculateWeightTrends(anthropometrics),
      bmiTrends: calculateBmiTrends(anthropometrics),
      measurementTrends: calculateMeasurementTrends(anthropometrics),
      // Polymorphic union: Assessment T=0 baseline + check-in self-reports
      lifestyleTrends: buildLifestyleTimeline(assessments, checkIns),
      adherenceTrends: calculateAdherenceTrends(checkIns),
    };
  },

  /**
   * Retrieves summary details of start/current states, total changes, and averages.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<object>}
   */
  async getClientProgressSummary(tenantId, clientId) {
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    // Fetch anthropometrics and check-ins in parallel. Check-ins are NOT required
    // for summary computation — anthropometrics are the SSoT for body metrics.
    const [anthropometrics, checkIns] = await Promise.all([
      progressRepository.findClientAnthropometricRecords(tenantId, clientId, 'asc'),
      progressRepository.findClientCheckIns(tenantId, clientId, 'asc'),
    ]);

    // NOTE: Removed the `if (checkIns.length === 0) return early-exit` guard.
    // Summary cards (weight, measurements) are sourced exclusively from the SSoT
    // ClientAnthropometricRecord ledger seeded at assessment intake.
    // A client with 0 check-ins but 1 Assessment will still render correct values.

    const latest = checkIns[checkIns.length - 1];
    const lastCheckInDate = latest ? latest.checkInDate.toISOString().split('T')[0] : null;
    const checkInCount = checkIns.length;

    // Fetch baseline Assessment
    const profile = await prisma.clientClinicalProfile.findUnique({
      where: { clientId },
      select: { id: true, latestAssessmentId: true }
    });
    
    let baselineAssessment = null;
    if (profile?.latestAssessmentId) {
      baselineAssessment = await prisma.assessment.findUnique({
        where: { id: profile.latestAssessmentId }
      });
    }

    const riskSummary = { critical: 0, high: 0, moderate: 0 };
    if (profile) {
      const risks = await prisma.clientRiskFlag.findMany({
        where: { tenantId, profileId: profile.id, status: 'ACTIVE', deletedAt: null }
      });
      risks.forEach(r => {
        if (r.severity === 'CRITICAL') riskSummary.critical++;
        else if (r.severity === 'HIGH') riskSummary.high++;
        else if (r.severity === 'MODERATE') riskSummary.moderate++;
      });
    }

    // Helper to calculate starting, current, total changes, and trend
    const getSummaryField = (key, dataArray, baselineKey = key) => {
      let start = null;
      let current = null;

      // Prefer explicit baseline assessment over the oldest anthropometric record
      if (baselineAssessment && baselineAssessment[baselineKey] !== null && baselineAssessment[baselineKey] !== undefined) {
        start = baselineAssessment[baselineKey];
      } else {
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i][key] !== null && dataArray[i][key] !== undefined) {
            start = dataArray[i][key];
            break;
          }
        }
      }

      for (let i = dataArray.length - 1; i >= 0; i--) {
        if (dataArray[i][key] !== null && dataArray[i][key] !== undefined) {
          current = dataArray[i][key];
          break;
        }
      }

      const change = start !== null && current !== null ? Math.round((current - start) * 100) / 100 : null;
      return {
        start,
        current,
        change,
        trend: getTrendDirection(change),
      };
    };

    // 1. Establish the Clinical Baseline (Earliest Record)
    const baselineRecord = await prisma.clientAnthropometricRecord.findFirst({
      where: { tenantId, clientId, weightKg: { not: null }, deletedAt: null },
      orderBy: { measuredAt: 'asc' },
      select: { weightKg: true, measuredAt: true }
    });

    // 2. Establish the Current State (Latest Record)
    const currentRecord = await prisma.clientAnthropometricRecord.findFirst({
      where: { tenantId, clientId, weightKg: { not: null }, deletedAt: null },
      orderBy: { measuredAt: 'desc' },
      select: { weightKg: true, measuredAt: true }
    });

    const startingWeight = baselineRecord?.weightKg || null;
    const currentWeight = currentRecord?.weightKg || null;
    
    // 3. Execute the SSoT Calculation
    let netChange = null;
    if (startingWeight !== null && currentWeight !== null) {
      netChange = Number((currentWeight - startingWeight).toFixed(2));
    }

    const waistSummary = getSummaryField('waistCm', anthropometrics);
    const hipSummary = getSummaryField('hipCm', anthropometrics);
    const chestSummary = getSummaryField('chestCm', anthropometrics);
    const armSummary = getSummaryField('armCm', anthropometrics);
    const thighSummary = getSummaryField('thighCm', anthropometrics);

    const getAverage = (key) => {
      const values = checkIns
        .map((c) => c[key])
        .filter((v) => v !== null && v !== undefined);
      if (values.length === 0) return null;
      const sum = values.reduce((acc, curr) => acc + curr, 0);
      return Math.round((sum / values.length) * 10) / 10;
    };

    return {
      currentWeight,
      startingWeight,
      netChange,
      weightTrend: getTrendDirection(netChange),
      baselineDate: baselineRecord?.measuredAt || null,
      latestDate: currentRecord?.measuredAt || null,

      currentWaist: waistSummary.current,
      startingWaist: waistSummary.start,
      waistChange: waistSummary.change,
      waistTrend: waistSummary.trend,

      currentHip: hipSummary.current,
      startingHip: hipSummary.start,
      hipChange: hipSummary.change,
      hipTrend: hipSummary.trend,

      currentChest: chestSummary.current,
      startingChest: chestSummary.start,
      chestChange: chestSummary.change,
      chestTrend: chestSummary.trend,

      currentArm: armSummary.current,
      startingArm: armSummary.start,
      armChange: armSummary.change,
      armTrend: armSummary.trend,

      currentThigh: thighSummary.current,
      startingThigh: thighSummary.start,
      thighChange: thighSummary.change,
      thighTrend: thighSummary.trend,

      averageSleep: getAverage('sleepHours'),
      averageWater: getAverage('waterIntakeLiters'),
      averageAdherence: getAverage('planAdherence'),
      lastCheckInDate,
      checkInCount,
      riskSummary,
    };
  },

  /**
   * Retrieves a simplified dashboard metrics snapshot for a client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<object>}
   */
  async getClientProgressSnapshot(tenantId, clientId) {
    const summary = await this.getClientProgressSummary(tenantId, clientId);

    // Calculate weight and waist lost (positive value represents loss)
    const weightLost =
      summary.startingWeight !== null && summary.currentWeight !== null
        ? Math.round((summary.startingWeight - summary.currentWeight) * 100) / 100
        : 0;

    const waistLost =
      summary.startingWaist !== null && summary.currentWaist !== null
        ? Math.round((summary.startingWaist - summary.currentWaist) * 100) / 100
        : 0;

    // Average adherence percentage: average score (1-5) scaled to %
    const averageAdherence =
      summary.averageAdherence !== null ? Math.round((summary.averageAdherence / 5) * 100) : 0;

    return {
      weightLost,
      waistLost,
      averageAdherence,
      averageSleep: summary.averageSleep || 0,
      checkInCount: summary.checkInCount || 0,
    };
  },

  /**
   * Compiles practitioner review dashboard data and analytics.
   *
   * @param {string} tenantId
   * @returns {Promise<object>}
   */
  async getReviewDashboard(tenantId) {
    const [
      pendingReviews,
      requiresFollowUp,
      recentCheckIns,
      allCheckIns,
      statusCounts,
    ] = await Promise.all([
      progressRepository.findPendingReviews(tenantId, 5),
      progressRepository.findRequiresFollowUp(tenantId, 5),
      progressRepository.findRecentCheckIns(tenantId, 5),
      progressRepository.findTenantCheckIns(tenantId),
      progressRepository.countCheckInsByStatus(tenantId),
    ]);

    // Group check-ins by client
    const clientCheckInsMap = {};
    allCheckIns.forEach((c) => {
      if (!c.client) return;
      if (!clientCheckInsMap[c.clientId]) {
        clientCheckInsMap[c.clientId] = {
          client: c.client,
          checkIns: [],
        };
      }
      clientCheckInsMap[c.clientId].checkIns.push(c);
    });

    const lowAdherenceClients = [];
    const weightStalledClients = [];

    Object.keys(clientCheckInsMap).forEach((clientId) => {
      const entry = clientCheckInsMap[clientId];
      const checkIns = entry.checkIns; // checkIns list is ordered checkInDate desc
      const client = entry.client;
      const fullName = `${client.firstName} ${client.lastName}`;

      // 1. Calculate low adherence: average adherence < 3
      const adherenceVals = checkIns
        .map((c) => c.planAdherence)
        .filter((v) => v !== null && v !== undefined);

      if (adherenceVals.length > 0) {
        const sum = adherenceVals.reduce((acc, curr) => acc + curr, 0);
        const averageAdherence = Math.round((sum / adherenceVals.length) * 100) / 100;

        if (averageAdherence < PROGRESS_CONSTANTS.ADHERENCE_LOW_THRESHOLD) {
          const latestWeight = checkIns.find((c) => c.weightKg !== null)?.weightKg || null;
          lowAdherenceClients.push({
            clientId,
            fullName,
            latestWeight,
            averageAdherence,
          });
        }
      }

      // 2. Calculate weight stalled: net weight change over last 3 check-ins >= -0.2 kg
      // Sort chronologically (asc) to inspect chronological sequence
      const sortedCheckIns = [...checkIns].sort((a, b) => a.checkInDate - b.checkInDate);
      const weightCheckIns = sortedCheckIns.filter(
        (c) => c.weightKg !== null && c.weightKg !== undefined
      );

      if (weightCheckIns.length >= 2) {
        const recentWeightCheckIns = weightCheckIns.slice(-PROGRESS_CONSTANTS.RECENT_CHECK_INS_LIMIT);
        const latest = recentWeightCheckIns[recentWeightCheckIns.length - 1];
        const oldest = recentWeightCheckIns[0];

        const weightChange = Math.round((latest.weightKg - oldest.weightKg) * 100) / 100;

        if (weightChange >= PROGRESS_CONSTANTS.WEIGHT_STALL_TOLERANCE) {
          weightStalledClients.push({
            clientId,
            fullName,
            latestWeight: latest.weightKg,
            weightChange,
          });
        }
      }
    });

    // Calculate completion rate
    const reviewed = statusCounts.REVIEWED || 0;
    const submitted = statusCounts.SUBMITTED || 0;
    const totalReviewable = reviewed + submitted;
    const reviewCompletionRate =
      totalReviewable > 0 ? Math.round((reviewed / totalReviewable) * 100) : 100;

    return {
      pendingReviews,
      requiresFollowUp,
      recentCheckIns,
      lowAdherenceClients,
      weightStalledClients,
      reviewCompletionRate,
    };
  },

  /**
   * Full Progress Dashboard Aggregator — single-shot endpoint.
   *
   * Fetches SSoT summary + anthropometric timeline + polymorphic lifestyle
   * timeline in one parallelised payload, independent of check-in status.
   *
   * A client with exactly 1 Assessment and 0 check-ins will receive:
   *   - summary: live anthropometric baseline values from the SSoT ledger
   *   - chartData.anthropometrics: [{ measuredAt, weightKg, bmi, ... }]
   *   - chartData.lifestyle: [{ date, sleepHours, waterIntakeLiters, source: 'ASSESSMENT' }]
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<object>}
   */
  async getFullProgressDashboard(tenantId, clientId) {
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    // 1. Parallelise all three data sources — no serial waterfall
    const [summary, anthropometricRecords, assessments, checkIns] = await Promise.all([
      // SSoT summary (starting / current / net) — already check-in-independent
      this.getClientProgressSummary(tenantId, clientId),

      // Anthropometric SSoT ledger (Repairs the Progress charts)
      prisma.clientAnthropometricRecord.findMany({
        where: { tenantId, clientId, deletedAt: null },
        orderBy: { measuredAt: 'asc' },
        select: {
          measuredAt: true,
          weightKg: true,
          bmi: true,
          waistCm: true,
          chestCm: true,
          armCm: true,
          thighCm: true,
          hipCm: true,
        },
      }),

      // Assessment T=0 baseline for lifestyle polymorphic union
      prisma.assessment.findMany({
        where: { tenantId, clientId, deletedAt: null },
        orderBy: { assessmentDate: 'asc' },
        select: { assessmentDate: true, sleepHours: true, waterIntakeLiters: true },
      }),

      // Check-in lifestyle self-reports (SUBMITTED + REVIEWED only)
      prisma.clientCheckIn.findMany({
        where: {
          tenantId,
          clientId,
          status: { in: ['SUBMITTED', 'REVIEWED'] },
          deletedAt: null,
        },
        orderBy: { checkInDate: 'asc' },
        select: { checkInDate: true, sleepHours: true, waterIntakeLiters: true },
      }),
    ]);

    // 2. Polymorphic lifestyle timeline — Assessment T=0 ∪ check-in self-reports
    const lifestyleTimeline = buildLifestyleTimeline(assessments, checkIns);

    // 3. Return resilient payload — all fields default to [] / null, never error
    return {
      summary,
      chartData: {
        anthropometrics: anthropometricRecords,
        lifestyle: lifestyleTimeline,
      },
      checkInCount: checkIns.length,
    };
  },
};
