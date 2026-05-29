// src/modules/clients/client.service.js
// Business logic for Client management.
import { clientRepository } from './client.repository.js';
import prisma from '../../lib/prisma.js';
import ApiError from '../../utils/ApiError.js';
import { Role } from '@prisma/client';

export const clientService = {
  /**
   * Validates that the dietitian exists and belongs to the same tenant.
   *
   * @param {string} tenantId
   * @param {string|null} dietitianId
   */
  async validateDietitian(tenantId, dietitianId) {
    if (!dietitianId) return;

    const user = await prisma.user.findFirst({
      where: {
        id: dietitianId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw ApiError.badRequest('Assigned practitioner not found');
    }

    if (user.role === Role.CLIENT) {
      throw ApiError.badRequest('A client cannot be assigned as a practitioner');
    }
  },

  /**
   * Creates a client.
   *
   * @param {string} tenantId
   * @param {object} clientData
   * @returns {Promise<object>}
   */
  async createClient(tenantId, clientData) {
    if (clientData.dietitianId) {
      await this.validateDietitian(tenantId, clientData.dietitianId);
    }

    return clientRepository.create(tenantId, clientData);
  },

  /**
   * Retrieves a client by ID.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getClientById(tenantId, id) {
    const client = await clientRepository.findById(tenantId, id);
    if (!client) {
      throw ApiError.notFound('Client');
    }
    return client;
  },

  /**
   * Updates an existing client.
   *
   * @param {string} tenantId
   * @param {string} id
   * @param {object} updateData
   * @returns {Promise<object>}
   */
  async updateClient(tenantId, id, updateData) {
    const client = await clientRepository.findById(tenantId, id);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    if (updateData.dietitianId !== undefined) {
      await this.validateDietitian(tenantId, updateData.dietitianId);
    }

    return clientRepository.update(id, updateData);
  },

  /**
   * Soft-deletes a client.
   *
   * @param {string} tenantId
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteClient(tenantId, id) {
    const affectedCount = await clientRepository.softDelete(tenantId, id);
    if (affectedCount === 0) {
      throw ApiError.notFound('Client');
    }
  },

  /**
   * Lists and filters clients with pagination.
   *
   * @param {string} tenantId
   * @param {object} filters
   * @param {object} pagination
   * @returns {Promise<object>}
   */
  async getClients(tenantId, filters, pagination) {
    const [clients, total] = await clientRepository.findManyAndCount(
      tenantId,
      filters,
      pagination
    );

    return {
      clients,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  },
};
