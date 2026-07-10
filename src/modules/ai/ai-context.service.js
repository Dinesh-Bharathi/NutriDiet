// src/modules/ai/ai-context.service.js
// ─────────────────────────────────────────────────────────────────────────────
// Service to compile multi-dimensional clinical context for the AI Agent.
// ─────────────────────────────────────────────────────────────────────────────
import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

export const aiContextService = {
  /**
   * Resolves the Client ID for a user.
   * If the user is a client, looks up the Client record by email.
   * If the user is a practitioner, returns the provided targetClientId.
   *
   * @param {string} tenantId
   * @param {object} user - Authenticated user object (req.user)
   * @param {string} [targetClientId] - Explicitly targeted client (practitioner view)
   * @returns {Promise<string|null>} Resolved clientId
   */
  async resolveClientId(tenantId, user, targetClientId) {
    if (user.role !== 'CLIENT') {
      return targetClientId || null;
    }

    // Resolve client record for the logged-in client user using unique email constraint
    const client = await prisma.client.findFirst({
      where: {
        email: user.email,
        tenantId,
        deletedAt: null,
      },
      select: { id: true },
    });

    return client ? client.id : null;
  },

  /**
   * Fetches full context for a client (goals, latest anthropometrics, lifestyle, consumed macros today)
   * and formats it into a structured text prompt block.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<string>} Compiled context string for the system prompt injection
   */
  async getClientContextPrompt(tenantId, clientId) {
    try {
      const today = new Date();
      // Set to local start of day
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));

      const [
        client,
        clinicalProfile,
        activeGoal,
        latestAnthropometrics,
        lifestyleProfile,
        todayMealLogs
      ] = await Promise.all([
        prisma.client.findFirst({
          where: { id: clientId, tenantId, deletedAt: null },
          select: { firstName: true, lastName: true, gender: true, dateOfBirth: true, timezone: true }
        }),
        prisma.clientClinicalProfile.findFirst({
          where: { clientId, tenantId, deletedAt: null },
          select: { summaryNotes: true }
        }),
        prisma.clientGoalProfile.findFirst({
          where: { clientId, tenantId, status: 'ACTIVE', deletedAt: null },
          select: { goalType: true, targetWeightKg: true, notes: true }
        }),
        prisma.clientAnthropometricRecord.findFirst({
          where: { clientId, tenantId, deletedAt: null },
          orderBy: { measuredAt: 'desc' },
          select: { heightCm: true, weightKg: true, bmi: true, bodyFatPercent: true }
        }),
        prisma.clientLifestyleProfile.findFirst({
          where: { clientId, tenantId, deletedAt: null },
          select: { occupation: true, workSchedule: true, sleepHours: true, stressLevel: true, hydrationLiters: true, trainingFrequency: true, activityLevel: true }
        }),
        prisma.clientMealLog.findMany({
          where: {
            clientId,
            tenantId,
            loggedAt: { gte: startOfDay }
          },
          select: { calories: true, protein: true, carbs: true, fat: true }
        })
      ]);

      if (!client) return '';

      // Calculate age from date of birth
      let age = 'N/A';
      if (client.dateOfBirth) {
        const birthDate = new Date(client.dateOfBirth);
        age = new Date().getFullYear() - birthDate.getFullYear();
      }

      // Calculate totals logged today
      let todayCal = 0;
      let todayProt = 0;
      let todayCarb = 0;
      let todayFat = 0;
      for (const log of todayMealLogs) {
        todayCal += log.calories || 0;
        todayProt += log.protein || 0;
        todayCarb += log.carbs || 0;
        todayFat += log.fat || 0;
      }

      // Compile Markdown-based profile to inject into system prompts
      const promptContext = `
[INJECTED USER CLINICAL CONTEXT]
- Name: ${client.firstName} ${client.lastName}
- Gender: ${client.gender || 'Not specified'}
- Age: ${age}
- Timezone: ${client.timezone || 'Not specified'}

[GOALS & CLINICAL DATA]
- Primary Goal Type: ${activeGoal?.goalType || 'Maintenance / General Health'}
- Target Weight: ${activeGoal?.targetWeightKg ? `${activeGoal.targetWeightKg} kg` : 'N/A'}
- Goal Notes: ${activeGoal?.notes || 'None'}
- Clinical Summary Notes: ${clinicalProfile?.summaryNotes || 'None'}

[LATEST BIOMETRICS]
- Height: ${latestAnthropometrics?.heightCm ? `${latestAnthropometrics.heightCm} cm` : 'N/A'}
- Weight: ${latestAnthropometrics?.weightKg ? `${latestAnthropometrics.weightKg} kg` : 'N/A'}
- BMI: ${latestAnthropometrics?.bmi ? latestAnthropometrics.bmi.toFixed(1) : 'N/A'}
- Body Fat: ${latestAnthropometrics?.bodyFatPercent ? `${latestAnthropometrics.bodyFatPercent}%` : 'N/A'}

[LIFESTYLE PARAMETERS]
- Occupation: ${lifestyleProfile?.occupation || 'N/A'}
- Stress Level (1-10): ${lifestyleProfile?.stressLevel || 'N/A'}
- Training Frequency: ${lifestyleProfile?.trainingFrequency || 'N/A'}
- Activity Level: ${lifestyleProfile?.activityLevel || 'N/A'}

[LOGGED NUTRITION INTAKE TODAY]
- Calories consumed today: ${todayCal.toFixed(0)} kcal
- Protein consumed today: ${todayProt.toFixed(1)} g
- Carbs consumed today: ${todayCarb.toFixed(1)} g
- Fat consumed today: ${todayFat.toFixed(1)} g
`;

      return promptContext;
    } catch (error) {
      logger.error(`[AI Context Service] Failed to compile clinical context for client ${clientId}:`, error);
      return '';
    }
  }
};
