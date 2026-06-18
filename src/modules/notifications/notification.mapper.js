// src/modules/notifications/notification.mapper.js
// Maps database models to clean API response objects.

/**
 * Maps a single notification database record to API response format.
 *
 * @param {object} n - Database notification record
 * @returns {object|null} Mapped notification
 */
export function mapNotification(n) {
  if (!n) return null;
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    description: n.message, // Map message to description for frontend compatibility
    message: n.message,
    entityType: n.entityType,
    entityId: n.entityId,
    priority: n.priority,
    actionUrl: n.actionUrl,
    metadata: n.metadata,
    read: n.isRead, // Map isRead to read
    isRead: n.isRead,
    archived: n.isArchived, // Map isArchived to archived
    isArchived: n.isArchived,
    readAt: n.readAt,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

/**
 * Maps an array of notification database records to API response format.
 *
 * @param {Array<object>} notifications - Database notification records
 * @returns {Array<object>} Mapped notifications
 */
export function mapNotificationsList(notifications) {
  if (!Array.isArray(notifications)) return [];
  return notifications.map(mapNotification);
}
