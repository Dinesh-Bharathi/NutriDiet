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
      ...(role && { role: { in: role } }),
      ...(status && { status }),
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
};
