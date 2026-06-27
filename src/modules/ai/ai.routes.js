// src/modules/ai/ai.routes.js
// ─────────────────────────────────────────────────────────────────────────────
// Routing definitions for AI endpoints.
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { aiController } from './ai.controller.js';
import { chatSchema } from './ai.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

// Apply authentication, tenant verification, and validation middleware to the chat endpoint
router.post(
  '/chat',
  authenticate,
  resolveTenant,
  validate(chatSchema),
  asyncHandler(aiController.chat)
);

export default router;
