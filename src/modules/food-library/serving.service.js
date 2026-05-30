// src/modules/food-library/serving.service.js
import { servingRepository } from './serving.repository.js';
import { foodLibraryRepository } from './food-library.repository.js';
import ApiError from '../../utils/ApiError.js';

export const servingService = {
  async createServing(tenantId, foodId, data) {
    const food = await foodLibraryRepository.findById(tenantId, foodId);
    if (!food) {
      throw ApiError.notFound('Food item');
    }

    return servingRepository.create(foodId, data);
  },

  async getAllServingsForFood(tenantId, foodId) {
    const food = await foodLibraryRepository.findById(tenantId, foodId);
    if (!food) {
      throw ApiError.notFound('Food item');
    }

    return servingRepository.findAllForFood(foodId);
  },

  async updateServing(tenantId, id, data) {
    const serving = await servingRepository.findById(id);
    if (!serving || serving.food.tenantId !== tenantId) {
      throw ApiError.notFound('Serving');
    }

    return servingRepository.update(id, serving.foodId, data);
  },

  async deleteServing(tenantId, id) {
    const serving = await servingRepository.findById(id);
    if (!serving || serving.food.tenantId !== tenantId) {
      throw ApiError.notFound('Serving');
    }

    return servingRepository.delete(id);
  },
};
