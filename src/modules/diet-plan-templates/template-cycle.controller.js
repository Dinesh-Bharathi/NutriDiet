// src/modules/diet-plan-templates/template-cycle.controller.js
import { templateCycleService } from './template-cycle.service.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const templateCycleController = {
  async createCycle(req, res) {
    const tenantId = req.user.tenantId;
    const templateId = req.params.id;
    const cycle = await templateCycleService.createCycle(tenantId, templateId, req.body);
    return sendSuccess(res, HTTP_STATUS.CREATED, 'Template cycle created successfully', cycle);
  },

  async getCycles(req, res) {
    const tenantId = req.user.tenantId;
    const templateId = req.params.id;
    const cycles = await templateCycleService.getCyclesByTemplateId(tenantId, templateId);
    return sendSuccess(res, HTTP_STATUS.OK, 'Template cycles retrieved successfully', cycles);
  },

  async updateCycle(req, res) {
    const tenantId = req.user.tenantId;
    const { cycleId } = req.params;
    const cycle = await templateCycleService.updateCycle(tenantId, cycleId, req.body);
    return sendSuccess(res, HTTP_STATUS.OK, 'Template cycle updated successfully', cycle);
  },

  async deleteCycle(req, res) {
    const tenantId = req.user.tenantId;
    const { cycleId } = req.params;
    await templateCycleService.deleteCycle(tenantId, cycleId);
    return sendSuccess(res, HTTP_STATUS.OK, 'Template cycle deleted successfully', null);
  },

  async createCycleDay(req, res) {
    const tenantId = req.user.tenantId;
    const { cycleId } = req.params;
    const day = await templateCycleService.createCycleDay(tenantId, cycleId, req.body);
    return sendSuccess(res, HTTP_STATUS.CREATED, 'Template cycle day created successfully', day);
  },

  async getCycleDays(req, res) {
    const tenantId = req.user.tenantId;
    const { cycleId } = req.params;
    const days = await templateCycleService.getCycleDays(tenantId, cycleId);
    return sendSuccess(res, HTTP_STATUS.OK, 'Template cycle days retrieved successfully', days);
  },

  async updateCycleDay(req, res) {
    const tenantId = req.user.tenantId;
    const { dayId } = req.params;
    const day = await templateCycleService.updateCycleDay(tenantId, dayId, req.body);
    return sendSuccess(res, HTTP_STATUS.OK, 'Template cycle day updated successfully', day);
  },

  async deleteCycleDay(req, res) {
    const tenantId = req.user.tenantId;
    const { dayId } = req.params;
    await templateCycleService.deleteCycleDay(tenantId, dayId);
    return sendSuccess(res, HTTP_STATUS.OK, 'Template cycle day deleted successfully', null);
  },
};
