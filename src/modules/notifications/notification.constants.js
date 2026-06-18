// src/modules/notifications/notification.constants.js
// Notification type and priority enums.
// Keep these in sync with the frontend notification.constants.js.

export const NOTIFICATION_TYPES = Object.freeze({
  // WhatsApp inbound message (text, location, contact, interactive)
  WHATSAPP_MESSAGE_RECEIVED: 'WHATSAPP_MESSAGE_RECEIVED',
  // WhatsApp inbound media (image, video, audio, voice, document, sticker)
  WHATSAPP_MEDIA_RECEIVED: 'WHATSAPP_MEDIA_RECEIVED',
  // WhatsApp new conversation started
  WHATSAPP_CONVERSATION: 'WHATSAPP_CONVERSATION',
  // General system notification
  SYSTEM: 'SYSTEM',
});

export const NOTIFICATION_PRIORITIES = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

/**
 * Message types that should trigger a notification.
 * Reactions, status updates, and deletions are excluded.
 */
export const NOTIFIABLE_WHATSAPP_MESSAGE_TYPES = Object.freeze(new Set([
  'TEXT',
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'VOICE',
  'DOCUMENT',
  'STICKER',
  'LOCATION',
  'CONTACT',
  'INTERACTIVE',
]));

/**
 * Message types that map to the WHATSAPP_MEDIA_RECEIVED notification type.
 */
export const WHATSAPP_MEDIA_MESSAGE_TYPES = Object.freeze(new Set([
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'VOICE',
  'DOCUMENT',
  'STICKER',
]));
