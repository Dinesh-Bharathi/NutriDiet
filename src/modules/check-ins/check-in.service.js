// src/modules/check-ins/check-in.service.js
// Business rules and operations for client check-ins.
import { checkInRepository } from './check-in.repository.js';
import { clientRepository } from '../clients/client.repository.js';
import { dietPlanRepository } from '../diet-plans/diet-plan.repository.js';
import { clinicalProfileService } from '../assessments/clinical-profile.service.js';
import { CHECK_IN_STATUS } from './check-in.constants.js';
import ApiError from '../../utils/ApiError.js';

/**
 * Calculates physical measurement changes (deltas) between current and previous check-ins.
 *
 * @param {object} current
 * @param {object|null} previous
 * @returns {object} Calculated deltas (e.g. weightChange, waistChange, etc.)
 */
function calculateDeltas(current, previous) {
  if (!previous) {
    return {
      weightChange: null,
      waistChange: null,
      hipChange: null,
      chestChange: null,
      armChange: null,
      thighChange: null,
    };
  }

  const diff = (currVal, prevVal) => {
    if (currVal === null || currVal === undefined || prevVal === null || prevVal === undefined) {
      return null;
    }
    return Math.round((currVal - prevVal) * 100) / 100;
  };

  return {
    weightChange: diff(current.weightKg, previous.weightKg),
    waistChange: diff(current.waistCm, previous.waistCm),
    hipChange: diff(current.hipCm, previous.hipCm),
    chestChange: diff(current.chestCm, previous.chestCm),
    armChange: diff(current.armCm, previous.armCm),
    thighChange: diff(current.thighCm, previous.thighCm),
  };
}

/**
 * Populates deltas for a list of check-ins.
 *
 * @param {string} tenantId
 * @param {string} clientId
 * @param {Array<object>} checkIns
 * @returns {Promise<Array<object>>}
 */
async function populateDeltasForList(tenantId, clientId, checkIns) {
  return Promise.all(
    checkIns.map(async (checkIn) => {
      const prev = await checkInRepository.findPreviousCheckIn(
        tenantId,
        clientId,
        checkIn.checkInDate,
        checkIn.id
      );
      const deltas = calculateDeltas(checkIn, prev);
      return {
        ...checkIn,
        ...deltas,
      };
    })
  );
}

