// src/modules/storage/storage.controller.js
import asyncHandler from "../../utils/asyncHandler.js";
import * as storageService from "./storage.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { sendSuccess } from "../../utils/ApiResponse.js";

/**
 * Upload a new asset
 * POST /api/v1/storage/upload
 */
export const uploadAsset = asyncHandler(async (req, res) => {
  const { entityType, entityId, visibility } = req.body;
  const tenantId = req.tenant.id;
  const userId = req.user.userId;
  const file = req.file;

  if (!file) {
    throw new ApiError("File is required", 400);
  }

  const asset = await storageService.uploadAsset(
    tenantId,
    userId,
    file,
    entityType,
    entityId,
    visibility,
  );

  return sendSuccess(res, 201, "Asset uploaded successfully", asset);
});

/**
 * List assets
 * GET /api/v1/storage
 */
export const listAssets = asyncHandler(async (req, res) => {
  const tenantId = req.tenant.id;
  const { entityType, entityId, resourceType } = req.query;

  const assets = await storageService.listAssets(tenantId, {
    entityType,
    entityId,
    resourceType,
  });

  return sendSuccess(res, 200, "Assets retrieved successfully", { assets });
});

/**
 * Get specific asset metadata
 * GET /api/v1/storage/:id
 */
export const getAsset = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant.id;

  const asset = await storageService.getAsset(id, tenantId);

  return sendSuccess(res, 200, "Asset retrieved successfully", asset);
});

/**
 * Generate signed access/download URL
 * GET /api/v1/storage/:id/access
 * GET /api/v1/storage/:id/download
 */
export const getAssetAccessUrl = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant.id;
  const userId = req.user.userId;

  // Determine if this is a download action based on URL path
  const action = req.path.includes("download") ? "DOWNLOAD" : "VIEW";

  const result = await storageService.getAssetAccessUrl(
    id,
    tenantId,
    userId,
    action,
  );

  return sendSuccess(res, 200, "Access URL generated", {
    url: result.accessUrl,
    asset: {
      id: result.asset.id,
      fileName: result.asset.fileName,
      mimeType: result.asset.mimeType,
    },
  });
});

/**
 * Delete an asset
 * DELETE /api/v1/storage/:id
 */
export const deleteAsset = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant.id;
  const userId = req.user.userId;

  await storageService.deleteAsset(id, tenantId, userId);

  return sendSuccess(res, 200, "Asset deleted successfully");
});
