// src/modules/assessments/assessment.service.js
// Business rules and operations for client assessments.
import { assessmentRepository } from './assessment.repository.js';
import { clientRepository } from '../clients/client.repository.js';
import ApiError from '../../utils/ApiError.js';

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
    // 1. Verify client exists and belongs to the tenant
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    // 2. Automatically calculate BMI if height and weight are provided
    const bmi = calculateBmi(data.heightCm, data.weightKg);

    return assessmentRepository.create(tenantId, clientId, creatorId, {
      ...data,
      bmi,
    });
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
      throw ApiError.notFound('Assessment');
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
      throw ApiError.notFound('Client');
    }

    const [assessments, total] = await assessmentRepository.findManyAndCount(
      tenantId,
      clientId,
      pagination
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
      throw ApiError.notFound('Assessment');
    }

    // 2. If height or weight is being modified, recalculate BMI
    const heightCm =
      updateData.heightCm !== undefined ? updateData.heightCm : existing.heightCm;
    const weightKg =
      updateData.weightKg !== undefined ? updateData.weightKg : existing.weightKg;

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
      throw ApiError.notFound('Assessment');
    }
  },
};
