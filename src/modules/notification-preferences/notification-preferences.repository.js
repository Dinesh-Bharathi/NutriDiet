import prisma from "../../lib/prisma.js";

export const notificationPreferencesRepository = {
  /**
   * Find notification preference by userId
   */
  async findByUserId(userId) {
    return prisma.notificationPreference.findUnique({
      where: { userId }
    });
  },

  /**
   * Create default notification preference
   */
  async create(userId, data) {
    return prisma.notificationPreference.create({
      data: {
        userId,
        browserNotifications: data.browserNotifications,
        inAppNotifications: data.inAppNotifications,
        soundNotifications: data.soundNotifications,
        soundVolume: data.soundVolume,
        soundId: data.soundId
      }
    });
  },

  /**
   * Update notification preference
   */
  async update(userId, data) {
    return prisma.notificationPreference.update({
      where: { userId },
      data: {
        browserNotifications: data.browserNotifications,
        inAppNotifications: data.inAppNotifications,
        soundNotifications: data.soundNotifications,
        soundVolume: data.soundVolume,
        soundId: data.soundId
      }
    });
  }
};
