// src/modules/notifications/notification.routes.js
// Express routes for notification operations.
import { Router } from 'express';
import { notificationController } from './notification.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import { validate } from '../../middlewares/validate.middleware.js';
import asyncHandler from '../../utils/asyncHandler.js';
import {
  queryNotificationsSchema,
  markReadSchema,
  archiveNotificationSchema,
  deleteNotificationSchema,
} from './notification.validation.js';

const router = Router();

// Protect all routes under this module
router.use(authenticate);
router.use(resolveTenant);
router.use(requireMinRole(ROLES.ASSISTANT));

// GET /api/v1/notifications
router.get(
  '/',
  validate(queryNotificationsSchema),
  asyncHandler(notificationController.getNotifications)
);

// GET /api/v1/notifications/unread-count
router.get(
  '/unread-count',
  asyncHandler(notificationController.getUnreadCount)
);

// PATCH /api/v1/notifications/read-all
router.patch(
  '/read-all',
  asyncHandler(notificationController.markAllAsRead)
);

// PATCH /api/v1/notifications/:id/read
router.patch(
  '/:id/read',
  validate(markReadSchema),
  asyncHandler(notificationController.markAsRead)
);

// PATCH /api/v1/notifications/:id/archive
router.patch(
  '/:id/archive',
  validate(archiveNotificationSchema),
  asyncHandler(notificationController.archiveNotification)
);

// DELETE /api/v1/notifications/:id
router.delete(
  '/:id',
  validate(deleteNotificationSchema),
  asyncHandler(notificationController.deleteNotification)
);

export default router;
