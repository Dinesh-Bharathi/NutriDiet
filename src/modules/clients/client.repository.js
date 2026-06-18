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
    const { search, status, onboardingStatus, dietitianId, sortBy } = filters;
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

    if (sortBy === 'lastActiveMessage') {
      const queryParts = [
        `SELECT c.id FROM clients c`,
        `LEFT JOIN whatsapp_conversations wc ON wc."clientId" = c.id AND wc."tenantId" = c."tenantId"`,
        `WHERE c."tenantId" = $1 AND c."deletedAt" IS NULL`
      ];
      const queryParams = [tenantId];
      let paramIndex = 2;

      if (status) {
        queryParts.push(`AND c.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      if (onboardingStatus) {
        queryParts.push(`AND c."onboardingStatus" = $${paramIndex}`);
        queryParams.push(onboardingStatus);
        paramIndex++;
      }

      if (dietitianId) {
        queryParts.push(`AND c."dietitianId" = $${paramIndex}`);
        queryParams.push(dietitianId);
        paramIndex++;
      }

      if (search) {
        const searchPattern = `%${search}%`;
        queryParts.push(`AND (
          c."firstName" ILIKE $${paramIndex} OR
          c."lastName" ILIKE $${paramIndex} OR
          c.email ILIKE $${paramIndex} OR
          c.phone ILIKE $${paramIndex}
        )`);
        queryParams.push(searchPattern);
        paramIndex++;
      }

      const countQuery = `SELECT COUNT(*)::int as count FROM (${queryParts.join(' ')}) as sub`;
      
      queryParts.push(`ORDER BY COALESCE(wc."lastMessageAt", c."updatedAt") DESC, c.id DESC`);
      queryParts.push(`LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`);
      
      const selectParams = [...queryParams, limit, skip];
      
      const [idsResult, countResult] = await Promise.all([
        prisma.$queryRawUnsafe(queryParts.join(' '), ...selectParams),
        prisma.$queryRawUnsafe(countQuery, ...queryParams),
      ]);

      const ids = idsResult.map(r => r.id);
      const total = countResult[0]?.count || 0;

      const clients = await prisma.client.findMany({
        where: {
          id: { in: ids },
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
          whatsAppConversations: {
            select: {
              id: true,
              lastMessageAt: true,
              lastMessageText: true,
              unreadCount: true,
              isMuted: true,
              isArchived: true,
              optInStatus: true,
              optInCapturedAt: true,
              lastInboundAt: true,
              lastOutboundAt: true,
              conversationStartedAt: true,
              lastClientMessageAt: true,
              lastPractitionerMessageAt: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: { messages: true }
              }
            }
          }
        },
      });

      const sortedClients = ids.map(id => clients.find(c => c.id === id)).filter(Boolean);
      return [sortedClients, total];
    } else {
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
            whatsAppConversations: {
              select: {
                id: true,
                lastMessageAt: true,
                lastMessageText: true,
                unreadCount: true,
                isMuted: true,
                isArchived: true,
                optInStatus: true,
                optInCapturedAt: true,
                lastInboundAt: true,
                lastOutboundAt: true,
                conversationStartedAt: true,
                lastClientMessageAt: true,
                lastPractitionerMessageAt: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                  select: { messages: true }
                }
              }
            }
          },
        }),
        prisma.client.count({ where }),
      ]);

      return [clients, total];
    }
  }
};
