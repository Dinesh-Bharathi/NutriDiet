// src/modules/progress/progress.constants.js

export const PROGRESS_CONSTANTS = {
  ADHERENCE_LOW_THRESHOLD: 3,     // Average adherence < 3 is considered low
  RECENT_CHECK_INS_LIMIT: 3,      // Number of recent check-ins to inspect for weight stalling
  WEIGHT_STALL_TOLERANCE: -0.2,   // Weight change >= -0.2 kg over the recent limit indicates stalling
};
