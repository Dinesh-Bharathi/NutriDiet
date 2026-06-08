import asyncHandler from '../../utils/asyncHandler.js';
import { vaultService } from './vault.service.js';
import { z } from 'zod';

const createVaultSchema = z.object({
  assetId: z.string().min(1),
  category: z.enum(['BLOODWORK', 'CONSENT_FORM', 'DIET_HISTORY', 'LIFESTYLE_FITNESS', 'GENERAL']),
  description: z.string().max(500).optional().nullable(),
});

const listVaultQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  type: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
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
    const { search, category, type, page, limit } = listVaultQuerySchema.parse(req.query);
    
    const results = await vaultService.getClientVault(clientId, tenantId, { 
      search, 
      category, 
      type,
      page,
      limit
    });
    
    if (page && limit) {
      const { documents, total } = results;
      const totalPages = Math.ceil(total / limit);
      return res.status(200).json({
        success: true,
        message: 'Vault documents retrieved',
        data: { 
          vaultDocuments: documents,
          pagination: {
            total,
            page,
            limit,
            totalPages
          }
        }
      });
    }
    
    return res.status(200).json({
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
