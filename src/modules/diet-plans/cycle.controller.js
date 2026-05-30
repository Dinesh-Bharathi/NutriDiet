// src/modules/diet-plans/cycle.controller.js
import { cycleService } from './cycle.service.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const cycleController = {
  async createCycle(req, res) {
    const tenantId = req.user.tenantId;
    const dietPlanId = req.params.id;
    const cycle = await cycleService.createCycle(tenantId, dietPlanId, req.body);
    return sendSuccess(res, HTTP_STATUS.CREATED, 'Diet plan cycle created successfully', cycle);
  },

  async getCycles(req, res) {
    const tenantId = req.user.tenantId;
    const dietPlanId = req.params.id;
    const cycles = await cycleService.getCyclesByPlanId(tenantId, dietPlanId);
    return sendSuccess(res, HTTP_STATUS.OK, 'Diet plan cycles retrieved successfully', cycles);
  },

  async getCycle(req, res) {
    const tenantId = req.user.tenantId;
    const { cycleId } = req.params;
    const cycle = await cycleService.getCycleById(tenantId, cycleId);
    return sendSuccess(res, HTTP_STATUS.OK, 'Diet plan cycle retrieved successfully', cycle);
  },

  async updateCycle(req, res) {
    const tenantId = req.user.tenantId;
    const { cycleId } = req.params;
    const cycle = await cycleService.updateCycle(tenantId, cycleId, req.body);
    return sendSuccess(res, HTTP_STATUS.OK, 'Diet plan cycle updated successfully', cycle);
  },

  async deleteCycle(req, res) {
    const tenantId = req.user.tenantId;
    const { cycleId } = req.params;
    await cycleService.deleteCycle(tenantId, cycleId);
    return sendSuccess(res, HTTP_STATUS.OK, 'Diet plan cycle deleted successfully', null);
  },

  async createCycleDay(req, res) {
    const tenantId = req.user.tenantId;
    const { cycleId } = req.params;
    const day = await cycleService.createCycleDay(tenantId, cycleId, req.body);
    return sendSuccess(res, HTTP_STATUS.CREATED, 'Cycle day created successfully', day);
  },

  async getCycleDays(req, res) {
    const tenantId = req.user.tenantId;
    const { cycleId } = req.params;
    const days = await cycleService.getCycleDays(tenantId, cycleId);
    return sendSuccess(res, HTTP_STATUS.OK, 'Cycle days retrieved successfully', days);
  },

  async updateCycleDay(req, res) {
    const tenantId = req.user.tenantId;
    const { dayId } = req.params;
    const day = await cycleService.updateCycleDay(tenantId, dayId, req.body);
    return sendSuccess(res, HTTP_STATUS.OK, 'Cycle day updated successfully', day);
  },

  async deleteCycleDay(req, res) {
    const tenantId = req.user.tenantId;
    const { dayId } = req.params;
    await cycleService.deleteCycleDay(tenantId, dayId);
    return sendSuccess(res, HTTP_STATUS.OK, 'Cycle day deleted successfully', null);
  },

  async getCalendarPreview(req, res) {
    const tenantId = req.user.tenantId;
    const planId = req.params.id;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
    const preview = await cycleService.getCalendarPreview(tenantId, planId, limit);
    return sendSuccess(res, HTTP_STATUS.OK, 'Calendar preview retrieved successfully', preview);
  },
};
