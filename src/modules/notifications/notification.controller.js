// src/modules/notifications/notification.controller.js
// Notification management HTTP adapters.
import { notificationService } from './notification.service.js';
import { mapNotification, mapNotificationsList } from './notification.mapper.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const notificationController = {
  /**
   * GET /api/v1/notifications
   * Retrieves a filtered and paginated list of notifications for the logged-in user.
   */
  async getNotifications(req, res) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId || req.user.id;

    const filters = {
      isArchived: req.query.isArchived,
      isRead: req.query.isRead,
      type: req.query.type,
    };

    const pagination = {
      page: req.query.page,
      limit: req.query.limit,
    };

    const result = await notificationService.getNotifications(tenantId, userId, filters, pagination);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Notifications retrieved successfully',
      {
        notifications: mapNotificationsList(result.notifications),
        pagination: result.pagination,
      }
    );
  },

  /**
   * GET /api/v1/notifications/unread-count
   * Retrieves count of unread and not archived notifications.
   */
  async getUnreadCount(req, res) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId || req.user.id;

    const data = await notificationService.getUnreadCount(tenantId, userId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Unread notifications count retrieved successfully',
      data
    );
  },

  /**
   * PATCH /api/v1/notifications/:id/read
   * Marks a specific notification as read.
   */
  async markAsRead(req, res) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;

    const notification = await notificationService.markAsRead(tenantId, userId, id);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Notification marked as read successfully',
      { notification: mapNotification(notification) }
    );
  },

  /**
   * PATCH /api/v1/notifications/read-all
   * Marks all unread notifications for a user as read.
   */
  async markAllAsRead(req, res) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId || req.user.id;

    await notificationService.markAllAsRead(tenantId, userId);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'All notifications marked as read successfully'
    );
  },

  /**
   * PATCH /api/v1/notifications/:id/archive
   * Archives or unarchives a notification.
   */
  async archiveNotification(req, res) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;
    const { archived } = req.body;

    const notification = await notificationService.archiveNotification(tenantId, userId, id, archived);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      archived ? 'Notification archived successfully' : 'Notification unarchived successfully',
      { notification: mapNotification(notification) }
    );
  },

  /**
   * DELETE /api/v1/notifications/:id
   * Hard-deletes a notification.
   */
  async deleteNotification(req, res) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;

    await notificationService.deleteNotification(tenantId, userId, id);

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Notification deleted successfully'
    );
  },
};
