// src/modules/food-library/food-library-v2.routes.js
import { Router } from 'express';
import { foodLibraryV2Controller } from './food-library-v2.controller.js';
import {
  categoryParamSchema,
  createCategorySchema,
  updateCategorySchema,
  tagParamSchema,
  createTagSchema,
  updateTagSchema,
  foodParamSchema,
  servingParamSchema,
  createServingSchema,
  updateServingSchema,
  createEquivalentSchema,
  equivalentParamSchema,
} from './food-library-v2.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireMinRole } from '../../middlewares/rbac.middleware.js';
import { ROLES } from '../../config/constants.js';
import asyncHandler from '../../utils/asyncHandler.js';

const router = Router();

// Apply authorization and tenancy middlewares
router.use(authenticate);
router.use(resolveTenant);
router.use(requireMinRole(ROLES.ASSISTANT));

// ─── Food Categories ────────────────────────────────────────────────────────
router.post(
  '/food-categories',
  validate(createCategorySchema),
  asyncHandler(foodLibraryV2Controller.createCategory)
);

router.get(
  '/food-categories',
  asyncHandler(foodLibraryV2Controller.getAllCategories)
);

router.get(
  '/food-categories/:id',
  validate(categoryParamSchema),
  asyncHandler(foodLibraryV2Controller.getCategoryById)
);

router.patch(
  '/food-categories/:id',
  validate(categoryParamSchema),
  validate(updateCategorySchema),
  asyncHandler(foodLibraryV2Controller.updateCategory)
);

router.delete(
  '/food-categories/:id',
  validate(categoryParamSchema),
  asyncHandler(foodLibraryV2Controller.deleteCategory)
);

// ─── Food Tags ──────────────────────────────────────────────────────────────
router.post(
  '/food-tags',
  validate(createTagSchema),
  asyncHandler(foodLibraryV2Controller.createTag)
);

router.get(
  '/food-tags',
  asyncHandler(foodLibraryV2Controller.getAllTags)
);

router.get(
  '/food-tags/:id',
  validate(tagParamSchema),
  asyncHandler(foodLibraryV2Controller.getTagById)
);

router.patch(
  '/food-tags/:id',
  validate(tagParamSchema),
  validate(updateTagSchema),
  asyncHandler(foodLibraryV2Controller.updateTag)
);

router.delete(
  '/food-tags/:id',
  validate(tagParamSchema),
  asyncHandler(foodLibraryV2Controller.deleteTag)
);

// ─── Food Servings ──────────────────────────────────────────────────────────
router.post(
  '/foods/:id/servings',
  validate(foodParamSchema),
  validate(createServingSchema),
  asyncHandler(foodLibraryV2Controller.createServing)
);

router.get(
  '/foods/:id/servings',
  validate(foodParamSchema),
  asyncHandler(foodLibraryV2Controller.getAllServings)
);

router.patch(
  '/food-servings/:id',
  validate(servingParamSchema),
  validate(updateServingSchema),
  asyncHandler(foodLibraryV2Controller.updateServing)
);

router.delete(
  '/food-servings/:id',
  validate(servingParamSchema),
  asyncHandler(foodLibraryV2Controller.deleteServing)
);

// ─── Food Equivalents ───────────────────────────────────────────────────────
router.post(
  '/foods/:id/equivalents',
  validate(foodParamSchema),
  validate(createEquivalentSchema),
  asyncHandler(foodLibraryV2Controller.createEquivalent)
);

router.get(
  '/foods/:id/equivalents',
  validate(foodParamSchema),
  asyncHandler(foodLibraryV2Controller.getAllEquivalents)
);

router.delete(
  '/food-equivalents/:id',
  validate(equivalentParamSchema),
  asyncHandler(foodLibraryV2Controller.deleteEquivalent)
);

// ─── Food Details ───────────────────────────────────────────────────────────
router.get(
  '/foods/:id/details',
  validate(foodParamSchema),
  asyncHandler(foodLibraryV2Controller.getFoodDetails)
);

export default router;
