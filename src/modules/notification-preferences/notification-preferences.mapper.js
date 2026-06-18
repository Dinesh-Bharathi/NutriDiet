export const notificationPreferencesMapper = {
  toDTO(model) {
    if (!model) return null;
    return {
      userId: model.userId,
      browserNotifications: model.browserNotifications,
      inAppNotifications: model.inAppNotifications,
      soundNotifications: model.soundNotifications,
      soundVolume: model.soundVolume,
      soundId: model.soundId,
      updatedAt: model.updatedAt.toISOString(),
    };
  }
};
