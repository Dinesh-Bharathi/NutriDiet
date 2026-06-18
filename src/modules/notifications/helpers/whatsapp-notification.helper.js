// src/modules/notifications/helpers/whatsapp-notification.helper.js
// Reusable helpers for building WhatsApp notification payloads and resolving recipients.
// Used by Phase 6B (webhook integration) and reusable by Phase 6C (browser push)
// and Phase 6D (mobile push).

import prisma from '../../../lib/prisma.js';
import { logWhatsApp } from '../../whatsapp/whatsapp-logger.js';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  WHATSAPP_MEDIA_MESSAGE_TYPES,
} from '../notification.constants.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum length (chars) for notification preview message text. */
const PREVIEW_MAX_LENGTH = 100;

/** Roles that always receive WhatsApp inbound notifications. */
const ALWAYS_NOTIFY_ROLES = ['OWNER', 'ADMIN'];

// ─── Payload Builder ─────────────────────────────────────────────────────────

/**
 * Maps a WhatsApp message type to a human-readable emoji label.
 *
 * @param {string} mappedType - Normalized WhatsApp message type (e.g. 'IMAGE')
 * @param {string|null} previewText - Server-generated preview text from the message
 * @param {object} opts - Additional context
 * @param {string|null} opts.mediaFileName - File name for DOCUMENT type
 * @param {string|null} opts.clientName - Sender client display name
 * @returns {{ label: string, preview: string }}
 */
function buildTypeLabel(mappedType, previewText, { mediaFileName } = {}) {
  switch (mappedType) {
    case 'TEXT':
      return { label: null, preview: previewText || 'Sent a message' };
    case 'IMAGE':
      return { label: '📷 Photo', preview: previewText ? `📷 ${previewText}` : '📷 Photo' };
    case 'VIDEO':
      return { label: '🎥 Video', preview: previewText ? `🎥 ${previewText}` : '🎥 Video' };
    case 'AUDIO':
      return { label: '🎵 Audio', preview: '🎵 Audio' };
    case 'VOICE':
      return { label: '🎤 Voice Message', preview: '🎤 Voice Message' };
    case 'DOCUMENT': {
      const filename = mediaFileName || 'Document';
      return { label: `📄 ${filename}`, preview: `📄 ${filename}` };
    }
    case 'STICKER':
      return { label: '🗒️ Sticker', preview: '🗒️ Sticker' };
    case 'LOCATION':
      return { label: '📍 Shared Location', preview: previewText ? `📍 ${previewText}` : '📍 Shared Location' };
    case 'CONTACT':
      return { label: '👤 Shared Contact', preview: previewText ? `👤 ${previewText}` : '👤 Shared Contact' };
    case 'INTERACTIVE':
      return { label: '🔘 Interactive Reply', preview: previewText ? `🔘 ${previewText}` : '🔘 Interactive Reply' };
    default:
      return { label: '💬 New message', preview: previewText || 'New message' };
  }
}

/**
 * Builds a complete notification payload for a WhatsApp inbound message.
 * This function is pure and free of side-effects — reusable by any channel
 * (browser push, mobile push, email digest, activity feed).
 *
 * @param {object} params
 * @param {string} params.userId - Target notification recipient user ID
 * @param {string} params.clientName - Display name of the client who sent the message
 * @param {string} params.clientId - Client DB record ID
 * @param {string} params.conversationId - WhatsApp conversation ID
 * @param {string} params.messageId - Saved WhatsApp message DB ID
 * @param {string} params.mappedType - Normalized message type (e.g. 'TEXT', 'IMAGE')
 * @param {string|null} params.previewText - Server-generated message preview text
 * @param {string|null} params.mediaFileName - Filename for DOCUMENT messages
 * @returns {object} Notification creation payload
 */
export function buildWhatsAppNotificationPayload({
  userId,
  clientName,
  clientId,
  conversationId,
  messageId,
  mappedType,
  previewText,
  mediaFileName,
}) {
  const isMedia = WHATSAPP_MEDIA_MESSAGE_TYPES.has(mappedType);
  const notificationType = isMedia
    ? NOTIFICATION_TYPES.WHATSAPP_MEDIA_RECEIVED
    : NOTIFICATION_TYPES.WHATSAPP_MESSAGE_RECEIVED;

  const { label, preview } = buildTypeLabel(mappedType, previewText, { mediaFileName });

  // Notification title e.g. "New WhatsApp message from John Doe"
  const title = `New WhatsApp message from ${clientName}`;

  // Notification preview, truncated for badge display
  const messagePreview = (label || preview || 'New message').slice(0, PREVIEW_MAX_LENGTH);

  // Action URL — navigates directly to the conversation in the WhatsApp message center.
  // Format is the actual route: /messages?conversationId={conversationId}
  // This will be used in Phase 6C (browser notifications) and Phase 6D (mobile push).
  const actionUrl = `/messages?conversationId=${conversationId}`;

  return {
    userId,
    type: notificationType,
    title,
    message: messagePreview,
    priority: NOTIFICATION_PRIORITIES.NORMAL,
    entityType: 'whatsapp_conversation',
    entityId: conversationId,
    actionUrl,
    metadata: {
      clientId,
      clientName,
      messageId,
      messageType: mappedType,
      conversationId,
    },
  };
}

// ─── Recipient Resolver ──────────────────────────────────────────────────────

/**
 * Resolves the set of user IDs that should receive a notification
 * for an inbound WhatsApp message on a given conversation.
 *
 * Strategy:
 *   1. Assigned Dietitian (client.dietitianId) — owns the clinical relationship.
 *   2. All OWNER users in the tenant — full operational oversight.
 *   3. All ADMIN users in the tenant — practice management.
 *   ASSISTANT users are excluded in Phase 6B (no assignment model exists yet).
 *
 * Recipients are deduplicated by userId before being returned.
 *
 * @param {string} tenantId
 * @param {string} clientId
 * @returns {Promise<string[]>} Array of unique user IDs to notify
 */
export async function resolveWhatsAppNotificationRecipients(tenantId, clientId) {
  // Fetch client with assigned dietitian ID only
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
    select: { dietitianId: true },
  });

  // Fetch all OWNER and ADMIN users in the tenant (active users only)
  const staffUsers = await prisma.user.findMany({
    where: {
      tenantId,
      role: { in: ALWAYS_NOTIFY_ROLES },
      deletedAt: null,
    },
    select: { id: true },
  });

  // Build recipient set — deduplicate using a Set
  const recipientSet = new Set(staffUsers.map((u) => u.id));

  // Add the assigned dietitian if one is set
  if (client?.dietitianId) {
    recipientSet.add(client.dietitianId);
  }

  return Array.from(recipientSet);
}
