import asyncHandler from '../../utils/asyncHandler.js';
import { vaultService } from './vault.service.js';
import { z } from 'zod';

const createVaultSchema = z.object({
  assetId: z.string().min(1),
  category: z.enum(['BLOODWORK', 'CONSENT_FORM', 'DIET_HISTORY', 'LIFESTYLE_FITNESS', 'GENERAL']),
  description: z.string().max(500).optional().nullable(),
});

export const vaultController = {
  create: asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId; // Verified JWT extraction
    const { clientId } = req.params;
    const dto = createVaultSchema.parse(req.body);
    
    const result = await vaultService.createDocument(dto, { tenantId, clientId });
    
    res.status(201).json({
      success: true,
      message: 'Document added to vault successfully',
      data: { vaultDocument: result }
    });
  }),

  list: asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { clientId } = req.params;
    const { search, category } = req.query;
    
    const results = await vaultService.getClientVault(clientId, tenantId, { search, category });
    
    res.status(200).json({
      success: true,
      message: 'Vault documents retrieved',
      data: { vaultDocuments: results }
    });
  }),

  delete: asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { documentId } = req.params;
    
    await vaultService.deleteDocument(documentId, tenantId, req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      data: null
    });
  })
};
