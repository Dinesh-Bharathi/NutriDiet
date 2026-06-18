import { createRequire } from "module";
import { notificationPreferencesRepository } from "./notification-preferences.repository.js";
import { notificationPreferencesMapper } from "./notification-preferences.mapper.js";

const require = createRequire(import.meta.url);
const notificationSounds = require("../../config/notification-sounds.json");

const SYSTEM_DEFAULTS = {
  browserNotifications: true,
  inAppNotifications: true,
  soundNotifications: true,
  soundVolume: 80,
  soundId: "message-default"
};

export const notificationPreferencesService = {
  /**
   * Get effective notification preferences for user
   */
  async getPreferences(userId) {
    const stored = await notificationPreferencesRepository.findByUserId(userId);
    if (!stored) {
      // Auto-create default settings record in DB
      const created = await notificationPreferencesRepository.create(userId, SYSTEM_DEFAULTS);
      return notificationPreferencesMapper.toDTO(created);
    }

    // Dynamic Preference Merging & Backward Compatibility Migration
    const merged = this.mergeAndMigratePreferences(stored);
    
    // Auto-save migration results back to DB if soundId column was missing/uninitialized
    if (stored.soundId !== merged.soundId) {
      await notificationPreferencesRepository.update(userId, {
        browserNotifications: merged.browserNotifications,
        inAppNotifications: merged.inAppNotifications,
        soundNotifications: merged.soundNotifications,
        soundVolume: merged.soundVolume,
        soundId: merged.soundId
      });
    }

    return notificationPreferencesMapper.toDTO(merged);
  },

  /**
   * Update notification preferences for user
   */
  async updatePreferences(userId, data) {
    const stored = await notificationPreferencesRepository.findByUserId(userId);
    
    // Flatten sounds list from registry to validate global sound selection
    const allSounds = Object.values(notificationSounds).flat();
    
    let soundId = typeof data.soundId === "string" ? data.soundId : SYSTEM_DEFAULTS.soundId;
    const isValid = allSounds.some(s => s.id === soundId);
    if (!isValid) {
      soundId = SYSTEM_DEFAULTS.soundId; // Fallback to default sound
    }

    const updateData = {
      browserNotifications: typeof data.browserNotifications === "boolean" ? data.browserNotifications : SYSTEM_DEFAULTS.browserNotifications,
      inAppNotifications: typeof data.inAppNotifications === "boolean" ? data.inAppNotifications : SYSTEM_DEFAULTS.inAppNotifications,
      soundNotifications: typeof data.soundNotifications === "boolean" ? data.soundNotifications : SYSTEM_DEFAULTS.soundNotifications,
      soundVolume: typeof data.soundVolume === "number" ? data.soundVolume : SYSTEM_DEFAULTS.soundVolume,
      soundId
    };

    let result;
    if (!stored) {
      result = await notificationPreferencesRepository.create(userId, updateData);
    } else {
      result = await notificationPreferencesRepository.update(userId, updateData);
    }

    return notificationPreferencesMapper.toDTO(result);
  },

  /**
   * Merge stored settings with current system defaults and migrate legacy data if needed
   */
  mergeAndMigratePreferences(stored) {
    let soundId = stored.soundId;

    // Backward compatibility: Extract old category sound if soundId is missing/default and legacy categories exist
    if ((!soundId || soundId === SYSTEM_DEFAULTS.soundId) && stored.categories && typeof stored.categories === "object") {
      const oldWhatsapp = stored.categories.whatsapp;
      if (oldWhatsapp && oldWhatsapp.soundId) {
        soundId = oldWhatsapp.soundId;
      }
    }

    if (!soundId) {
      soundId = SYSTEM_DEFAULTS.soundId;
    }

    // Validate soundId against current registry
    const allSounds = Object.values(notificationSounds).flat();
    const isValid = allSounds.some(s => s.id === soundId);
    if (!isValid) {
      soundId = SYSTEM_DEFAULTS.soundId;
    }

    return {
      userId: stored.userId,
      browserNotifications: typeof stored.browserNotifications === "boolean" ? stored.browserNotifications : SYSTEM_DEFAULTS.browserNotifications,
      inAppNotifications: typeof stored.inAppNotifications === "boolean" ? stored.inAppNotifications : SYSTEM_DEFAULTS.inAppNotifications,
      soundNotifications: typeof stored.soundNotifications === "boolean" ? stored.soundNotifications : SYSTEM_DEFAULTS.soundNotifications,
      soundVolume: typeof stored.soundVolume === "number" ? stored.soundVolume : SYSTEM_DEFAULTS.soundVolume,
      soundId,
      updatedAt: stored.updatedAt
    };
  }
};
