// src/modules/food-library/tag.service.js
import { tagRepository } from './tag.repository.js';
import ApiError from '../../utils/ApiError.js';

export const tagService = {
  async createTag(tenantId, data) {
    const existing = await tagRepository.findByName(tenantId, data.name);
    if (existing) {
      throw ApiError.badRequest('A tag with this name already exists');
    }
    return tagRepository.create(tenantId, data);
  },

  async getTagById(tenantId, id) {
    const tag = await tagRepository.findById(tenantId, id);
    if (!tag) {
      throw ApiError.notFound('Tag');
    }
    return tag;
  },

  async getAllTags(tenantId) {
    return tagRepository.findAll(tenantId);
  },

  async updateTag(tenantId, id, data) {
    const tag = await tagRepository.findById(tenantId, id);
    if (!tag) {
      throw ApiError.notFound('Tag');
    }

    if (tag.isSystem) {
      throw ApiError.forbidden('Cannot modify system-defined food tags');
    }

    if (data.name && data.name.toLowerCase() !== tag.name.toLowerCase()) {
      const existing = await tagRepository.findByName(tenantId, data.name);
      if (existing && existing.id !== id) {
        throw ApiError.badRequest('A tag with this name already exists');
      }
    }

    return tagRepository.update(id, data);
  },

  async deleteTag(tenantId, id) {
    const tag = await tagRepository.findById(tenantId, id);
    if (!tag) {
      throw ApiError.notFound('Tag');
    }

    if (tag.isSystem) {
      throw ApiError.forbidden('Cannot delete system-defined food tags');
    }

    return tagRepository.delete(id);
  },
};
