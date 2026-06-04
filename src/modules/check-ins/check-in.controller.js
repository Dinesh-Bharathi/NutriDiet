// src/modules/check-ins/check-in.controller.js
// Client check-in HTTP adapter endpoints.
import { checkInService } from './check-in.service.js';
import { mapCheckIn, mapCheckInList } from './check-in.mapper.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const checkInController = {
  /**
   * POST /api/v1/clients/:clientId/check-ins
   * Creates a new check-in for a client.
   */
  async createCheckIn(req, res) {
    const tenantId = req.user.tenantId;
    const { clientId } = req.params;

    const checkIn = await checkInService.createCheckIn(tenantId, clientId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Check-in created successfully',
      { checkIn: mapCheckIn(checkIn) }
    );
  },

  /**
   * GET /api/v1/clients/:clientId/check-ins
   * Lists all check-ins for a client (paginated, filtered, sorted).
   */
  async getClientCheckIns(req, res) {
    const tenantId = req.user.tenantId;
    const { clientId } = req.params;

    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const filters = {
      status: req.query.status,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    };

    const sorting = {
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    };

    const result = await checkInService.getClientCheckIns(
      tenantId,
      clientId,
      pagination,
      filters,
      sorting
    );

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Client check-ins retrieved successfully',
      {
        checkIns: mapCheckInList(result.checkIns),
        pagination: result.pagination,
      }
    );
  },

  /**
   * GET /api/v1/check-ins
   * Global practitioner view of all check-ins (paginated, filtered, sorted).
   */
  async getAllCheckIns(req, res) {
    const tenantId = req.user.tenantId;

    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const filters = {
      status: req.query.status,
      requiresFollowUp: req.query.requiresFollowUp,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
    };

    const sorting = {
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    };

    const result = await checkInService.getAllCheckIns(
      tenantId,
      pagination,
      filters,
      sorting
    );

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'All check-ins retrieved successfully',
      {
        checkIns: mapCheckInList(result.checkIns),
        pagination: result.pagination,
      }
    );
  },

  /**
   * GET /api/v1/check-ins/queue
   * Server-side paginated + searched practitioner queue.
   * Accepts ?page, ?limit, and ?q (free-text search on client name / email).
   * tenantId is read ONLY from req.user.tenantId — never from query params.
   */
  async getPractitionerQueue(req, res) {
    const tenantId = req.user.tenantId;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const q = req.query.q ? String(req.query.q).trim() : undefined;

    const params = {
      page,
      limit,
      q,
      status: req.query.status,
      requiresFollowUp: req.query.requiresFollowUp === 'true'
        ? true
        : req.query.requiresFollowUp === 'false'
          ? false
          : undefined,
      fromDate: req.query.fromDate ? new Date(req.query.fromDate) : undefined,
      toDate: req.query.toDate ? new Date(req.query.toDate) : undefined,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    };

    const result = await checkInService.getPractitionerQueue(tenantId, params);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Practitioner queue retrieved successfully',
      {
        checkIns: mapCheckInList(result.checkIns),
        pagination: result.pagination,
      }
    );
  },

  /**
   * GET /api/v1/check-ins/:id
   * Retrieves details of a specific check-in.
   */
  async getCheckInById(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const checkIn = await checkInService.getCheckInById(tenantId, id);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Check-in details retrieved successfully',
      { checkIn: mapCheckIn(checkIn) }
    );
  },

  /**
   * PATCH /api/v1/check-ins/:id
   * Updates an existing check-in.
   */
  async updateCheckIn(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const checkIn = await checkInService.updateCheckIn(tenantId, id, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Check-in updated successfully',
      { checkIn: mapCheckIn(checkIn) }
    );
  },

  /**
   * POST /api/v1/check-ins/:id/review
   * Review workflow — marks status as REVIEWED and locks practitioner notes.
   */
  async reviewCheckIn(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const reviewerId = req.user.userId;

    const checkIn = await checkInService.reviewCheckIn(
      tenantId,
      id,
      reviewerId,
      req.body
    );

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Check-in reviewed successfully',
      { checkIn: mapCheckIn(checkIn) }
    );
  },

  /**
   * DELETE /api/v1/check-ins/:id
   * Soft-deletes a check-in.
   */
  async deleteCheckIn(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    await checkInService.deleteCheckIn(tenantId, id);

    return sendSuccess(res, HTTP_STATUS.OK, 'Check-in deleted successfully');
  },
};
