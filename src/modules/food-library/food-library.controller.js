// src/modules/food-library/food-library.controller.js
// Food library HTTP adapter endpoints.
import { foodLibraryService } from './food-library.service.js';
import { mapFoodItem, mapFoodList } from './food-library.mapper.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const foodLibraryController = {
  async createFood(req, res) {
    const tenantId = req.user.tenantId;

    const food = await foodLibraryService.createFood(tenantId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Food item created successfully',
      { food: mapFoodItem(food) }
    );
  },

  async getFoodLibrary(req, res) {
    const tenantId = req.user.tenantId;
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const filters = {
      query: req.query.q || undefined,
      categoryId: req.query.categoryId || undefined,
      tagIds: req.query.tagIds || undefined,
      status: req.query.status || undefined,
      minCalories: req.query.minCalories !== undefined ? Number(req.query.minCalories) : undefined,
      maxCalories: req.query.maxCalories !== undefined ? Number(req.query.maxCalories) : undefined,
      minProtein: req.query.minProtein !== undefined ? Number(req.query.minProtein) : undefined,
      maxProtein: req.query.maxProtein !== undefined ? Number(req.query.maxProtein) : undefined,
    };

    const result = await foodLibraryService.searchFoodAdvanced(tenantId, filters, pagination);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food library retrieved successfully',
      {
        foods: mapFoodList(result.foods),
        pagination: result.pagination,
      }
    );
  },


  async searchFood(req, res) {
    const tenantId = req.user.tenantId;
    const q = req.query.q;
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await foodLibraryService.searchFood(tenantId, q, pagination);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food search completed successfully',
      {
        foods: mapFoodList(result.foods),
        pagination: result.pagination,
      }
    );
  },

  async getFoodById(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const food = await foodLibraryService.getFoodById(tenantId, id);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food item retrieved successfully',
      { food: mapFoodItem(food) }
    );
  },

  async updateFood(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const food = await foodLibraryService.updateFood(tenantId, id, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Food item updated successfully',
      { food: mapFoodItem(food) }
    );
  },

  async deleteFood(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    await foodLibraryService.deleteFood(tenantId, id);

    return sendSuccess(res, HTTP_STATUS.OK, 'Food item deleted successfully');
  },
};
