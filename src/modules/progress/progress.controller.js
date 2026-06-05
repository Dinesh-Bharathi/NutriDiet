// src/modules/progress/progress.controller.js
// Client progress tracking and dashboard reviews controller.
import { progressService } from './progress.service.js';
import { progressMapper } from './progress.mapper.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const progressController = {
  /**
   * GET /api/v1/clients/:clientId/progress
   * Retrieves chronological trends for weight, measurements, sleep, water, and adherence.
   */
  async getClientProgress(req, res) {
    const tenantId = req.user.tenantId;
    const { clientId } = req.params;

    const progress = await progressService.getClientProgress(tenantId, clientId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Client progress trends retrieved successfully',
      progressMapper.mapProgressTrends(progress)
    );
  },

  /**
   * GET /api/v1/clients/:clientId/progress-summary
   * Retrieves summary details of start/current states, total changes, and averages.
   */
  async getClientProgressSummary(req, res) {
    const tenantId = req.user.tenantId;
    const { clientId } = req.params;

    const summary = await progressService.getClientProgressSummary(tenantId, clientId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Client progress summary retrieved successfully',
      progressMapper.mapProgressSummary(summary)
    );
  },

  /**
   * GET /api/v1/clients/:clientId/progress-snapshot
   * Retrieves simplified dashboard metrics snapshot for a client.
   */
  async getClientProgressSnapshot(req, res) {
    const tenantId = req.user.tenantId;
    const { clientId } = req.params;

    const snapshot = await progressService.getClientProgressSnapshot(tenantId, clientId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Client progress snapshot retrieved successfully',
      progressMapper.mapProgressSnapshot(snapshot)
    );
  },

  /**
   * GET /api/v1/reviews/dashboard
   * Compiles practitioner review dashboard data and analytics.
   */
  async getReviewDashboard(req, res) {
    const tenantId = req.user.tenantId;

    const dashboard = await progressService.getReviewDashboard(tenantId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Review dashboard retrieved successfully',
      progressMapper.mapReviewDashboard(dashboard)
    );
  },
  /**
   * GET /api/v1/clients/:clientId/progress-dashboard
   * Single-shot full progress dashboard: summary + anthropometric chart + lifestyle timeline.
   * Independent of check-in status — renders SSoT baseline with 0 check-ins.
   */
  async getFullProgressDashboard(req, res) {
    const tenantId = req.user.tenantId;
    const { clientId } = req.params;

    const dashboard = await progressService.getFullProgressDashboard(tenantId, clientId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Client progress dashboard retrieved successfully',
      dashboard
    );
  },
};
