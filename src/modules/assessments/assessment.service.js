// src/modules/assessments/assessment.service.js
// Business rules and operations for client assessments.
import { assessmentRepository } from "./assessment.repository.js";
import { clientRepository } from "../clients/client.repository.js";
import { clinicalProfileService } from "./clinical-profile.service.js";
import ApiError from "../../utils/ApiError.js";
import prisma from "../../lib/prisma.js";
import logger from "../../utils/logger.js";

/**
 * Calculates BMI based on height in centimeters and weight in kilograms.
 * Formula: weight (kg) / [height (m)]^2
 *
 * @param {number|null} heightCm
 * @param {number|null} weightKg
 * @returns {number|null} Calculated BMI rounded to 2 decimal places
 */
function calculateBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 100) / 100;
}

/**
 * Decomposes a legacy flat comma-separated string into a trimmed, non-empty
 * array of values for relational createMany ingestion.
 *
 * @param {string|null|undefined} str
 * @returns {string[]}
 */
const parseCsv = (str) =>
  str ? str.split(',').map((s) => s.trim()).filter(Boolean) : [];

export const assessmentService = {
  /**
   * Creates a new assessment for a client.
   *
   * STRICT ARCHITECTURAL ENFORCEMENT: Atomic V1-to-V2 Synchronization.
   * Writes the flat Assessment payload (V1 log) then fans out to seed each
   * deeply nested SSoT ledger (V2 relational tables) within a single
   * Prisma transaction, ensuring Medical History, Anthropometrics, Lifestyle,
   * and Goal screens always reflect the intake data immediately.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {string} creatorId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createAssessment(tenantId, clientId, creatorId, data) {
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound("Client");
    }

    const bmi = calculateBmi(data.heightCm, data.weightKg);

    let assessment;
    let profileId;

    await prisma.$transaction(
      async (tx) => {
        // 1. Create the Immutable V1 Assessment Log
        assessment = await tx.assessment.create({
          data: {
            tenantId,
            clientId,
            createdBy: creatorId,
            title: data.title,
            assessmentDate: data.assessmentDate
              ? new Date(data.assessmentDate)
              : new Date(),
            heightCm: data.heightCm ?? null,
            weightKg: data.weightKg ?? null,
            bmi,
            goalType: data.goalType ?? null,
            goal: data.goal ?? null,
            activityLevel: data.activityLevel ?? null,
            waterIntakeLiters: data.waterIntakeLiters ?? null,
            sleepHours: data.sleepHours ?? null,
            medicalConditions: data.medicalConditions ?? null,
            allergies: data.allergies ?? null,
            medications: data.medications ?? null,
            foodPreferences: data.foodPreferences ?? null,
            foodRestrictions: data.foodRestrictions ?? null,
            notes: data.notes ?? null,
          },
        });

        // 2. Bootstrap or Update the V2 Clinical Profile SSoT
        let profile = await tx.clientClinicalProfile.findFirst({
          where: { tenantId, clientId, deletedAt: null },
        });

        if (!profile) {
          profile = await tx.clientClinicalProfile.create({
            data: {
              tenantId,
              clientId,
              createdById: creatorId,
              latestAssessmentId: assessment.id,
              sectionStatuses: {
                create: ["ANTHROPOMETRICS", "MEDICAL", "LIFESTYLE", "LABS"].map(
                  (section) => ({
                    tenantId,
                    clientId,
                    assessmentId: assessment.id,
                    section,
                    status: "DRAFT",
                  }),
                ),
              },
            },
          });
        } else {
          await tx.clientClinicalProfile.update({
            where: { id: profile.id },
            data: { latestAssessmentId: assessment.id },
          });
        }
        profileId = profile.id;

        // 3. Seed the Anthropometric Ledger (Repairs the Progress Screen)
        if (data.weightKg || data.heightCm || data.waistCm) {
          await tx.clientAnthropometricRecord.create({
            data: {
              tenantId,
              clientId,
              profileId,
              assessmentId: assessment.id,
              measuredAt: assessment.assessmentDate,
              weightKg: data.weightKg ?? null,
              heightCm: data.heightCm ?? null,
              waistCm: data.waistCm ?? null,
              hipCm: data.hipCm ?? null,
              chestCm: data.chestCm ?? null,
              armCm: data.armCm ?? null,
              thighCm: data.thighCm ?? null,
              bodyFatPercent: data.bodyFatPercent ?? null,
              leanMassKg: data.leanMassKg ?? null,
              bmi,
              notes: 'Initial Intake Baseline',
            },
          });
        }

        // 4. Seed the Medical History SSoT (Repairs the Clinical Profile Screen)
        // Decomposes flat CSV strings into individual relational rows so the
        // Medical History, Conditions, Allergies, and Medications screens
        // always have queryable, filterable records from the first assessment.
        const conditions = parseCsv(data.medicalConditions);
        if (conditions.length > 0) {
          await tx.clientCondition.createMany({
            data: conditions.map((name) => ({
              tenantId,
              clientId,
              profileId,
              assessmentId: assessment.id,
              name,
            })),
          });
        }

        const allergies = parseCsv(data.allergies);
        if (allergies.length > 0) {
          await tx.clientAllergy.createMany({
            data: allergies.map((allergen) => ({
              tenantId,
              clientId,
              profileId,
              assessmentId: assessment.id,
              allergen,
            })),
          });
        }

        const medications = parseCsv(data.medications);
        if (medications.length > 0) {
          await tx.clientMedication.createMany({
            data: medications.map((name) => ({
              tenantId,
              clientId,
              profileId,
              assessmentId: assessment.id,
              name,
            })),
          });
        }

        // 5. Seed Goal Profile (with version-chain management)
        if (data.goalType) {
          await tx.clientGoalProfile.updateMany({
            where: { tenantId, profileId, status: "ACTIVE" },
            data: { status: "SUPERSEDED" },
          });

          const nextVersion =
            (await tx.clientGoalProfile.count({
              where: { tenantId, profileId },
            })) + 1;

          await tx.clientGoalProfile.create({
            data: {
              tenantId,
              clientId,
              profileId,
              assessmentId: assessment.id,
              versionNumber: nextVersion,
              goalType: data.goalType,
              status: "ACTIVE",
              notes: data.goal ?? null,
            },
          });
        }

        // 6. Seed Lifestyle Profile
        if (data.activityLevel || data.sleepHours || data.waterIntakeLiters) {
          await tx.clientLifestyleProfile.upsert({
            where: { profileId },
            create: {
              tenantId,
              clientId,
              profileId,
              assessmentId: assessment.id,
              activityLevel: data.activityLevel ?? null,
              sleepHours: data.sleepHours ?? null,
              hydrationLiters: data.waterIntakeLiters ?? null,
            },
            update: {
              assessmentId: assessment.id,
              activityLevel: data.activityLevel ?? null,
              sleepHours: data.sleepHours ?? null,
              hydrationLiters: data.waterIntakeLiters ?? null,
            },
          });
        }
      },
    );

    // POST-COMMIT ASYNC ACTIONS
    // 7. Generate Snapshot (background — fires after transaction commits)
    clinicalProfileService
      .generateSnapshot(tenantId, clientId, creatorId)
      .catch((err) => logger.error("Failed to generate clinical snapshot:", err));

    // 8. Activity Timeline Event (Optional/Future implementation)
    // 9. Recalculate Readiness (Future implementation)

    return assessment;
  },

  /**
   * Retrieves a single assessment.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getAssessmentById(tenantId, id) {
    const assessment = await assessmentRepository.findById(tenantId, id);
    if (!assessment) {
      throw ApiError.notFound("Assessment");
    }
    return assessment;
  },

  /**
   * Retrieves a paginated list of assessments for a specific client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {object} pagination - { page, limit }
   * @returns {Promise<object>}
   */
  async getClientAssessments(tenantId, clientId, pagination) {
    // Verify client exists and belongs to the tenant
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound("Client");
    }

    const [assessments, total] = await assessmentRepository.findManyAndCount(
      tenantId,
      clientId,
      pagination,
    );

    return {
      assessments,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  },

  /**
   * Updates an existing assessment.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} updateData
   * @returns {Promise<object>}
   */
  async updateAssessment(tenantId, id, updateData) {
    // 1. Verify assessment exists and belongs to the tenant
    const existing = await assessmentRepository.findById(tenantId, id);
    if (!existing) {
      throw ApiError.notFound("Assessment");
    }

    // Restrict updateData to metadata fields only (title, notes, assessmentDate)
    const allowedMetadata = {};
    if (updateData.title !== undefined) allowedMetadata.title = updateData.title;
    if (updateData.notes !== undefined) allowedMetadata.notes = updateData.notes;
    if (updateData.assessmentDate !== undefined) {
      allowedMetadata.assessmentDate = updateData.assessmentDate ? new Date(updateData.assessmentDate) : null;
    }

    return assessmentRepository.update(tenantId, id, allowedMetadata);
  },

  /**
   * Soft-deletes an assessment.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteAssessment(tenantId, id) {
    const affectedCount = await assessmentRepository.softDelete(tenantId, id);
    if (affectedCount === 0) {
      throw ApiError.notFound("Assessment");
    }
  },
};
