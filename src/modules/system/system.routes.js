import { Router } from 'express';
import { systemController } from './system.controller.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Allow authenticated users to fetch system enumerations
router.use(authenticate);

// GET /api/v1/system/enums
router.get('/enums', asyncHandler(systemController.getEnums));

export default router;
