// src/modules/food-library/food-library.routes.js
// Food library routes.
import { Router } from 'express';
import { foodLibraryController } from './food-library.controller.js';
import {
  createFoodSchema,
  updateFoodSchema,
  queryFoodSchema,
  searchFoodSchema,
  foodParamSchema,
} from './food-library.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

// Apply authentication, tenant verification, and practitioner RBAC checks
router.use(authenticate);
router.use(resolveTenant);
router.use(requireMinRole(ROLES.ASSISTANT));

// POST /api/v1/food-library - Create food item
router.post(
  '/',
  validate(createFoodSchema),
  asyncHandler(foodLibraryController.createFood)
);

// GET /api/v1/food-library/search - Autocomplete search food items (must be registered BEFORE GET /:id)
router.get(
  '/search',
  validate(searchFoodSchema),
  asyncHandler(foodLibraryController.searchFood)
);

// GET /api/v1/food-library - List food library (paginated)
router.get(
  '/',
  validate(queryFoodSchema),
  asyncHandler(foodLibraryController.getFoodLibrary)
);

// GET /api/v1/food-library/:id - Get food item by id
router.get(
  '/:id',
  validate(foodParamSchema),
  asyncHandler(foodLibraryController.getFoodById)
);

// PATCH /api/v1/food-library/:id - Update food item
router.patch(
  '/:id',
  validate(updateFoodSchema),
  asyncHandler(foodLibraryController.updateFood)
);

// DELETE /api/v1/food-library/:id - Soft delete food item
router.delete(
  '/:id',
  validate(foodParamSchema),
  asyncHandler(foodLibraryController.deleteFood)
);

export default router;
