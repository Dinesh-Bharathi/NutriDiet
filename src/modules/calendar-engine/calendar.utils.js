import { differenceInCalendarDays } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

export function getActiveCycleDay(startDate, targetDate, cycles, timezone = 'UTC') {
  const zonedStart = utcToZonedTime(new Date(startDate), timezone);
  const zonedTarget = utcToZonedTime(new Date(targetDate), timezone);

  const daysElapsed = differenceInCalendarDays(zonedTarget, zonedStart);
  const planDay = daysElapsed + 1;

  // Find active cycle based on startDay
  const sortedCycles = [...cycles].sort((a, b) => b.startDay - a.startDay);
  let activeCycle = sortedCycles.find((c) => c.startDay <= planDay);
  if (!activeCycle) {
    // Fallback to the earliest starting cycle
    activeCycle = [...cycles].sort((a, b) => a.startDay - b.startDay)[0];
  }

  const activeDays = activeCycle.days ? activeCycle.days.filter((d) => d.isActive) : [];
  if (activeDays.length === 0) {
    return { planDay, activeCycle, activeDays, index: -1 };
  }

  const cycleDayOffset = planDay - activeCycle.startDay;
  const offset = Math.max(0, cycleDayOffset);
  const index = offset % activeDays.length;

  return { planDay, activeCycle, activeDays, index };
}
