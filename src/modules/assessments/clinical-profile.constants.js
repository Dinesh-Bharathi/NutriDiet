export const ASSESSMENT_SECTIONS = Object.freeze({
  ANTHROPOMETRICS: 'ANTHROPOMETRICS',
  MEDICAL: 'MEDICAL',
  LIFESTYLE: 'LIFESTYLE',
  LABS: 'LABS',
});

export const SECTION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  COMPLETED: 'COMPLETED',
});

import { GOAL_TYPE, GOAL_STATUS } from '../../shared/constants/goal.constants.js';

export const CLIENT_GOAL_TYPE = GOAL_TYPE;
export const CLIENT_GOAL_STATUS = GOAL_STATUS;

export const LAB_RESULT_SEVERITY = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const RISK_FLAG_SEVERITY = Object.freeze({
  INFO: 'INFO',
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const RISK_FLAG_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
});
