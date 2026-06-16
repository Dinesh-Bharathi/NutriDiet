import crypto from 'crypto';
import prisma from "../../lib/prisma.js";
import { getRedisClient } from "../../lib/redis.js";
import { emitTenantEvent } from "../../lib/socket.js";
import { logWhatsApp, logWhatsAppVerbose } from "./whatsapp-logger.js";
import { decrypt } from "../../utils/encryption.js";
import { mediaService } from "./services/media.service.js";
import { whatsappService, generatePreviewText } from "./whatsapp.service.js";

export const whatsappWebhookService = {
  /**
   * Main entry point to process raw payload offloaded by BullMQ worker.
   * Processes statuses (receipts) and incoming messages.
   *
   * @param {object} payload
   */
  async processPayload(payload) {
    const startTime = Date.now();
    const redis = getRedisClient();

    logWhatsApp('[WHATSAPP_WEBHOOK]', {}, 'Webhook Processing Started');
    logWhatsAppVerbose('[WHATSAPP_WEBHOOK]', {}, 'Webhook Raw Payload', payload);

    if (payload.object !== "whatsapp_business_account") {
      logWhatsApp('[WHATSAPP_WEBHOOK]', {}, `Skipping non-whatsapp_business_account object: ${payload.object}`, 'warn');
      return {
        duration: Date.now() - startTime,
        tenantId: null,
      };
    }

    let tenantIdResolved = null;

    for (const entry of payload.entry || []) {
      const wabaId = entry.id;

      // Track webhook receipt at connection level
      if (redis && wabaId) {
        await redis.set(`whatsapp:webhook:last_received_at:${wabaId}`, new Date().toISOString());
      }

      for (const change of entry.changes || []) {
        if (change.field !== "messages") {
          continue;
        }

        const value = change.value;
        const metadata = value.metadata;
        const phoneId = metadata?.phone_number_id;

        // 1. Validate that WABA and Phone ID are registered under a tenant
        const connection = await prisma.whatsAppConnection.findFirst({
          where: {
            wabaId,
            phoneNumberId: phoneId,
          },
        });

        if (!connection) {
          logWhatsApp('[WHATSAPP_WEBHOOK]', {}, `Unrecognized WABA (${wabaId}) or Phone ID (${phoneId}). Skipping.`, 'warn');
          if (redis) {
            await redis.incr('whatsapp:metrics:webhook:errors');
          }
          continue;
        }

        const tenantId = connection.tenantId;
        tenantIdResolved = tenantId;

        logWhatsApp('[WHATSAPP_WEBHOOK]', { tenantId }, `Tenant resolved: ${tenantId}, WABA resolved: ${wabaId}`);

        const messageCount = value.messages?.length || 0;
        const statusCount = value.statuses?.length || 0;

        logWhatsApp('[WHATSAPP_WEBHOOK]', { tenantId }, `Webhook event resolved: eventType=messages, messageCount=${messageCount}, statusCount=${statusCount}`);

        // 2. Process Outbound Message Status Updates (Receipts)
        if (value.statuses && value.statuses.length > 0) {
          for (const statusUpdate of value.statuses) {
            const wamid = statusUpdate.id;
            const statusStr = statusUpdate.status.toUpperCase(); // SENT | DELIVERED | READ | FAILED
            const timestamp = new Date(parseInt(statusUpdate.timestamp, 10) * 1000);

            // Increment status metrics
            if (redis) {
              await redis.incr('whatsapp:metrics:webhook:statuses');
            }

            // Retrieve correlationId from Redis
            let correlationId = null;
            if (redis) {
              correlationId = await redis.get(`whatsapp:correlation:wamid:${wamid}`);
            }

            logWhatsApp('[WHATSAPP_RECEIPT]', { correlationId, metaMessageId: wamid, tenantId }, `Delivery receipt received: metaMessageId=${wamid}, recipient=${statusUpdate.recipient_id}, status=${statusStr}, timestamp=${timestamp.toISOString()}`);
            logWhatsAppVerbose('[WHATSAPP_RECEIPT]', { correlationId, metaMessageId: wamid, tenantId }, 'Raw Status Update Payload', statusUpdate);

            // Store raw payload and status history in Redis (expires in 7 days)
            if (redis) {
              await redis.set(`whatsapp:receipt:raw:${wamid}:${statusStr}`, JSON.stringify(statusUpdate), 'EX', 604800);
              await redis.rpush(`whatsapp:receipt:history:${wamid}`, JSON.stringify({
                status: statusStr,
                timestamp: timestamp.toISOString(),
                raw: statusUpdate
              }));
              await redis.expire(`whatsapp:receipt:history:${wamid}`, 604800);
            }

            // Deduplicate status receipts
            if (redis) {
              const idempotencyKey = `whatsapp:status:${wamid}:${statusStr}`;
              const seen = await redis.get(idempotencyKey);
              if (seen) {
                logWhatsApp('[WHATSAPP_RECEIPT]', { correlationId, metaMessageId: wamid, tenantId }, `Duplicate receipt status event wamid=${wamid} status=${statusStr}. Dropping.`, 'debug');
                continue;
              }
              await redis.set(idempotencyKey, "1", "EX", 86400);
            }

            let mappedStatus = "SENT";
            if (statusStr === "DELIVERED") mappedStatus = "DELIVERED";
            if (statusStr === "READ") mappedStatus = "READ";
            if (statusStr === "FAILED") mappedStatus = "FAILED";

            // Update metadata
            const updateFields = {
              status: mappedStatus,
            };

            if (mappedStatus === "SENT") updateFields.sentAt = timestamp;
            if (mappedStatus === "DELIVERED") updateFields.deliveredAt = timestamp;
            if (mappedStatus === "READ") {
              updateFields.readAt = timestamp;
              if (redis) {
                await redis.incr('whatsapp:metrics:webhook:read_receipts');
              }
            }
            if (mappedStatus === "FAILED") {
              updateFields.failedAt = timestamp;
              const error = statusUpdate.errors?.[0];
              if (error) {
                const metaCode = error.code ? String(error.code) : 'UNKNOWN';
                const metaSubcode = error.error_subcode ? String(error.error_subcode) : 'N/A';
                const fbtraceId = error.fbtrace_id || 'N/A';
                const errorType = error.type || 'UNKNOWN';
                const errorMsg = error.message || "Meta API failure";

                logWhatsApp('[WHATSAPP_META]', { correlationId, metaMessageId: wamid, tenantId }, `Meta Error:\nCode: ${metaCode}\nSubcode: ${metaSubcode}\nType: ${errorType}\nMessage: ${errorMsg}\nTrace: ${fbtraceId}`, 'error');

                let cleanErrorMsg = 'Message Delivery Failure';
                const codeNum = Number(metaCode);
                if (codeNum === 190 || codeNum === 102 || codeNum === 104) {
                  cleanErrorMsg = 'Authentication Error';
                } else if (codeNum === 131005 || codeNum === 10 || codeNum === 200) {
                  cleanErrorMsg = 'Access Denied';
                } else if (errorMsg.toLowerCase().includes('access denied') || errorMsg.toLowerCase().includes('oauth')) {
                  cleanErrorMsg = 'Access Denied';
                } else {
                  cleanErrorMsg = errorMsg;
                }

                updateFields.errorText = cleanErrorMsg;
                updateFields.lastErrorCode = metaCode;

                if (redis) {
                  await redis.incr('whatsapp:metrics:webhook:errors');
                }
              }
            }

            // Perform transaction/upsert to resolve out-of-order deliveries
            const message = await prisma.whatsAppMessage.upsert({
              where: { metaMessageId: wamid },
              update: updateFields,
              create: {
                metaMessageId: wamid,
                tenantId,
                conversationId: "STUB_PENDING", // Temporary placeholder for stubs
                direction: "OUTBOUND",
                type: "TEXT",
                senderType: "SYSTEM",
                source: "MANUAL",
                ...updateFields,
              },
            });

            const localMessageId = message.id;

            logWhatsApp('[WHATSAPP_SEND]', { correlationId, messageId: localMessageId, metaMessageId: wamid, tenantId }, `Message Status Transition: SENT -> ${mappedStatus}`);

            // Update conversation metadata if mapped message is resolved
            if (message.conversationId !== "STUB_PENDING") {
              const convUpdate = {};
              if (mappedStatus === "READ") {
                convUpdate.lastPractitionerMessageAt = timestamp;
                convUpdate.lastOutboundAt = timestamp;
              }

              await prisma.whatsAppConversation.update({
                where: { id: message.conversationId },
                data: convUpdate,
              });

              // Fetch receipt history to broadcast latest status
              let receiptHistory = [];
              if (process.env.NODE_ENV === 'development' && redis) {
                const historyJson = await redis.lrange(`whatsapp:receipt:history:${wamid}`, 0, -1);
                receiptHistory = historyJson.map(item => JSON.parse(item));
              }

              // Broadcast realtime status change
              emitTenantEvent(tenantId, "whatsapp:message_status", {
                id: message.id,
                metaMessageId: wamid,
                correlationId,
                status: mappedStatus,
                sentAt: message.sentAt,
                deliveredAt: message.deliveredAt,
                readAt: message.readAt,
                failedAt: message.failedAt,
                receiptHistory,
              });
            }
          }
        }

        // 3. Process Inbound Messages
        if (value.messages && value.messages.length > 0) {
          for (const messageData of value.messages) {
            const wamid = messageData.id;
            const fromPhone = messageData.from; // e.g. "61412345678"
            const timestamp = new Date(parseInt(messageData.timestamp, 10) * 1000);

            // Log Inbound Message Received
            logWhatsApp('[WHATSAPP_WEBHOOK] Inbound message received', { metaMessageId: wamid, from: fromPhone });

            // Increment incoming message counter
            if (redis) {
              await redis.incr('whatsapp:metrics:webhook:messages');
            }

            // Deduplicate incoming message deliveries
            if (redis) {
              const idempotencyKey = `whatsapp:msg:${wamid}`;
              const seen = await redis.get(idempotencyKey);
              if (seen) {
                logWhatsApp('[WHATSAPP_WEBHOOK]', { tenantId }, `Duplicate incoming message event ${wamid}. Dropping.`, 'debug');
                continue;
              }
              await redis.set(idempotencyKey, "1", "EX", 86400);
            }

            // Generate correlation ID for incoming messages to trace inbound flow
            const correlationId = crypto.randomUUID();
            if (redis) {
              await redis.set(`whatsapp:correlation:wamid:${wamid}`, correlationId, 'EX', 604800);
            }

            logWhatsApp('[WHATSAPP_WEBHOOK]', { correlationId, metaMessageId: wamid, tenantId }, `Incoming Message Webhook Received: wamid=${wamid}, from=${fromPhone}, timestamp=${timestamp.toISOString()}`);
            logWhatsAppVerbose('[WHATSAPP_WEBHOOK]', { correlationId, metaMessageId: wamid, tenantId }, 'Raw Incoming Message Payload', messageData);

            // Match sender phone to a Client record in the active tenant workspace
            const clients = await prisma.client.findMany({
              where: {
                tenantId,
              },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            });

            const cleanPhone = (num) => num ? num.replace(/[-\s()+]/g, '') : '';
            const normalizedFrom = cleanPhone(fromPhone).slice(-10);

            const client = clients.find((c) => {
              if (!c.phone) return false;
              const normalizedDb = cleanPhone(c.phone).slice(-10);
              return normalizedDb === normalizedFrom;
            });

            if (!client) {
              logWhatsApp('[WHATSAPP_WEBHOOK]', { correlationId, metaMessageId: wamid, tenantId }, `No client matching phone ${fromPhone} in tenant ${tenantId}. Dropping incoming message.`, 'warn');
              if (redis) {
                await redis.incr('whatsapp:metrics:webhook:errors');
              }
              continue;
            }

            logWhatsApp('[WHATSAPP_WEBHOOK] Tenant resolved', { tenantId });

            // Get or create conversation for this client
            const conversation = await prisma.whatsAppConversation.upsert({
              where: {
                tenantId_clientId: {
                  tenantId,
                  clientId: client.id,
                },
              },
              update: {
                unreadCount: { increment: 1 },
                lastClientMessageAt: timestamp,
                lastInboundAt: timestamp,
              },
              create: {
                tenantId,
                clientId: client.id,
                unreadCount: 1,
                conversationStartedAt: timestamp,
                lastClientMessageAt: timestamp,
                lastInboundAt: timestamp,
              },
            });

            logWhatsApp('[WHATSAPP_WEBHOOK] Conversation resolved', { tenantId, conversationId: conversation.id });

            // Map message types and handle optimizations
            const rawType = String(messageData.type).toUpperCase();
            let mappedType = "TEXT";
            if (["TEXT", "IMAGE", "DOCUMENT", "AUDIO", "VIDEO", "LOCATION", "CONTACT", "REACTION", "INTERACTIVE", "SYSTEM"].includes(rawType)) {
              mappedType = rawType;
            }

            if (rawType === "AUDIO" && messageData.audio?.voice) {
              mappedType = "VOICE";
            }
            if (rawType === "STICKER") {
              mappedType = "STICKER";
            }

            let bodyContent = null;
            let mimeType = null;
            let fileSize = null;
            let mediaUrl = null;
            let mediaFileName = null;
            let storageFileId = null;
            let mediaWidth = null;
            let mediaHeight = null;
            let mediaDurationSeconds = null;
            let locationLatitude = null;
            let locationLongitude = null;
            let locationName = null;
            let locationAddress = null;
            let contactName = null;
            let contactPhones = null;
            let contactPayload = null;
            let interactivePayload = null;

            // 1. Text Type
            if (mappedType === "TEXT") {
              bodyContent = messageData.text?.body || null;
            }
            
            // 2. Interactive Type
            else if (mappedType === "INTERACTIVE") {
              interactivePayload = messageData.interactive;
              const type = messageData.interactive?.type;
              if (type === "button_reply") {
                bodyContent = messageData.interactive?.button_reply?.title || null;
              } else if (type === "list_reply") {
                bodyContent = messageData.interactive?.list_reply?.title || null;
              }
            }

            // 3. Location Type
            else if (mappedType === "LOCATION") {
              locationLatitude = messageData.location?.latitude || null;
              locationLongitude = messageData.location?.longitude || null;
              locationName = messageData.location?.name || null;
              locationAddress = messageData.location?.address || null;
              bodyContent = locationName || locationAddress || "Location";
            }

            // 4. Contacts Type
            else if (mappedType === "CONTACT") {
              contactPayload = messageData.contacts;
              const primaryContact = messageData.contacts?.[0];
              if (primaryContact) {
                contactName = primaryContact.name?.formatted_name || primaryContact.name?.first_name || 'Contact';
                contactPhones = primaryContact.phones?.map(p => p.phone || p.wa_id).filter(Boolean) || [];
              }
              bodyContent = contactName || "Contact Details";
            }

            // 5. Media Types
            else if (["IMAGE", "VIDEO", "AUDIO", "VOICE", "DOCUMENT", "STICKER"].includes(mappedType)) {
              const mediaKey = messageData.type;
              const mediaData = messageData[mediaKey];
              if (mediaData && mediaData.id) {
                const mediaId = mediaData.id;
                mimeType = mediaData.mime_type || null;
                bodyContent = mediaData.caption || null;
                mediaFileName = mediaData.filename || null;
                mediaWidth = mediaData.width ? parseInt(mediaData.width, 10) : null;
                mediaHeight = mediaData.height ? parseInt(mediaData.height, 10) : null;
                mediaDurationSeconds = mediaData.duration ? parseInt(mediaData.duration, 10) : null;
                
                try {
                  const decryptedToken = decrypt(connection.accessToken);
                  const fileAsset = await mediaService.downloadAndStoreMedia(
                    tenantId,
                    mediaId,
                    decryptedToken,
                    conversation.id
                  );
                  
                  if (fileAsset) {
                    storageFileId = fileAsset.id;
                    mediaUrl = fileAsset.secureUrl || fileAsset.url;
                    fileSize = fileAsset.fileSize;
                    if (!mediaFileName) {
                      mediaFileName = fileAsset.originalName || fileAsset.fileName;
                    }
                  }
                } catch (mediaErr) {
                  logWhatsApp('[WHATSAPP_WEBHOOK]', { tenantId }, `Failed to download/upload media attachment for mediaId=${mediaId}: ${mediaErr.message}`, 'error');
                }
              }
            }

            // 6. Reactions
            else if (mappedType === "REACTION") {
              const reactionData = messageData.reaction;
              if (reactionData) {
                const reactionEmoji = reactionData.emoji || null;
                const targetMetaId = reactionData.message_id;
                const senderPhone = fromPhone;
                
                bodyContent = reactionEmoji || "Removed reaction";
                
                const targetMsg = await prisma.whatsAppMessage.findFirst({
                  where: { metaMessageId: targetMetaId, tenantId }
                });
                
                if (targetMsg) {
                  if (reactionEmoji) {
                    await prisma.whatsappReaction.upsert({
                      where: {
                        messageId_senderPhone: {
                          messageId: targetMsg.id,
                          senderPhone,
                        },
                      },
                      update: {
                        emoji: reactionEmoji,
                        metaMessageId: wamid,
                      },
                      create: {
                        tenantId,
                        messageId: targetMsg.id,
                        metaMessageId: wamid,
                        senderPhone,
                        senderName: messageData.senderName || `${client.firstName} ${client.lastName}`,
                        emoji: reactionEmoji,
                      },
                    });
                  } else {
                    await prisma.whatsappReaction.deleteMany({
                      where: {
                        messageId: targetMsg.id,
                        senderPhone,
                      },
                    });
                  }
                  
                  const allReactions = await prisma.whatsappReaction.findMany({
                    where: { messageId: targetMsg.id },
                    select: { senderPhone: true, emoji: true, senderName: true }
                  });
                  
                  emitTenantEvent(tenantId, 'whatsapp:message_reaction', {
                    targetMessageId: targetMsg.id,
                    metaMessageId: targetMsg.metaMessageId,
                    reactions: allReactions,
                  });
                }
              }
            }

            // Deletions check
            const isDeletion = messageData.type === 'unsupported' || (messageData.errors && messageData.errors.some(e => e.code === 131051 || String(e.message).toLowerCase().includes('deleted')));
            if (isDeletion) {
              const existingMsg = await prisma.whatsAppMessage.findFirst({
                where: { metaMessageId: wamid, tenantId }
              });
              if (existingMsg) {
                await prisma.whatsAppMessage.update({
                  where: { id: existingMsg.id },
                  data: {
                    deletedAt: timestamp,
                  }
                });
                
                emitTenantEvent(tenantId, "whatsapp:message_deleted", {
                  id: existingMsg.id,
                  metaMessageId: existingMsg.metaMessageId,
                  deletedAt: timestamp,
                });
                
                continue;
              }
            }

            // Resolve reply context
            let replyToMessageId = null;
            let replyToMetaMessageId = null;
            let replyPreviewText = null;

            if (messageData.context) {
              replyToMetaMessageId = messageData.context.id;
              const repliedMsg = await prisma.whatsAppMessage.findFirst({
                where: { metaMessageId: replyToMetaMessageId, tenantId }
              });
              if (repliedMsg) {
                replyToMessageId = repliedMsg.id;
                replyPreviewText = repliedMsg.previewText || repliedMsg.body || '';
              }
            }

            // Generate server-side previewText
            const previewText = generatePreviewText(mappedType, bodyContent, {
              document: { filename: mediaFileName },
              location: { name: locationName },
              contacts: messageData.contacts,
              interactive: messageData.interactive,
            });

            const createFields = {
              tenantId,
              conversationId: conversation.id,
              metaMessageId: wamid,
              direction: "INBOUND",
              type: mappedType,
              status: "DELIVERED",
              senderType: "CLIENT",
              source: "MANUAL",
              body: bodyContent,
              mediaMimeType: mimeType,
              mediaSize: fileSize,
              mediaUrl,
              mediaFileName,
              storageFileId,
              mediaWidth,
              mediaHeight,
              mediaDurationSeconds,
              locationLatitude: locationLatitude ? parseFloat(locationLatitude) : null,
              locationLongitude: locationLongitude ? parseFloat(locationLongitude) : null,
              locationName,
              locationAddress,
              contactName,
              contactPhones,
              contactPayload,
              interactivePayload,
              replyToMessageId,
              replyToMetaMessageId,
              replyPreviewText,
              previewText,
              senderPhone: fromPhone,
              senderName: `${client.firstName} ${client.lastName}`,
              deliveredAt: timestamp,
              createdAt: timestamp,
            };

            const savedMessage = await prisma.whatsAppMessage.upsert({
              where: { metaMessageId: wamid },
              update: {
                ...createFields,
                direction: "INBOUND",
              },
              create: createFields,
              include: {
                reactions: true,
              }
            });

            logWhatsApp('[WHATSAPP_WEBHOOK] Message persisted', { tenantId, messageId: savedMessage.id });

            if (redis) {
              await redis.set(`whatsapp:correlation:local:${savedMessage.id}`, correlationId, 'EX', 604800);
            }

            // Update conversation last messageDetails
            const updatedConv = await prisma.whatsAppConversation.update({
              where: { id: conversation.id },
              data: {
                lastMessageId: savedMessage.id,
                lastMessageText: previewText.slice(0, 499),
                lastMessageAt: timestamp,
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

            const receiptHistory = [];

            const messageDto = {
              ...whatsappService.toMessageResponseDTO(savedMessage),
              correlationId,
              receiptHistory,
            };

            emitTenantEvent(tenantId, "whatsapp:message_new", messageDto);

            logWhatsApp('[WHATSAPP_SOCKET] Inbound message broadcasted', { tenantId, messageId: savedMessage.id });
            emitTenantEvent(tenantId, "whatsapp:conversation_update", updatedConv);
          }
        }
      }
    }

    // Save diagnostics last webhook payload (unconditionally, to aid troubleshooting)
    if (redis) {
      let eventType = "unknown";
      let phoneId = null;
      let wabaId = null;
      for (const entry of payload.entry || []) {
        wabaId = entry.id;
        for (const change of entry.changes || []) {
          if (change.field === "messages") {
            const val = change.value;
            phoneId = val?.metadata?.phone_number_id;
            if (val?.messages && val.messages.length > 0) {
              eventType = "messages";
            } else if (val?.statuses && val.statuses.length > 0) {
              eventType = "statuses";
            }
          }
        }
      }

      // Try resolving tenant ID for diagnostic logging if database has it
      let diagnosticTenantId = tenantIdResolved;
      if (!diagnosticTenantId && wabaId && phoneId) {
        try {
          const conn = await prisma.whatsAppConnection.findFirst({
            where: { wabaId, phoneNumberId: phoneId },
            select: { tenantId: true }
          });
          if (conn) {
            diagnosticTenantId = conn.tenantId;
          }
        } catch (err) {
          // ignore database error during diagnostics logging
        }
      }

      const diagnosticPayload = {
        timestamp: new Date().toISOString(),
        eventType,
        wabaId: wabaId || null,
        phoneNumberId: phoneId || null,
        tenantId: diagnosticTenantId || null,
        rawPayload: payload,
      };

      try {
        await redis.set("whatsapp:webhook:last_payload", JSON.stringify(diagnosticPayload), "EX", 86400);
      } catch (err) {
        // ignore
      }
    }

    const duration = Date.now() - startTime;
    logWhatsApp('[WHATSAPP_WEBHOOK]', { tenantId: tenantIdResolved }, `Webhook Processing Completed: duration=${duration}ms`);

    return {
      duration,
      tenantId: tenantIdResolved,
    };
  },
};
