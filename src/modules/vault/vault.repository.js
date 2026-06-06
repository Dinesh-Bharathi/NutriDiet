import prisma from '../../lib/prisma.js';

export const vaultRepository = {
  create: async (data, tenantId) => {
    return prisma.vaultDocument.create({
      data: { ...data, tenantId },
      include: { asset: true }
    });
  },

  findByClientId: async (clientId, tenantId, filters = {}) => {
    const { category, search } = filters;
    
    const whereClause = { 
      clientId, 
      tenantId, 
      deletedAt: null 
    };

    if (category && category !== 'ALL') {
      whereClause.category = category;
    }

    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { asset: { originalName: { contains: search, mode: 'insensitive' } } },
        { asset: { fileName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    return prisma.vaultDocument.findMany({
      where: whereClause,
      include: { asset: true },
      orderBy: { createdAt: 'desc' }
    });
  },

  findById: async (id, tenantId) => {
    return prisma.vaultDocument.findFirst({
      where: { id, tenantId, deletedAt: null }
    });
  },

  softDelete: async (id, tenantId) => {
    return prisma.vaultDocument.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() }
    });
  }
};
