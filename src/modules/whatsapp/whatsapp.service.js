import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { whatsappRepository } from './whatsapp.repository.js';
import { metaValidator } from './providers/meta/meta-validator.js';
import { MetaClient } from './providers/meta/meta-client.js';
import { metaMessageFormatter } from './providers/meta/meta-message.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { emitTenantEvent } from '../../lib/socket.js';
import ApiError from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';
import { getRedisClient } from '../../lib/redis.js';
import { logWhatsApp, logWhatsAppVerbose } from './whatsapp-logger.js';


/**
 * Generate SHA-256 fingerprint for credentials to prevent duplicate checks.
 */
function generateFingerprint(credentials) {
  const raw = `${credentials.accessToken || ''}:${credentials.wabaId || ''}:${credentials.phoneNumberId || ''}:${credentials.businessAccountId || ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export const whatsappService = {
  /**
   * Get WhatsApp connection for a tenant.
   * Scopes to tenant and maps to WhatsAppConnectionResponse DTO.
   *
   * @param {string} tenantId
   * @returns {Promise<object>}
   */
  async getConnection(tenantId) {
    const connection = await whatsappRepository.findByTenantId(tenantId);
    if (!connection) {
      return {
        status: 'NOT_CONFIGURED',
        provider: 'WHATSAPP',
        tokenType: null,
        scope: null,
        metaBusinessId: null,
        wabaId: null,
        phoneNumberId: null,
        businessAccountId: null,
        displayPhoneNumber: null,
        verifiedName: null,
        webhookVerified: false,
        connectedAt: null,
        lastSyncAt: null,
        lastValidatedAt: null,
        lastSuccessfulValidationAt: null,
        lastError: null,
        lastErrorCode: null,
        lastErrorAt: null,
        validationAttempts: 0,
      };
    }
    return this.toResponseDTO(connection);
  },

  /**
   * Upsert WhatsApp connection for a tenant.
   * Matches WhatsAppConnectionUpdateRequest DTO, encrypts tokens, and triggers synchronous validation.
   *
   * @param {string} tenantId
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async upsertConnection(tenantId, payload) {
    const existing = await whatsappRepository.findByTenantId(tenantId);
    
    let encryptedAccessToken = existing?.accessToken || null;
    const connectedAt = existing?.connectedAt || null;
    
    // Rule: If status is DISCONNECTED and token is empty, block submit and throw validation error
    if (existing?.status === 'DISCONNECTED' && !payload.accessToken && !existing.accessToken) {
      throw ApiError.badRequest('Meta Access Token is required to reconnect this WhatsApp account.');
    }
    
    if (payload.accessToken) {
      encryptedAccessToken = encrypt(payload.accessToken);
    }
    
    // Generate fingerprint to see if configurations have changed
    let decryptedToken = payload.accessToken || null;
    if (!decryptedToken && encryptedAccessToken) {
      try {
        decryptedToken = decrypt(encryptedAccessToken);
      } catch (err) {
        // Suppress
      }
    }
    
    const fingerprint = generateFingerprint({
      accessToken: decryptedToken,
      wabaId: payload.wabaId,
      phoneNumberId: payload.phoneNumberId,
      businessAccountId: payload.businessAccountId,
    });
    
    // Save configurations with PENDING status first
    const updateData = {
      wabaId: payload.wabaId,
      phoneNumberId: payload.phoneNumberId,
      businessAccountId: payload.businessAccountId,
      displayPhoneNumber: payload.displayPhoneNumber || existing?.displayPhoneNumber || null,
      verifiedName: payload.verifiedName || existing?.verifiedName || null,
      accessToken: encryptedAccessToken,
      status: 'PENDING',
      connectedAt,
      credentialFingerprint: fingerprint,
    };
    
    if (!existing) {
      updateData.provider = 'WHATSAPP';
    }

    const saved = await whatsappRepository.upsert(tenantId, updateData);

    // If fingerprint is identical and status was already CONNECTed, we can bypass validation check
    if (existing && existing.credentialFingerprint === fingerprint && existing.status === 'CONNECTED') {
      const bypassed = await whatsappRepository.update(tenantId, {
        status: 'CONNECTED',
        lastValidatedAt: new Date(),
      });
      return this.toResponseDTO(bypassed);
    }

    // Run synchronous validation
    return this.validateConnection(tenantId, {
      accessToken: decryptedToken,
      wabaId: saved.wabaId,
      phoneNumberId: saved.phoneNumberId,
      businessAccountId: saved.businessAccountId,
    });
  },

  /**
   * Execute Meta API credential validation sequence and persist connection health updates.
   *
   * @param {string} tenantId
   * @param {object} credentials
   * @returns {Promise<object>}
   */
  async validateConnection(tenantId, credentials) {
    const existing = await whatsappRepository.findByTenantId(tenantId);
    if (!existing) {
      throw ApiError.notFound('No WhatsApp configuration exists to validate.');
    }

    const attempts = (existing.validationAttempts || 0) + 1;
    
    // Fetch decrypted token if not supplied
    let decryptedToken = credentials?.accessToken;
    if (!decryptedToken && existing.accessToken) {
      try {
        decryptedToken = decrypt(existing.accessToken);
      } catch (err) {
        // Suppress
      }
    }

    const checkParams = {
      accessToken: decryptedToken,
      wabaId: credentials?.wabaId || existing.wabaId,
      phoneNumberId: credentials?.phoneNumberId || existing.phoneNumberId,
      businessAccountId: credentials?.businessAccountId || existing.businessAccountId,
    };

    const validationResult = await metaValidator.validate(checkParams);

    const updateData = {
      lastValidatedAt: new Date(),
      validationAttempts: attempts,
    };

    if (validationResult.success) {
      updateData.status = 'CONNECTED';
      updateData.lastSuccessfulValidationAt = new Date();
      updateData.lastError = null;
      updateData.lastErrorCode = null;
      updateData.connectedAt = existing.connectedAt || new Date();
      
      // Meta is source of truth: overwrite verifiedName and displayPhoneNumber
      if (validationResult.displayPhoneNumber) {
        updateData.displayPhoneNumber = validationResult.displayPhoneNumber;
      }
      if (validationResult.verifiedName) {
        updateData.verifiedName = validationResult.verifiedName;
      }
    } else {
      updateData.status = 'ERROR';
      updateData.lastError = validationResult.error;
      updateData.lastErrorCode = validationResult.errorCode;
      updateData.lastErrorAt = new Date();
    }

    const updated = await whatsappRepository.update(tenantId, updateData);
    return this.toResponseDTO(updated);
  },

  /**
   * Disconnect WhatsApp connection for a tenant.
   *
   * @param {string} tenantId
   * @returns {Promise<object>}
   */
  async disconnect(tenantId) {
    const existing = await whatsappRepository.findByTenantId(tenantId);
    if (!existing) {
      throw ApiError.notFound('No WhatsApp connection found to disconnect');
    }
    
    const updateData = {
      status: 'DISCONNECTED',
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      credentialFingerprint: null,
    };
    
    const updated = await whatsappRepository.update(tenantId, updateData);
    return this.toResponseDTO(updated);
  },

  /**
   * Get or create a conversation for a specific client.
   *
   * @param {string} tenantId
   * @param {string} clientId
   * @returns {Promise<object>}
   */
  async getOrCreateConversation(tenantId, clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) {
      throw ApiError.notFound('Client not found');
    }

    const conversation = await prisma.whatsAppConversation.upsert({
      where: {
        tenantId_clientId: {
          tenantId,
          clientId,
        },
      },
      update: {},
      create: {
        tenantId,
        clientId,
        unreadCount: 0,
      },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            avatarAssetId: true,
            phone: true,
          },
        },
      },
    });

    return conversation;
  },

  /**
   * Get paginated conversations list supporting search and archive filter parameters.
   *
   * @param {string} tenantId
   * @param {object} query - limit, cursor, search, archived
   * @returns {Promise<object>}
   */
  async getConversations(tenantId, query) {
    const { archived = false, search, limit = 50, cursor } = query;
    const limitNum = parseInt(limit, 10);
    
    const whereClause = {
      tenantId,
      isArchived: archived === 'true' || archived === true,
    };

    if (search) {
      const searchLower = String(search).trim().toLowerCase();
      whereClause.OR = [
        {
          client: {
            OR: [
              { firstName: { contains: searchLower, mode: 'insensitive' } },
              { lastName: { contains: searchLower, mode: 'insensitive' } },
              { phone: { contains: searchLower } },
            ],
          },
        },
        {
          lastMessageText: { contains: searchLower, mode: 'insensitive' },
        },
        {
          messages: {
            some: {
              body: { contains: searchLower, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const findParams = {
      where: whereClause,
      take: limitNum + 1,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            avatarAssetId: true,
            phone: true,
          },
        },
      },
    };

    if (cursor) {
      findParams.cursor = { id: cursor };
      findParams.skip = 1;
    }

    const conversations = await prisma.whatsAppConversation.findMany(findParams);

    let nextCursor = null;
    if (conversations.length > limitNum) {
      const nextItem = conversations.pop();
      nextCursor = nextItem.id;
    }

    return {
      conversations,
      nextCursor,
    };
  },

  /**
   * Get message history for a conversation using infinite-scroll upward cursor pagination.
   *
   * @param {string} tenantId
   * @param {string} conversationId
   * @param {object} query - limit, cursor
   * @returns {Promise<object>}
   */
  async getMessages(tenantId, conversationId, query) {
    const { limit = 50, cursor } = query;
    const limitNum = parseInt(limit, 10);

    const whereClause = {
      tenantId,
      conversationId,
      deletedAt: null, // Skip soft deleted items
    };

    const findParams = {
      where: whereClause,
      take: limitNum + 1,
      orderBy: { createdAt: 'desc' },
      include: {
        attachments: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            fileSize: true,
            url: true,
            secureUrl: true,
          },
        },
      },
    };

    if (cursor) {
      findParams.cursor = { id: cursor };
      findParams.skip = 1;
    }

    const messages = await prisma.whatsAppMessage.findMany(findParams);

    let nextCursor = null;
    if (messages.length > limitNum) {
      const nextItem = messages.pop();
      nextCursor = nextItem.id;
    }

    const redis = getRedisClient();
    const messagesMapped = [];
    for (const msg of messages.reverse()) {
      const dto = this.toMessageResponseDTO(msg);
      if (process.env.NODE_ENV === 'development' && redis) {
        if (msg.metaMessageId) {
          const corrId = await redis.get(`whatsapp:correlation:wamid:${msg.metaMessageId}`);
          dto.correlationId = corrId || null;

          const historyJson = await redis.lrange(`whatsapp:receipt:history:${msg.metaMessageId}`, 0, -1);
          dto.receiptHistory = historyJson.map(item => JSON.parse(item));
        } else {
          const corrId = await redis.get(`whatsapp:correlation:local:${msg.id}`);
          dto.correlationId = corrId || null;
          dto.receiptHistory = [];
        }
      }
      messagesMapped.push(dto);
    }

    // Return in chronological order
    return {
      messages: messagesMapped,
      nextCursor,
    };
  },

  /**
   * Send an outbound WhatsApp text, template, or media message.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {string} role
   * @param {string} conversationId
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async sendMessage(tenantId, userId, role, conversationId, payload) {
    const correlationId = crypto.randomUUID();
    const redis = getRedisClient();

    const conversation = await prisma.whatsAppConversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { client: true },
    });

    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    const client = conversation.client;
    if (!client.phone) {
      throw ApiError.badRequest('Client phone number is missing.');
    }

    const connection = await prisma.whatsAppConnection.findUnique({
      where: { tenantId },
    });

    if (!connection || connection.status !== 'CONNECTED') {
      throw ApiError.badRequest('Active WhatsApp connection not found for this tenant.');
    }

    const decryptedToken = decrypt(connection.accessToken);
    const metaClient = new MetaClient(decryptedToken);

    let formattedPayload = null;
    let mimeType = null;
    let size = null;

    if (payload.type === 'TEXT') {
      formattedPayload = metaMessageFormatter.text(client.phone, payload.body);
    } else if (payload.type === 'TEMPLATE') {
      formattedPayload = metaMessageFormatter.template(
        client.phone,
        payload.templateName,
        payload.templateLanguage || 'en_US',
        payload.components
      );
    } else if (payload.type === 'MEDIA') {
      const assetId = Array.isArray(payload.attachmentIds) ? payload.attachmentIds[0] : payload.attachmentId;
      const asset = await prisma.fileAsset.findFirst({
        where: { id: assetId, tenantId },
      });
      if (!asset) {
        throw ApiError.notFound('Attachment file asset not found');
      }
      mimeType = asset.mimeType;
      size = asset.fileSize;
      formattedPayload = metaMessageFormatter.media(
        client.phone,
        payload.mediaType || 'DOCUMENT',
        asset.secureUrl || asset.url,
        asset.fileName
      );
    }

    // Persist message in QUEUED state
    const createdMsg = await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        conversationId,
        direction: 'OUTBOUND',
        type: payload.type === 'MEDIA' ? (payload.mediaType || 'DOCUMENT') : payload.type,
        status: 'QUEUED',
        senderType: 'USER',
        source: 'MANUAL',
        body: payload.body || payload.templateName || null,
        mediaMimeType: mimeType,
        mediaSize: size,
        senderUserId: userId,
        senderRole: role,
        senderName: payload.senderName || 'Staff',
        senderPhone: connection.displayPhoneNumber || '',
        createdByUserId: userId,
      },
    });

    // Map correlation ID in Redis for the local message ID
    if (redis) {
      await redis.set(`whatsapp:correlation:local:${createdMsg.id}`, correlationId, 'EX', 604800);
    }

    logWhatsApp('[WHATSAPP_SEND]', { correlationId, messageId: createdMsg.id, tenantId }, `Message Send Request: conversationId=${conversationId}, clientId=${conversation.clientId}, recipient=${client.phone}, type=${payload.type}, senderUser=${userId}`);

    // Link attachments if provided
    if (payload.attachmentIds && payload.attachmentIds.length > 0) {
      await prisma.fileAsset.updateMany({
        where: { id: { in: payload.attachmentIds }, tenantId },
        data: { whatsAppMessageId: createdMsg.id },
      });
    } else if (payload.attachmentId) {
      await prisma.fileAsset.update({
        where: { id: payload.attachmentId },
        data: { whatsAppMessageId: createdMsg.id },
      });
    }

    logWhatsApp('[WHATSAPP_META]', { correlationId, messageId: createdMsg.id, tenantId }, `Meta API Request: endpoint=POST /${connection.phoneNumberId}/messages, phoneNumberId=${connection.phoneNumberId}, payloadSummary=type:${payload.type}`);
    logWhatsAppVerbose('[WHATSAPP_META]', { correlationId, messageId: createdMsg.id, tenantId }, 'Meta Request Payload', formattedPayload);

    try {
      const metaRes = await metaClient.sendMessage(connection.phoneNumberId, formattedPayload);
      const wamid = metaRes.messages?.[0]?.id;

      if (redis && wamid) {
        await redis.set(`whatsapp:correlation:wamid:${wamid}`, correlationId, 'EX', 604800);
      }

      logWhatsApp('[WHATSAPP_META]', { correlationId, messageId: createdMsg.id, metaMessageId: wamid, tenantId }, `Meta API Response: status=200, metaMessageId=${wamid}`);
      logWhatsAppVerbose('[WHATSAPP_META]', { correlationId, messageId: createdMsg.id, metaMessageId: wamid, tenantId }, 'Meta Response Payload', metaRes);

      const updated = await prisma.whatsAppMessage.update({
        where: { id: createdMsg.id },
        data: {
          status: 'SENT',
          metaMessageId: wamid,
          sentAt: new Date(),
        },
      });

      logWhatsApp('[WHATSAPP_SEND]', { correlationId, messageId: createdMsg.id, metaMessageId: wamid, tenantId }, `Message Status Transition: QUEUED -> SENT`);

      const summaryText = payload.body ? payload.body.slice(0, 499) : `[${payload.type}]`;
      await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: updated.id,
          lastMessageText: summaryText,
          lastMessageAt: new Date(),
          lastOutboundAt: new Date(),
          lastPractitionerMessageAt: new Date(),
        },
      });

      const messageDto = {
        ...this.toMessageResponseDTO(updated),
        correlationId,
        receiptHistory: [],
      };

      emitTenantEvent(tenantId, 'whatsapp:message_new', messageDto);

      return messageDto;
    } catch (err) {
      const errData = err.response?.data?.error;
      const metaCode = errData?.code ? String(errData.code) : 'UNKNOWN';
      const metaSubcode = errData?.error_subcode ? String(errData.error_subcode) : 'N/A';
      const fbtraceId = errData?.fbtrace_id || 'N/A';
      const errorType = errData?.type || 'UNKNOWN';
      const errorMsg = errData?.message || err.message;

      logWhatsApp('[WHATSAPP_META]', { correlationId, messageId: createdMsg.id, tenantId }, `Meta Error:\nCode: ${metaCode}\nSubcode: ${metaSubcode}\nType: ${errorType}\nMessage: ${errorMsg}\nTrace: ${fbtraceId}`, 'error');
      logWhatsAppVerbose('[WHATSAPP_META]', { correlationId, messageId: createdMsg.id, tenantId }, 'Meta Error Raw Payload', err.response?.data || err.message);

      let cleanErrorMsg = 'Message Send Failure';
      const codeNum = Number(metaCode);
      if (codeNum === 190 || codeNum === 102 || codeNum === 104) {
        cleanErrorMsg = 'Authentication Error';
      } else if (codeNum === 131005 || codeNum === 10 || codeNum === 200) {
        cleanErrorMsg = 'Access Denied';
      } else if (errorMsg.toLowerCase().includes('access denied') || errorMsg.toLowerCase().includes('oauth')) {
        cleanErrorMsg = 'Access Denied';
      } else {
        cleanErrorMsg = errorMsg || 'Unknown Meta API Error';
      }

      const failed = await prisma.whatsAppMessage.update({
        where: { id: createdMsg.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          errorText: cleanErrorMsg,
          lastErrorCode: metaCode,
        },
      });

      logWhatsApp('[WHATSAPP_SEND]', { correlationId, messageId: createdMsg.id, tenantId }, `Message Status Transition: QUEUED -> FAILED`);

      const messageDtoFailed = {
        ...this.toMessageResponseDTO(failed),
        correlationId,
        receiptHistory: [],
      };

      emitTenantEvent(tenantId, 'whatsapp:message_new', messageDtoFailed);

      return messageDtoFailed;
    }
  },

  /**
   * Resets conversation unread counts and notifies Meta API via read receipt for the last inbound message.
   *
   * @param {string} tenantId
   * @param {string} conversationId
   * @returns {Promise<object>}
   */
  async markConversationAsRead(tenantId, conversationId) {
    const conversation = await prisma.whatsAppConversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    // Find the last incoming message which hasn't been marked read yet
    const lastInboundMsg = await prisma.whatsAppMessage.findFirst({
      where: {
        conversationId,
        direction: 'INBOUND',
        status: { not: 'READ' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastInboundMsg && lastInboundMsg.metaMessageId) {
      try {
        const connection = await prisma.whatsAppConnection.findUnique({
          where: { tenantId },
        });
        if (connection && connection.status === 'CONNECTED') {
          const decryptedToken = decrypt(connection.accessToken);
          const metaClient = new MetaClient(decryptedToken);
          const readPayload = metaMessageFormatter.readReceipt(lastInboundMsg.metaMessageId);
          await metaClient.sendMessage(connection.phoneNumberId, readPayload);

          await prisma.whatsAppMessage.update({
            where: { id: lastInboundMsg.id },
            data: {
              status: 'READ',
              readAt: new Date(),
            },
          });
        }
      } catch (err) {
        logger.warn('[WhatsApp Service] Meta Cloud API read receipt dispatch failed', { error: err.message });
      }
    }

    const updated = await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });

    emitTenantEvent(tenantId, 'whatsapp:conversation_update', updated);
    return updated;
  },

  /**
   * Soft deletes a WhatsAppMessage (medical communication preservation).
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {string} messageId
   * @returns {Promise<object>}
   */
  async softDeleteMessage(tenantId, userId, messageId) {
    const message = await prisma.whatsAppMessage.findFirst({
      where: { id: messageId, tenantId },
    });

    if (!message) {
      throw ApiError.notFound('Message not found');
    }

    const updated = await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        deletedByUserId: userId,
      },
    });

    emitTenantEvent(tenantId, 'whatsapp:message_status', {
      id: messageId,
      status: 'DELETED',
      deletedAt: updated.deletedAt,
    });

    return updated;
  },

  /**
   * Toggle conversation archive state.
   */
  async archiveConversation(tenantId, conversationId, archived) {
    const updated = await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { isArchived: archived },
    });
    emitTenantEvent(tenantId, 'whatsapp:conversation_update', updated);
    return updated;
  },

  /**
   * Toggle conversation mute state.
   */
  async muteConversation(tenantId, conversationId, muted) {
    const updated = await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { isMuted: muted },
    });
    emitTenantEvent(tenantId, 'whatsapp:conversation_update', updated);
    return updated;
  },

  /**
   * Update compliance opt-in parameters.
   */
  async optInClient(tenantId, conversationId, status) {
    const updated = await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        optInStatus: status,
        optInCapturedAt: status ? new Date() : null,
      },
    });
    emitTenantEvent(tenantId, 'whatsapp:conversation_update', updated);
    return updated;
  },

  /**
   * Map database model to WhatsAppConnectionResponse DTO.
   * Strips out database ids, tenant ids, access tokens, and refresh tokens.
   *
   * @param {object} model
   * @returns {object}
   */
  toResponseDTO(model) {
    if (!model) return null;
    
    return {
      status: model.status,
      provider: model.provider || 'WHATSAPP',
      tokenType: model.tokenType || null,
      scope: model.scope || null,
      metaBusinessId: model.metaBusinessId || null,
      wabaId: model.wabaId || null,
      phoneNumberId: model.phoneNumberId || null,
      businessAccountId: model.businessAccountId || null,
      displayPhoneNumber: model.displayPhoneNumber || null,
      verifiedName: model.verifiedName || null,
      webhookVerified: model.webhookVerified,
      connectedAt: model.connectedAt ? model.connectedAt.toISOString() : null,
      lastSyncAt: model.lastSyncAt ? model.lastSyncAt.toISOString() : null,
      lastValidatedAt: model.lastValidatedAt ? model.lastValidatedAt.toISOString() : null,
      lastSuccessfulValidationAt: model.lastSuccessfulValidationAt ? model.lastSuccessfulValidationAt.toISOString() : null,
      lastError: model.lastError || null,
      lastErrorCode: model.lastErrorCode || null,
      lastErrorAt: model.lastErrorAt ? model.lastErrorAt.toISOString() : null,
      validationAttempts: model.validationAttempts || 0,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
    };
  },

  /**
   * Map database WhatsAppMessage to response DTO.
   *
   * @param {object} model
   * @returns {object}
   */
  toMessageResponseDTO(model) {
    if (!model) return null;
    return {
      id: model.id,
      conversationId: model.conversationId,
      metaMessageId: model.metaMessageId,
      direction: model.direction,
      type: model.type,
      status: model.status,
      senderType: model.senderType,
      source: model.source,
      body: model.body,
      mediaMimeType: model.mediaMimeType,
      mediaSize: model.mediaSize,
      senderUserId: model.senderUserId,
      senderRole: model.senderRole,
      senderName: model.senderName,
      senderPhone: model.senderPhone,
      createdByUserId: model.createdByUserId,
      errorText: model.errorText,
      lastErrorCode: model.lastErrorCode,
      sentAt: model.sentAt ? model.sentAt.toISOString() : null,
      deliveredAt: model.deliveredAt ? model.deliveredAt.toISOString() : null,
      readAt: model.readAt ? model.readAt.toISOString() : null,
      failedAt: model.failedAt ? model.failedAt.toISOString() : null,
      deletedAt: model.deletedAt ? model.deletedAt.toISOString() : null,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
    };
  },
};
