// src/modules/assessments/assessment.service.js
// Business rules and operations for client assessments.
import { assessmentRepository } from "./assessment.repository.js";
import { clientRepository } from "../clients/client.repository.js";
import { clinicalProfileService } from "./clinical-profile.service.js";
import ApiError from "../../utils/ApiError.js";
import prisma from "../../lib/prisma.js";

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

export const assessmentService = {
  /**
   * Creates a new assessment for a client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {string} creatorId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createAssessment(tenantId, clientId, creatorId, data) {
    console.log("============================");
    console.log("tenantId 2", tenantId);
    console.log("clientId 2", clientId);
    console.log("creatorId 2", creatorId);
    console.log("============================");
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound("Client");
    }

    const bmi = calculateBmi(data.heightCm, data.weightKg);

    let assessment;
    let profileId;

    await prisma.$transaction(async (tx) => {
      // 1. Create Assessment Record
      console.log("============================");
      console.log("tenantId 3", tenantId);
      console.log("============================");
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

      // 2. Ensure Clinical Profile V2
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

      // 3. Create Initial Anthropometric Record
      if (data.weightKg || data.heightCm || data.waistCm) {
        await tx.clientAnthropometricRecord.create({
          data: {
            tenantId,
            clientId,
            profileId,
            assessmentId: assessment.id,
            measuredAt: assessment.assessmentDate,
            weightKg: data.weightKg,
            heightCm: data.heightCm,
            waistCm: data.waistCm,
            hipCm: data.hipCm,
            chestCm: data.chestCm,
            armCm: data.armCm,
            thighCm: data.thighCm,
            bodyFatPercent: data.bodyFatPercent,
            leanMassKg: data.leanMassKg,
            bmi,
          },
        });
      }

      // 4. Create Goal Profile
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
            notes: data.goal,
          },
        });
      }

      // 5. Create Lifestyle Profile
      if (data.activityLevel || data.sleepHours || data.waterIntakeLiters) {
        await tx.clientLifestyleProfile.upsert({
          where: { profileId },
          create: {
            tenantId,
            clientId,
            profileId,
            activityLevel: data.activityLevel,
            sleepHours: data.sleepHours,
            hydrationLiters: data.waterIntakeLiters,
          },
          update: {
            activityLevel: data.activityLevel,
            sleepHours: data.sleepHours,
            hydrationLiters: data.waterIntakeLiters,
          },
        });
      }
    },
      {
        maxWait: 5000,
        timeout: 20000,
      }
    );

    // POST-COMMIT ASYNC ACTIONS
    // 6. Generate Snapshot (background)
    clinicalProfileService
      .generateSnapshot(tenantId, clientId, creatorId)
      .catch(console.error);

    // 7. Activity Timeline Event (Optional/Future implementation)
    // 8. Recalculate Readiness (Future implementation)

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

    // 2. If height or weight is being modified, recalculate BMI
    const heightCm =
      updateData.heightCm !== undefined
        ? updateData.heightCm
        : existing.heightCm;
    const weightKg =
      updateData.weightKg !== undefined
        ? updateData.weightKg
        : existing.weightKg;

    const bmi = calculateBmi(heightCm, weightKg);

    return assessmentRepository.update(id, {
      ...updateData,
      bmi,
    });
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
