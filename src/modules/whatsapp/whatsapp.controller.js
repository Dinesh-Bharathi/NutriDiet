import { whatsappService } from './whatsapp.service.js';
import { whatsappConnectionUpsertSchema } from './whatsapp.validation.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const whatsappController = {
  /**
   * GET /api/v1/whatsapp/connection
   * Returns current WhatsApp connection details for the tenant.
   */
  async getConnection(req, res) {
    const tenantId = req.user.tenantId;
    const connection = await whatsappService.getConnection(tenantId);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'WhatsApp connection retrieved successfully',
      connection
    );
  },

  /**
   * PUT /api/v1/whatsapp/connection
   * Creates or updates the WhatsApp connection configuration.
   */
  async upsertConnection(req, res) {
    const tenantId = req.user.tenantId;
    const validatedData = whatsappConnectionUpsertSchema.parse(req.body);
    const connection = await whatsappService.upsertConnection(tenantId, validatedData);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'WhatsApp connection saved successfully',
      connection
    );
  },

  /**
   * POST /api/v1/whatsapp/disconnect
   * Disconnects WhatsApp connection (marks as DISCONNECTED and nullifies access token).
   */
  async disconnectConnection(req, res) {
    const tenantId = req.user.tenantId;
    const connection = await whatsappService.disconnect(tenantId);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'WhatsApp connection disconnected successfully',
      connection
    );
  },

  /**
   * POST /api/v1/whatsapp/validate
   * Manually checks credentials, updates status and records health.
   */
  async validateConnection(req, res) {
    const tenantId = req.user.tenantId;
    const connection = await whatsappService.validateConnection(tenantId);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'WhatsApp connection validated successfully',
      connection
    );
  },
};
