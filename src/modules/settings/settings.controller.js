// src/modules/settings/settings.controller.js
import { settingsService } from './settings.service.js';
import { tenantSettingsSchema } from './settings.validation.js';
import { pdfTemplateSchema } from './pdf-template.validation.js';
import { sendSuccess } from '../../utils/ApiResponse.js';
import { HTTP_STATUS } from '../../config/constants.js';

export function decodeHtmlEntities(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function recursiveDecodeHtmlEntities(val) {
  if (typeof val === 'string') {
    return decodeHtmlEntities(val);
  }
  if (Array.isArray(val)) {
    return val.map(recursiveDecodeHtmlEntities);
  }
  if (val !== null && typeof val === 'object') {
    const res = {};
    for (const key of Object.keys(val)) {
      res[key] = recursiveDecodeHtmlEntities(val[key]);
    }
    return res;
  }
  return val;
}

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
    
    // Targeted decoding to undo xss-clean HTML-encoding on template and URL fields
    if (req.body.headerContent) {
      req.body.headerContent = recursiveDecodeHtmlEntities(req.body.headerContent);
    }
    if (req.body.footerContent) {
      req.body.footerContent = recursiveDecodeHtmlEntities(req.body.footerContent);
    }
    if (typeof req.body.logoUrl === 'string') {
      req.body.logoUrl = decodeHtmlEntities(req.body.logoUrl);
    }
    if (typeof req.body.watermarkUrl === 'string') {
      req.body.watermarkUrl = decodeHtmlEntities(req.body.watermarkUrl);
    }

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
