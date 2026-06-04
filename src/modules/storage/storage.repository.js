// src/modules/storage/storage.repository.js
import prisma from "../../config/database.js";

/**
 * Create a new file asset record.
 */
export async function createFileAsset(data) {
  return prisma.fileAsset.create({
    data,
  });
}

/**
 * Find a file asset by ID and Tenant ID.
 */
export async function getFileAssetById(id, tenantId) {
  return prisma.fileAsset.findFirst({
    where: {
      id,
      tenantId,
      deletedAt: null,
    },
  });
}

/**
 * List file assets with filters.
 */
export async function listFileAssets(tenantId, filters = {}) {
  const where = {
    tenantId,
    deletedAt: null,
  };

  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.resourceType) where.resourceType = filters.resourceType;
  if (filters.visibility) where.visibility = filters.visibility;

  return prisma.fileAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Soft delete a file asset.
 */
export async function softDeleteFileAsset(id, tenantId) {
  return prisma.fileAsset.updateMany({
    where: {
      id,
      tenantId,
    },
    data: {
      deletedAt: new Date(),
      status: "DELETED",
    },
  });
}

/**
 * Update an asset's metadata or status.
 */
export async function updateFileAsset(id, tenantId, data) {
  return prisma.fileAsset.updateMany({
    where: {
      id,
      tenantId,
    },
    data,
  });
}
