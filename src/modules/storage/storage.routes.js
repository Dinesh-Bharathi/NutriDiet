// src/modules/storage/storage.routes.js
import { Router } from "express";
import multer from "multer";
import os from "os";
import { validate } from "../../middlewares/validate.middleware.js";
import * as storageController from "./storage.controller.js";
import { uploadAssetSchema, getAssetsSchema } from "./storage.validation.js";
import { MAX_FILE_SIZE_BYTES } from "./storage.constants.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { resolveTenant } from "../../middlewares/tenant.middleware.js";

const router = Router();

// Configure multer to use system temp directory
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

// All storage routes require authentication and tenant context
router.use(authenticate);
router.use(resolveTenant);

// Upload a new asset
router.post(
  "/upload",
  upload.single("file"),
  validate(uploadAssetSchema),
  storageController.uploadAsset,
);

// List assets
router.get("/", validate(getAssetsSchema), storageController.listAssets);

// Get specific asset metadata
router.get("/:id", storageController.getAsset);

// Generate signed download/access URL
router.get("/:id/access", storageController.getAssetAccessUrl);
router.get(
  "/:id/download",
  storageController.getAssetAccessUrl, // Handled by the same logic, or can be aliased
);

// Delete an asset
router.delete("/:id", storageController.deleteAsset);

export default router;
