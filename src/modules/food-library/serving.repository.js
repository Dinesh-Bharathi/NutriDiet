// src/modules/food-library/serving.repository.js
import prisma from '../../lib/prisma.js';

export const servingRepository = {
  async create(foodId, data) {
    if (data.isDefault) {
      return prisma.$transaction(async (tx) => {
        await tx.foodServing.updateMany({
          where: { foodId },
          data: { isDefault: false },
        });

        return tx.foodServing.create({
          data: {
            ...data,
            foodId,
          },
        });
      });
    }

    return prisma.foodServing.create({
      data: {
        ...data,
        foodId,
      },
    });
  },

  async findById(id) {
    return prisma.foodServing.findUnique({
      where: { id },
      include: {
        food: {
          select: { tenantId: true },
        },
      },
    });
  },

  async findAllForFood(foodId) {
    return prisma.foodServing.findMany({
      where: { foodId },
      orderBy: { displayOrder: 'asc' },
    });
  },

  async update(id, foodId, data) {
    if (data.isDefault) {
      return prisma.$transaction(async (tx) => {
        await tx.foodServing.updateMany({
          where: { foodId },
          data: { isDefault: false },
        });

        return tx.foodServing.update({
          where: { id },
          data,
        });
      });
    }

    return prisma.foodServing.update({
      where: { id },
      data,
    });
  },

  async delete(id) {
    return prisma.foodServing.delete({
      where: { id },
    });
  },
};
