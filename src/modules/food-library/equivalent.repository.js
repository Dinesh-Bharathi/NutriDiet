// src/modules/food-library/equivalent.repository.js
import prisma from '../../lib/prisma.js';

export const equivalentRepository = {
  async create(sourceFoodId, data) {
    return prisma.foodEquivalent.create({
      data: {
        sourceFoodId,
        targetFoodId: data.targetFoodId,
        equivalencyType: data.equivalencyType,
        similarityScore: data.similarityScore ?? 100,
      },
      include: {
        targetFood: true,
      },
    });
  },

  async findById(id) {
    return prisma.foodEquivalent.findUnique({
      where: { id },
      include: {
        sourceFood: {
          select: { tenantId: true },
        },
      },
    });
  },

  async findAllForFood(foodId) {
    return prisma.foodEquivalent.findMany({
      where: { sourceFoodId: foodId },
      include: {
        targetFood: {
          include: {
            category: true,
            tagMappings: {
              include: { tag: true },
            },
          },
        },
      },
      orderBy: { similarityScore: 'desc' },
    });
  },

  async delete(id) {
    return prisma.foodEquivalent.delete({
      where: { id },
    });
  },

  // Future Swap Engine Support structure
  async findEquivalentFoods(foodId) {
    return prisma.foodEquivalent.findMany({
      where: { sourceFoodId: foodId },
      include: {
        targetFood: {
          include: {
            category: true,
            servings: true,
            tagMappings: {
              include: { tag: true },
            },
          },
        },
      },
      orderBy: { similarityScore: 'desc' },
    });
  },
};
