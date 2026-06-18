import { z } from "zod";

export const updateNotificationPreferencesSchema = z.object({
  browserNotifications: z.boolean(),
  inAppNotifications: z.boolean(),
  soundNotifications: z.boolean(),
  soundVolume: z.number().int().min(0).max(100),
  soundId: z.string()
});
