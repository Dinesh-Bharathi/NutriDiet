import { Router } from "express";
import { userController } from "./user.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { resolveTenant } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { userValidation } from "./user.validation.js";
import asyncHandler from "../../utils/asyncHandler.js";

const router = Router();

// Apply authentication and tenant context to all user routes
router.use(authenticate, resolveTenant);

/**
 * @route GET /api/v1/users
 * @desc Get a paginated and filtered list of users in the tenant
 * @access Private
 */
router.get("/", validate(userValidation.getUsers), asyncHandler(userController.getDirectory));

export default router;
