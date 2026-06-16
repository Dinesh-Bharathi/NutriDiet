import logger from '../../utils/logger.js';
import env from '../../config/env.js';

/**
 * Log a structured WhatsApp diagnostic entry.
 *
 * @param {string} prefix - e.g. [WHATSAPP_SEND]
 * @param {object} fields - correlationId, messageId, metaMessageId, tenantId, error
 * @param {string} message - The diagnostic description
 * @param {string} [type='info'] - winston log level
 */
export function logWhatsApp(prefix, fields, message, type = 'info') {
  const { correlationId = 'N/A', messageId = 'N/A', metaMessageId = 'N/A', tenantId = 'N/A', error } = fields;
  const logMsg = `${prefix} correlationId=${correlationId} messageId=${messageId} metaMessageId=${metaMessageId} tenantId=${tenantId} - ${message}`;

  if (type === 'error') {
    logger.error(logMsg, error ? { error: error.message || error } : undefined);
  } else if (type === 'warn') {
    logger.warn(logMsg);
  } else if (type === 'debug') {
    logger.debug(logMsg);
  } else {
    logger.info(logMsg);
  }
}

/**
 * Log verbose request or response payload, gated by WHATSAPP_VERBOSE_LOGGING.
 * Safe-redacts access tokens, authorization headers, passwords, and secrets.
 *
 * @param {string} prefix - e.g. [WHATSAPP_META]
 * @param {object} fields - correlationId, messageId, metaMessageId, tenantId
 * @param {string} payloadName - Label for payload (e.g. 'Meta Request Payload')
 * @param {any} payload - The object or string to serialize and log
 */
export function logWhatsAppVerbose(prefix, fields, payloadName, payload) {
  if (!env.WHATSAPP_VERBOSE_LOGGING) return;
  const { correlationId = 'N/A', messageId = 'N/A', metaMessageId = 'N/A', tenantId = 'N/A' } = fields;

  let safePayload = null;
  try {
    if (payload && typeof payload === 'object') {
      safePayload = JSON.parse(JSON.stringify(payload));
      
      const sanitize = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === 'object') {
            sanitize(obj[key]);
          } else if (typeof obj[key] === 'string') {
            const lowerKey = key.toLowerCase();
            if (
              lowerKey.includes('token') ||
              lowerKey.includes('secret') ||
              lowerKey.includes('password') ||
              lowerKey.includes('authorization') ||
              lowerKey.includes('credential') ||
              lowerKey.includes('access_token')
            ) {
              obj[key] = '[REDACTED]';
            }
          }
        }
      };
      sanitize(safePayload);
    } else {
      safePayload = String(payload);
    }
  } catch (err) {
    safePayload = '[UNSERIALIZABLE PAYLOAD]';
  }

  const payloadStr = typeof safePayload === 'object' ? JSON.stringify(safePayload) : safePayload;
  const logMsg = `${prefix} correlationId=${correlationId} messageId=${messageId} metaMessageId=${metaMessageId} tenantId=${tenantId} - VERBOSE [${payloadName}]: ${payloadStr}`;
  logger.info(logMsg);
}
