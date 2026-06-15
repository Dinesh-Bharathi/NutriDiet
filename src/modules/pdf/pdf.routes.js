import { Router } from "express";
import { pdfController } from "./pdf.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { resolveTenant } from "../../middlewares/tenant.middleware.js";
import { requireMinRole } from "../../middlewares/rbac.middleware.js";
import { ROLES } from "../../config/constants.js";
import asyncHandler from "../../utils/asyncHandler.js";

const router = Router();

/**
 * GET /api/v1/pdf/health
 * Public diagnostic endpoint for deployment verification
 */
router.get(
  "/health",
  asyncHandler(pdfController.getHealth)
);

// Secure subsequent PDF compilation and generation endpoints
router.use(authenticate);
router.use(resolveTenant);

/**
 * POST /api/v1/pdf/sample
 * Generates and compiles a sample PDF using the tenant's current template builder settings
 */
router.post(
  "/sample",
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(pdfController.generateSamplePdf)
);

/**
 * POST /api/v1/pdf/diet-plans/:id
 * Generates and compiles a client diet plan PDF.
 */
router.post(
  "/diet-plans/:id",
  requireMinRole(ROLES.ASSISTANT),
  asyncHandler(pdfController.generateDietPlanPdf)
);

export default router;
