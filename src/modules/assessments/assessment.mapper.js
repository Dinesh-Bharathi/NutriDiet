// src/modules/assessments/assessment.mapper.js
// Client assessment response serialization.

/**
 * Maps a database assessment record to a clean API resource.
 *
 * @param {object} assessment
 * @returns {object|null}
 */
export function mapAssessment(assessment) {
  if (!assessment) return null;

  return {
    id: assessment.id,
    clientId: assessment.clientId,
    title: assessment.title,
    assessmentDate: assessment.assessmentDate
      ? assessment.assessmentDate.toISOString().split('T')[0]
      : null,
    heightCm: assessment.heightCm || null,
    weightKg: assessment.weightKg || null,
    bmi: assessment.bmi || null,
    goalType: assessment.goalType || null,
    goal: assessment.goal || null,
    activityLevel: assessment.activityLevel || null,
    waterIntakeLiters: assessment.waterIntakeLiters || null,
    sleepHours: assessment.sleepHours || null,
    medicalConditions: assessment.medicalConditions || null,
    allergies: assessment.allergies || null,
    medications: assessment.medications || null,
    foodPreferences: assessment.foodPreferences || null,
    foodRestrictions: assessment.foodRestrictions || null,
    notes: assessment.notes || null,
    createdAt: assessment.createdAt,
    updatedAt: assessment.updatedAt,
    creator: assessment.creator
      ? {
          id: assessment.creator.id,
          firstName: assessment.creator.firstName,
          lastName: assessment.creator.lastName,
          fullName: `${assessment.creator.firstName} ${assessment.creator.lastName}`,
          email: assessment.creator.email,
        }
      : null,
  };
}

/**
 * Maps an array of database assessment records to API resources.
 *
 * @param {Array<object>} assessments
 * @returns {Array<object>}
 */
export function mapAssessmentsList(assessments) {
  return assessments.map(mapAssessment);
}
