// src/modules/meal-swaps/meal-swap.controller.js
import { mealSwapService } from "./meal-swap.service.js";
import { HTTP_STATUS } from "../../config/constants.js";

export const mealSwapController = {
  /**
   * GET /api/v1/meals/:mealId/items/:itemId/swaps
   */
  async getSwapCandidates(req, res) {
    const { itemId } = req.params;
    const {
      strategy,
      tags,
      allergies,
      preferences,
      restrictions,
      q,
      page,
      limit,
    } = req.query;

    const result = await mealSwapService.getSwapCandidates(
      req.user.tenantId,
      itemId,
      strategy,
      { tags, allergies, preferences, restrictions, q, page, limit },
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  },

  /**
   * POST /api/v1/meals/:mealId/items/:itemId/swaps/apply
   */
  async applySingleSwap(req, res) {
    const { itemId } = req.params;
    const { targetFoodId, swapStrategy } = req.body;

    const result = await mealSwapService.applySingleSwap(
      req.user.tenantId,
      itemId,
      targetFoodId,
      swapStrategy,
      req.user.userId,
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Meal item swapped successfully",
      data: result,
    });
  },

  /**
   * POST /api/v1/diet-plans/:dietPlanId/swaps/apply
   */
  async applyBulkPlanSwap(req, res) {
    const { dietPlanId } = req.params;

    const results = await mealSwapService.applyBulkPlanSwap(
      req.user.tenantId,
      dietPlanId,
      req.body,
      req.user.userId,
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Successfully swapped ${results.length} meal item(s) in diet plan`,
      data: results,
    });
  },

  /**
   * POST /api/v1/diet-plan-templates/:templateId/swaps/apply
   */
  async applyBulkTemplateSwap(req, res) {
    const { templateId } = req.params;

    const results = await mealSwapService.applyBulkTemplateSwap(
      req.user.tenantId,
      templateId,
      req.body,
      req.user.userId,
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: `Successfully swapped ${results.length} meal item(s) in template`,
      data: results,
    });
  },
};
