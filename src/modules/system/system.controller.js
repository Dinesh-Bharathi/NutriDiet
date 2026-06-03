import {
  AssessmentSectionType,
  AssessmentSectionWorkflowStatus,
  ClientGoalType,
  ClientGoalStatus,
  LabResultSeverity,
  RiskFlagSeverity,
  RiskFlagStatus,
  Gender,
  ClientStatus,
  OnboardingStatus,
  CheckInStatus,
} from '@prisma/client';

export const systemController = {
  /**
   * Retrieves all system enumerations dynamically from the database layer.
   * This guarantees the frontend uses the exact string values expected by Prisma.
   */
  async getEnums(req, res) {
    res.status(200).json({
      success: true,
      data: {
        version: '1.0.0',
        AssessmentSectionType,
        AssessmentSectionWorkflowStatus,
        ClientGoalType,
        ClientGoalStatus,
        LabResultSeverity,
        RiskFlagSeverity,
        RiskFlagStatus,
        Gender,
        ClientStatus,
        OnboardingStatus,
        CheckInStatus,
        ActivityLevel: {
          SEDENTARY: 'SEDENTARY',
          LIGHTLY_ACTIVE: 'LIGHTLY_ACTIVE',
          MODERATELY_ACTIVE: 'MODERATELY_ACTIVE',
          VERY_ACTIVE: 'VERY_ACTIVE',
          EXTRA_ACTIVE: 'EXTRA_ACTIVE',
        },
      },
    });
  },
};
