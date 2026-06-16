import { MetaClient } from './meta-client.js';

export const metaValidator = {
  /**
   * Run validation sequence on the credentials.
   * Maps Meta API error codes/exceptions to standardized display errors.
   *
   * @param {object} credentials - { accessToken, phoneNumberId, wabaId, businessAccountId }
   * @returns {Promise<object>} { success: boolean, displayPhoneNumber?: string, verifiedName?: string, error?: string, errorCode?: string }
   */
  async validate(credentials) {
    const { accessToken, phoneNumberId, wabaId } = credentials;

    if (!accessToken) {
      return {
        success: false,
        error: 'Meta access token is invalid or expired.',
        errorCode: 'MISSING_TOKEN',
      };
    }

    const client = new MetaClient(accessToken);

    // Step 1: Validate Access Token
    try {
      await client.getMe();
    } catch (err) {
      const metaError = err.response?.data?.error;
      const code = metaError?.code || err.code || 'UNKNOWN';
      return {
        success: false,
        error: 'Meta access token is invalid or expired.',
        errorCode: String(code),
      };
    }

    // Step 2: Validate Phone Number ID
    let displayPhoneNumber = null;
    let verifiedName = null;
    if (phoneNumberId) {
      try {
        const phoneDetails = await client.getPhoneNumberDetails(phoneNumberId);
        displayPhoneNumber = phoneDetails.display_phone_number || null;
        verifiedName = phoneDetails.verified_name || null;
      } catch (err) {
        const metaError = err.response?.data?.error;
        const code = metaError?.code || err.code || 'UNKNOWN';
        if (metaError?.code === 190) {
          return {
            success: false,
            error: 'Meta access token is invalid or expired.',
            errorCode: '190',
          };
        }
        return {
          success: false,
          error: 'Phone Number ID could not be verified.',
          errorCode: String(code),
        };
      }
    }

    // Step 3: Validate WABA Account
    if (wabaId) {
      try {
        await client.getWabaDetails(wabaId);
      } catch (err) {
        const metaError = err.response?.data?.error;
        const code = metaError?.code || err.code || 'UNKNOWN';
        if (metaError?.code === 190) {
          return {
            success: false,
            error: 'Meta access token is invalid or expired.',
            errorCode: '190',
          };
        }
        return {
          success: false,
          error: 'WhatsApp Business Account could not be verified.',
          errorCode: String(code),
        };
      }
    }

    return {
      success: true,
      displayPhoneNumber,
      verifiedName,
    };
  }
};
