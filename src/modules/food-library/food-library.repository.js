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
      include: {
        category: true,
        tagMappings: {
          include: { tag: true },
        },
        servings: {
          orderBy: { displayOrder: 'asc' },
        },
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

  async searchAdvanced(tenantId, filters, pagination) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;
    const take = limit;

    const where = {
      tenantId,
      deletedAt: null,
    };

    // Filter by status (default to ACTIVE if not specified)
    if (filters.status) {
      where.status = filters.status;
    } else {
      where.status = 'ACTIVE';
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.tagIds) {
      const tagIdsArray = Array.isArray(filters.tagIds)
        ? filters.tagIds
        : filters.tagIds.split(',').map((id) => id.trim()).filter(Boolean);

      if (tagIdsArray.length > 0) {
        where.tagMappings = {
          some: {
            tagId: { in: tagIdsArray },
          },
        };
      }
    }

    if (filters.minCalories !== undefined || filters.maxCalories !== undefined) {
      where.calories = {};
      if (filters.minCalories !== undefined) where.calories.gte = parseFloat(filters.minCalories);
      if (filters.maxCalories !== undefined) where.calories.lte = parseFloat(filters.maxCalories);
    }

    if (filters.minProtein !== undefined || filters.maxProtein !== undefined) {
      where.protein = {};
      if (filters.minProtein !== undefined) where.protein.gte = parseFloat(filters.minProtein);
      if (filters.maxProtein !== undefined) where.protein.lte = parseFloat(filters.maxProtein);
    }

    if (filters.query) {
      where.OR = [
        { foodName: { contains: filters.query, mode: 'insensitive' } },
        { commonName: { contains: filters.query, mode: 'insensitive' } },
        { brandName: { contains: filters.query, mode: 'insensitive' } },
        { searchKeywords: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    const [foods, total] = await Promise.all([
      prisma.foodLibrary.findMany({
        where,
        skip,
        take,
        orderBy: { foodName: 'asc' },
        include: {
          category: true,
          tagMappings: {
            include: { tag: true },
          },
          servings: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      }),
      prisma.foodLibrary.count({ where }),
    ]);

    return [foods, total];
  },

  async findManyAndCount(tenantId, pagination) {
    return this.searchAdvanced(tenantId, {}, pagination);
  },

  async search(tenantId, q, pagination) {
    return this.searchAdvanced(tenantId, { query: q }, pagination);
  },

  async update(tenantId, id, data) {
    const food = await this.findById(tenantId, id);
    if (!food) return null;

    // Handle tag mapping updates if provided in data
    const { tagIds, ...updateData } = data;

    return prisma.$transaction(async (tx) => {
      if (tagIds !== undefined) {
        // Clear existing tags
        await tx.foodTagMapping.deleteMany({
          where: { foodId: id },
        });

        // Insert new tags
        if (tagIds.length > 0) {
          await tx.foodTagMapping.createMany({
            data: tagIds.map((tagId) => ({
              foodId: id,
              tagId,
            })),
          });
        }
      }

      return tx.foodLibrary.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          tagMappings: {
            include: { tag: true },
          },
          servings: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
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
