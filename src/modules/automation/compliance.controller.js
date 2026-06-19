// src/modules/automation/compliance.controller.js

import { complianceService } from './compliance.service.js';
import ApiError from '../../utils/ApiError.js';
import { format } from 'date-fns';

export const complianceController = {
  /**
   * Retrieves client compliance summaries filtered by requested month.
   */
  async getComplianceCalendar(req, res) {
    const { clientId } = req.params;
    const { month } = req.query; // format: YYYY-MM
    const tenantId = req.user.tenantId;

    if (!clientId) {
      throw ApiError.badRequest('Client ID is required');
    }

    // Default to current month if not specified
    const targetMonth = month || format(new Date(), 'yyyy-MM');

    const calendar = await complianceService.getCalendarData(tenantId, clientId, targetMonth);

    return res.status(200).json({
      success: true,
      data: {
        calendar,
      },
    });
  },

  /**
   * Retrieves compliance KPI aggregates and trends.
   */
  async getComplianceAnalytics(req, res) {
    const { clientId } = req.params;
    const { period } = req.query; // options: 7d, 30d, 90d
    const tenantId = req.user.tenantId;

    if (!clientId) {
      throw ApiError.badRequest('Client ID is required');
    }

    const analytics = await complianceService.getAnalytics(tenantId, clientId, period || '7d');

    return res.status(200).json({
      success: true,
      data: {
        analytics,
      },
    });
  },

  /**
   * Retrieves paginated compliance event timeline records.
   */
  async getComplianceEvents(req, res) {
    const { clientId } = req.params;
    const { page, limit, jobType, date } = req.query;
    const tenantId = req.user.tenantId;

    if (!clientId) {
      throw ApiError.badRequest('Client ID is required');
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const data = await complianceService.getEvents(tenantId, clientId, pageNum, limitNum, jobType || null, date || null);

    return res.status(200).json({
      success: true,
      data,
    });
  },
};
