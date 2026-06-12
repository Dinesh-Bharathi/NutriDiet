import { Router } from "express";
import { userController } from "./user.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { resolveTenant } from "../../middlewares/tenant.middleware.js";
import { adminOrAbove } from "../../middlewares/rbac.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { userValidation } from "./user.validation.js";
import asyncHandler from "../../utils/asyncHandler.js";

const router = Router();

// Apply authentication and tenant context globally to all user routes
router.use(authenticate, resolveTenant);

// Middleware to authorize either the user themselves or an administrator/owner
const selfOrAdmin = (req, res, next) => {
  if (req.user && req.user.userId === req.params.id) {
    return next();
  }
  return adminOrAbove(req, res, next);
};

/**
 * @route GET /api/v1/users
 * @desc Get a paginated and filtered list of users in the tenant
 * @access Admin/Owner Only
 */
router.get("/", adminOrAbove, validate(userValidation.getUsers), asyncHandler(userController.getDirectory));

/**
 * @route POST /api/v1/users
 * @desc Create/Invite a new staff user under the tenant
 * @access Admin/Owner Only
 */
router.post("/", adminOrAbove, validate(userValidation.createUser), asyncHandler(userController.createUser));

/**
 * @route PATCH /api/v1/users/:id/role
 * @desc Update a staff user's role
 * @access Admin/Owner Only
 */
router.patch("/:id/role", adminOrAbove, validate(userValidation.updateRole), asyncHandler(userController.updateRole));

/**
 * @route PATCH /api/v1/users/:id/status
 * @desc Update a staff user's status (e.g. suspend or activate)
 * @access Admin/Owner Only
 */
router.patch("/:id/status", adminOrAbove, validate(userValidation.updateStatus), asyncHandler(userController.updateStatus));

/**
 * @route PATCH /api/v1/users/:id/password
 * @desc Direct reset of a staff user's password
 * @access Admin/Owner Only
 */
router.patch("/:id/password", adminOrAbove, validate(userValidation.changePassword), asyncHandler(userController.changePassword));

/**
 * @route GET /api/v1/users/:id
 * @desc Get details of a single staff user
 * @access Self or Admin/Owner Only
 */
router.get("/:id", selfOrAdmin, asyncHandler(userController.getUser));

/**
 * @route PATCH /api/v1/users/:id
 * @desc Update a staff user's general details
 * @access Self or Admin/Owner Only
 */
router.patch("/:id", selfOrAdmin, validate(userValidation.updateUser), asyncHandler(userController.updateUser));

export default router;
