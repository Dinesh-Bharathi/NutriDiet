// src/modules/check-ins/check-in.repository.js
// Database adapter for Check-ins — strictly tenant-isolated.
import prisma from '../../lib/prisma.js';

export const checkInRepository = {
  /**
   * Creates a new client check-in.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(tenantId, clientId, data) {
    return prisma.clientCheckIn.create({
      data: {
        ...data,
        tenantId,
        clientId,
      },
      include: {
        reviewer: {
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
   * Finds a check-in by ID scoped to tenant.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async findById(tenantId, id) {
    return prisma.clientCheckIn.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
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
        reviewer: {
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
   * Finds the immediately preceding check-in for weight and measurement trend analysis.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {Date} checkInDate
   * @param {string|null} excludeId
   * @returns {Promise<object|null>}
   */
  async findPreviousCheckIn(tenantId, clientId, checkInDate, excludeId = null) {
    return prisma.clientCheckIn.findFirst({
      where: {
        tenantId,
        clientId,
        checkInDate: {
          lt: checkInDate,
        },
        id: excludeId ? { not: excludeId } : undefined,
        deletedAt: null,
      },
      orderBy: {
        checkInDate: 'desc',
      },
    });
  },

  /**
   * Retrieves a paginated, filtered, and sorted list of check-ins for a client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @param {object} pagination - { page, limit }
   * @param {object} filters - { status, fromDate, toDate }
   * @param {object} sorting - { sortBy, sortOrder }
   * @returns {Promise<[Array<object>, number]>}
   */
  async findManyAndCount(tenantId, clientId, pagination, filters = {}, sorting = {}) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const take = limit;

    const { status, fromDate, toDate } = filters;
    const { sortBy = 'checkInDate', sortOrder = 'desc' } = sorting;

    const where = {
      tenantId,
      clientId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.checkInDate = {};
      if (fromDate) where.checkInDate.gte = fromDate;
      if (toDate) where.checkInDate.lte = toDate;
    }

    const [checkIns, total] = await Promise.all([
      prisma.clientCheckIn.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.clientCheckIn.count({ where }),
    ]);

    return [checkIns, total];
  },

  /**
   * Retrieves a paginated, filtered, and sorted list of all check-ins (global practitioner list).
   *
   * @param {string} tenantId
   * @param {object} pagination - { page, limit }
   * @param {object} filters - { status, requiresFollowUp, fromDate, toDate }
   * @param {object} sorting - { sortBy, sortOrder }
   * @returns {Promise<[Array<object>, number]>}
   */
  async findAllAndCount(tenantId, pagination, filters = {}, sorting = {}) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const take = limit;

    const { status, requiresFollowUp, fromDate, toDate } = filters;
    const { sortBy = 'checkInDate', sortOrder = 'desc' } = sorting;

    const where = {
      tenantId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (requiresFollowUp !== undefined) {
      where.requiresFollowUp = requiresFollowUp;
    }

    if (fromDate || toDate) {
      where.checkInDate = {};
      if (fromDate) where.checkInDate.gte = fromDate;
      if (toDate) where.checkInDate.lte = toDate;
    }

    const [checkIns, total] = await Promise.all([
      prisma.clientCheckIn.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      prisma.clientCheckIn.count({ where }),
    ]);

    return [checkIns, total];
  },

  /**
   * Updates a check-in. Assumes tenant validation was performed.
   *
   * @param {string} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    return prisma.clientCheckIn.update({
      where: { id },
      data,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewer: {
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
   * Soft-deletes a check-in.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<number>} Number of affected records (0 or 1)
   */
  async softDelete(tenantId, id) {
    const result = await prisma.clientCheckIn.updateMany({
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
