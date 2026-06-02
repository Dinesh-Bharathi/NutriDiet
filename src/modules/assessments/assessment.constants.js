// src/modules/assessments/assessment.constants.js
// Domain constants for client assessments.

import { GOAL_TYPE } from '../../shared/constants/goal.constants.js';

export const ACTIVITY_LEVEL = Object.freeze({
  SEDENTARY: 'SEDENTARY',
  LIGHTLY_ACTIVE: 'LIGHTLY_ACTIVE',
  MODERATELY_ACTIVE: 'MODERATELY_ACTIVE',
  VERY_ACTIVE: 'VERY_ACTIVE',
  EXTRA_ACTIVE: 'EXTRA_ACTIVE',
});

export const CLIENT_GOAL_TYPE = GOAL_TYPE;
