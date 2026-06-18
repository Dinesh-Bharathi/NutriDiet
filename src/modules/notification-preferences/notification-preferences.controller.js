import { notificationPreferencesService } from "./notification-preferences.service.js";
import { updateNotificationPreferencesSchema } from "./notification-preferences.validation.js";
import { sendSuccess } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../config/constants.js";

export const notificationPreferencesController = {
  /**
   * GET /api/v1/notification-preferences
   * Get user's notification preferences (with merged system defaults).
   */
  async getPreferences(req, res) {
    const userId = req.user.userId;
    const preferences = await notificationPreferencesService.getPreferences(userId);
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "Notification preferences retrieved successfully",
      preferences
    );
  },

  /**
   * PUT /api/v1/notification-preferences
   * Update user's notification preferences.
   */
  async updatePreferences(req, res) {
    const userId = req.user.userId;
    
    // Validate request body
    const validatedData = updateNotificationPreferencesSchema.parse(req.body);
    
    const preferences = await notificationPreferencesService.updatePreferences(userId, validatedData);
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "Notification preferences updated successfully",
      preferences
    );
  }
};
