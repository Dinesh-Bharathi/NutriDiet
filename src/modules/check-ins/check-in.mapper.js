// src/modules/check-ins/check-in.mapper.js
// Client check-in response serialization.

/**
 * Maps a database check-in record to a clean API resource.
 *
 * @param {object} checkIn
 * @returns {object|null}
 */
export function mapCheckIn(checkIn) {
  if (!checkIn) return null;

  return {
    id: checkIn.id,
    clientId: checkIn.clientId,
    dietPlanId: checkIn.dietPlanId || null,
    checkInDate: checkIn.checkInDate
      ? checkIn.checkInDate.toISOString().split('T')[0]
      : null,
    submittedAt: checkIn.submittedAt || null,
    reviewedAt: checkIn.reviewedAt || null,
    status: checkIn.status,
    requiresFollowUp: checkIn.requiresFollowUp,

    // Weight & Measurements
    weightKg: checkIn.weightKg || null,
    waistCm: checkIn.waistCm || null,
    hipCm: checkIn.hipCm || null,
    chestCm: checkIn.chestCm || null,
    armCm: checkIn.armCm || null,
    thighCm: checkIn.thighCm || null,

    // Lifestyle
    waterIntakeLiters: checkIn.waterIntakeLiters || null,
    sleepHours: checkIn.sleepHours || null,
    exerciseDays: checkIn.exerciseDays ?? null,

    // Self Assessment
    energyLevel: checkIn.energyLevel || null,
    stressLevel: checkIn.stressLevel || null,
    moodLevel: checkIn.moodLevel || null,
    planAdherence: checkIn.planAdherence || null,
    adherenceNotes: checkIn.adherenceNotes || null,

    // Notes
    clientNotes: checkIn.clientNotes || null,
    practitionerNotes: checkIn.practitionerNotes || null,

    // Dynamic measurement deltas
    weightChange: checkIn.weightChange ?? null,
    waistChange: checkIn.waistChange ?? null,
    hipChange: checkIn.hipChange ?? null,
    chestChange: checkIn.chestChange ?? null,
    armChange: checkIn.armChange ?? null,
    thighChange: checkIn.thighChange ?? null,

    // Timestamps
    createdAt: checkIn.createdAt,
    updatedAt: checkIn.updatedAt,

    // Relations
    client: checkIn.client
      ? {
          id: checkIn.client.id,
          firstName: checkIn.client.firstName,
          lastName: checkIn.client.lastName,
          fullName: `${checkIn.client.firstName} ${checkIn.client.lastName}`,
          email: checkIn.client.email || null,
        }
      : null,
    reviewedBy: checkIn.reviewer
      ? {
          id: checkIn.reviewer.id,
          firstName: checkIn.reviewer.firstName,
          lastName: checkIn.reviewer.lastName,
          name: `${checkIn.reviewer.firstName} ${checkIn.reviewer.lastName}`,
          email: checkIn.reviewer.email,
        }
      : null,
  };
}

/**
 * Maps an array of database check-in records to API resources.
 *
 * @param {Array<object>} checkIns
 * @returns {Array<object>}
 */
export function mapCheckInList(checkIns) {
  return checkIns.map(mapCheckIn);
}
