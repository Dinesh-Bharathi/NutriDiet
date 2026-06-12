// src/utils/audit-logger.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralized audit logging utility.
// Standardizes the format of all security-sensitive events.
// ─────────────────────────────────────────────────────────────────────────────
import logger from './logger.js';

export const auditLogger = {
  /**
   * Logs a structured security event.
   *
   * @param {import('express').Request} req - The current express request (for actor & context parsing)
   * @param {object} params
   * @param {string} params.event - Event type, e.g. 'USER_CREATED', 'USER_ROLE_CHANGED'
   * @param {string} params.targetUserId - ID of the user who is the target of the action
   * @param {string} [params.status='success'] - 'success' or 'failure'
   * @param {object} [params.metadata={}] - Key-value pair of extra audit trail payload (e.g. previousValue, newValue)
   */
  logSecurityEvent(req, { event, targetUserId, status = 'success', metadata = {} }) {
    logger.info(`Security Audit Event: ${event}`, {
      timestamp: new Date().toISOString(),
      event,
      actor: req.user ? {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
      } : 'system',
      tenantId: req.user?.tenantId || 'unknown',
      targetUserId,
      status,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null,
      metadata,
    });
  }
};
