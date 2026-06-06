import { vaultRepository } from './vault.repository.js';
import { deleteAsset } from '../storage/storage.service.js';
import { ApiError } from '../../utils/ApiError.js';

export const vaultService = {
  createDocument: async (payload, { tenantId, clientId }) => {
    const document = await vaultRepository.create({
      clientId,
      assetId: payload.assetId,
      category: payload.category,
      description: payload.description
    }, tenantId);
    
    return document;
  },

  getClientVault: async (clientId, tenantId, filters = {}) => {
    return vaultRepository.findByClientId(clientId, tenantId, filters);
  },

  deleteDocument: async (documentId, tenantId, userId) => {
    // 1. Retrieve document to get assetId before soft deleting
    const document = await vaultRepository.findById(documentId, tenantId);
    if (!document) {
      throw new ApiError(404, 'Document not found or unauthorized');
    }

    // 2. Soft delete the Vault relational record
    const result = await vaultRepository.softDelete(documentId, tenantId);
    if (result.count === 0) {
      throw new ApiError(404, 'Document not found or unauthorized');
    }

    // 3. Storage Foundation handles the actual FileAsset deletion and Cloudinary hard delete
    await deleteAsset(document.assetId, tenantId, userId);

    return true;
  }
};
