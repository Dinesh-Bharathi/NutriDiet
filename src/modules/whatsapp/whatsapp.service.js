import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { whatsappRepository } from './whatsapp.repository.js';
import { metaValidator } from './providers/meta/meta-validator.js';
import { MetaClient } from './providers/meta/meta-client.js';
import { metaMessageFormatter } from './providers/meta/meta-message.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { emitTenantEvent } from '../../lib/socket.js';
import ApiError from '../../utils/ApiError.js';

export class AppError extends ApiError {
  constructor(message, statusCode = 401) {
    super(statusCode, message);
    this.name = 'AppError';
  }
}
import logger from '../../utils/logger.js';
import { getRedisClient } from '../../lib/redis.js';
import { logWhatsApp, logWhatsAppVerbose } from './whatsapp-logger.js';

export function generatePreviewText(type, body, messageData = {}) {
  switch (type) {
    case 'TEXT':
      return body || '';
    case 'IMAGE':
      return `📷 Photo${body ? ': ' + body : ''}`;
    case 'VIDEO':
      return `🎥 Video${body ? ': ' + body : ''}`;
    case 'AUDIO':
      return `🎤 Audio File`;
    case 'VOICE':
      return `🎤 Voice Note`;
    case 'DOCUMENT': {
      const docName = messageData.document?.filename || messageData.mediaFileName || body;
      return `📄 Document${docName ? ': ' + docName : ''}`;
    }
    case 'LOCATION': {
      const locName = messageData.location?.name || messageData.locationName || body;
      return `📍 Shared Location${locName ? ': ' + locName : ''}`;
    }
    case 'CONTACT': {
      const contactName = messageData.contacts?.[0]?.name?.formatted_name || messageData.contactName || 'Contact';
      return `👤 Contact: ${contactName}`;
    }
    case 'STICKER':
      return `🎨 Sticker`;
    case 'REACTION':
      return `Reaction`;
    case 'INTERACTIVE': {
      const interactive = messageData.interactive || {};
      const optionTitle = interactive.button_reply?.title || interactive.list_reply?.title || 'Option';
      return `🔘 ${optionTitle}`;
    }
    case 'SYSTEM':
      return body || 'System event';
    default:
      return body || `[${type}]`;
  }
}


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
        _count: {
          select: { messages: true }
        }
      },
    });

    return this.toConversationResponseDTO(conversation);
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
      orderBy: [
        {
          lastMessageAt: {
            sort: 'desc',
            nulls: 'last',
          },
        },
        { id: 'desc' },
      ],
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            avatarAssetId: true,
            phone: true,
          },
        },
        _count: {
          select: { messages: true }
        }
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

    // Bulk fetch client last-seen times from Redis
    const redis = getRedisClient();
    const lastSeenMap = new Map();
    if (redis && conversations.length > 0) {
      try {
        const keys = conversations.map(c => `whatsapp:client:last_seen:${c.id}`);
        const values = await redis.mget(keys);
        conversations.forEach((c, idx) => {
          if (values[idx]) {
            lastSeenMap.set(c.id, parseInt(values[idx], 10));
          }
        });
      } catch (err) {
        logger.error("[WhatsApp Service] Redis mget last_seen error", { error: err.message });
      }
    }

    const now = Date.now();
    const mappedConversations = [];
    for (const c of conversations) {
      const lastSeen = lastSeenMap.get(c.id);
      const dto = await this.toConversationResponseDTO(c, lastSeen, now);
      mappedConversations.push(dto);
    }

    return {
      conversations: mappedConversations,
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
      // Soft-deleted messages are intentionally included.
      // The frontend renders them as "🚫 This message was deleted" placeholders.
      // Never add `deletedAt: null` here — doing so causes deleted messages to vanish
      // after a page load or query refetch, breaking the deletion UX.
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
        reactions: true,
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
    if (!userId) {
      throw new AppError('Authenticated user required for outbound WhatsApp messages', 401);
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new AppError('Authenticated user required for outbound WhatsApp messages', 401);
    }

    const senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (!senderName) {
      throw new AppError('Authenticated user required for outbound WhatsApp messages', 401);
    }

    if (!user.role) {
      throw new AppError('Authenticated user required for outbound WhatsApp messages', 401);
    }

    const correlationId = payload.correlationId || crypto.randomUUID();
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
    let mediaUrl = payload.mediaUrl || null;
    let mediaFileName = payload.mediaFileName || null;
    let storageFileId = null;
    let previewText = '';

    // Reply context lookup
    let replyToMessageId = null;
    let replyToMetaMessageId = null;
    let replyPreviewText = null;

    if (payload.replyToMessageId) {
      const replyMsg = await prisma.whatsAppMessage.findFirst({
        where: { id: payload.replyToMessageId, tenantId },
      });
      if (replyMsg) {
        replyToMessageId = replyMsg.id;
        replyToMetaMessageId = replyMsg.metaMessageId;
        replyPreviewText = replyMsg.previewText || replyMsg.body || '';
      }
    }

    if (payload.type === 'TEXT') {
      formattedPayload = metaMessageFormatter.text(client.phone, payload.body, replyToMetaMessageId);
      previewText = generatePreviewText('TEXT', payload.body);
    } else if (payload.type === 'TEMPLATE') {
      formattedPayload = metaMessageFormatter.template(
        client.phone,
        payload.templateName,
        payload.templateLanguage || 'en_US',
        payload.components,
        replyToMetaMessageId
      );
      previewText = generatePreviewText('TEMPLATE', payload.templateName);
    } else if (payload.type === 'LOCATION') {
      formattedPayload = metaMessageFormatter.location(
        client.phone,
        payload.locationLatitude,
        payload.locationLongitude,
        payload.locationName,
        payload.locationAddress,
        replyToMetaMessageId
      );
      previewText = generatePreviewText('LOCATION', payload.locationName || payload.body);
    } else if (['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'].includes(payload.type)) {
      const assetId = Array.isArray(payload.attachmentIds) ? payload.attachmentIds[0] : (payload.attachmentId || null);
      let asset = null;
      if (assetId) {
        asset = await prisma.fileAsset.findFirst({
          where: { id: assetId, tenantId },
        });
        if (!asset) {
          throw ApiError.notFound('Attachment file asset not found');
        }
        mimeType = asset.mimeType;
        size = asset.fileSize;
        mediaUrl = asset.secureUrl || asset.url;
        mediaFileName = asset.fileName || asset.originalName;
        storageFileId = asset.id;
      }

      const mediaType = payload.type;
      formattedPayload = metaMessageFormatter.media(
        client.phone,
        mediaType,
        mediaUrl,
        payload.caption || payload.body,
        mediaFileName,
        replyToMetaMessageId
      );
      previewText = generatePreviewText(mediaType, payload.caption || payload.body || mediaFileName);
    }

    // Persist message in QUEUED state
    const createdMsg = await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        conversationId,
        direction: 'OUTBOUND',
        type: payload.type,
        status: 'QUEUED',
        senderType: 'USER',
        source: payload.source || 'MANUAL',
        body: payload.body || payload.caption || payload.templateName || null,
        mediaMimeType: mimeType,
        mediaSize: size,
        mediaUrl,
        mediaFileName,
        storageFileId,
        replyToMessageId,
        replyToMetaMessageId,
        replyPreviewText,
        locationLatitude: payload.locationLatitude ? parseFloat(payload.locationLatitude) : null,
        locationLongitude: payload.locationLongitude ? parseFloat(payload.locationLongitude) : null,
        locationName: payload.locationName,
        locationAddress: payload.locationAddress,
        previewText,
        senderUserId: user.id,
        senderRole: user.role,
        senderName: `${user.firstName} ${user.lastName}`,
        senderPhone: connection.displayPhoneNumber || '',
        createdByUserId: user.id,
      },
    });

    // Map correlation ID in Redis for the local message ID
    if (redis) {
      await redis.set(`whatsapp:correlation:local:${createdMsg.id}`, correlationId, 'EX', 604800);
    }

    logWhatsApp('[WHATSAPP_SEND]', { correlationId, messageId: createdMsg.id, tenantId }, `Message Send Request: conversationId=${conversationId}, clientId=${conversation.clientId}, recipient=${client.phone}, type=${payload.type}, senderUser=${user.id}`);

    // Link attachments if provided
    const assetId = Array.isArray(payload.attachmentIds) ? payload.attachmentIds[0] : (payload.attachmentId || null);
    if (assetId) {
      await prisma.fileAsset.update({
        where: { id: assetId },
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
        await redis.incr('whatsapp:metrics:outbound:sent');
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
        include: {
          reactions: true,
        }
      });

      logWhatsApp('[WHATSAPP_SEND]', { correlationId, messageId: createdMsg.id, metaMessageId: wamid, tenantId }, `Message Status Transition: QUEUED -> SENT`);

      const updatedConv = await prisma.whatsAppConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: updated.id,
          lastMessageText: previewText.slice(0, 499),
          lastMessageAt: new Date(),
          lastOutboundAt: new Date(),
          lastPractitionerMessageAt: new Date(),
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
          _count: {
            select: { messages: true }
          }
        },
      });

      const messageDto = {
        ...this.toMessageResponseDTO(updated),
        correlationId,
        receiptHistory: [],
      };

      const dto = await this.toConversationResponseDTO(updatedConv);

      emitTenantEvent(tenantId, 'whatsapp:message_new', messageDto);
      emitTenantEvent(tenantId, 'whatsapp:conversation_update', dto);

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
        include: {
          reactions: true,
        }
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
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            avatarAssetId: true,
            phone: true,
          },
        },
        _count: {
          select: { messages: true }
        }
      },
    });

    const dto = await this.toConversationResponseDTO(updated);
    emitTenantEvent(tenantId, 'whatsapp:conversation_update', dto);
    return dto;
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
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new AppError('Authenticated user required to delete messages', 401);
    }

    const message = await prisma.whatsAppMessage.findFirst({
      where: { id: messageId, tenantId },
    });

    if (!message) {
      throw ApiError.notFound('Message not found');
    }

    const senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff';

    const updated = await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        deletedByUserId: userId,
        deleteSource: 'STAFF',
        deletedBy: senderName,
      },
    });

    // eslint-disable-next-line no-console
    console.log(
      `[WHATSAPP_DELETE] Message deleted\n` +
      `messageId=${messageId}\n` +
      `metaMessageId=${message.metaMessageId || 'N/A'}\n` +
      `deletedAt=${updated.deletedAt}`
    );

    emitTenantEvent(tenantId, 'whatsapp:message_deleted', {
      id: messageId,
      metaMessageId: message.metaMessageId,
      deletedAt: updated.deletedAt,
      deleteSource: updated.deleteSource,
      deletedBy: updated.deletedBy,
    });

    // eslint-disable-next-line no-console
    console.log(
      `[WHATSAPP_DELETE] Broadcast emitted\n` +
      `messageId=${messageId}\n` +
      `metaMessageId=${message.metaMessageId || 'N/A'}`
    );

    return updated;
  },

  /**
   * React to a WhatsApp message from the NutriDiet web application.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {string} messageId
   * @param {string|null} emoji
   * @returns {Promise<object>}
   */
  async reactToMessage(tenantId, userId, messageId, emoji) {
    // eslint-disable-next-line no-console
    console.log(
      `[WHATSAPP_REACTION] Raw payload received\n` +
      `emoji=${emoji || 'none'}\n` +
      `userId=${userId}\n` +
      `targetMessageId=${messageId}`
    );

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new AppError('Authenticated user required to react to messages', 401);
    }

    const message = await prisma.whatsAppMessage.findFirst({
      where: { id: messageId, tenantId },
    });

    // eslint-disable-next-line no-console
    console.log(
      `[WHATSAPP_REACTION] Message lookup result\n` +
      `found=${!!message}\n` +
      `messageId=${messageId}\n` +
      `targetWamid=${message ? message.metaMessageId : 'N/A'}`
    );

    if (!message) {
      throw ApiError.notFound('Message not found');
    }

    const senderPhone = `user-${user.id}`;
    const senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Staff';

    let dbResult = null;
    if (emoji) {
      dbResult = await prisma.whatsAppReaction.upsert({
        where: {
          messageId_senderPhone: {
            messageId,
            senderPhone,
          },
        },
        update: {
          emoji,
        },
        create: {
          tenantId,
          messageId,
          senderPhone,
          senderName,
          emoji,
        },
      });
    } else {
      dbResult = await prisma.whatsAppReaction.deleteMany({
        where: {
          messageId,
          senderPhone,
        },
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      `[WHATSAPP_REACTION] DB upsert result\n` +
      `action=${emoji ? 'upsert' : 'delete'}\n` +
      `result=${JSON.stringify(dbResult)}`
    );

    const allReactions = await prisma.whatsAppReaction.findMany({
      where: { messageId },
      select: { senderPhone: true, emoji: true, senderName: true },
    });

    emitTenantEvent(tenantId, 'whatsapp:message_reaction', {
      targetMessageId: messageId,
      metaMessageId: message.metaMessageId,
      reactions: allReactions,
    });

    // eslint-disable-next-line no-console
    console.log(
      `[WHATSAPP_REACTION] Socket emission result\n` +
      `event=whatsapp:message_reaction\n` +
      `targetMessageId=${messageId}\n` +
      `reactionsCount=${allReactions.length}`
    );

    return {
      targetMessageId: messageId,
      reactions: allReactions,
    };
  },

  /**
   * Toggle conversation archive state.
   */
  async archiveConversation(tenantId, conversationId, archived) {
    const updated = await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { isArchived: archived },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            avatarAssetId: true,
            phone: true,
          },
        },
        _count: {
          select: { messages: true }
        }
      },
    });
    const dto = await this.toConversationResponseDTO(updated);
    emitTenantEvent(tenantId, 'whatsapp:conversation_update', dto);
    return dto;
  },

  /**
   * Toggle conversation mute state.
   */
  async muteConversation(tenantId, conversationId, muted) {
    const updated = await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: { isMuted: muted },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            avatarAssetId: true,
            phone: true,
          },
        },
        _count: {
          select: { messages: true }
        }
      },
    });
    const dto = await this.toConversationResponseDTO(updated);
    emitTenantEvent(tenantId, 'whatsapp:conversation_update', dto);
    return dto;
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
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            avatarAssetId: true,
            phone: true,
          },
        },
        _count: {
          select: { messages: true }
        }
      },
    });
    const dto = await this.toConversationResponseDTO(updated);
    emitTenantEvent(tenantId, 'whatsapp:conversation_update', dto);
    return dto;
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
      mediaUrl: model.mediaUrl,
      mediaFileName: model.mediaFileName,
      mediaWidth: model.mediaWidth,
      mediaHeight: model.mediaHeight,
      mediaDurationSeconds: model.mediaDurationSeconds,
      storageFileId: model.storageFileId,
      replyToMessageId: model.replyToMessageId,
      replyToMetaMessageId: model.replyToMetaMessageId,
      replyPreviewText: model.replyPreviewText,
      locationLatitude: model.locationLatitude,
      locationLongitude: model.locationLongitude,
      locationName: model.locationName,
      locationAddress: model.locationAddress,
      contactName: model.contactName,
      contactPhones: model.contactPhones,
      contactPayload: model.contactPayload,
      interactivePayload: model.interactivePayload,
      previewText: model.previewText,
      reactions: model.reactions || [],
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

  /**
   * Map database WhatsAppConversation to response DTO including client presence.
   */
  async toConversationResponseDTO(conv, lastSeenTime = null, now = Date.now()) {
    if (!conv) return null;
    
    let resolvedLastSeen = lastSeenTime;
    if (resolvedLastSeen === null) {
      const redis = getRedisClient();
      if (redis) {
        try {
          const val = await redis.get(`whatsapp:client:last_seen:${conv.id}`);
          if (val) {
            resolvedLastSeen = parseInt(val, 10);
          }
        } catch (err) {
          logger.error("[WhatsApp Service] Redis get last_seen error", { error: err.message });
        }
      }
    }
    
    const fallbackTime = conv.lastMessageAt || conv.lastInboundAt || conv.lastOutboundAt || conv.createdAt;
    if (resolvedLastSeen === null && fallbackTime) {
      resolvedLastSeen = new Date(fallbackTime).getTime();
    }
    
    const online = resolvedLastSeen ? (now - resolvedLastSeen < 5 * 60 * 1000) : false;
    const lastSeenAt = resolvedLastSeen ? new Date(resolvedLastSeen).toISOString() : null;
    
    let client = conv.client;
    if (!client && conv.clientId) {
      try {
        client = await prisma.client.findUnique({
          where: { id: conv.clientId },
          select: {
            firstName: true,
            lastName: true,
            avatarAssetId: true,
            phone: true,
          },
        });
      } catch (err) {
        logger.error("[WhatsApp Service] Failed to fetch client for DTO", { error: err.message });
      }
    }
    
    return {
      id: conv.id,
      tenantId: conv.tenantId,
      clientId: conv.clientId,
      optInStatus: conv.optInStatus,
      optInCapturedAt: conv.optInCapturedAt ? conv.optInCapturedAt.toISOString() : null,
      lastMessageId: conv.lastMessageId,
      lastMessageText: conv.lastMessageText,
      lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : null,
      unreadCount: conv.unreadCount,
      isArchived: conv.isArchived,
      isMuted: conv.isMuted,
      conversationStartedAt: conv.conversationStartedAt ? conv.conversationStartedAt.toISOString() : null,
      lastInboundAt: conv.lastInboundAt ? conv.lastInboundAt.toISOString() : null,
      lastOutboundAt: conv.lastOutboundAt ? conv.lastOutboundAt.toISOString() : null,
      lastClientMessageAt: conv.lastClientMessageAt ? conv.lastClientMessageAt.toISOString() : null,
      lastPractitionerMessageAt: conv.lastPractitionerMessageAt ? conv.lastPractitionerMessageAt.toISOString() : null,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      client,
      messagesCount: conv._count?.messages ?? 0,
      clientPresence: {
        online,
        lastSeenAt,
      },
    };
  },

  /**
   * Search messages and group them under conversations.
   * Scopes to tenant and groups matches.
   *
   * @param {string} tenantId
   * @param {object} query - { q, page, limit }
   * @returns {Promise<object>}
   */
  async searchMessages(tenantId, query) {
    const { q, page = 1, limit = 20 } = query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const { conversations, messages } = await whatsappRepository.searchMessages(tenantId, { q });

    const grouped = {};

    // 1. Process client/conversation matches first (Type: CONVERSATION)
    for (const conv of conversations) {
      const client = conv.client;
      const lastMsg = conv.messages?.[0] || null;
      grouped[conv.id] = {
        conversationId: conv.id,
        clientId: client?.id || '',
        clientName: client ? `${client.firstName} ${client.lastName}`.trim() : 'Unknown Client',
        phone: client?.phone || '',
        avatarAssetId: client?.avatarAssetId || null,
        type: 'CONVERSATION',
        messageId: lastMsg?.id || '',
        messagePreview: lastMsg?.previewText || lastMsg?.body || '',
        messageType: lastMsg?.type || 'TEXT',
        createdAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : conv.createdAt.toISOString(),
        matches: [],
        isArchived: conv.isArchived,
      };
    }

    // 2. Process message content matches (Type: MESSAGE)
    for (const msg of messages) {
      const convId = msg.conversationId;
      const client = msg.conversation?.client;

      if (!grouped[convId]) {
        grouped[convId] = {
          conversationId: convId,
          clientId: client?.id || '',
          clientName: client ? `${client.firstName} ${client.lastName}`.trim() : 'Unknown Client',
          phone: client?.phone || '',
          avatarAssetId: client?.avatarAssetId || null,
          type: 'MESSAGE',
          messageId: msg.id,
          messagePreview: msg.previewText || msg.body || '',
          messageType: msg.type,
          createdAt: msg.createdAt.toISOString(),
          matches: [],
          isArchived: msg.conversation?.isArchived || false,
        };
      }

      grouped[convId].matches.push({
        messageId: msg.id,
        messagePreview: msg.previewText || msg.body || '',
        messageType: msg.type,
        createdAt: msg.createdAt.toISOString(),
      });
    }

    // 3. Convert grouped object to array and sort by latest activity date
    const allResults = Object.values(grouped).sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = allResults.length;
    const skip = (pageNum - 1) * limitNum;
    const paginatedResults = allResults.slice(skip, skip + limitNum);

    // Bulk fetch client last-seen times from Redis for search results
    const redis = getRedisClient();
    const lastSeenMap = new Map();
    const resultConvIds = paginatedResults.map(r => r.conversationId);
    if (redis && resultConvIds.length > 0) {
      try {
        const keys = resultConvIds.map(id => `whatsapp:client:last_seen:${id}`);
        const values = await redis.mget(keys);
        resultConvIds.forEach((id, idx) => {
          if (values[idx]) {
            lastSeenMap.set(id, parseInt(values[idx], 10));
          }
        });
      } catch (err) {
        logger.error("[WhatsApp Service] Redis mget last_seen error", { error: err.message });
      }
    }

    const now = Date.now();
    for (const r of paginatedResults) {
      const lastSeen = lastSeenMap.get(r.conversationId);
      const fallbackTime = r.createdAt;
      const resolvedLastSeen = lastSeen || (fallbackTime ? new Date(fallbackTime).getTime() : null);
      const online = resolvedLastSeen ? (now - resolvedLastSeen < 5 * 60 * 1000) : false;
      const lastSeenAt = resolvedLastSeen ? new Date(resolvedLastSeen).toISOString() : null;
      
      r.clientPresence = {
        online,
        lastSeenAt
      };
    }

    return {
      results: paginatedResults,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  },
};