export const checkInService = {
  /**
   * Creates a new client check-in.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createCheckIn(tenantId, clientId, data) {
    // 1. Verify client exists and belongs to the tenant
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    // 2. Verify diet plan belongs to the client and tenant if provided
    if (data.dietPlanId) {
      const dietPlan = await dietPlanRepository.findById(tenantId, data.dietPlanId);
      if (!dietPlan || dietPlan.clientId !== clientId) {
        throw ApiError.badRequest('Diet plan must exist and belong to the client');
      }
    }

    // 3. Set submittedAt automatically if status is SUBMITTED
    const submittedAt = data.status === CHECK_IN_STATUS.SUBMITTED ? new Date() : null;

    const checkIn = await checkInRepository.create(tenantId, clientId, {
      ...data,
      submittedAt,
    });

    // Create Anthropometric Record if physical measurements exist
    if (
      data.weightKg !== undefined ||
      data.bodyFatPercent !== undefined ||
      data.waistCm !== undefined ||
      data.hipCm !== undefined ||
      data.chestCm !== undefined ||
      data.armCm !== undefined ||
      data.thighCm !== undefined ||
      data.neckCm !== undefined
    ) {
      await clinicalProfileService.createAnthropometricRecord(tenantId, clientId, null, {
        weightKg: data.weightKg,
        bodyFatPercent: data.bodyFatPercent,
        waistCm: data.waistCm,
        hipCm: data.hipCm,
        chestCm: data.chestCm,
        armCm: data.armCm,
        thighCm: data.thighCm,
        neckCm: data.neckCm,
        measuredAt: data.checkInDate || new Date(),
        notes: data.clientNotes ? `From Check-In: ${data.clientNotes}` : 'Created from Check-In',
      });
    }

    // Create Lifestyle Profile if behavioral measurements exist
    if (
      data.sleepHours !== undefined ||
      data.waterIntakeLiters !== undefined ||
      data.activityLevel !== undefined
    ) {
      await clinicalProfileService.upsertLifestyleProfile(tenantId, clientId, null, {
        sleepHours: data.sleepHours,
        hydrationLiters: data.waterIntakeLiters,
        activityLevel: data.activityLevel,
      });
    }

    // 4. Retrieve delta against previous check-in
    const prev = await checkInRepository.findPreviousCheckIn(tenantId, clientId, checkIn.checkInDate, checkIn.id);
    const deltas = calculateDeltas(checkIn, prev);

    return {
      ...checkIn,
      ...deltas,
    };
  },

  /**
   * Retrieves a single check-in by ID.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getCheckInById(tenantId, id) {
    const checkIn = await checkInRepository.findById(tenantId, id);
    if (!checkIn) {
      throw ApiError.notFound('Check-in');
    }

    const prev = await checkInRepository.findPreviousCheckIn(
      tenantId,
      checkIn.clientId,
      checkIn.checkInDate,
      checkIn.id
    );
    const deltas = calculateDeltas(checkIn, prev);

    return {
      ...checkIn,
      ...deltas,
    };
  },

  /**
   * Retrieves a paginated list of check-ins for a client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {object} pagination - { page, limit }
   * @param {object} filters - { status, fromDate, toDate }
   * @param {object} sorting - { sortBy, sortOrder }
   * @returns {Promise<object>}
   */
  async getClientCheckIns(tenantId, clientId, pagination, filters, sorting) {
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    const [checkIns, total] = await checkInRepository.findManyAndCount(
      tenantId,
      clientId,
      pagination,
      filters,
      sorting
    );

    const populated = await populateDeltasForList(tenantId, clientId, checkIns);

    return {
      checkIns: populated,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  },

  /**
   * Retrieves a paginated list of all check-ins (global practitioner list).
   *
   * @param {string} tenantId
   * @param {object} pagination - { page, limit }
   * @param {object} filters - { status, requiresFollowUp, fromDate, toDate }
   * @param {object} sorting - { sortBy, sortOrder }
   * @returns {Promise<object>}
   */
  async getAllCheckIns(tenantId, pagination, filters, sorting) {
    const [checkIns, total] = await checkInRepository.findAllAndCount(
      tenantId,
      pagination,
      filters,
      sorting
    );

    const populated = await Promise.all(
      checkIns.map(async (checkIn) => {
        const prev = await checkInRepository.findPreviousCheckIn(
          tenantId,
          checkIn.clientId,
          checkIn.checkInDate,
          checkIn.id
        );
        const deltas = calculateDeltas(checkIn, prev);
        return {
          ...checkIn,
          ...deltas,
        };
      })
    );

    return {
      checkIns: populated,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  },
  /**
   * Retrieves a paginated, server-searched list of all check-ins for the practitioner queue.
   * Calculates skip/take here so the repository stays a pure data adapter.
   *
   * @param {string} tenantId
   * @param {object} params
   * @param {number} params.page
   * @param {number} params.limit
   * @param {string} [params.q]
   * @param {string} [params.status]
   * @param {boolean} [params.requiresFollowUp]
   * @param {Date|null} [params.fromDate]
   * @param {Date|null} [params.toDate]
   * @param {string} [params.sortBy]
   * @param {string} [params.sortOrder]
   * @returns {Promise<{ checkIns: Array<object>, pagination: object }>}
   */
  async getPractitionerQueue(tenantId, params = {}) {
    const {
      page,
      limit,
      q,
      status,
      requiresFollowUp,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    } = params;

    const skip = (page - 1) * limit;
    const take = limit;

    const [checkIns, total] = await checkInRepository.findManyPaginated(tenantId, {
      skip,
      take,
      q,
      status,
      requiresFollowUp,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    });

    const populated = await Promise.all(
      checkIns.map(async (checkIn) => {
        const prev = await checkInRepository.findPreviousCheckIn(
          tenantId,
          checkIn.clientId,
          checkIn.checkInDate,
          checkIn.id
        );
        const deltas = calculateDeltas(checkIn, prev);
        return {
          ...checkIn,
          ...deltas,
        };
      })
    );

    return {
      checkIns: populated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Updates an existing check-in.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} updateData
   * @returns {Promise<object>}
   */
  async updateCheckIn(tenantId, id, updateData) {
    // 1. Verify existence
    const existing = await checkInRepository.findById(tenantId, id);
    if (!existing) {
      throw ApiError.notFound('Check-in');
    }

    // 2. Terminal status protection: Block moving a check-in OUT of REVIEWED status
    if (existing.status === CHECK_IN_STATUS.REVIEWED && updateData.status && updateData.status !== CHECK_IN_STATUS.REVIEWED) {
      throw ApiError.badRequest('Check-in has already been reviewed and cannot be moved to another status');
    }

    // 3. Only SUBMITTED can become REVIEWED
    if (updateData.status === CHECK_IN_STATUS.REVIEWED && existing.status !== CHECK_IN_STATUS.SUBMITTED) {
      throw ApiError.badRequest('Only check-ins in SUBMITTED status can be marked as REVIEWED');
    }

    // 4. Validate diet plan relation if updated
    if (updateData.dietPlanId) {
      const dietPlan = await dietPlanRepository.findById(tenantId, updateData.dietPlanId);
      if (!dietPlan || dietPlan.clientId !== existing.clientId) {
        throw ApiError.badRequest('Diet plan must exist and belong to the client');
      }
    }

    // 5. Update submittedAt automatically if status changes to SUBMITTED
    if (updateData.status === CHECK_IN_STATUS.SUBMITTED && existing.status !== CHECK_IN_STATUS.SUBMITTED) {
      updateData.submittedAt = new Date();
    }

    const updated = await checkInRepository.update(id, updateData);

    // Create Anthropometric Record if check-in is submitted with measurements
    if (
      updateData.status === CHECK_IN_STATUS.SUBMITTED &&
      (updated.weightKg !== null ||
        updated.bodyFatPercent !== null ||
        updated.waistCm !== null ||
        updated.hipCm !== null ||
        updated.chestCm !== null ||
        updated.armCm !== null ||
        updated.thighCm !== null ||
        updated.neckCm !== null)
    ) {
      await clinicalProfileService.createAnthropometricRecord(tenantId, updated.clientId, null, {
        weightKg: updated.weightKg,
        bodyFatPercent: updated.bodyFatPercent,
        waistCm: updated.waistCm,
        hipCm: updated.hipCm,
        chestCm: updated.chestCm,
        armCm: updated.armCm,
        thighCm: updated.thighCm,
        neckCm: updated.neckCm,
        measuredAt: updated.checkInDate || new Date(),
        notes: updated.clientNotes ? `From Check-In: ${updated.clientNotes}` : 'Submitted via Check-In',
      });
    }

    const prev = await checkInRepository.findPreviousCheckIn(
      tenantId,
      updated.clientId,
      updated.checkInDate,
      updated.id
    );
    const deltas = calculateDeltas(updated, prev);

    return {
      ...updated,
      ...deltas,
    };
  },

  /**
   * Reviews a check-in (Practitioner review workflow).
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {string} reviewerId
   * @param {object} reviewData
   * @returns {Promise<object>}
   */
  async reviewCheckIn(tenantId, id, reviewerId, reviewData) {
    // 1. Verify existence
    const existing = await checkInRepository.findById(tenantId, id);
    if (!existing) {
      throw ApiError.notFound('Check-in');
    }

    // 2. Enforce transition constraint: Only SUBMITTED can be REVIEWED
    if (existing.status !== CHECK_IN_STATUS.SUBMITTED) {
      throw ApiError.badRequest('Only check-ins in SUBMITTED status can be reviewed');
    }

    // TODO: Validate that practitionerNotes is provided when requiresFollowUp is true (optional future block rule)

    const updated = await checkInRepository.update(id, {
      status: CHECK_IN_STATUS.REVIEWED,
      practitionerNotes: reviewData.practitionerNotes,
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
    });

    const prev = await checkInRepository.findPreviousCheckIn(
      tenantId,
      updated.clientId,
      updated.checkInDate,
      updated.id
    );
    const deltas = calculateDeltas(updated, prev);

    return {
      ...updated,
      ...deltas,
    };
  },

  /**
   * Soft-deletes a check-in.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteCheckIn(tenantId, id) {
    const existing = await checkInRepository.findById(tenantId, id);
    if (!existing) {
      throw ApiError.notFound('Check-in');
    }

    const affectedCount = await checkInRepository.softDelete(tenantId, id);
    if (affectedCount === 0) {
      throw ApiError.notFound('Check-in');
    }

    // Safest Long-Term Architecture: Audit-friendly Soft Delete
    // Soft-delete the corresponding anthropometric record created by this check-in
    // We match by identical timestamp (checkInDate) and notes prefix.
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.clientAnthropometricRecord.updateMany({
        where: {
          tenantId,
          clientId: existing.clientId,
          measuredAt: existing.checkInDate,
          notes: {
            startsWith: 'From Check-In',
          },
        },
        data: {
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to soft-delete linked anthropometric record:', error);
    }
  },
};
