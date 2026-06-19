// src/modules/clients/client.service.js
// Business logic for Client management.
import { clientRepository } from './client.repository.js';
import prisma from '../../lib/prisma.js';
import ApiError from '../../utils/ApiError.js';
import { Role } from '@prisma/client';
import * as storageService from '../storage/storage.service.js';
import { getRedisClient } from '../../lib/redis.js';
import logger from '../../utils/logger.js';

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

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        timezone: true,
        locale: true,
        countryCode: true,
      },
    });

    if (tenant) {
      clientData.timezone = clientData.timezone || tenant.timezone || null;
      clientData.locale = clientData.locale || tenant.locale || null;
      clientData.country = clientData.country || tenant.countryCode || null;
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

    return clientRepository.update(tenantId, id, updateData);
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

    // If sorting by lastActiveMessage, attach presence from Redis:
    if (filters.sortBy === 'lastActiveMessage' && clients.length > 0) {
      const redis = getRedisClient();
      const lastSeenMap = new Map();
      
      const convs = clients.map(c => c.whatsAppConversations?.[0]).filter(Boolean);
      if (redis && convs.length > 0) {
        try {
          const keys = convs.map(c => `whatsapp:client:last_seen:${c.id}`);
          const values = await redis.mget(keys);
          convs.forEach((c, idx) => {
            if (values[idx]) {
              lastSeenMap.set(c.id, parseInt(values[idx], 10));
            }
          });
        } catch (err) {
          logger.error("[Client Service] Redis mget last_seen error", { error: err.message });
        }
      }

      const now = Date.now();
      clients.forEach(c => {
        const conv = c.whatsAppConversations?.[0];
        if (conv) {
          let resolvedLastSeen = lastSeenMap.get(conv.id) || null;
          const fallbackTime = conv.lastMessageAt || conv.lastInboundAt || conv.lastOutboundAt || conv.createdAt;
          if (resolvedLastSeen === null && fallbackTime) {
            resolvedLastSeen = new Date(fallbackTime).getTime();
          }
          const online = resolvedLastSeen ? (now - resolvedLastSeen < 5 * 60 * 1000) : false;
          const lastSeenAt = resolvedLastSeen ? new Date(resolvedLastSeen).toISOString() : null;
          
          c.clientPresence = {
            online,
            lastSeenAt,
          };
        } else {
          c.clientPresence = {
            online: false,
            lastSeenAt: null,
          };
        }
      });
    }

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

  /**
   * Attaches an avatar to a client. Replaces and soft deletes the old one if it exists.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {string} clientId
   * @param {string} fileAssetId
   * @returns {Promise<object>}
   */
  async attachAvatar(tenantId, userId, clientId, fileAssetId) {
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    const asset = await storageService.getAsset(fileAssetId, tenantId);
    
    if (asset.entityType !== 'CLIENT' || asset.entityId !== clientId) {
      throw ApiError.badRequest('FileAsset does not belong to this client');
    }
    
    if (asset.resourceType !== 'image') {
      throw ApiError.badRequest('Avatar must be an image');
    }

    // Option A: Soft delete old avatar if replacing
    if (client.avatarAssetId && client.avatarAssetId !== fileAssetId) {
      try {
        await storageService.deleteAsset(client.avatarAssetId, tenantId, userId);
      } catch (err) {
        // Ignore if already deleted
      }
    }

    return clientRepository.update(tenantId, clientId, { avatarAssetId: fileAssetId });
  },

  /**
   * Removes an avatar from a client and soft deletes the asset.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {string} clientId
   * @returns {Promise<object>}
   */
  async removeAvatar(tenantId, userId, clientId) {
    const client = await clientRepository.findById(tenantId, clientId);
    if (!client) {
      throw ApiError.notFound('Client');
    }

    if (client.avatarAssetId) {
      try {
        await storageService.deleteAsset(client.avatarAssetId, tenantId, userId);
      } catch (err) {
        // Ignore if already deleted
      }
      return clientRepository.update(tenantId, clientId, { avatarAssetId: null });
    }
    
    return client;
  },
};
