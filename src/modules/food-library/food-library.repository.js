// src/modules/food-library/food-library.repository.js
// Database operations for FoodLibrary — tenant-isolated.
import prisma from '../../lib/prisma.js';

export const foodLibraryRepository = {
  async create(tenantId, data) {
    return prisma.foodLibrary.create({
      data: {
        ...data,
        tenantId,
      },
    });
  },

  async findById(tenantId, id) {
    return prisma.foodLibrary.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
    });
  },

  async findByName(tenantId, foodName) {
    return prisma.foodLibrary.findFirst({
      where: {
        tenantId,
        foodName: {
          equals: foodName,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
    });
  },

  async findManyAndCount(tenantId, pagination) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const take = limit;

    const where = {
      tenantId,
      deletedAt: null,
    };

    const [foods, total] = await Promise.all([
      prisma.foodLibrary.findMany({
        where,
        skip,
        take,
        orderBy: { foodName: 'asc' },
      }),
      prisma.foodLibrary.count({ where }),
    ]);

    return [foods, total];
  },

  async search(tenantId, q, pagination) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const take = limit;

    const where = {
      tenantId,
      foodName: {
        contains: q,
        mode: 'insensitive',
      },
      deletedAt: null,
    };

    const [foods, total] = await Promise.all([
      prisma.foodLibrary.findMany({
        where,
        skip,
        take,
        orderBy: { foodName: 'asc' },
      }),
      prisma.foodLibrary.count({ where }),
    ]);

    return [foods, total];
  },

  async update(tenantId, id, data) {
    // Perform updateMany-based update or findFirst then update to enforce tenancy checks safely.
    const food = await this.findById(tenantId, id);
    if (!food) return null;

    return prisma.foodLibrary.update({
      where: { id },
      data,
    });
  },

  async softDelete(tenantId, id) {
    const food = await this.findById(tenantId, id);
    if (!food) return 0;

    const result = await prisma.foodLibrary.updateMany({
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
