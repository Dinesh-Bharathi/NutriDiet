import prisma from "../../lib/prisma.js";

export const userRepository = {
  /**
   * Find users in a tenant matching the given filters.
   * @param {string} tenantId
   * @param {Object} filters
   * @returns {Promise<{ users: any[], total: number }>}
   */
  async findUsersByTenant(tenantId, filters) {
    const { page, limit, role, status, search } = filters;

    const where = {
      tenantId,
      deletedAt: null,
      ...(role && { role: { in: role } }),
      ...(status && { status: { in: status } }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  },

  /**
   * Find a non-deleted user by ID scoped to a tenant.
   * @param {string} id
   * @param {string} tenantId
   */
  async findById(id, tenantId) {
    return prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
  },

  /**
   * Find a non-deleted user by email scoped to a tenant.
   * @param {string} tenantId
   * @param {string} email
   */
  async findByEmail(tenantId, email) {
    return prisma.user.findFirst({
      where: { tenantId, email, deletedAt: null },
    });
  },

  /**
   * Create a new user scoped to a tenant.
   * @param {Object} data
   * @param {string} tenantId
   */
  async create(data, tenantId) {
    return prisma.user.create({
      data: {
        ...data,
        tenantId,
      },
    });
  },

  /**
   * Update a user's role scoped to a tenant.
   * @param {string} id
   * @param {string} role
   * @param {string} tenantId
   */
  async updateRole(id, role, tenantId) {
    return prisma.user.update({
      where: { id, tenantId },
      data: { role },
    });
  },

  /**
   * Update a user's status scoped to a tenant.
   * @param {string} id
   * @param {string} status
   * @param {string} tenantId
   */
  async updateStatus(id, status, tenantId) {
    return prisma.user.update({
      where: { id, tenantId },
      data: { status },
    });
  },

  /**
   * Update general user details scoped to a tenant.
   * @param {string} id
   * @param {Object} data
   * @param {string} tenantId
   */
  async update(id, data, tenantId) {
    return prisma.user.update({
      where: { id, tenantId },
      data,
    });
  },

  /**
   * Update a user's password hash and timestamp scoped to a tenant.
   * @param {string} id
   * @param {string} passwordHash
   * @param {string} tenantId
   */
  async updatePassword(id, passwordHash, tenantId) {
    return prisma.user.update({
      where: { id, tenantId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
      },
    });
  },

  /**
   * Count the number of active, non-deleted Owners in a tenant.
   * @param {string} tenantId
   */
  async countOwners(tenantId) {
    return prisma.user.count({
      where: {
        tenantId,
        role: "OWNER",
        deletedAt: null,
      },
    });
  },

  /**
   * Revokes all active refresh tokens for a user.
   * Used on password resets or account deactivation to invalidate sessions.
   * @param {string} userId
   */
  async revokeSessions(userId) {
    return prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },
};
