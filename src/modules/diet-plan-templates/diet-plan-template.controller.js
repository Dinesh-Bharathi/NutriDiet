// src/modules/diet-plan-templates/diet-plan-template.controller.js
// Diet plan templates HTTP adapter.
import { dietPlanTemplateService } from './diet-plan-template.service.js';
import { mapTemplate, mapTemplateList } from './diet-plan-template.mapper.js';
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
};
