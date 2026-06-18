// src/modules/notifications/notification.validation.js
// Zod validation schemas for notification routes.
import { z } from 'zod';
import { PAGINATION } from '../../config/constants.js';

// Schema for client search, pagination and filtering query parameters
export const queryNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .default(PAGINATION.DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(PAGINATION.MAX_LIMIT)
      .default(PAGINATION.DEFAULT_LIMIT),
    isArchived: z.preprocess(
      (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
      z.boolean().optional()
    ),
    isRead: z.preprocess(
      (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
      z.boolean().optional()
    ),
    type: z.string().optional(),
  }),
});

// Schema for marking notification as read
export const markReadSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Notification ID is required'),
  }),
});

// Schema for archiving a notification
export const archiveNotificationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Notification ID is required'),
  }),
  body: z.object({
    archived: z.boolean({ required_error: 'Archived status is required' }),
  }),
});

// Schema for deleting a notification
export const deleteNotificationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Notification ID is required'),
  }),
});
