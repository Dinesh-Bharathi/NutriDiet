// src/modules/storage/storage.service.js
import fs from "fs";
import { ApiError } from "../../utils/ApiError.js";
import storageProvider from "../../lib/storage/index.js";
import * as storageRepository from "./storage.repository.js";
import { ALLOWED_MIME_TYPES, FILE_VISIBILITY, FILE_ENTITY_TYPE } from "./storage.constants.js";
import prisma from "../../config/database.js";
import logger from "../../utils/logger.js";

/**
 * Validate that the requested entity exists and belongs to the tenant.
 */
async function validateEntityOwnership(tenantId, entityType, entityId) {
  let entityExists = false;

  switch (entityType) {
    case FILE_ENTITY_TYPE.TENANT: {
      entityExists = (tenantId === entityId);
      break;
    }
    case FILE_ENTITY_TYPE.USER: {
      const user = await prisma.user.findFirst({ where: { id: entityId, tenantId, deletedAt: null } });
      entityExists = !!user;
      break;
    }
    case FILE_ENTITY_TYPE.CLIENT: {
      const client = await prisma.client.findFirst({ where: { id: entityId, tenantId, deletedAt: null } });
      entityExists = !!client;
      break;
    }
    case FILE_ENTITY_TYPE.ASSESSMENT: {
      const assessment = await prisma.assessment.findFirst({ where: { id: entityId, tenantId, deletedAt: null } });
      entityExists = !!assessment;
      break;
    }
    case FILE_ENTITY_TYPE.DIET_PLAN: {
      const dietPlan = await prisma.dietPlan.findFirst({ where: { id: entityId, tenantId, deletedAt: null } });
      entityExists = !!dietPlan;
      break;
    }
    // For future modules (Package, Program, etc.), we bypass strict db check if tables don't exist yet, 
    // or we throw an error if they shouldn't be used yet. For now, we allow them to pass to support Phase 10.
    default:
      entityExists = true; 
      break;
  }

  if (!entityExists) {
    throw new ApiError(`Entity not found or does not belong to tenant: ${entityType} ${entityId}`, 404);
  }
}

/**
 * Determine the resource type based on mimetype.
 */
function getResourceTypeFromMime(mimeType) {
  if (ALLOWED_MIME_TYPES.image.includes(mimeType)) return "image";
  if (ALLOWED_MIME_TYPES.video.includes(mimeType)) return "video";
  if (ALLOWED_MIME_TYPES.document.includes(mimeType)) return "raw";
  return null;
}

/**
 * Handle asset upload.
 */
export async function uploadAsset(tenantId, userId, file, entityType, entityId, visibility) {
  if (!file) throw new ApiError("No file provided", 400);

  // 1. Validate Mime Type & Determine Resource Type
  const resourceType = getResourceTypeFromMime(file.mimetype);
  if (!resourceType) {
    // Clean up temp file
    fs.unlink(file.path, () => {});
    throw new ApiError(`Unsupported file type: ${file.mimetype}`, 400);
  }

  try {
    // 2. Validate Entity Ownership
    await validateEntityOwnership(tenantId, entityType, entityId);

    // 3. Build Deterministic Folder Path
    // nutri-diet/tenants/{tenantId}/{entityType}/{entityId}
    const folder = `nutri-diet/tenants/${tenantId}/${entityType.toUpperCase()}/${entityId}`;

    // 4. Cloudinary Delivery Type
    let deliveryType = "upload"; // default PUBLIC
    if (visibility === FILE_VISIBILITY.PROTECTED || visibility === FILE_VISIBILITY.PRIVATE) {
      deliveryType = "authenticated";
    }

    // 5. Upload to Cloudflare R2
    const uploadResult = await storageProvider.upload(file, {
      folder,
      visibility,
    });

    // Clean up temp file
    fs.unlink(file.path, () => {});

    const extension = file.originalname.split('.').pop() || "";

    // 6. Save FileAsset Record
    const assetData = {
      tenantId,
      entityType,
      entityId,
      folder,
      publicId: uploadResult.public_id,
      assetId: uploadResult.asset_id,
      resourceType,
      fileName: uploadResult.original_filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      extension: extension.toLowerCase(),
      fileSize: uploadResult.bytes,
      url: uploadResult.url,
      secureUrl: uploadResult.secure_url,
      uploadedBy: userId,
      visibility,
      status: "ACTIVE",
    };

    const fileAsset = await storageRepository.createFileAsset(assetData);
    
    // Audit Event (Optional for now, depending on system logger configuration)
    logger.info("File uploaded successfully", { tenantId, userId, fileAssetId: fileAsset.id });

    return fileAsset;
  } catch (error) {
    // Clean up temp file on error
    fs.unlink(file.path, () => {});
    throw error;
  }
}

/**
 * Handle asset retrieval.
 */
export async function getAsset(assetId, tenantId) {
  const asset = await storageRepository.getFileAssetById(assetId, tenantId);
  if (!asset) throw new ApiError("Asset not found", 404);
  return asset;
}

/**
 * Handle asset list.
 */
export async function listAssets(tenantId, filters) {
  return storageRepository.listFileAssets(tenantId, filters);
}

/**
 * Generate Signed Access/Download URL.
 */
export async function getAssetAccessUrl(assetId, tenantId, userId, action = "VIEW") {
  const asset = await storageRepository.getFileAssetById(assetId, tenantId);
  if (!asset) throw new ApiError("Asset not found", 404);

  let accessUrl = asset.secureUrl;

  if (asset.visibility === FILE_VISIBILITY.PROTECTED || asset.visibility === FILE_VISIBILITY.PRIVATE) {
    // Generate signed URL
    accessUrl = await storageProvider.getPublicUrl(asset.publicId, { signed: true });
  }

  // Generate audit trail
  logger.info(`Asset Access Audit: ${action}`, {
    tenantId,
    userId,
    fileAssetId: asset.id,
    action,
    timestamp: new Date().toISOString(),
  });

  return { accessUrl, asset };
}

/**
 * Handle asset deletion.
 */
export async function deleteAsset(assetId, tenantId, userId) {
  const asset = await storageRepository.getFileAssetById(assetId, tenantId);
  if (!asset) throw new ApiError("Asset not found", 404);

  // 1. Delete from Cloudflare R2
  await storageProvider.delete(asset.publicId);

  // 2. Soft delete from database
  await storageRepository.softDeleteFileAsset(assetId, tenantId);

  // 3. Audit trail
  logger.info("Asset Delete Audit", {
    tenantId,
    userId,
    fileAssetId: asset.id,
    action: "DELETE",
    timestamp: new Date().toISOString(),
  });

  return true;
}
