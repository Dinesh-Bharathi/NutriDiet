// src/modules/diet-plan-templates/diet-plan-template.controller.js
// Diet plan templates HTTP adapter.
import { dietPlanTemplateService } from './diet-plan-template.service.js';
import { mapTemplate, mapTemplateList, mapTemplateMeal, mapTemplateMealItem } from './diet-plan-template.mapper.js';
import { mapDietPlan } from '../diet-plans/diet-plan.mapper.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const dietPlanTemplateController = {
  async createTemplate(req, res) {
    const tenantId = req.user.tenantId;
    const creatorId = req.user.userId;

    const template = await dietPlanTemplateService.createTemplate(tenantId, creatorId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Diet plan template created successfully',
      { template: mapTemplate(template) }
    );
  },

  async getTemplates(req, res) {
    const tenantId = req.user.tenantId;
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await dietPlanTemplateService.getTemplates(tenantId, pagination);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Templates retrieved successfully',
      {
        templates: mapTemplateList(result.templates),
        pagination: result.pagination,
      }
    );
  },

  async getTemplateById(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const template = await dietPlanTemplateService.getTemplateById(tenantId, id);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Template retrieved successfully',
      { template: mapTemplate(template) }
    );
  },

  async updateTemplate(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const template = await dietPlanTemplateService.updateTemplate(tenantId, id, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Template updated successfully',
      { template: mapTemplate(template) }
    );
  },

  async deleteTemplate(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    await dietPlanTemplateService.deleteTemplate(tenantId, id);

    return sendSuccess(res, HTTP_STATUS.OK, 'Template deleted successfully');
  },

  async createTemplateFromPlan(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params; // Plan ID
    const creatorId = req.user.userId;

    const template = await dietPlanTemplateService.createTemplateFromPlan(
      tenantId,
      id,
      creatorId,
      req.body
    );

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Diet plan saved as template successfully',
      { template: mapTemplate(template) }
    );
  },

  async applyTemplateToClient(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params; // Template ID
    const creatorId = req.user.userId;
    const { clientId, startDate, endDate, status } = req.body;

    const plan = await dietPlanTemplateService.applyTemplateToClient(
      tenantId,
      id,
      clientId,
      creatorId,
      { startDate, endDate, status }
    );

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Template applied to client successfully',
      { dietPlan: mapDietPlan(plan) }
    );
  },

  // ─── Template Meal Controllers ─────────────────────────────────────────────
  async createMeal(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params; // Template ID

    const meal = await dietPlanTemplateService.createMeal(tenantId, id, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Template meal created successfully',
      { meal: mapTemplateMeal(meal) }
    );
  },

  async updateMeal(req, res) {
    const tenantId = req.user.tenantId;
    const { mealId } = req.params;

    const meal = await dietPlanTemplateService.updateMeal(tenantId, mealId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Template meal updated successfully',
      { meal: mapTemplateMeal(meal) }
    );
  },

  async deleteMeal(req, res) {
    const tenantId = req.user.tenantId;
    const { mealId } = req.params;

    await dietPlanTemplateService.deleteMeal(tenantId, mealId);

    return sendSuccess(res, HTTP_STATUS.OK, 'Template meal deleted successfully');
  },

  // ─── Template Meal Item Controllers ────────────────────────────────────────
  async createMealItem(req, res) {
    const tenantId = req.user.tenantId;
    const { mealId } = req.params;

    const item = await dietPlanTemplateService.createMealItem(tenantId, mealId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Template meal item created successfully',
      { item: mapTemplateMealItem(item) }
    );
  },

  async updateMealItem(req, res) {
    const tenantId = req.user.tenantId;
    const { itemId } = req.params;

    const item = await dietPlanTemplateService.updateMealItem(tenantId, itemId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Template meal item updated successfully',
      { item: mapTemplateMealItem(item) }
    );
  },

  async deleteMealItem(req, res) {
    const tenantId = req.user.tenantId;
    const { itemId } = req.params;

    await dietPlanTemplateService.deleteMealItem(tenantId, itemId);

    return sendSuccess(res, HTTP_STATUS.OK, 'Template meal item deleted successfully');
  },
};
