// src/modules/calendar-engine/calendar-engine.service.js
import prisma from '../../lib/prisma.js';
import { getActiveCycleDay } from './calendar.utils.js';

export const calendarEngineService = {
  /**
   * Resolves the cycle day, active cycle, and offset information for a given plan and date.
   */
  resolveCycleDay(plan, targetDate, providedTimezone) {
    if (!plan || !plan.cycles || plan.cycles.length === 0) {
      return {
        isCycleBased: false,
        cycleDay: null,
        activeCycle: null,
        planDay: null,
      };
    }

    let timezone = providedTimezone || 'UTC';
    if (!providedTimezone) {
      if (plan.tenant?.timezone) timezone = plan.tenant.timezone;
      if (plan.client?.timezone) timezone = plan.client.timezone;
      if (plan.client?.lifestyleProfile?.metadata) {
        try {
          const meta = typeof plan.client.lifestyleProfile.metadata === 'string'
            ? JSON.parse(plan.client.lifestyleProfile.metadata)
            : plan.client.lifestyleProfile.metadata;
          if (meta && meta.timezone) {
            timezone = meta.timezone;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }

    const start = plan.cycleStartDate || plan.startDate || plan.createdAt;
    
    const { planDay, activeCycle, activeDays, index } = getActiveCycleDay(
      start,
      targetDate,
      plan.cycles,
      timezone
    );

    if (activeDays.length === 0 || index === -1) {
      return {
        isCycleBased: true,
        cycleDay: null,
        activeCycle,
        planDay,
      };
    }

    const cycleDay = activeDays[index];

    return {
      isCycleBased: true,
      cycleDay,
      activeCycle,
      planDay,
      cycleLength: activeDays.length,
      currentPosition: index + 1,
    };
  },

  /**
   * Resolves plan details for a client and date.
   */
  async resolveCurrentPlanDay(tenantId, clientId, targetDate) {
    const target = targetDate ? new Date(targetDate) : new Date();

    const plan = await prisma.dietPlan.findFirst({
      where: {
        tenantId,
        clientId,
        status: 'ACTIVE',
      },
      include: {
        meals: {
          orderBy: { mealOrder: 'asc' },
          include: {
            items: true,
          },
        },
        cycles: {
          orderBy: { startDay: 'asc' },
          include: {
            days: {
              orderBy: { dayNumber: 'asc' },
              include: {
                meals: {
                  orderBy: { mealOrder: 'asc' },
                  include: {
                    items: true,
                  },
                },
              },
            },
          },
        },
        tenant: { select: { timezone: true } },
        client: {
          include: {
            lifestyleProfile: { select: { metadata: true } }
          }
        },
      },
    });

    if (!plan) {
      return null;
    }

    const resolution = this.resolveCycleDay(plan, target);
    return {
      plan,
      ...resolution,
    };
  },

  /**
   * Returns a plan object with meals mapped to the current cycle day to maintain backward compatibility.
   */
  async getPlanForDate(tenantId, clientId, targetDate) {
    const resolution = await this.resolveCurrentPlanDay(tenantId, clientId, targetDate);
    if (!resolution) {
      return null;
    }

    const { plan, isCycleBased, cycleDay } = resolution;

    if (!isCycleBased) {
      return plan;
    }

    // Map cycle day meals to plan.meals for backward compatibility
    const resolvedMeals = cycleDay ? cycleDay.meals : [];

    return {
      ...plan,
      meals: resolvedMeals,
      resolvedCycleDay: cycleDay
        ? {
            id: cycleDay.id,
            dayNumber: cycleDay.dayNumber,
            dayLabel: cycleDay.dayLabel,
            description: cycleDay.description,
            plannedCalories: cycleDay.plannedCalories,
            plannedProtein: cycleDay.plannedProtein,
            plannedCarbs: cycleDay.plannedCarbs,
            plannedFat: cycleDay.plannedFat,
          }
        : null,
    };
  },

  /**
   * Computes position info within a cycle.
   */
  getCurrentCyclePosition(plan, targetDate) {
    const target = targetDate ? new Date(targetDate) : new Date();
    const res = this.resolveCycleDay(plan, target);
    if (!res.isCycleBased || !res.cycleDay) {
      return null;
    }

    return {
      cycleLength: res.cycleLength,
      currentPosition: res.currentPosition,
      currentDay: res.cycleDay.dayLabel,
    };
  },

  /**
   * Generates calendar preview dates.
   */
  async getPlanCalendarPreview(tenantId, planId, limit = 30) {
    const plan = await prisma.dietPlan.findFirst({
      where: { id: planId, tenantId },
      include: {
        cycles: {
          orderBy: { startDay: 'asc' },
          include: {
            days: {
              orderBy: { dayNumber: 'asc' },
              include: {
                meals: {
                  orderBy: { mealOrder: 'asc' },
                  include: {
                    items: true,
                  },
                },
              },
            },
          },
        },
        tenant: { select: { timezone: true } },
        client: {
          include: {
            lifestyleProfile: { select: { metadata: true } }
          }
        },
      },
    });

    if (!plan) {
      return [];
    }

    const start = plan.cycleStartDate || plan.startDate || new Date();
    const preview = [];

    for (let i = 0; i < limit; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);

      const formattedDate = date.toISOString().split('T')[0];
      const res = this.resolveCycleDay(plan, date);

      preview.push({
        date: formattedDate,
        dayLabel: res.cycleDay ? res.cycleDay.dayLabel : 'Static Day',
        description: res.cycleDay ? (res.cycleDay.description || '') : '',
      });
    }

    return preview;
  },
};
