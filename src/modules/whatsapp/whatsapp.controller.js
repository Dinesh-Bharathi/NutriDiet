import crypto from 'crypto';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';
import { whatsappService, AppError } from './whatsapp.service.js';
import { whatsappConnectionUpsertSchema, whatsappMessageSendSchema } from './whatsapp.validation.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';
import prisma from '../../lib/prisma.js';
import { getRedisClient } from '../../lib/redis.js';
import { getActiveConnectionsCount } from '../../lib/socket.js';
import { logWhatsApp, logWhatsAppVerbose } from './whatsapp-logger.js';
import { webhookQueue } from './queues/webhook-queue.js';


export const whatsappController = {
  /**
   * GET /api/v1/whatsapp/connection
   * Returns current WhatsApp connection details for the tenant.
   */
  async getConnection(req, res) {
    const tenantId = req.user.tenantId;
    const connection = await whatsappService.getConnection(tenantId);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'WhatsApp connection retrieved successfully',
      connection
    );
  },

  /**
   * PUT /api/v1/whatsapp/connection
   * Creates or updates the WhatsApp connection configuration.
   */
  async upsertConnection(req, res) {
    const tenantId = req.user.tenantId;
    const validatedData = whatsappConnectionUpsertSchema.parse(req.body);
    const connection = await whatsappService.upsertConnection(tenantId, validatedData);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'WhatsApp connection saved successfully',
      connection
    );
  },

  /**
   * POST /api/v1/whatsapp/disconnect
   * Disconnects WhatsApp connection (marks as DISCONNECTED and nullifies access token).
   */
  async disconnectConnection(req, res) {
    const tenantId = req.user.tenantId;
    const connection = await whatsappService.disconnect(tenantId);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'WhatsApp connection disconnected successfully',
      connection
    );
  },

  /**
   * POST /api/v1/whatsapp/validate
   * Manually checks credentials, updates status and records health.
   */
  async validateConnection(req, res) {
    const tenantId = req.user.tenantId;
    const connection = await whatsappService.validateConnection(tenantId);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'WhatsApp connection validated successfully',
      connection
    );
  },

  /**
   * GET /api/v1/whatsapp/conversations
   * Get all conversations for a tenant (paginated, with search filters).
   */
  async getConversations(req, res) {
    const tenantId = req.user.tenantId;
    const result = await whatsappService.getConversations(tenantId, req.query);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Conversations retrieved successfully',
      result
    );
  },

  /**
   * GET /api/v1/whatsapp/conversations/:id/messages
   * Get message timeline history for a specific conversation.
   */
  async getMessages(req, res) {
    const tenantId = req.user.tenantId;
    const conversationId = req.params.id;
    const result = await whatsappService.getMessages(tenantId, conversationId, req.query);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Messages retrieved successfully',
      result
    );
  },

  /**
   * POST /api/v1/whatsapp/conversations/:id/messages
   * Sends an outbound text, template, or media message.
   */
  async sendMessage(req, res) {
    if (!req.user || (!req.user.userId && !req.user.id)) {
      throw new AppError('Authenticated user required for outbound WhatsApp messages', 401);
    }

    const tenantId = req.user.tenantId;
    const conversationId = req.params.id;
    const userId = req.user.userId || req.user.id;
    const role = req.user.role;
    
    const validatedData = whatsappMessageSendSchema.parse(req.body);
    
    const message = await whatsappService.sendMessage(
      tenantId,
      userId,
      role,
      conversationId,
      validatedData
    );
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Message sent successfully',
      message
    );
  },

  /**
   * POST /api/v1/whatsapp/conversations/:id/read
   * Mark a conversation unread count to 0 and trigger Meta Cloud API read receipt.
   */
  async markConversationAsRead(req, res) {
    const tenantId = req.user.tenantId;
    const conversationId = req.params.id;
    const result = await whatsappService.markConversationAsRead(tenantId, conversationId);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Conversation marked as read successfully',
      result
    );
  },

  /**
   * DELETE /api/v1/whatsapp/messages/:id
   * Soft deletes a specific message.
   */
  async deleteMessage(req, res) {
    const tenantId = req.user.tenantId;
    const messageId = req.params.id;
    const userId = req.user.userId || req.user.id;
    
    const result = await whatsappService.softDeleteMessage(tenantId, userId, messageId);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Message deleted successfully',
      result
    );
  },

  /**
   * POST /api/v1/whatsapp/messages/:id/react
   * Reacts to a message from the web application.
   */
  async reactToMessage(req, res) {
    if (!req.user || (!req.user.userId && !req.user.id)) {
      throw new AppError('Authenticated user required to react to messages', 401);
    }

    const tenantId = req.user.tenantId;
    const messageId = req.params.id;
    const userId = req.user.userId || req.user.id;
    const { emoji } = req.body;

    const result = await whatsappService.reactToMessage(tenantId, userId, messageId, emoji);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      emoji ? 'Reaction added successfully' : 'Reaction removed successfully',
      result
    );
  },

  /**
   * PUT /api/v1/whatsapp/conversations/:id/archive
   * Toggle archived state of conversation.
   */
  async archiveConversation(req, res) {
    const tenantId = req.user.tenantId;
    const conversationId = req.params.id;
    const { archived } = req.body;
    
    const result = await whatsappService.archiveConversation(tenantId, conversationId, !!archived);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      archived ? 'Conversation archived successfully' : 'Conversation unarchived successfully',
      result
    );
  },

  /**
   * PUT /api/v1/whatsapp/conversations/:id/mute
   * Toggle muted state of conversation.
   */
  async muteConversation(req, res) {
    const tenantId = req.user.tenantId;
    const conversationId = req.params.id;
    const { muted } = req.body;
    
    const result = await whatsappService.muteConversation(tenantId, conversationId, !!muted);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      muted ? 'Conversation muted successfully' : 'Conversation unmuted successfully',
      result
    );
  },

  /**
   * PUT /api/v1/whatsapp/conversations/:id/opt-in
   * Toggle WhatsApp compliance opt-in for client.
   */
  async optInClient(req, res) {
    const tenantId = req.user.tenantId;
    const conversationId = req.params.id;
    const { status } = req.body;
    
    const result = await whatsappService.optInClient(tenantId, conversationId, !!status);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      status ? 'Client opt-in enabled successfully' : 'Client opt-in disabled successfully',
      result
    );
  },

  /**
   * GET /api/v1/whatsapp/conversations/client/:clientId
   * Get or create conversation for a specific client.
   */
  async getOrCreateConversation(req, res) {
    const tenantId = req.user.tenantId;
    const clientId = req.params.clientId;
    const result = await whatsappService.getOrCreateConversation(tenantId, clientId);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Conversation retrieved or created successfully',
      result
    );
  },

  /**
   * GET /api/v1/whatsapp/webhook
   * Verification challenge requested by Meta.
   */
  async verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    logWhatsApp('[WHATSAPP_WEBHOOK]', {}, 'Webhook verification challenge received.');

    if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      logWhatsApp('[WHATSAPP_WEBHOOK]', {}, 'Verification challenge successful.');
      return res.status(200).send(challenge);
    }
    
    logWhatsApp('[WHATSAPP_WEBHOOK]', {}, 'Verification challenge failed: token mismatch.', 'warn');
    return res.status(403).end();
  },

  /**
   * POST /api/v1/whatsapp/webhook
   * Webhook payload ingestion. Verifies X-Hub-Signature-256 and pushes to queue.
   */
  async receiveWebhook(req, res) {
    const signature = req.headers['x-hub-signature-256'];
    const contentLength = req.headers['content-length'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const timestampStr = new Date().toISOString();

    // eslint-disable-next-line no-console
    console.log(
      `[WHATSAPP_WEBHOOK_RAW] Request arrived\n` +
      `method=POST\n` +
      `headers=x-hub-signature-256 present? ${signature ? 'yes' : 'no'}\n` +
      `content-length=${contentLength}\n` +
      `user-agent=${userAgent}\n` +
      `timestamp=${timestampStr}`
    );

    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.incr('whatsapp:webhook:raw_requests');
        await redis.set('whatsapp:webhook:last_raw_request_at', timestampStr);
        await redis.set('whatsapp:webhook:debug:last_headers', JSON.stringify(req.headers), 'EX', 86400);
        await redis.set('whatsapp:webhook:debug:last_body', typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body), 'EX', 86400);
        await redis.set('whatsapp:webhook:debug:last_request_at', timestampStr, 'EX', 86400);
      } catch (err) {
        logger.warn('Failed to write raw webhook metrics to Redis', { error: err.message });
      }
    }

    logWhatsApp('[WHATSAPP_WEBHOOK]', {}, 'Webhook Received');
    logWhatsAppVerbose('[WHATSAPP_WEBHOOK]', {}, 'Raw Webhook Request Payload', req.body);

    if (!signature) {
      // eslint-disable-next-line no-console
      console.log(
        `[WHATSAPP_WEBHOOK]\n` +
        `Signature verification FAILED\n` +
        `Error: Missing x-hub-signature-256 header`
      );
      if (redis) {
        try {
          await redis.incr('whatsapp:metrics:webhook:errors');
          await redis.set('whatsapp:webhook:last_signature_validation_result', 'false');
          await redis.set('whatsapp:webhook:last_signature_validation_error', 'Missing x-hub-signature-256 header');
          await redis.set('whatsapp:webhook:debug:last_signature_result', 'false', 'EX', 86400);
        } catch (err) {
          // ignore
        }
      }
      logWhatsApp('[WHATSAPP_WEBHOOK]', {}, 'Missing x-hub-signature-256 header.', 'warn');
      logger.info('[WHATSAPP_WEBHOOK_EXIT] Exited receiveWebhook: Missing signature header.');
      return res.status(401).json({ success: false, message: 'Missing signature' });
    }
    
    const parts = signature.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      // eslint-disable-next-line no-console
      console.log(
        `[WHATSAPP_WEBHOOK]\n` +
        `Signature verification FAILED\n` +
        `Error: Invalid signature format`
      );
      if (redis) {
        try {
          await redis.incr('whatsapp:metrics:webhook:errors');
          await redis.set('whatsapp:webhook:last_signature_validation_result', 'false');
          await redis.set('whatsapp:webhook:last_signature_validation_error', 'Invalid signature format');
          await redis.set('whatsapp:webhook:debug:last_signature_result', 'false', 'EX', 86400);
        } catch (err) {
          // ignore
        }
      }
      logWhatsApp('[WHATSAPP_WEBHOOK]', {}, 'Invalid x-hub-signature-256 format.', 'warn');
      logger.info('[WHATSAPP_WEBHOOK_EXIT] Exited receiveWebhook: Invalid signature format.');
      return res.status(400).json({ success: false, message: 'Invalid signature format' });
    }
    
    const signatureHash = parts[1];
    const appSecret = env.WHATSAPP_APP_SECRET || 'mock_app_secret';
    const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
    
    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(payload);
    const digest = hmac.digest('hex');
    
    let isSignatureValid = false;
    let timingError = null;
    try {
      isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(digest, 'hex'),
        Buffer.from(signatureHash, 'hex')
      );
    } catch (err) {
      isSignatureValid = false;
      timingError = err.message;
    }
    
    const signatureLength = signatureHash ? signatureHash.length : 0;
    const digestLength = digest ? digest.length : 0;

    if (!isSignatureValid) {
      const errorMsg = timingError || 'Signature hash mismatch';
      // eslint-disable-next-line no-console
      console.log(
        `[WHATSAPP_WEBHOOK]\n` +
        `Signature verification FAILED\n` +
        `Expected Hash Length: ${digestLength}, Received Hash Length: ${signatureLength}\n` +
        `Detail: ${errorMsg}`
      );
      if (redis) {
        try {
          await redis.incr('whatsapp:metrics:webhook:errors');
          await redis.set('whatsapp:webhook:last_signature_validation_result', 'false');
          await redis.set('whatsapp:webhook:last_signature_validation_error', errorMsg);
          await redis.set('whatsapp:webhook:debug:last_signature_result', 'false', 'EX', 86400);
        } catch (err) {
          // ignore
        }
      }
      logWhatsApp('[WHATSAPP_WEBHOOK]', {}, 'HMAC signature verification failed.', 'warn');
      logger.info('[WHATSAPP_WEBHOOK_EXIT] Exited receiveWebhook: Signature verification failed.');
      return res.status(401).json({ success: false, message: 'Signature verification failed' });
    }
    
    // eslint-disable-next-line no-console
    console.log(
      `[WHATSAPP_WEBHOOK]\n` +
      `Signature verification PASSED\n` +
      `Expected Hash Length: ${digestLength}, Received Hash Length: ${signatureLength}`
    );
    if (redis) {
      try {
        await redis.set('whatsapp:webhook:last_signature_validation_result', 'true');
        await redis.set('whatsapp:webhook:last_signature_validation_error', '');
        await redis.set('whatsapp:webhook:debug:last_signature_result', 'true', 'EX', 86400);
      } catch (err) {
        // ignore
      }
    }

    logWhatsApp('[WHATSAPP_WEBHOOK]', {}, 'Webhook Signature Verified');

    // Push payload to BullMQ queue
    const job = await webhookQueue.add('whatsapp-webhook', req.body);
    
    logWhatsApp('[WHATSAPP_WEBHOOK]', {}, `Webhook Queued: jobId=${job.id}`);
    logWhatsApp('[WHATSAPP_QUEUE]', { messageId: job.id }, 'Job queued: Queue=whatsapp-webhook-queue');

    logger.info(`[WHATSAPP_WEBHOOK_EXIT] Exited receiveWebhook: Successfully queued webhook job ${job.id}`);
    return res.status(200).json({ success: true, message: 'Webhook received and queued' });
  },

  /**
   * GET /api/v1/whatsapp/health
   * Dynamic diagnostics check covering connections, webhooks, BullMQ queues, Socket connections, and database status.
   */
  async getHealthDiagnostics(req, res) {
    const tenantId = req.user.tenantId;
    const redis = getRedisClient();

    // 1. Connection Details
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { tenantId }
    });

    const connectionStatus = connection?.status || 'NOT_CONFIGURED';
    const lastValidatedAt = connection?.lastValidatedAt ? connection.lastValidatedAt.toISOString() : null;
    const lastSuccessfulValidationAt = connection?.lastSuccessfulValidationAt ? connection.lastSuccessfulValidationAt.toISOString() : null;

    // 2. Webhook config & verification
    const wabaId = connection?.wabaId;
    const webhookConfigured = !!(connection?.wabaId && connection?.phoneNumberId);
    const webhookVerificationStatus = connection?.webhookVerified || false;
    
    let lastWebhookReceivedAt = null;
    let lastWebhookEventType = null;
    let lastWebhookPhoneNumberId = null;
    let lastWebhookWabaId = null;
    let webhookMessagesReceived = 0;
    let webhookStatusesReceived = 0;
    let webhookErrors = 0;
    
    let readReceiptsReceived = 0;
    let outboundMessagesSent = 0;
    let authenticatedConnections = 0;
    let failedConnections = 0;
    let processedJobs = 0;
    let failedJobs = 0;
    let retryJobs = 0;
    let lastSocketConnectionAt = null;
    
    let rawWebhookRequests = 0;
    let lastRawWebhookRequestAt = null;
    let lastSignatureValidationResult = null;
    let lastSignatureValidationError = "";

    if (redis) {
      if (wabaId) {
        lastWebhookReceivedAt = await redis.get(`whatsapp:webhook:last_received_at:${wabaId}`);
      }
      
      const lastPayloadStr = await redis.get("whatsapp:webhook:last_payload");
      if (lastPayloadStr) {
        try {
          const lp = JSON.parse(lastPayloadStr);
          lastWebhookReceivedAt = lp.timestamp;
          lastWebhookEventType = lp.eventType;
          lastWebhookPhoneNumberId = lp.phoneNumberId;
          lastWebhookWabaId = lp.wabaId;
        } catch (err) {
          // ignore
        }
      }

      const lastSocketConn = await redis.get(`whatsapp:socket:last_connection_at:${tenantId}`);
      lastSocketConnectionAt = lastSocketConn || null;

      const msgCount = await redis.get('whatsapp:metrics:webhook:messages');
      const statusCount = await redis.get('whatsapp:metrics:webhook:statuses');
      const errCount = await redis.get('whatsapp:metrics:webhook:errors');

      webhookMessagesReceived = msgCount ? parseInt(msgCount, 10) : 0;
      webhookStatusesReceived = statusCount ? parseInt(statusCount, 10) : 0;
      webhookErrors = errCount ? parseInt(errCount, 10) : 0;

      const rr = await redis.get("whatsapp:metrics:webhook:read_receipts");
      readReceiptsReceived = rr ? parseInt(rr, 10) : 0;

      const oms = await redis.get("whatsapp:metrics:outbound:sent");
      outboundMessagesSent = oms ? parseInt(oms, 10) : 0;

      const ac = await redis.get("whatsapp:metrics:socket:authenticated");
      authenticatedConnections = ac ? parseInt(ac, 10) : 0;

      const fc = await redis.get("whatsapp:metrics:socket:failed");
      failedConnections = fc ? parseInt(fc, 10) : 0;

      const pj = await redis.get("whatsapp:metrics:queue:processed");
      processedJobs = pj ? parseInt(pj, 10) : 0;

      const fj = await redis.get("whatsapp:metrics:queue:failed");
      failedJobs = fj ? parseInt(fj, 10) : 0;

      const rj = await redis.get("whatsapp:metrics:queue:retries");
      retryJobs = rj ? parseInt(rj, 10) : 0;

      const rwReqs = await redis.get('whatsapp:webhook:raw_requests');
      rawWebhookRequests = rwReqs ? parseInt(rwReqs, 10) : 0;
      lastRawWebhookRequestAt = await redis.get('whatsapp:webhook:last_raw_request_at');

      const sigResult = await redis.get('whatsapp:webhook:last_signature_validation_result');
      if (sigResult !== null) {
        lastSignatureValidationResult = sigResult === 'true';
      }
      lastSignatureValidationError = await redis.get('whatsapp:webhook:last_signature_validation_error') || "";
    }

    // 3. Meta API Configured status
    const metaApiConfigured = !!connection?.accessToken;

    // 4. Queue metrics
    let queueMetrics = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };
    try {
      queueMetrics = {
        waiting: await webhookQueue.getWaitingCount(),
        active: await webhookQueue.getActiveCount(),
        completed: await webhookQueue.getCompletedCount(),
        failed: await webhookQueue.getFailedCount(),
        delayed: await webhookQueue.getDelayedCount()
      };
    } catch (err) {
      logger.warn('[WHATSAPP_HEALTH] Failed to fetch queue metrics from Redis', { error: err.message });
    }

    // 5. Messaging timestamps
    const lastInbound = await prisma.whatsAppMessage.findFirst({
      where: { tenantId, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    const lastOutbound = await prisma.whatsAppMessage.findFirst({
      where: { tenantId, direction: 'OUTBOUND' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    const lastInboundMessageAt = lastInbound?.createdAt ? lastInbound.createdAt.toISOString() : null;
    const lastOutboundMessageAt = lastOutbound?.createdAt ? lastOutbound.createdAt.toISOString() : null;

    // 6. Socket Connections
    const activeConnections = getActiveConnectionsCount(tenantId);

    // 7. Conversation metrics
    const activeConversations = await prisma.whatsAppConversation.count({
      where: { tenantId, isArchived: false }
    });
    const archivedConversations = await prisma.whatsAppConversation.count({
      where: { tenantId, isArchived: true }
    });

    logWhatsApp('[WHATSAPP_HEALTH]', { tenantId }, `Diagnostics status requested. Connection=${connectionStatus}`);

    return res.status(200).json({
      success: true,
      data: {
        connectionStatus,
        lastValidatedAt,
        lastSuccessfulValidationAt,
        webhookConfigured,
        webhookVerificationStatus,
        lastWebhookReceivedAt,
        lastWebhookEventType,
        lastWebhookPhoneNumberId,
        lastWebhookWabaId,
        lastSocketConnectionAt,
        lastInboundMessageAt,
        lastOutboundMessageAt,
        rawWebhookRequests,
        lastRawWebhookRequestAt,
        lastSignatureValidationResult,
        lastSignatureValidationError,
        metaApiConfigured,
        queue: queueMetrics,
        messaging: {
          lastInboundMessageAt,
          lastOutboundMessageAt
        },
        socket: {
          activeConnections
        },
        webhookMessagesReceived,
        webhookStatusesReceived,
        webhookErrors,
        metrics: {
          webhook: {
            inboundMessagesReceived: webhookMessagesReceived,
            outboundMessagesSent,
            statusReceiptsReceived: webhookStatusesReceived,
            readReceiptsReceived
          },
          socket: {
            authenticatedConnections,
            failedConnections
          },
          queue: {
            processedJobs,
            failedJobs,
            retryJobs
          },
          conversation: {
            activeConversations,
            archivedConversations
          }
        }
      }
    });
  },

  /**
   * GET /api/v1/whatsapp/debug/webhook
   * Returns details of the last raw webhook received (headers, body, signature check result).
   */
  async getWebhookDebug(req, res) {
    const redis = getRedisClient();
    
    let lastHeaders = {};
    let lastRequestBody = {};
    let lastSignatureResult = null;
    let lastRequestAt = null;

    if (redis) {
      const headersStr = await redis.get('whatsapp:webhook:debug:last_headers');
      if (headersStr) {
        try {
          lastHeaders = JSON.parse(headersStr);
        } catch (err) {
          lastHeaders = {};
        }
      }

      const bodyStr = await redis.get('whatsapp:webhook:debug:last_body');
      if (bodyStr) {
        try {
          lastRequestBody = JSON.parse(bodyStr);
        } catch (err) {
          lastRequestBody = bodyStr;
        }
      }

      const sigResult = await redis.get('whatsapp:webhook:debug:last_signature_result');
      if (sigResult !== null) {
        lastSignatureResult = sigResult === 'true';
      }

      lastRequestAt = await redis.get('whatsapp:webhook:debug:last_request_at');
    }

    return res.status(200).json({
      success: true,
      data: {
        lastHeaders,
        lastRequestBody,
        lastSignatureResult,
        lastRequestAt,
      }
    });
  },

  /**
   * POST /api/v1/whatsapp/test-message
   * Dev-only integration check to trigger end-to-end diagnostics message sending.
   */
  async sendTestMessage(req, res) {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        message: 'This diagnostic endpoint is only available in development mode.'
      });
    }

    const tenantId = req.user.tenantId;
    const userId = req.user.userId || req.user.id;
    const role = req.user.role;
    const { recipientPhone, body = 'Hello! This is a diagnostics test message from NutriDiet.' } = req.body;

    if (!recipientPhone) {
      return res.status(400).json({
        success: false,
        message: 'recipientPhone is required in the request body.'
      });
    }

    // Resolve or create a mock client for diagnostics
    let client = await prisma.client.findFirst({
      where: {
        tenantId,
        OR: [
          { phone: recipientPhone },
          { phone: `+${recipientPhone}` }
        ]
      }
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          tenantId,
          firstName: 'Diagnostic',
          lastName: 'Test Client',
          phone: recipientPhone,
          email: `diagnostic-${Date.now()}@example.com`
        }
      });
    }

    const conversation = await whatsappService.getOrCreateConversation(tenantId, client.id);

    // Call outbound message sending pipeline
    const message = await whatsappService.sendMessage(tenantId, userId, role, conversation.id, {
      type: 'TEXT',
      body
    });

    const redis = getRedisClient();
    let webhookReceived = false;
    let delivered = message.status === 'DELIVERED' || message.status === 'READ';
    let read = message.status === 'READ';

    if (redis && message.metaMessageId) {
      // Check if any webhook status has hit Redis
      const sentVal = await redis.get(`whatsapp:status:${message.metaMessageId}:SENT`);
      const delVal = await redis.get(`whatsapp:status:${message.metaMessageId}:DELIVERED`);
      const readVal = await redis.get(`whatsapp:status:${message.metaMessageId}:READ`);

      webhookReceived = !!(sentVal || delVal || readVal);
      if (delVal) delivered = true;
      if (readVal) {
        delivered = true;
        read = true;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        sent: message.status !== 'FAILED',
        messageId: message.id,
        metaMessageId: message.metaMessageId,
        correlationId: message.correlationId,
        webhookReceived,
        delivered,
        read
      }
    });
  },

  /**
   * GET /api/v1/whatsapp/search
   * Scoped search for WhatsApp messages and clients.
   */
  async search(req, res) {
    const tenantId = req.user.tenantId;
    const result = await whatsappService.searchMessages(tenantId, req.query);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Messages and client conversations searched successfully',
      result
    );
  }
};

