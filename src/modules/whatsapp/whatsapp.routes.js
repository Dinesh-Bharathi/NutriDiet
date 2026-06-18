import { Router } from 'express';
import { whatsappController } from './whatsapp.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

// ── Public Webhook Routes (No Authentication or Tenant Resolution Middlewares) ──
router.get(
  '/webhook',
  asyncHandler(whatsappController.verifyWebhook)
);

router.post(
  '/webhook',
  asyncHandler(whatsappController.receiveWebhook)
);

// ── Require Authentication and Tenant Resolution for All Other Routes ──
router.use(authenticate);
router.use(resolveTenant);

// GET diagnostics health details (ASSISTANT or higher)
router.get(
  '/health',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.getHealthDiagnostics)
);

// GET webhook debug details (ASSISTANT or higher)
router.get(
  '/debug/webhook',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.getWebhookDebug)
);

// POST diagnostic test message (ADMIN or higher, dev-only)
router.post(
  '/test-message',
  requireMinRole(ROLES.ADMIN),
  asyncHandler(whatsappController.sendTestMessage)
);


// GET connection details (ASSISTANT or higher)
router.get(
  '/connection',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.getConnection)
);

// PUT connection details (ADMIN or higher)
router.put(
  '/connection',
  requireMinRole(ROLES.ADMIN),
  asyncHandler(whatsappController.upsertConnection)
);

// POST disconnect (ADMIN or higher)
router.post(
  '/disconnect',
  requireMinRole(ROLES.ADMIN),
  asyncHandler(whatsappController.disconnectConnection)
);

// POST validate connection health (ADMIN or higher)
router.post(
  '/validate',
  requireMinRole(ROLES.ADMIN),
  asyncHandler(whatsappController.validateConnection)
);

// GET search client conversations and messages (ASSISTANT or higher)
router.get(
  '/search',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.search)
);

// GET conversations list (ASSISTANT or higher)
router.get(
  '/conversations',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.getConversations)
);

// GET or create conversation by client ID (ASSISTANT or higher)
router.get(
  '/conversations/client/:clientId',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.getOrCreateConversation)
);

// GET messages in a conversation (ASSISTANT or higher)
router.get(
  '/conversations/:id/messages',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.getMessages)
);

// GET media, documents, audio, links in a conversation (ASSISTANT or higher)
router.get(
  '/conversations/:id/media',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.getConversationMedia)
);

// POST send message in a conversation (ASSISTANT or higher)
router.post(
  '/conversations/:id/messages',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.sendMessage)
);

// POST mark conversation as read (ASSISTANT or higher)
router.post(
  '/conversations/:id/read',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.markConversationAsRead)
);

// PUT archive conversation (DIETITIAN or higher)
router.put(
  '/conversations/:id/archive',
  requireMinRole(ROLES.DIETITIAN),
  asyncHandler(whatsappController.archiveConversation)
);

// PUT mute conversation (DIETITIAN or higher)
router.put(
  '/conversations/:id/mute',
  requireMinRole(ROLES.DIETITIAN),
  asyncHandler(whatsappController.muteConversation)
);

// PUT WhatsApp compliance opt-in (DIETITIAN or higher)
router.put(
  '/conversations/:id/opt-in',
  requireMinRole(ROLES.DIETITIAN),
  asyncHandler(whatsappController.optInClient)
);

// POST react to a message (ASSISTANT or higher)
router.post(
  '/messages/:id/react',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.reactToMessage)
);

// DELETE soft delete a message (DIETITIAN or higher)
router.delete(
  '/messages/:id',
  requireMinRole(ROLES.DIETITIAN),
  asyncHandler(whatsappController.deleteMessage)
);

export default router;
