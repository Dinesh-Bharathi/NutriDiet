// src/modules/assessments/assessment.repository.js
// Database adapter for Assessments — strictly tenant-isolated.
import prisma from '../../lib/prisma.js';

export const assessmentRepository = {
  /**
   * Creates a new client assessment.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {string} creatorId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(tenantId, clientId, creatorId, data) {
    return prisma.assessment.create({
      data: {
        ...data,
        tenantId,
        clientId,
        createdBy: creatorId,
      },
      include: {
        creator: {
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
   * Finds an assessment by ID scoped to tenant.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(tenantId, id) {
    return prisma.assessment.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        creator: {
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
   * Retrieves a paginated list of assessments for a specific client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {object} pagination - { page, limit }
   * @returns {Promise<[Array<object>, number]>}
   */
  async findManyAndCount(tenantId, clientId, pagination) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const take = limit;

    const where = {
      tenantId,
      clientId,
      deletedAt: null,
    };

    const [assessments, total] = await Promise.all([
      prisma.assessment.findMany({
        where,
        skip,
        take,
        orderBy: { assessmentDate: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.assessment.count({ where }),
    ]);

    return [assessments, total];
  },

  /**
   * Updates an assessment. Assumes tenant validation was performed.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(tenantId, id, data) {
    return prisma.assessment.update({
      where: { id, tenantId },
      data,
      include: {
        creator: {
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
   * Soft-deletes an assessment.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<number>} Number of affected records (0 or 1)
   */
  async softDelete(tenantId, id) {
    const result = await prisma.assessment.updateMany({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
    return result.count;
  },
};
