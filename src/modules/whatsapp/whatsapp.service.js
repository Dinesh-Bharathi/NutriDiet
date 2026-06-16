import crypto from 'crypto';
import { whatsappRepository } from './whatsapp.repository.js';
import { metaValidator } from './providers/meta/meta-validator.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import ApiError from '../../utils/ApiError.js';

/**
 * Generate SHA-256 fingerprint for credentials to prevent duplicate checks.
 */
function generateFingerprint(credentials) {
  const raw = `${credentials.accessToken || ''}:${credentials.wabaId || ''}:${credentials.phoneNumberId || ''}:${credentials.businessAccountId || ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export const whatsappService = {
  /**
   * Get WhatsApp connection for a tenant.
   * Scopes to tenant and maps to WhatsAppConnectionResponse DTO.
   *
   * @param {string} tenantId
   * @returns {Promise<object>}
   */
  async getConnection(tenantId) {
    const connection = await whatsappRepository.findByTenantId(tenantId);
    if (!connection) {
      return {
        status: 'NOT_CONFIGURED',
        provider: 'WHATSAPP',
        tokenType: null,
        scope: null,
        metaBusinessId: null,
        wabaId: null,
        phoneNumberId: null,
        businessAccountId: null,
        displayPhoneNumber: null,
        verifiedName: null,
        webhookVerified: false,
        connectedAt: null,
        lastSyncAt: null,
        lastValidatedAt: null,
        lastSuccessfulValidationAt: null,
        lastError: null,
        lastErrorCode: null,
        lastErrorAt: null,
        validationAttempts: 0,
      };
    }
    return this.toResponseDTO(connection);
  },

  /**
   * Upsert WhatsApp connection for a tenant.
   * Matches WhatsAppConnectionUpdateRequest DTO, encrypts tokens, and triggers synchronous validation.
   *
   * @param {string} tenantId
   * @param {object} payload
   * @returns {Promise<object>}
   */
  async upsertConnection(tenantId, payload) {
    const existing = await whatsappRepository.findByTenantId(tenantId);
    
    let encryptedAccessToken = existing?.accessToken || null;
    const connectedAt = existing?.connectedAt || null;
    
    // Rule: If status is DISCONNECTED and token is empty, block submit and throw validation error
    if (existing?.status === 'DISCONNECTED' && !payload.accessToken && !existing.accessToken) {
      throw ApiError.badRequest('Meta Access Token is required to reconnect this WhatsApp account.');
    }
    
    if (payload.accessToken) {
      encryptedAccessToken = encrypt(payload.accessToken);
    }
    
    // Generate fingerprint to see if configurations have changed
    let decryptedToken = payload.accessToken || null;
    if (!decryptedToken && encryptedAccessToken) {
      try {
        decryptedToken = decrypt(encryptedAccessToken);
      } catch (err) {
        // Suppress
      }
    }
    
    const fingerprint = generateFingerprint({
      accessToken: decryptedToken,
      wabaId: payload.wabaId,
      phoneNumberId: payload.phoneNumberId,
      businessAccountId: payload.businessAccountId,
    });
    
    // Save configurations with PENDING status first
    const updateData = {
      wabaId: payload.wabaId,
      phoneNumberId: payload.phoneNumberId,
      businessAccountId: payload.businessAccountId,
      displayPhoneNumber: payload.displayPhoneNumber || existing?.displayPhoneNumber || null,
      verifiedName: payload.verifiedName || existing?.verifiedName || null,
      accessToken: encryptedAccessToken,
      status: 'PENDING',
      connectedAt,
      credentialFingerprint: fingerprint,
    };
    
    if (!existing) {
      updateData.provider = 'WHATSAPP';
    }

    const saved = await whatsappRepository.upsert(tenantId, updateData);

    // If fingerprint is identical and status was already CONNECTed, we can bypass validation check
    if (existing && existing.credentialFingerprint === fingerprint && existing.status === 'CONNECTED') {
      const bypassed = await whatsappRepository.update(tenantId, {
        status: 'CONNECTED',
        lastValidatedAt: new Date(),
      });
      return this.toResponseDTO(bypassed);
    }

    // Run synchronous validation
    return this.validateConnection(tenantId, {
      accessToken: decryptedToken,
      wabaId: saved.wabaId,
      phoneNumberId: saved.phoneNumberId,
      businessAccountId: saved.businessAccountId,
    });
  },

  /**
   * Execute Meta API credential validation sequence and persist connection health updates.
   *
   * @param {string} tenantId
   * @param {object} credentials
   * @returns {Promise<object>}
   */
  async validateConnection(tenantId, credentials) {
    const existing = await whatsappRepository.findByTenantId(tenantId);
    if (!existing) {
      throw ApiError.notFound('No WhatsApp configuration exists to validate.');
    }

    const attempts = (existing.validationAttempts || 0) + 1;
    
    // Fetch decrypted token if not supplied
    let decryptedToken = credentials?.accessToken;
    if (!decryptedToken && existing.accessToken) {
      try {
        decryptedToken = decrypt(existing.accessToken);
      } catch (err) {
        // Suppress
      }
    }

    const checkParams = {
      accessToken: decryptedToken,
      wabaId: credentials?.wabaId || existing.wabaId,
      phoneNumberId: credentials?.phoneNumberId || existing.phoneNumberId,
      businessAccountId: credentials?.businessAccountId || existing.businessAccountId,
    };

    const validationResult = await metaValidator.validate(checkParams);

    const updateData = {
      lastValidatedAt: new Date(),
      validationAttempts: attempts,
    };

    if (validationResult.success) {
      updateData.status = 'CONNECTED';
      updateData.lastSuccessfulValidationAt = new Date();
      updateData.lastError = null;
      updateData.lastErrorCode = null;
      updateData.connectedAt = existing.connectedAt || new Date();
      
      // Meta is source of truth: overwrite verifiedName and displayPhoneNumber
      if (validationResult.displayPhoneNumber) {
        updateData.displayPhoneNumber = validationResult.displayPhoneNumber;
      }
      if (validationResult.verifiedName) {
        updateData.verifiedName = validationResult.verifiedName;
      }
    } else {
      updateData.status = 'ERROR';
      updateData.lastError = validationResult.error;
      updateData.lastErrorCode = validationResult.errorCode;
      updateData.lastErrorAt = new Date();
    }

    const updated = await whatsappRepository.update(tenantId, updateData);
    return this.toResponseDTO(updated);
  },

  /**
   * Disconnect WhatsApp connection for a tenant.
   *
   * @param {string} tenantId
   * @returns {Promise<object>}
   */
  async disconnect(tenantId) {
    const existing = await whatsappRepository.findByTenantId(tenantId);
    if (!existing) {
      throw ApiError.notFound('No WhatsApp connection found to disconnect');
    }
    
    const updateData = {
      status: 'DISCONNECTED',
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      credentialFingerprint: null,
    };
    
    const updated = await whatsappRepository.update(tenantId, updateData);
    return this.toResponseDTO(updated);
  },

  /**
   * Map database model to WhatsAppConnectionResponse DTO.
   * Strips out database ids, tenant ids, access tokens, and refresh tokens.
   *
   * @param {object} model
   * @returns {object}
   */
  toResponseDTO(model) {
    if (!model) return null;
    
    return {
      status: model.status,
      provider: model.provider || 'WHATSAPP',
      tokenType: model.tokenType || null,
      scope: model.scope || null,
      metaBusinessId: model.metaBusinessId || null,
      wabaId: model.wabaId || null,
      phoneNumberId: model.phoneNumberId || null,
      businessAccountId: model.businessAccountId || null,
      displayPhoneNumber: model.displayPhoneNumber || null,
      verifiedName: model.verifiedName || null,
      webhookVerified: model.webhookVerified,
      connectedAt: model.connectedAt ? model.connectedAt.toISOString() : null,
      lastSyncAt: model.lastSyncAt ? model.lastSyncAt.toISOString() : null,
      lastValidatedAt: model.lastValidatedAt ? model.lastValidatedAt.toISOString() : null,
      lastSuccessfulValidationAt: model.lastSuccessfulValidationAt ? model.lastSuccessfulValidationAt.toISOString() : null,
      lastError: model.lastError || null,
      lastErrorCode: model.lastErrorCode || null,
      lastErrorAt: model.lastErrorAt ? model.lastErrorAt.toISOString() : null,
      validationAttempts: model.validationAttempts || 0,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
    };
  },
};
