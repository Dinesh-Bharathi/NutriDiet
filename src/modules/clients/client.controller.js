// src/modules/clients/client.controller.js
// Client management HTTP adapters.
import { clientService } from './client.service.js';
import { mapClient, mapClientsList } from './client.mapper.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const clientController = {
  /**
   * POST /api/v1/clients
   * Creates a new client.
   */
  async createClient(req, res) {
    const tenantId = req.user.tenantId;
    const client = await clientService.createClient(tenantId, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      'Client created successfully',
      { client: mapClient(client) }
    );
  },

  /**
   * GET /api/v1/clients
   * Retrieves a filtered and paginated list of clients.
   */
  async getClients(req, res) {
    const tenantId = req.user.tenantId;
    const filters = {
      search: req.query.search,
      status: req.query.status,
      onboardingStatus: req.query.onboardingStatus,
      dietitianId: req.query.dietitianId,
    };
    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await clientService.getClients(tenantId, filters, pagination);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Clients retrieved successfully',
      {
        clients: mapClientsList(result.clients),
        pagination: result.pagination,
      }
    );
  },

  /**
   * GET /api/v1/clients/:id
   * Retrieves a single client.
   */
  async getClientById(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const client = await clientService.getClientById(tenantId, id);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Client retrieved successfully',
      { client: mapClient(client) }
    );
  },

  /**
   * PATCH /api/v1/clients/:id
   * Updates an existing client.
   */
  async updateClient(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const client = await clientService.updateClient(tenantId, id, req.body);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Client updated successfully',
      { client: mapClient(client) }
    );
  },

  /**
   * DELETE /api/v1/clients/:id
   * Soft-deletes a client.
   */
  async deleteClient(req, res) {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    await clientService.deleteClient(tenantId, id);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Client deleted successfully'
    );
  },
};
