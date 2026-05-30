// src/modules/food-library/food-library-v2.controller.js
import { categoryService } from './category.service.js';
import { tagService } from './tag.service.js';
import { servingService } from './serving.service.js';
import { equivalentService } from './equivalent.service.js';
import { foodLibraryService } from './food-library.service.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const foodLibraryV2Controller = {
  // ─── Food Category Handlers ────────────────────────────────────────────────
  async createCategory(req, res) {
    const tenantId = req.user.tenantId;
    const category = await categoryService.createCategory(tenantId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Food category created successfully',
      { category }
    );
  },

  async getAllCategories(req, res) {
    const tenantId = req.user.tenantId;
    const categories = await categoryService.getAllCategories(tenantId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food categories retrieved successfully',
      { categories }
    );
  },

  async getCategoryById(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const category = await categoryService.getCategoryById(tenantId, id);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food category retrieved successfully',
      { category }
    );
  },

  async updateCategory(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const category = await categoryService.updateCategory(tenantId, id, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food category updated successfully',
      { category }
    );
  },

  async deleteCategory(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    await categoryService.deleteCategory(tenantId, id);

    return sendSuccess(res, HTTP_STATUS.OK, 'Food category deleted successfully');
  },

  // ─── Food Tag Handlers ────────────────────────────────────────────────────
  async createTag(req, res) {
    const tenantId = req.user.tenantId;
    const tag = await tagService.createTag(tenantId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Food tag created successfully',
      { tag }
    );
  },

  async getAllTags(req, res) {
    const tenantId = req.user.tenantId;
    const tags = await tagService.getAllTags(tenantId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food tags retrieved successfully',
      { tags }
    );
  },

  async getTagById(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const tag = await tagService.getTagById(tenantId, id);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food tag retrieved successfully',
      { tag }
    );
  },

  async updateTag(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const tag = await tagService.updateTag(tenantId, id, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food tag updated successfully',
      { tag }
    );
  },

  async deleteTag(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    await tagService.deleteTag(tenantId, id);

    return sendSuccess(res, HTTP_STATUS.OK, 'Food tag deleted successfully');
  },

  // ─── Food Serving Handlers ────────────────────────────────────────────────
  async createServing(req, res) {
    const tenantId = req.user.tenantId;
    const { id: foodId } = req.params;
    const serving = await servingService.createServing(tenantId, foodId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Food serving size added successfully',
      { serving }
    );
  },

  async getAllServings(req, res) {
    const tenantId = req.user.tenantId;
    const { id: foodId } = req.params;
    const servings = await servingService.getAllServingsForFood(tenantId, foodId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food serving sizes retrieved successfully',
      { servings }
    );
  },

  async updateServing(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const serving = await servingService.updateServing(tenantId, id, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food serving size updated successfully',
      { serving }
    );
  },

  async deleteServing(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    await servingService.deleteServing(tenantId, id);

    return sendSuccess(res, HTTP_STATUS.OK, 'Food serving size deleted successfully');
  },

  // ─── Food Equivalent Handlers ─────────────────────────────────────────────
  async createEquivalent(req, res) {
    const tenantId = req.user.tenantId;
    const { id: foodId } = req.params;
    const equivalent = await equivalentService.createEquivalent(tenantId, foodId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Food equivalency pair created successfully',
      { equivalent }
    );
  },

  async getAllEquivalents(req, res) {
    const tenantId = req.user.tenantId;
    const { id: foodId } = req.params;
    const equivalents = await equivalentService.getEquivalentFoods(tenantId, foodId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food equivalents retrieved successfully',
      { equivalents }
    );
  },

  async deleteEquivalent(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    await equivalentService.deleteEquivalent(tenantId, id);

    return sendSuccess(res, HTTP_STATUS.OK, 'Food equivalency pair deleted successfully');
  },

  // ─── Food Details Handlers ────────────────────────────────────────────────
  async getFoodDetails(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const details = await foodLibraryService.getFoodDetails(tenantId, id);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food details retrieved successfully',
      { details }
    );
  },
};
