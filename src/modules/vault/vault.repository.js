import prisma from '../../lib/prisma.js';

export const vaultRepository = {
  create: async (data, tenantId) => {
    return prisma.vaultDocument.create({
      data: { ...data, tenantId },
      include: { asset: true }
    });
  },
  findByClientId: async (clientId, tenantId, filters = {}) => {
    const { category, search, type, page, limit } = filters;
    
    const whereClause = { 
      clientId, 
      tenantId, 
      deletedAt: null 
    };

    if (category && category !== 'ALL') {
      whereClause.category = category;
    }

    if (type && type !== 'ALL') {
      if (type === 'PDF') {
        whereClause.asset = { mimeType: 'application/pdf' };
      } else if (type === 'IMAGE') {
        whereClause.asset = { mimeType: { startsWith: 'image/' } };
      } else if (type === 'WORD') {
        whereClause.asset = {
          mimeType: {
            in: [
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ]
          }
        };
      } else if (type === 'EXCEL') {
        whereClause.asset = {
          mimeType: {
            in: [
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/csv'
            ]
          }
        };
      }
    }

    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { asset: { originalName: { contains: search, mode: 'insensitive' } } },
        { asset: { fileName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const queryOptions = {
      where: whereClause,
      include: { asset: true },
      orderBy: { createdAt: 'desc' }
    };

    if (page && limit) {
      queryOptions.skip = (parseInt(page) - 1) * parseInt(limit);
      queryOptions.take = parseInt(limit);

      const [documents, total] = await Promise.all([
        prisma.vaultDocument.findMany(queryOptions),
        prisma.vaultDocument.count({ where: whereClause })
      ]);
      return { documents, total };
    }

    return prisma.vaultDocument.findMany(queryOptions);
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
