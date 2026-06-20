// src/modules/automation/reminder-generator.service.js

import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { format, addDays } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { AUTOMATION_CONFIG } from './automation.config.js';
import { automationTemplateRegistry } from './automation-template-variables.js';
import { calendarEngineService } from '../calendar-engine/calendar-engine.service.js';
import { reminderProducer } from './reminder-producer.js';

/**
 * Generates a standard CUID-compatible format ID in memory (25 alphanumeric characters starting with 'c').
 * Used to pre-assign job IDs before database insertion and BullMQ queue scheduling.
 *
 * @returns {string} Pre-generated CUID
 */
function generateCuid() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return 'c' + (timestamp + randomStr).substring(0, 24);
}

export const reminderGeneratorService = {
  /**
   * Generates and enqueues reminder jobs for an active automation session.
   *
   * @param {string} tenantId
   * @param {string} automationId
   * @returns {Promise<number>} Number of jobs generated
   */
  async generateJobs(tenantId, automationId, options = { dryRun: false }) {
    logger.info(`[REMINDER_GENERATOR] Starting job generation for automation: ${automationId} (Dry run: ${!!options?.dryRun})`, { tenantId, automationId });

    // Fetch client & tenant details
    const automation = await prisma.dietPlanAutomation.findUnique({
      where: { id: automationId, tenantId },
      include: {
        client: {
          include: { dietitian: true },
        },
        tenant: true,
      },
    });

    if (!automation) {
      throw new Error(`Automation not found: ${automationId}`);
    }

    const { client, tenant } = automation;
    const clientTimezone = client.timezone || 'UTC';

    // Resolve tenant reminder configuration
    const tenantConfig = tenant.reminderConfig || {};
    const mealReminderOffset = tenantConfig.mealReminderOffsetMinutes !== undefined
      ? parseInt(tenantConfig.mealReminderOffsetMinutes, 10)
      : AUTOMATION_CONFIG.mealReminderOffsetMinutes;

    const mealFollowupDelay = tenantConfig.mealFollowupOffsetMinutes !== undefined
      ? parseInt(tenantConfig.mealFollowupOffsetMinutes, 10)
      : AUTOMATION_CONFIG.mealFollowupOffsetMinutes;

    const waterStartTime = tenantConfig.waterStartTime || '08:00';
    const waterEndTime = tenantConfig.waterEndTime || '20:00';
    const waterFrequencyHours = tenantConfig.waterFrequencyHours !== undefined ? parseInt(tenantConfig.waterFrequencyHours, 10) : 2;
    const sleepTime = tenantConfig.sleepReminderTime || AUTOMATION_CONFIG.sleepReminderTime;

    // Fetch the diet plan details with cycles & meals (with food items included)
    const dietPlan = await prisma.dietPlan.findUnique({
      where: { id: automation.dietPlanId, tenantId },
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

    if (!dietPlan) {
      throw new Error(`Diet plan not found: ${automation.dietPlanId}`);
    }

    // Determine target dates range (default 14 days)
    const start = dietPlan.startDate || new Date();
    const durationDays = AUTOMATION_CONFIG.generationDays;
    const end = dietPlan.endDate || addDays(start, durationDays - 1);

    const zonedStart = utcToZonedTime(start, clientTimezone);
    const zonedEnd = utcToZonedTime(end, clientTimezone);

    const diffTime = Math.abs(zonedEnd - zonedStart);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const maxDays = Math.min(diffDays, 60); // safety cap

    const jobsToCreate = [];
    const queuedJobs = [];

    // 1. Fetch existing pending jobs outside transaction to keep transaction fast
    const existingPending = await prisma.reminderJob.findMany({
      where: {
        tenantId,
        clientId: client.id,
        automationId: automation.id,
        status: 'PENDING',
        isArchived: false,
      },
      select: { id: true, queueJobId: true },
    });

    // Fetch all templates (active or inactive) for this tenant or default
    const templates = await prisma.reminderTemplate.findMany({
      where: {
        OR: [
          { tenantId },
          { tenantId: null, isDefault: true },
        ],
      },
    });

    const getTemplate = (type) => {
      const custom = templates.find(t => t.type === type && t.tenantId === tenantId);
      if (custom) {
        return custom.isActive ? custom : null;
      }
      const system = templates.find(t => t.type === type && t.tenantId === null);
      if (system) {
        return system.isActive ? system : null;
      }
      return null;
    };

    const now = new Date();

    // Construct jobs in memory with pre-generated IDs
    for (let i = 0; i < maxDays; i++) {
      const currentLocalDate = addDays(zonedStart, i);
      const dateStr = format(currentLocalDate, 'yyyy-MM-dd');

      // Resolve cycle day
      const resolution = calendarEngineService.resolveCycleDay(dietPlan, currentLocalDate, clientTimezone);
      const meals = resolution?.isCycleBased && resolution?.cycleDay
        ? resolution.cycleDay.meals
        : dietPlan.meals || [];

      // Meal reminders
      for (const meal of meals) {
        if (!meal.mealTime) continue;

        // Meal Reminder
        const reminderTemplate = getTemplate('MEAL_REMINDER');
        if (reminderTemplate) {
          const reminderTimeStr = offsetTime(meal.mealTime, -mealReminderOffset);
          const reminderUtc = zonedTimeToUtc(`${dateStr} ${reminderTimeStr}:00`, clientTimezone);

          // Only schedule if reminder is in the future
          if (reminderUtc > now) {
            const context = {
              client,
              tenant,
              dietPlan,
              meal: { name: getMealDisplay(meal.name), mealTime: meal.mealTime, items: meal.items || [] },
            };

            const compiledTitle = automationTemplateRegistry.compile(reminderTemplate.title, context);
            const compiledMessage = automationTemplateRegistry.compile(reminderTemplate.message, context);

            const jobId = generateCuid();
            const foodNames = meal.items ? meal.items.map(it => it.foodName) : [];
            const itemsSnapshot = meal.items ? meal.items.map(it => ({
              id: it.id,
              foodLibraryId: it.foodLibraryId,
              foodName: it.foodName,
              quantity: it.quantity,
              unit: it.unit,
              calories: it.calories,
              protein: it.protein,
              carbs: it.carbs,
              fat: it.fat,
              notes: it.notes,
            })) : [];

            jobsToCreate.push({
              id: jobId,
              tenantId,
              clientId: client.id,
              automationId: automation.id,
              dietPlanId: dietPlan.id,
              jobType: 'MEAL_REMINDER',
              scheduledFor: reminderUtc,
              timezone: clientTimezone,
              status: 'PENDING',
              templateId: reminderTemplate.id,
              templateVersion: reminderTemplate.version,
              automationVersion: automation.version,
              compiledTitle,
              compiledMessage,
              queueJobId: jobId,
              payload: {
                jobType: 'MEAL_REMINDER',
                clientId: client.id,
                automationId: automation.id,
                dietPlanId: dietPlan.id,
                mealId: meal.id,
                mealName: getMealDisplay(meal.name),
                mealTime: meal.mealTime,
                timezone: clientTimezone,
                foods: foodNames,
                items: itemsSnapshot,
                metadata: {
                  notes: meal.notes || null,
                },
              },
            });
          }
        }

        // Meal Follow-Up
        const followupTemplate = getTemplate('MEAL_FOLLOWUP');
        if (followupTemplate) {
          const followupTimeStr = offsetTime(meal.mealTime, mealFollowupDelay);
          const followupUtc = zonedTimeToUtc(`${dateStr} ${followupTimeStr}:00`, clientTimezone);

          // Only schedule if reminder is in the future
          if (followupUtc > now) {
            const context = {
              client,
              tenant,
              dietPlan,
              meal: { name: getMealDisplay(meal.name), mealTime: meal.mealTime, items: meal.items || [] },
            };

            const compiledTitle = automationTemplateRegistry.compile(followupTemplate.title, context);
            const compiledMessage = automationTemplateRegistry.compile(followupTemplate.message, context);

            const jobId = generateCuid();
            const foodNames = meal.items ? meal.items.map(it => it.foodName) : [];
            const itemsSnapshot = meal.items ? meal.items.map(it => ({
              id: it.id,
              foodLibraryId: it.foodLibraryId,
              foodName: it.foodName,
              quantity: it.quantity,
              unit: it.unit,
              calories: it.calories,
              protein: it.protein,
              carbs: it.carbs,
              fat: it.fat,
              notes: it.notes,
            })) : [];

            jobsToCreate.push({
              id: jobId,
              tenantId,
              clientId: client.id,
              automationId: automation.id,
              dietPlanId: dietPlan.id,
              jobType: 'MEAL_FOLLOWUP',
              scheduledFor: followupUtc,
              timezone: clientTimezone,
              status: 'PENDING',
              templateId: followupTemplate.id,
              templateVersion: followupTemplate.version,
              automationVersion: automation.version,
              compiledTitle,
              compiledMessage,
              queueJobId: jobId,
              payload: {
                jobType: 'MEAL_FOLLOWUP',
                clientId: client.id,
                automationId: automation.id,
                dietPlanId: dietPlan.id,
                mealId: meal.id,
                mealName: getMealDisplay(meal.name),
                mealTime: meal.mealTime,
                timezone: clientTimezone,
                foods: foodNames,
                items: itemsSnapshot,
                metadata: {
                  notes: meal.notes || null,
                },
              },
            });
          }
        }
      }

      // Water Reminders (Calculated according to client.timezone authority)
      if (automation.waterEnabled) {
        const waterTemplate = getTemplate('WATER_REMINDER');
        if (waterTemplate) {
          let waterTimes = [];
          if (automation.waterFrequencyType === 'CUSTOM' && automation.waterCustomTimes) {
            if (Array.isArray(automation.waterCustomTimes)) {
              // Legacy array fallback
              waterTimes.push(...automation.waterCustomTimes);
            } else if (typeof automation.waterCustomTimes === 'object') {
              const customStart = automation.waterCustomTimes.startTime || '08:00';
              const customEnd = automation.waterCustomTimes.endTime || '20:00';
              const customFreq = parseInt(automation.waterCustomTimes.frequencyHours, 10) || 2;
              waterTimes = generateIntervalTimes(customStart, customEnd, customFreq);
            }
          } else {
            // Use Clinic Defaults (FREQUENCY)
            waterTimes = generateIntervalTimes(waterStartTime, waterEndTime, waterFrequencyHours);
          }

          for (const timeStr of waterTimes) {
            const waterUtc = zonedTimeToUtc(`${dateStr} ${timeStr}:00`, clientTimezone);

            if (waterUtc > now) {
              const context = { client, tenant, dietPlan };
              const compiledTitle = automationTemplateRegistry.compile(waterTemplate.title, context);
              const compiledMessage = automationTemplateRegistry.compile(waterTemplate.message, context);

              const jobId = generateCuid();
              jobsToCreate.push({
                id: jobId,
                tenantId,
                clientId: client.id,
                automationId: automation.id,
                dietPlanId: dietPlan.id,
                jobType: 'WATER_REMINDER',
                scheduledFor: waterUtc,
                timezone: clientTimezone,
                status: 'PENDING',
                templateId: waterTemplate.id,
                templateVersion: waterTemplate.version,
                automationVersion: automation.version,
                compiledTitle,
                compiledMessage,
                queueJobId: jobId,
                payload: {
                  jobType: 'WATER_REMINDER',
                  clientId: client.id,
                  automationId: automation.id,
                  dietPlanId: dietPlan.id,
                  timezone: clientTimezone,
                },
              });
            }
          }
        }
      }

      // Water Follow-up (Calculated according to client.timezone authority)
      if (automation.waterEnabled) {
        const waterFollowupTemplate = getTemplate('WATER_FOLLOWUP');
        if (waterFollowupTemplate) {
          const sleepTimeStr = automation.sleepTime || sleepTime || '22:00';
          const waterFollowupOffset = tenantConfig.waterFollowupOffsetMinutes !== undefined
            ? parseInt(tenantConfig.waterFollowupOffsetMinutes, 10)
            : 10;
          const waterFollowupTimeStr = offsetTime(sleepTimeStr, -waterFollowupOffset);
          const waterFollowupUtc = zonedTimeToUtc(`${dateStr} ${waterFollowupTimeStr}:00`, clientTimezone);

          if (waterFollowupUtc > now) {
            const context = { client, tenant, dietPlan };
            const compiledTitle = automationTemplateRegistry.compile(waterFollowupTemplate.title, context);
            const compiledMessage = automationTemplateRegistry.compile(waterFollowupTemplate.message, context);

            const jobId = generateCuid();
            jobsToCreate.push({
              id: jobId,
              tenantId,
              clientId: client.id,
              automationId: automation.id,
              dietPlanId: dietPlan.id,
              jobType: 'WATER_FOLLOWUP',
              scheduledFor: waterFollowupUtc,
              timezone: clientTimezone,
              status: 'PENDING',
              templateId: waterFollowupTemplate.id,
              templateVersion: waterFollowupTemplate.version,
              automationVersion: automation.version,
              compiledTitle,
              compiledMessage,
              queueJobId: jobId,
              payload: {
                jobType: 'WATER_FOLLOWUP',
                clientId: client.id,
                automationId: automation.id,
                dietPlanId: dietPlan.id,
                timezone: clientTimezone,
              },
            });
          }
        }
      }

      // Sleep Reminders (Calculated according to client.timezone authority)
      if (automation.sleepEnabled) {
        const sleepTemplate = getTemplate('SLEEP_REMINDER');
        if (sleepTemplate) {
          const sleepTimeStr = automation.sleepTime || sleepTime || '22:00';
          const sleepUtc = zonedTimeToUtc(`${dateStr} ${sleepTimeStr}:00`, clientTimezone);

          if (sleepUtc > now) {
            const context = { client, tenant, dietPlan };
            const compiledTitle = automationTemplateRegistry.compile(sleepTemplate.title, context);
            const compiledMessage = automationTemplateRegistry.compile(sleepTemplate.message, context);

            const jobId = generateCuid();
            jobsToCreate.push({
              id: jobId,
              tenantId,
              clientId: client.id,
              automationId: automation.id,
              dietPlanId: dietPlan.id,
              jobType: 'SLEEP_REMINDER',
              scheduledFor: sleepUtc,
              timezone: clientTimezone,
              status: 'PENDING',
              templateId: sleepTemplate.id,
              templateVersion: sleepTemplate.version,
              automationVersion: automation.version,
              compiledTitle,
              compiledMessage,
              queueJobId: jobId,
              payload: {
                jobType: 'SLEEP_REMINDER',
                clientId: client.id,
                automationId: automation.id,
                dietPlanId: dietPlan.id,
                timezone: clientTimezone,
              },
            });
          }
        }
      }

      // Sleep Follow-up (Calculated according to client.timezone authority)
      const sleepFollowupEnabled = tenantConfig.sleepFollowupEnabled !== false;
      if (automation.sleepEnabled && sleepFollowupEnabled) {
        const sleepFollowupTemplate = getTemplate('SLEEP_FOLLOWUP');
        if (sleepFollowupTemplate) {
          const sleepFollowupTimeStr = tenantConfig.sleepFollowupTime || '07:00';
          const nextLocalDate = addDays(currentLocalDate, 1);
          const nextDateStr = format(nextLocalDate, 'yyyy-MM-dd');
          const sleepFollowupUtc = zonedTimeToUtc(`${nextDateStr} ${sleepFollowupTimeStr}:00`, clientTimezone);

          if (sleepFollowupUtc > now) {
            const context = { client, tenant, dietPlan };
            const compiledTitle = automationTemplateRegistry.compile(sleepFollowupTemplate.title, context);
            const compiledMessage = automationTemplateRegistry.compile(sleepFollowupTemplate.message, context);

            const jobId = generateCuid();
            jobsToCreate.push({
              id: jobId,
              tenantId,
              clientId: client.id,
              automationId: automation.id,
              dietPlanId: dietPlan.id,
              jobType: 'SLEEP_FOLLOWUP',
              scheduledFor: sleepFollowupUtc,
              timezone: clientTimezone,
              status: 'PENDING',
              templateId: sleepFollowupTemplate.id,
              templateVersion: sleepFollowupTemplate.version,
              automationVersion: automation.version,
              compiledTitle,
              compiledMessage,
              queueJobId: jobId,
              payload: {
                jobType: 'SLEEP_FOLLOWUP',
                clientId: client.id,
                automationId: automation.id,
                dietPlanId: dietPlan.id,
                timezone: clientTimezone,
              },
            });
          }
        }
      }
    }

    // If dry run, return the forecasted counts and do not touch database or queue
    if (options && options.dryRun) {
      const counts = {
        MEAL_REMINDER: 0,
        MEAL_FOLLOWUP: 0,
        WATER_REMINDER: 0,
        WATER_FOLLOWUP: 0,
        SLEEP_REMINDER: 0,
        SLEEP_FOLLOWUP: 0,
      };
      for (const job of jobsToCreate) {
        if (counts[job.jobType] !== undefined) {
          counts[job.jobType]++;
        }
      }
      return counts;
    }

    // 2. Run database step in a transaction (only bulk delete and bulk createMany)
    await prisma.$transaction(async (tx) => {
      // Delete existing PENDING jobs to prevent duplicates (idempotency)
      if (existingPending.length > 0) {
        await tx.reminderJob.deleteMany({
          where: {
            id: { in: existingPending.map(j => j.id) },
          },
        });
      }

      // Bulk create jobs in DB using createMany for fast execution
      if (jobsToCreate.length > 0) {
        await tx.reminderJob.createMany({
          data: jobsToCreate,
        });
      }
    }, {
      timeout: 10000,
    });

    // 3. Cancel old queue jobs in BullMQ outside the transaction
    for (const pj of existingPending) {
      if (pj.queueJobId) {
        await reminderProducer.cancelJob(pj.queueJobId);
      }
    }

    // 4. Queue new jobs in BullMQ outside transaction in parallel
    try {
      await Promise.all(
        jobsToCreate.map(async (job) => {
          const qJob = await reminderProducer.queueJob(job);
          queuedJobs.push(qJob.id);
        })
      );
    } catch (queueErr) {
      logger.error(`[REMINDER_FAILURE] Queue scheduling failed. Rolling back database records... Error: ${queueErr.message}`, {
        tenantId,
        automationId,
      });

      // Cleanup queued jobs in redis
      await Promise.all(queuedJobs.map(qId => reminderProducer.cancelJob(qId)));

      // Delete database jobs created in this batch to maintain consistent state
      await prisma.reminderJob.deleteMany({
        where: {
          id: { in: jobsToCreate.map(j => j.id) },
        },
      });

      throw new Error(`Failed to schedule queue reminders: ${queueErr.message}`);
    }

    logger.info(`[REMINDER_GENERATOR] Successfully created ${jobsToCreate.length} reminder jobs for automation: ${automationId}`);
    return jobsToCreate.length;
  },
};

/**
 * Offsets a time string by a given number of minutes.
 *
 * @param {string} timeStr - "HH:mm"
 * @param {number} offsetMinutes
 * @returns {string} Offset time "HH:mm"
 */
function offsetTime(timeStr, offsetMinutes) {
  const [hStr, mStr] = timeStr.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  
  const totalMinutes = hours * 60 + minutes + offsetMinutes;
  const wrappedMinutes = (totalMinutes + 24 * 60) % (24 * 60);
  
  const newHours = Math.floor(wrappedMinutes / 60);
  const newMinutes = wrappedMinutes % 60;
  
  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(newHours)}:${pad(newMinutes)}`;
}

function getMealDisplay(mealType) {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase().replace('_', ' ');
}

function generateIntervalTimes(startTime, endTime, frequencyHours) {
  const times = [];
  const startHour = parseInt(startTime.split(':')[0], 10) || 8;
  const startMin = parseInt(startTime.split(':')[1], 10) || 0;
  const endHour = parseInt(endTime.split(':')[0], 10) || 20;
  const endMin = parseInt(endTime.split(':')[1], 10) || 0;
  
  let currHour = startHour;
  let currMin = startMin;
  
  while (currHour < endHour || (currHour === endHour && currMin <= endMin)) {
    times.push(`${String(currHour).padStart(2, '0')}:${String(currMin).padStart(2, '0')}`);
    currHour += frequencyHours;
  }
  return times;
}

export default reminderGeneratorService;
