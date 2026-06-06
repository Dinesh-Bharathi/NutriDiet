import { Router } from 'express';
import { vaultController } from './vault.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';

const router = Router({ mergeParams: true });

// All vault routes require authentication, tenant resolution, and practitioner RBAC checks
router.use(authenticate);
router.use(resolveTenant);
router.use(requireMinRole(ROLES.ASSISTANT));

router.post('/', vaultController.create);
router.get('/', vaultController.list);
router.delete('/:documentId', vaultController.delete);

export default router;
