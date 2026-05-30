// src/modules/food-library/food-library.service.js
// Business logic for FoodLibrary — tenant-isolated.
import { foodLibraryRepository } from './food-library.repository.js';
import ApiError from '../../utils/ApiError.js';

export const foodLibraryService = {
  async createFood(tenantId, data) {
    const existing = await foodLibraryRepository.findByName(tenantId, data.foodName);
    if (existing) {
      throw ApiError.conflict('A food item with this name already exists in your library');
    }

    return foodLibraryRepository.create(tenantId, data);
  },

  async getFoodById(tenantId, id) {
    const food = await foodLibraryRepository.findById(tenantId, id);
    if (!food) {
      throw ApiError.notFound('Food item');
    }
    return food;
  },

  async getFoodLibrary(tenantId, pagination) {
    const [foods, total] = await foodLibraryRepository.findManyAndCount(tenantId, pagination);
    
    const page = Number(pagination.page);
    const limit = Number(pagination.limit);

    return {
      foods,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async searchFood(tenantId, q, pagination) {
    const [foods, total] = await foodLibraryRepository.search(tenantId, q, pagination);
    
    const page = Number(pagination.page);
    const limit = Number(pagination.limit);

    return {
      foods,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async updateFood(tenantId, id, data) {
    if (data.foodName) {
      const existing = await foodLibraryRepository.findByName(tenantId, data.foodName);
      if (existing && existing.id !== id) {
        throw ApiError.conflict('Another food item with this name already exists');
      }
    }

    const updated = await foodLibraryRepository.update(tenantId, id, data);
    if (!updated) {
      throw ApiError.notFound('Food item');
    }
    return updated;
  },

  async deleteFood(tenantId, id) {
    const count = await foodLibraryRepository.softDelete(tenantId, id);
    if (count === 0) {
      throw ApiError.notFound('Food item');
    }
  },
};
