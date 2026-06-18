import { Router } from "express";
import { notificationPreferencesController } from "./notification-preferences.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { resolveTenant } from "../../middlewares/tenant.middleware.js";
import asyncHandler from "../../utils/asyncHandler.js";

const router = Router();

// All notification preferences routes require authentication and tenant context
router.use(authenticate);
router.use(resolveTenant);

// GET /api/v1/notification-preferences
router.get("/", asyncHandler(notificationPreferencesController.getPreferences));

// PUT /api/v1/notification-preferences
router.put("/", asyncHandler(notificationPreferencesController.updatePreferences));

export default router;
