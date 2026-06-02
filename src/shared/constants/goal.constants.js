// Shared Goal Type Constants
// Used across Assessment, Clinical Profile, Nutrition Intelligence,
// Snapshot generation, and future Programs / AI Copilot modules.

export const GOAL_TYPE = Object.freeze({
  WEIGHT_LOSS: 'WEIGHT_LOSS',
  WEIGHT_GAIN: 'WEIGHT_GAIN',
  MAINTENANCE: 'MAINTENANCE',
  MUSCLE_GAIN: 'MUSCLE_GAIN',
  PERFORMANCE: 'PERFORMANCE',
  GENERAL_WELLNESS: 'GENERAL_WELLNESS',
  MEDICAL_NUTRITION: 'MEDICAL_NUTRITION',
  CUSTOM: 'CUSTOM',
});

export const GOAL_TYPE_LABELS = Object.freeze({
  WEIGHT_LOSS: 'Weight Loss',
  WEIGHT_GAIN: 'Weight Gain',
  MAINTENANCE: 'Maintenance',
  MUSCLE_GAIN: 'Muscle Gain',
  PERFORMANCE: 'Performance',
  GENERAL_WELLNESS: 'General Wellness',
  MEDICAL_NUTRITION: 'Medical Nutrition Therapy',
  CUSTOM: 'Custom',
});

export const GOAL_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  SUPERSEDED: 'SUPERSEDED',
  CANCELLED: 'CANCELLED',
});
