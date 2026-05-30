// src/modules/calendar-engine/calendar-engine.service.js
import prisma from '../../lib/prisma.js';

function getDaysDifference(date1, date2) {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export const calendarEngineService = {
  /**
   * Resolves the cycle day, active cycle, and offset information for a given plan and date.
   */
  resolveCycleDay(plan, targetDate) {
    if (!plan || !plan.cycles || plan.cycles.length === 0) {
      return {
        isCycleBased: false,
        cycleDay: null,
        activeCycle: null,
        planDay: null,
      };
    }

    const start = plan.cycleStartDate || plan.startDate || plan.createdAt;
    const daysElapsed = getDaysDifference(new Date(start), new Date(targetDate));
    const planDay = daysElapsed + 1;

    // Find active cycle based on startDay
    const sortedCycles = [...plan.cycles].sort((a, b) => b.startDay - a.startDay);
    let activeCycle = sortedCycles.find((c) => c.startDay <= planDay);
    if (!activeCycle) {
      // Fallback to the earliest starting cycle
      activeCycle = [...plan.cycles].sort((a, b) => a.startDay - b.startDay)[0];
    }

    const activeDays = activeCycle.days ? activeCycle.days.filter((d) => d.isActive) : [];
    if (activeDays.length === 0) {
      return {
        isCycleBased: true,
        cycleDay: null,
        activeCycle,
        planDay,
      };
    }

    const cycleDayOffset = planDay - activeCycle.startDay;
    const offset = Math.max(0, cycleDayOffset);
    const index = offset % activeDays.length;
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
      });
    }

    return preview;
  },
};
