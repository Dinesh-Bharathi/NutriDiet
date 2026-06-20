// src/modules/automation/automation.routes.js

import { Router } from 'express';
import { automationController } from './automation.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

// Secure all automation routes
router.use(authenticate);
router.use(resolveTenant);
router.use(requireMinRole(ROLES.ASSISTANT));

// ── Templates ───────────────────────────────────────────────────────────────
router.get('/templates', asyncHandler(automationController.getTemplates));
router.get('/templates/placeholders', asyncHandler(automationController.getPlaceholders));
router.post('/templates', asyncHandler(automationController.createTemplate));
router.put('/templates/:id', asyncHandler(automationController.updateTemplate));
router.delete('/templates/:id', asyncHandler(automationController.deleteTemplate));
router.post('/templates/:id/clone', asyncHandler(automationController.cloneTemplate));
router.post('/templates/restore', asyncHandler(automationController.restoreDefault));
router.get('/templates/:id/disable-impact', asyncHandler(automationController.getDisableImpact));
router.put('/templates/:id/toggle', asyncHandler(automationController.toggleTemplateActive));

// ── Configurations (Admin only) ─────────────────────────────────────────────
router.get('/config', requireMinRole(ROLES.ADMIN), asyncHandler(automationController.getReminderConfig));
router.put('/config', requireMinRole(ROLES.ADMIN), asyncHandler(automationController.updateReminderConfig));

// ── Jobs ────────────────────────────────────────────────────────────────────
router.get('/jobs', asyncHandler(automationController.getJobs));
router.post('/jobs/bulk-archive', asyncHandler(automationController.bulkArchiveJobs));
router.get('/jobs/:id', asyncHandler(automationController.getJobById));

// ── Automations ─────────────────────────────────────────────────────────────
router.post('/automations/:id/generate', asyncHandler(automationController.regenerateJobs));
router.get('/automations/:id/generate-preview', asyncHandler(automationController.generatePreview));
router.put('/automations/:id/settings', asyncHandler(automationController.updateAutomationSettings));

// ── Analytics (Operations Command Center) ───────────────────────────────────
router.get('/analytics', asyncHandler(automationController.getOperationsAnalytics));

export default router;
