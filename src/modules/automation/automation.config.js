// src/modules/automation/automation.config.js

export const AUTOMATION_CONFIG = {
  generationDays: 14,
  mealReminderOffsetMinutes: 5,
  mealFollowupOffsetMinutes: 60,
  waterReminderTime: "08:00",
  sleepReminderTime: "08:05",

  // Response windows in seconds (Standardized)
  RESPONSE_WINDOWS: {
    MEAL_REMINDER: 2 * 60 * 60,      // 2 hours
    MEAL_FOLLOWUP: 4 * 60 * 60,      // 4 hours
    WATER_REMINDER: 24 * 60 * 60,    // 24 hours
    SLEEP_REMINDER: 24 * 60 * 60,    // 24 hours
  },

  // Scoring weights for compliance calculations
  SCORING_WEIGHTS: {
    WATER: {
      "<1L": 25,
      "1-2L": 50,
      "2-3L": 80,
      "3L+": 100,
    },
    SLEEP: {
      "<5H": 25,
      "5-6H": 60,
      "7-8H": 100,
      "8H+": 90,
    },
  },
};
