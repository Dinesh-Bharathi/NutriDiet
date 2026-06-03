// src/modules/progress/progress.repository.js
// Database queries for Progress Tracking & Reviews - strictly tenant-isolated.
import prisma from '../../lib/prisma.js';

export const progressRepository = {
  /**
   * Fetches all check-ins for a client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {string} sortOrder - 'asc' or 'desc'
   * @returns {Promise<Array<object>>}
   */
  async findClientCheckIns(tenantId, clientId, sortOrder = 'asc') {
    return prisma.clientCheckIn.findMany({
      where: {
        tenantId,
        clientId,
        deletedAt: null,
      },
      orderBy: {
        checkInDate: sortOrder,
      },
    });
  },

  /**
   * Fetches all anthropometric records for a client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {string} sortOrder - 'asc' or 'desc'
   * @returns {Promise<Array<object>>}
   */
  async findClientAnthropometricRecords(tenantId, clientId, sortOrder = 'asc') {
    return prisma.clientAnthropometricRecord.findMany({
      where: {
        tenantId,
        clientId,
        deletedAt: null,
      },
      orderBy: {
        measuredAt: sortOrder,
      },
    });
  },

  /**
   * Retrieves the client's latest recorded height from assessments.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<number|null>}
   */
  async findClientLatestHeight(tenantId, clientId) {
    const assessment = await prisma.assessment.findFirst({
      where: {
        tenantId,
        clientId,
        heightCm: { not: null },
        deletedAt: null,
      },
      orderBy: {
        assessmentDate: 'desc',
      },
      select: {
        heightCm: true,
      },
    });
    return assessment ? assessment.heightCm : null;
  },

  /**
   * Fetches pending reviews (SUBMITTED status) across the tenant.
   *
   * @param {string} tenantId
   * @param {number} limit
   * @returns {Promise<Array<object>>}
   */
  async findPendingReviews(tenantId, limit = 5) {
    return prisma.clientCheckIn.findMany({
      where: {
        tenantId,
        status: 'SUBMITTED',
        deletedAt: null,
      },
      orderBy: {
        submittedAt: 'desc',
      },
      take: limit,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  },

  /**
   * Fetches check-ins requiring follow-up across the tenant.
   *
   * @param {string} tenantId
   * @param {number} limit
   * @returns {Promise<Array<object>>}
   */
  async findRequiresFollowUp(tenantId, limit = 5) {
    return prisma.clientCheckIn.findMany({
      where: {
        tenantId,
        requiresFollowUp: true,
        deletedAt: null,
      },
      orderBy: {
        checkInDate: 'desc',
      },
      take: limit,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  },

  /**
   * Fetches recent check-ins across the tenant regardless of status.
   *
   * @param {string} tenantId
   * @param {number} limit
   * @returns {Promise<Array<object>>}
   */
  async findRecentCheckIns(tenantId, limit = 5) {
    return prisma.clientCheckIn.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      orderBy: {
        checkInDate: 'desc',
      },
      take: limit,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  },

  /**
   * Fetches all non-deleted check-ins across the tenant for active client evaluations.
   *
   * @param {string} tenantId
   * @returns {Promise<Array<object>>}
   */
  async findTenantCheckIns(tenantId) {
    return prisma.clientCheckIn.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      orderBy: {
        checkInDate: 'desc',
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  },

  /**
   * Counts check-ins by status in the tenant.
   *
   * @param {string} tenantId
   * @returns {Promise<object>} Status counts mapping (PENDING, SUBMITTED, REVIEWED)
   */
  async countCheckInsByStatus(tenantId) {
    const counts = await prisma.clientCheckIn.groupBy({
      by: ['status'],
      where: {
        tenantId,
        deletedAt: null,
      },
      _count: {
        id: true,
      },
    });

    return counts.reduce(
      (acc, current) => {
        acc[current.status] = current._count.id;
        return acc;
      },
      { PENDING: 0, SUBMITTED: 0, REVIEWED: 0 }
    );
  },
};
