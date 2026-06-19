// src/modules/automation/compliance.service.js

import prisma from '../../lib/prisma.js';
import { AUTOMATION_CONFIG } from './automation.config.js';
import { utcToZonedTime, format } from 'date-fns-tz';
import logger from '../../utils/logger.js';
import { emitTenantEvent } from '../../lib/socket.js';

export const complianceService = {
  /**
   * Creates a pending compliance event for a sent reminder job.
   *
   * @param {object} tx - Prisma transaction context
   * @param {object} reminderJob - Sent ReminderJob details
   */
  async createComplianceEvent(tx, reminderJob) {
    const db = tx || prisma;

    // Resolve client timezone
    const client = await db.client.findUnique({
      where: { id: reminderJob.clientId },
      select: { timezone: true },
    });
    const timezone = client?.timezone || 'UTC';

    // Calculate local date (YYYY-MM-DD) based on client timezone
    const zonedTime = utcToZonedTime(reminderJob.scheduledFor, timezone);
    const localDate = format(zonedTime, 'yyyy-MM-dd', { timeZone: timezone });

    // Determine response window closes timestamp
    const windowSeconds =
      AUTOMATION_CONFIG.RESPONSE_WINDOWS[reminderJob.jobType] || 4 * 60 * 60;
    const responseWindowClosesAt = new Date(
      reminderJob.scheduledFor.getTime() + windowSeconds * 1000
    );

    // Snapshot meal variables from payload
    const isMeal =
      reminderJob.jobType === 'MEAL_REMINDER' ||
      reminderJob.jobType === 'MEAL_FOLLOWUP';

    const event = await db.clientComplianceEvent.create({
      data: {
        tenantId: reminderJob.tenantId,
        clientId: reminderJob.clientId,
        automationId: reminderJob.automationId,
        reminderJobId: reminderJob.id,
        templateId: reminderJob.templateId,
        templateVersion: reminderJob.templateVersion,
        status: 'PENDING',
        responseType: 'NO_RESPONSE',
        localDate,
        scheduledFor: reminderJob.scheduledFor,
        responseWindowClosesAt,
        mealType: isMeal ? reminderJob.payload?.mealType || reminderJob.jobType : null,
        mealName: isMeal ? reminderJob.payload?.mealName || null : null,
        mealTime: isMeal ? reminderJob.payload?.mealTime || null : null,
        compiledTitle: reminderJob.compiledTitle,
        compiledMessage: reminderJob.compiledMessage,
      },
    });

    // Update job to store relation
    await db.reminderJob.update({
      where: { id: reminderJob.id },
      data: { complianceEventId: event.id },
    });

    logger.info(
      `[COMPLIANCE] Created PENDING event ${event.id} for job ${reminderJob.id} (Local Date: ${localDate})`
    );
    return event;
  },

  /**
   * Records client response and triggers daily summary updates.
   */
  async recordResponse(tenantId, clientId, eventId, { responseType, raw, value, source, respondedAt }) {
    const event = await prisma.clientComplianceEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      logger.warn(`[COMPLIANCE] Event ${eventId} not found during response capture.`);
      return;
    }

    const latencySeconds = Math.round(
      (respondedAt.getTime() - event.scheduledFor.getTime()) / 1000
    );

    const updatedEvent = await prisma.clientComplianceEvent.update({
      where: { id: eventId },
      data: {
        status: 'COMPLETED',
        responseType,
        responseRaw: raw || null,
        responseValue: value || null,
        responseLatencySeconds: latencySeconds,
        source: source || 'BUTTON',
        respondedAt,
      },
    });

    logger.info(
      `[COMPLIANCE] Captured response for event ${eventId}. Type: ${responseType}, Latency: ${latencySeconds}s`
    );

    // Eagerly update daily compliance summary
    await this.aggregateDailySummary(tenantId, clientId, event.localDate);

    // Emit live socket event to practitioners
    emitTenantEvent(tenantId, 'compliance:response_captured', {
      clientId,
      localDate: event.localDate,
      event: {
        id: updatedEvent.id,
        responseType: updatedEvent.responseType,
        respondedAt: updatedEvent.respondedAt,
        latencySeconds,
      },
    });

    return updatedEvent;
  },

  /**
   * Closes a pending compliance event with NO_RESPONSE upon timeout.
   */
  async closeExpiredPending(eventId) {
    const event = await prisma.clientComplianceEvent.findUnique({
      where: { id: eventId },
    });

    if (!event || event.status !== 'PENDING') return;

    logger.info(`[COMPLIANCE] Response window expired for event ${eventId}. Marking as NO_RESPONSE.`);

    await prisma.clientComplianceEvent.update({
      where: { id: eventId },
      data: {
        status: 'COMPLETED',
        responseType: 'NO_RESPONSE',
      },
    });

    // Re-aggregate compliance daily summary
    await this.aggregateDailySummary(event.tenantId, event.clientId, event.localDate);

    emitTenantEvent(event.tenantId, 'compliance:timeout', {
      clientId: event.clientId,
      localDate: event.localDate,
      eventId: event.id,
    });
  },

  /**
   * Aggregates compliance percentages and streaks for a client on a specific day.
   */
  async aggregateDailySummary(tenantId, clientId, localDateStr) {
    const targetDate = new Date(`${localDateStr}T00:00:00.000Z`);

    // Get all events for the day (excluding archived jobs)
    const events = await prisma.clientComplianceEvent.findMany({
      where: {
        clientId,
        localDate: localDateStr,
        reminderJob: { isArchived: false },
      },
      include: {
        reminderJob: true,
      },
    });

    if (events.length === 0) {
      // Clean up summary if no events exist
      await prisma.complianceDailySummary.deleteMany({
        where: { tenantId, clientId, date: targetDate },
      });
      return;
    }

    // 1. Calculate Meal Compliance
    const mealEvents = events.filter(
      (e) =>
        e.reminderJob.jobType === 'MEAL_REMINDER' ||
        e.reminderJob.jobType === 'MEAL_FOLLOWUP'
    );

    let mealCompliancePercent = 0;
    let mealsTotal = 0;
    let mealsCompleted = 0;

    if (mealEvents.length > 0) {
      // Group by mealName (e.g. Breakfast, Lunch, Dinner)
      const mealsMap = new Map();
      for (const e of mealEvents) {
        if (!e.mealName) continue;
        if (!mealsMap.has(e.mealName)) {
          mealsMap.set(e.mealName, []);
        }
        mealsMap.get(e.mealName).push(e);
      }

      mealsTotal = mealsMap.size;
      if (mealsTotal > 0) {
        let totalMealScore = 0;
        for (const [mealName, mealEvs] of mealsMap.entries()) {
          let bestScore = 0;
          let isMealCompleted = false;
          for (const ev of mealEvs) {
            let score = 0;
            if (ev.responseType === 'MEAL_COMPLETED') score = 1.0;
            else if (ev.responseType === 'MEAL_PARTIAL') score = 0.5;
            bestScore = Math.max(bestScore, score);
            if (ev.responseType === 'MEAL_COMPLETED' || ev.responseType === 'MEAL_PARTIAL') {
              isMealCompleted = true;
            }
          }
          totalMealScore += bestScore;
          if (isMealCompleted) {
            mealsCompleted++;
          }
        }
        mealCompliancePercent = (totalMealScore / mealsTotal) * 100;
      }
    }

    // 2. Calculate Water Compliance
    const waterEvents = events.filter(
      (e) => e.reminderJob.jobType === 'WATER_REMINDER'
    );

    let waterCompliancePercent = 0;
    const waterTotal = waterEvents.length;
    let waterCompleted = 0;

    if (waterEvents.length > 0) {
      let totalWaterScore = 0;
      for (const e of waterEvents) {
        if (e.responseType === 'WATER_INTAKE') {
          const valObj = e.responseValue || {};
          const range = valObj.waterRange || '1-2L';
          const weight = (AUTOMATION_CONFIG.SCORING_WEIGHTS.WATER[range] ?? 100) / 100;
          totalWaterScore += weight;
          waterCompleted++;
        }
      }
      waterCompliancePercent = (totalWaterScore / waterEvents.length) * 100;
    }

    // 3. Calculate Sleep Compliance
    const sleepEvents = events.filter(
      (e) => e.reminderJob.jobType === 'SLEEP_REMINDER'
    );

    let sleepCompliancePercent = 0;
    const sleepTotal = sleepEvents.length;
    let sleepCompleted = 0;

    if (sleepEvents.length > 0) {
      let totalSleepScore = 0;
      for (const e of sleepEvents) {
        if (e.responseType === 'SLEEP_HOURS') {
          const valObj = e.responseValue || {};
          const range = valObj.sleepRange || '7-8H';
          const weight = (AUTOMATION_CONFIG.SCORING_WEIGHTS.SLEEP[range] ?? 100) / 100;
          totalSleepScore += weight;
          sleepCompleted++;
        }
      }
      sleepCompliancePercent = (totalSleepScore / sleepEvents.length) * 100;
    }

    // 4. Calculate Overall Compliance
    let mealWeight = mealEvents.length > 0 ? 0.70 : 0.0;
    let waterWeight = waterEvents.length > 0 ? 0.15 : 0.0;
    let sleepWeight = sleepEvents.length > 0 ? 0.15 : 0.0;
    const sumWeights = mealWeight + waterWeight + sleepWeight;

    let overallCompliancePercent = 0;
    if (sumWeights > 0) {
      overallCompliancePercent =
        (mealCompliancePercent * mealWeight +
          waterCompliancePercent * waterWeight +
          sleepCompliancePercent * sleepWeight) /
        sumWeights;
    }

    // 5. Response Counts
    const responseCount = events.filter(
      (e) => e.status === 'COMPLETED' && e.responseType !== 'NO_RESPONSE'
    ).length;
    const noResponseCount = events.filter(
      (e) => e.responseType === 'NO_RESPONSE' && e.status === 'COMPLETED'
    ).length;

    // 6. Save Aggregated Row
    await prisma.complianceDailySummary.upsert({
      where: {
        tenantId_clientId_date: {
          tenantId,
          clientId,
          date: targetDate,
        },
      },
      update: {
        mealCompliancePercent,
        waterCompliancePercent,
        sleepCompliancePercent,
        overallCompliancePercent,
        responseCount,
        noResponseCount,
        mealsCompleted,
        mealsTotal,
        waterCompleted,
        waterTotal,
        sleepCompleted,
        sleepTotal,
      },
      create: {
        tenantId,
        clientId,
        date: targetDate,
        mealCompliancePercent,
        waterCompliancePercent,
        sleepCompliancePercent,
        overallCompliancePercent,
        responseCount,
        noResponseCount,
        mealsCompleted,
        mealsTotal,
        waterCompleted,
        waterTotal,
        sleepCompleted,
        sleepTotal,
      },
    });

    // 7. Recalculate Client Streaks
    await this.recalculateStreaks(tenantId, clientId);
  },

  /**
   * Recalculates contiguous streaks chronologically backwards from today.
   */
  async recalculateStreaks(tenantId, clientId) {
    // Get all daily summaries chronologically
    const summaries = await prisma.complianceDailySummary.findMany({
      where: { clientId },
      orderBy: { date: 'asc' },
    });

    let currentStreak = 0;
    let longestStreak = 0;

    for (let i = 0; i < summaries.length; i++) {
      const isCompliant = summaries[i].overallCompliancePercent >= 70;
      if (isCompliant) {
        currentStreak++;
      } else {
        currentStreak = 0;
      }
      longestStreak = Math.max(longestStreak, currentStreak);

      // Update streaks in DB
      await prisma.complianceDailySummary.update({
        where: { id: summaries[i].id },
        data: { currentStreak, longestStreak },
      });
    }
  },

  /**
   * Retrieves daily summaries filtered by month.
   */
  async getCalendarData(tenantId, clientId, monthStr) {
    // monthStr is expected to be YYYY-MM
    const startStr = `${monthStr}-01T00:00:00.000Z`;
    const startDate = new Date(startStr);
    
    // Calculate last date of month
    const parts = monthStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = new Date(`${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`);

    const summaries = await prisma.complianceDailySummary.findMany({
      where: {
        clientId,
        tenantId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    return summaries.map((s) => ({
      date: format(s.date, 'yyyy-MM-dd'),
      overallCompliance: Math.round(s.overallCompliancePercent),
      mealCompliance: Math.round(s.mealCompliancePercent),
      waterCompliance: Math.round(s.waterCompliancePercent),
      sleepCompliance: Math.round(s.sleepCompliancePercent),
      eventCount: s.responseCount + s.noResponseCount,
      responseCount: s.responseCount,
      noResponseCount: s.noResponseCount,
      mealsCompleted: s.mealsCompleted,
      mealsTotal: s.mealsTotal,
      waterCompleted: s.waterCompleted,
      waterTotal: s.waterTotal,
      sleepCompleted: s.sleepCompleted,
      sleepTotal: s.sleepTotal,
    }));
  },

  /**
   * Compiles compliance KPI analytics and trend reporting.
   */
  async getAnalytics(tenantId, clientId, period = '7d') {
    const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const summaries = await prisma.complianceDailySummary.findMany({
      where: {
        clientId,
        tenantId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    if (summaries.length === 0) {
      return {
        overallRate: null,
        mealAdherence: null,
        waterAdherence: null,
        sleepAdherence: null,
        avgResponseLatencyMinutes: null,
        currentStreak: 0,
        longestStreak: 0,
        noResponseRate: null,
        mostMissedMeal: 'N/A',
        trends: {
          weekly: [],
          monthly: [],
        },
      };
    }

    // Aggregates
    const overallSum = summaries.reduce((acc, s) => acc + s.overallCompliancePercent, 0);
    const mealSum = summaries.reduce((acc, s) => acc + s.mealCompliancePercent, 0);
    const waterSum = summaries.reduce((acc, s) => acc + s.waterCompliancePercent, 0);
    const sleepSum = summaries.reduce((acc, s) => acc + s.sleepCompliancePercent, 0);
    const count = summaries.length;

    // Streak is obtained from the latest summary record
    const latestSummary = summaries[summaries.length - 1];
    const currentStreak = latestSummary?.currentStreak || 0;
    const longestStreak = latestSummary?.longestStreak || 0;

    // Latency and Missed Meals need compliance events (excluding archived jobs)
    const events = await prisma.clientComplianceEvent.findMany({
      where: {
        clientId,
        tenantId,
        createdAt: { gte: startDate },
        reminderJob: { isArchived: false },
      },
    });

    let totalLatencySeconds = 0;
    let latencyCount = 0;
    const missedMealsMap = new Map();

    for (const e of events) {
      if (e.status === 'COMPLETED' && e.respondedAt && e.responseLatencySeconds !== null) {
        totalLatencySeconds += e.responseLatencySeconds;
        latencyCount++;
      }
      // Track missed meals (responseType === NO_RESPONSE or MEAL_SKIPPED)
      const isMeal = e.mealName && (e.responseType === 'NO_RESPONSE' || e.responseType === 'MEAL_SKIPPED');
      if (isMeal) {
        missedMealsMap.set(e.mealName, (missedMealsMap.get(e.mealName) || 0) + 1);
      }
    }

    const avgResponseLatencyMinutes =
      latencyCount > 0 ? parseFloat(((totalLatencySeconds / latencyCount) / 60).toFixed(1)) : 0;

    // Missed meal resolution
    let mostMissedMeal = 'N/A';
    let maxMissedVal = 0;
    for (const [meal, missedCount] of missedMealsMap.entries()) {
      if (missedCount > maxMissedVal) {
        maxMissedVal = missedCount;
        mostMissedMeal = meal;
      }
    }

    // No response rate
    const totalJobsCount = events.length;
    const totalNoResponses = events.filter((e) => e.responseType === 'NO_RESPONSE' && e.status === 'COMPLETED').length;
    const noResponseRate = totalJobsCount > 0 ? Math.round((totalNoResponses / totalJobsCount) * 100) : 0;

    // Trend grouping: weekly trend
    const weeklyTrends = [];
    let tempSum = 0;
    let tempCount = 0;
    let weekIndex = 1;

    for (let i = 0; i < summaries.length; i++) {
      tempSum += summaries[i].overallCompliancePercent;
      tempCount++;
      if (tempCount === 7 || i === summaries.length - 1) {
        weeklyTrends.push({
          label: `Week ${weekIndex}`,
          rate: Math.round(tempSum / tempCount),
        });
        tempSum = 0;
        tempCount = 0;
        weekIndex++;
      }
    }

    // Monthly trend
    const monthMap = new Map();
    for (const s of summaries) {
      const monthLabel = format(s.date, 'MMM');
      if (!monthMap.has(monthLabel)) {
        monthMap.set(monthLabel, []);
      }
      monthMap.get(monthLabel).push(s.overallCompliancePercent);
    }

    const monthlyTrends = [];
    for (const [label, rates] of monthMap.entries()) {
      const avg = rates.reduce((acc, val) => acc + val, 0) / rates.length;
      monthlyTrends.push({
        label,
        rate: Math.round(avg),
      });
    }

    return {
      overallRate: Math.round(overallSum / count),
      mealAdherence: Math.round(mealSum / count),
      waterAdherence: Math.round(waterSum / count),
      sleepAdherence: Math.round(sleepSum / count),
      avgResponseLatencyMinutes,
      currentStreak,
      longestStreak,
      noResponseRate,
      mostMissedMeal,
      trends: {
        weekly: weeklyTrends,
        monthly: monthlyTrends,
      },
    };
  },

  /**
   * Paginated compliance events list.
   */
  async getEvents(tenantId, clientId, page = 1, limit = 20, jobType = null, localDate = null) {
    const where = {
      tenantId,
      clientId,
      reminderJob: { isArchived: false },
    };
    if (jobType) {
      where.reminderJob.jobType = jobType;
    }
    if (localDate) {
      where.localDate = localDate;
    }

    const total = await prisma.clientComplianceEvent.count({ where });
    const totalPages = Math.ceil(total / limit);

    const events = await prisma.clientComplianceEvent.findMany({
      where,
      include: {
        reminderJob: true,
      },
      orderBy: { scheduledFor: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      events: events.map((e) => {
        let complianceScore = 0.0;
        if (e.reminderJob.jobType === 'MEAL_REMINDER' || e.reminderJob.jobType === 'MEAL_FOLLOWUP') {
          if (e.responseType === 'MEAL_COMPLETED') complianceScore = 1.0;
          else if (e.responseType === 'MEAL_PARTIAL') complianceScore = 0.5;
        } else if (e.reminderJob.jobType === 'WATER_REMINDER') {
          if (e.responseType === 'WATER_INTAKE') {
            const valObj = e.responseValue || {};
            const range = valObj.waterRange || '1-2L';
            complianceScore = (AUTOMATION_CONFIG.SCORING_WEIGHTS.WATER[range] ?? 100) / 100;
          }
        } else if (e.reminderJob.jobType === 'SLEEP_REMINDER') {
          if (e.responseType === 'SLEEP_HOURS') {
            const valObj = e.responseValue || {};
            const range = valObj.sleepRange || '7-8H';
            complianceScore = (AUTOMATION_CONFIG.SCORING_WEIGHTS.SLEEP[range] ?? 100) / 100;
          }
        }

        return {
          id: e.id,
          jobType: e.reminderJob.jobType,
          scheduledFor: e.scheduledFor,
          outcome: e.responseType === 'NO_RESPONSE' ? 'NO_RESPONSE' : e.status === 'PENDING' ? 'PENDING' : e.responseType,
          mealType: e.mealType,
          mealName: e.mealName,
          mealTime: e.mealTime,
          respondedAt: e.respondedAt,
          responseRaw: e.responseRaw,
          responseValue: e.responseValue,
          responseSource: e.source,
          compiledTitle: e.compiledTitle,
          compiledMessage: e.compiledMessage,
          latencyMinutes: e.responseLatencySeconds ? parseFloat((e.responseLatencySeconds / 60).toFixed(1)) : null,
          complianceScore,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },
};
