// src/modules/food-library/category.repository.js
import prisma from '../../lib/prisma.js';

export const categoryRepository = {
  async create(tenantId, data) {
    return prisma.foodCategory.create({
      data: {
        ...data,
        tenantId,
        isSystem: false,
      },
      include: {
        parentCategory: true,
      },
    });
  },

  async findById(tenantId, id) {
    return prisma.foodCategory.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { tenantId },
          { isSystem: true },
        ],
      },
      include: {
        parentCategory: true,
        children: {
          where: { deletedAt: null },
        },
      },
    });
  },

  async findByName(tenantId, name) {
    return prisma.foodCategory.findFirst({
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
    return prisma.foodCategory.findMany({
      where: {
        deletedAt: null,
        OR: [
          { tenantId },
          { isSystem: true },
        ],
      },
      include: {
        parentCategory: true,
        children: {
          where: { deletedAt: null },
        },
      },
      orderBy: { name: 'asc' },
    });
  },

  async update(id, data) {
    return prisma.foodCategory.update({
      where: { id },
      data,
      include: {
        parentCategory: true,
      },
    });
  },

  async delete(id) {
    return prisma.foodCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};
