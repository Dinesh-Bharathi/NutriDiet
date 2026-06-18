// src/modules/notifications/notification.service.js
// Business logic for Notification management.
import { notificationRepository } from './notification.repository.js';
import { emitUserEvent } from '../../lib/socket.js';
import ApiError from '../../utils/ApiError.js';

export const notificationService = {
  /**
   * Helper to emit updated unread notification count.
   *
   * @param {string} tenantId
   * @param {string} userId
   */
  async _emitCountUpdate(tenantId, userId) {
    const unreadCount = await notificationRepository.countUnread(tenantId, userId);
    emitUserEvent(tenantId, userId, 'notification:count_updated', {
      unreadCount,
    });
  },

  /**
   * Creates a new notification.
   *
   * @param {string} tenantId
   * @param {object} notificationData
   * @returns {Promise<object>} Created notification
   */
  async createNotification(tenantId, notificationData) {
    const notification = await notificationRepository.create(tenantId, notificationData);

    // Emit real-time notification:new socket event
    emitUserEvent(tenantId, notification.userId, 'notification:new', notification);

    // Emit notification:count_updated socket event
    await this._emitCountUpdate(tenantId, notification.userId);

    return notification;
  },

  /**
   * Retrieves paginated and filtered list of notifications for a user.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {object} filters
   * @param {object} pagination
   * @returns {Promise<object>} Paginated notifications result
   */
  async getNotifications(tenantId, userId, filters, pagination) {
    const [notifications, total] = await notificationRepository.findManyAndCount(
      tenantId,
      userId,
      filters,
      pagination
    );

    return {
      notifications,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  },

  /**
   * Retrieves count of unread and not archived notifications.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @returns {Promise<object>} Unread count object
   */
  async getUnreadCount(tenantId, userId) {
    const count = await notificationRepository.countUnread(tenantId, userId);
    return { count };
  },

  /**
   * Marks a notification as read.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {string} id
   * @returns {Promise<object>} Updated notification
   */
  async markAsRead(tenantId, userId, id) {
    const notification = await notificationRepository.findById(tenantId, userId, id);
    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    if (notification.isRead) {
      return notification;
    }

    const updated = await notificationRepository.update(tenantId, id, {
      isRead: true,
      readAt: new Date(),
    });

    // Emit realtime socket updates
    emitUserEvent(tenantId, userId, 'notification:read', {
      id,
      isRead: true,
      readAt: updated.readAt,
    });
    emitUserEvent(tenantId, userId, 'notification:updated', updated);

    // Emit notification:count_updated socket event
    await this._emitCountUpdate(tenantId, userId);

    return updated;
  },

  /**
   * Marks all unread notifications for a user as read.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async markAllAsRead(tenantId, userId) {
    await notificationRepository.markAllRead(tenantId, userId);

    // Emit realtime socket update
    emitUserEvent(tenantId, userId, 'notification:read', { all: true });

    // Emit notification:count_updated socket event
    await this._emitCountUpdate(tenantId, userId);
  },

  /**
   * Archives or unarchives a notification.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {string} id
   * @param {boolean} isArchived
   * @returns {Promise<object>} Updated notification
   */
  async archiveNotification(tenantId, userId, id, isArchived) {
    const notification = await notificationRepository.findById(tenantId, userId, id);
    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    if (notification.isArchived === isArchived) {
      return notification;
    }

    const updated = await notificationRepository.update(tenantId, id, {
      isArchived,
    });

    // Emit realtime socket updates
    emitUserEvent(tenantId, userId, 'notification:archive', {
      id,
      isArchived,
    });
    emitUserEvent(tenantId, userId, 'notification:updated', updated);

    // Emit notification:count_updated socket event
    await this._emitCountUpdate(tenantId, userId);

    return updated;
  },

  /**
   * Deletes a notification.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteNotification(tenantId, userId, id) {
    const notification = await notificationRepository.findById(tenantId, userId, id);
    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    await notificationRepository.delete(tenantId, id);

    // Emit realtime socket update
    emitUserEvent(tenantId, userId, 'notification:deleted', { id });

    // Emit notification:count_updated socket event
    await this._emitCountUpdate(tenantId, userId);
  },
};
