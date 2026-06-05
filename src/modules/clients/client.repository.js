// src/modules/clients/client.repository.js
// Database access for Client operations — strictly tenant-isolated.
import prisma from '../../lib/prisma.js';

export const clientRepository = {
  /**
   * Creates a new client.
   *
   * @param {string} tenantId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(tenantId, data) {
    return prisma.client.create({
      data: {
        ...data,
        tenantId,
      },
      include: {
        dietitian: {
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
   * Finds a client by ID scoped to tenant.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(tenantId, id) {
    return prisma.client.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      include: {
        dietitian: {
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
   * Updates a client. Assumes tenant validation was performed.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(tenantId, id, data) {
    return prisma.client.update({
      where: { id, tenantId },
      data,
      include: {
        dietitian: {
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
   * Soft-deletes a client.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<number>} Number of affected records (0 or 1)
   */
  async softDelete(tenantId, id) {
    const result = await prisma.client.updateMany({
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

  /**
   * Paginated list of clients with search, status, and practitioner filtering.
   *
   * @param {string} tenantId
   * @param {object} filters - { search, status, onboardingStatus, dietitianId }
   * @param {object} pagination - { page, limit }
   * @returns {Promise<[Array<object>, number]>}
   */
  async findManyAndCount(tenantId, filters, pagination) {
    const { search, status, onboardingStatus, dietitianId } = filters;
    const { page, limit } = pagination;

    const where = {
      tenantId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (onboardingStatus) {
      where.onboardingStatus = onboardingStatus;
    }

    if (dietitianId) {
      where.dietitianId = dietitianId;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const take = limit;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          dietitian: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return [clients, total];
  },
};
