// src/modules/food-library/tag.repository.js
import prisma from '../../lib/prisma.js';

export const tagRepository = {
  async create(tenantId, data) {
    return prisma.foodTag.create({
      data: {
        ...data,
        tenantId,
        isSystem: false,
      },
    });
  },

  async findById(tenantId, id) {
    return prisma.foodTag.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { tenantId },
          { isSystem: true },
        ],
      },
    });
  },

  async findByName(tenantId, name) {
    return prisma.foodTag.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        deletedAt: null,
        OR: [
          { tenantId },
          { isSystem: true },
        ],
      },
    });
  },

  async findAll(tenantId) {
    return prisma.foodTag.findMany({
      where: {
        deletedAt: null,
        OR: [
          { tenantId },
          { isSystem: true },
        ],
      },
      orderBy: { name: 'asc' },
    });
  },

  async update(id, data) {
    return prisma.foodTag.update({
      where: { id },
      data,
    });
  },

  async delete(id) {
    return prisma.foodTag.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  // Tag Mapping Operations
  async createMapping(foodId, tagId) {
    return prisma.foodTagMapping.create({
      data: {
        foodId,
        tagId,
      },
    });
  },

  async deleteMapping(foodId, tagId) {
    return prisma.foodTagMapping.deleteMany({
      where: {
        foodId,
        tagId,
      },
    });
  },

  async clearMappingsForFood(foodId) {
    return prisma.foodTagMapping.deleteMany({
      where: { foodId },
    });
  },
};
