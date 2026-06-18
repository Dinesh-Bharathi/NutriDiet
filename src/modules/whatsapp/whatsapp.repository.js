import prisma from '../../lib/prisma.js';

export const whatsappRepository = {
  /**
   * Find connection status & details by tenantId.
   *
   * @param {string} tenantId
   * @returns {Promise<object|null>}
   */
  async findByTenantId(tenantId) {
    return prisma.whatsAppConnection.findUnique({
      where: { tenantId },
    });
  },

  /**
   * Create or update WhatsApp connection for the tenant.
   *
   * @param {string} tenantId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async upsert(tenantId, data) {
    return prisma.whatsAppConnection.upsert({
      where: { tenantId },
      update: data,
      create: {
        ...data,
        tenantId,
      },
    });
  },

  /**
   * Update fields on an existing WhatsApp connection.
   *
   * @param {string} tenantId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(tenantId, data) {
    return prisma.whatsAppConnection.update({
      where: { tenantId },
      data,
    });
  },

  /**
   * Raw query search for WhatsApp messages and client conversations.
   *
   * @param {string} tenantId
   * @param {object} params - { q }
   * @returns {Promise<object>}
   */
  async searchMessages(tenantId, { q }) {
    const searchLower = String(q || '').trim().toLowerCase();

    if (!searchLower) {
      return { conversations: [], messages: [] };
    }

    // 1. Find conversations where the client name or phone matches q
    const conversations = await prisma.whatsAppConversation.findMany({
      where: {
        tenantId,
        client: {
          OR: [
            { firstName: { contains: searchLower, mode: 'insensitive' } },
            { lastName: { contains: searchLower, mode: 'insensitive' } },
            { phone: { contains: searchLower } },
          ],
        },
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatarAssetId: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // 2. Find messages matching content (body or mediaFileName)
    const messages = await prisma.whatsAppMessage.findMany({
      where: {
        tenantId,
        OR: [
          { body: { contains: searchLower, mode: 'insensitive' } },
          { mediaFileName: { contains: searchLower, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        conversation: {
          include: {
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatarAssetId: true,
              },
            },
          },
        },
      },
    });

    return { conversations, messages };
  },
};

