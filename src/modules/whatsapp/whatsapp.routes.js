import { Router } from 'express';
import { whatsappController } from './whatsapp.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

// Require authentication and tenant resolution for all routes
router.use(authenticate);
router.use(resolveTenant);

// GET connection (ASSISTANT or higher)
router.get(
  '/connection',
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(whatsappController.getConnection)
);

// PUT connection (ADMIN or higher)
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

// POST validate (ADMIN or higher)
router.post(
  '/validate',
  requireMinRole(ROLES.ADMIN),
  asyncHandler(whatsappController.validateConnection)
);

export default router;
