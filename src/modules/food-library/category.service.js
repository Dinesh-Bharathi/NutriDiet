// src/modules/food-library/category.service.js
import { categoryRepository } from './category.repository.js';
import ApiError from '../../utils/ApiError.js';

export const categoryService = {
  async createCategory(tenantId, data) {
    // 1. Verify name uniqueness
    const existing = await categoryRepository.findByName(tenantId, data.name);
    if (existing) {
      throw ApiError.badRequest('A category with this name already exists');
    }

    // 2. Verify parent category exists and is accessible
    if (data.parentCategoryId) {
      const parent = await categoryRepository.findById(tenantId, data.parentCategoryId);
      if (!parent) {
        throw ApiError.notFound('Parent Category');
      }
    }

    return categoryRepository.create(tenantId, data);
  },

  async getCategoryById(tenantId, id) {
    const category = await categoryRepository.findById(tenantId, id);
    if (!category) {
      throw ApiError.notFound('Category');
    }
    return category;
  },

  async getAllCategories(tenantId) {
    return categoryRepository.findAll(tenantId);
  },

  async updateCategory(tenantId, id, data) {
    // 1. Retrieve the category
    const category = await categoryRepository.findById(tenantId, id);
    if (!category) {
      throw ApiError.notFound('Category');
    }

    // 2. Prevent modifying system categories
    if (category.isSystem) {
      throw ApiError.forbidden('Cannot modify system-defined food categories');
    }

    // 3. Verify name uniqueness if name is changed
    if (data.name && data.name.toLowerCase() !== category.name.toLowerCase()) {
      const existing = await categoryRepository.findByName(tenantId, data.name);
      if (existing && existing.id !== id) {
        throw ApiError.badRequest('A category with this name already exists');
      }
    }

    // 4. Prevent self-referencing hierarchy
    if (data.parentCategoryId) {
      if (data.parentCategoryId === id) {
        throw ApiError.badRequest('A category cannot be its own parent');
      }

      const parent = await categoryRepository.findById(tenantId, data.parentCategoryId);
      if (!parent) {
        throw ApiError.notFound('Parent Category');
      }
    }

    return categoryRepository.update(id, data);
  },

  async deleteCategory(tenantId, id) {
    const category = await categoryRepository.findById(tenantId, id);
    if (!category) {
      throw ApiError.notFound('Category');
    }

    if (category.isSystem) {
      throw ApiError.forbidden('Cannot delete system-defined food categories');
    }

    return categoryRepository.delete(id);
  },
};
