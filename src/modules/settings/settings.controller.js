// src/modules/settings/settings.controller.js
import { settingsService } from './settings.service.js';
import { tenantSettingsSchema } from './settings.validation.js';
import { pdfTemplateSchema } from './pdf-template.validation.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export const settingsController = {
  /**
   * GET /api/v1/settings/localization-options
   * Returns supported countries, currencies, timezones, and locales.
   */
  async getLocalizationOptions(req, res) {
    const options = settingsService.getLocalizationOptions();
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Localization options retrieved successfully',
      options
    );
  },

  /**
   * GET /api/v1/settings/tenant
   * Returns settings configurations for the current tenant.
   */
  async getTenantSettings(req, res) {
    const tenantId = req.user.tenantId;
    const settings = await settingsService.getTenantSettings(tenantId);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Tenant settings retrieved successfully',
      settings
    );
  },

  /**
   * PATCH /api/v1/settings/tenant
   * Updates settings configurations for the current tenant.
   */
  async updateTenantSettings(req, res) {
    const tenantId = req.user.tenantId;
    const validatedData = tenantSettingsSchema.parse(req.body);
    
    const settings = await settingsService.updateTenantSettings(tenantId, validatedData);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'Tenant settings updated successfully',
      settings
    );
  },

  /**
   * GET /api/v1/settings/pdf-template
   * Returns PDF template configurations for the current tenant.
   */
  async getPdfTemplateConfig(req, res) {
    const tenantId = req.user.tenantId;
    const config = await settingsService.getPdfTemplateConfig(tenantId);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'PDF template configuration retrieved successfully',
      config
    );
  },

  /**
   * PUT /api/v1/settings/pdf-template
   * Updates PDF template configurations for the current tenant.
   */
  async updatePdfTemplateConfig(req, res) {
    const tenantId = req.user.tenantId;
    const validatedData = pdfTemplateSchema.parse(req.body);
    
    const config = await settingsService.updatePdfTemplateConfig(tenantId, validatedData);
    
    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      'PDF template configuration updated successfully',
      config
    );
  },
};
