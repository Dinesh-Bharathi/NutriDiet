// src/modules/auth/auth.tokens.js
// JWT generation/verification + refresh token crypto utilities.
// jsonwebtoken is CommonJS — must be imported as default.
import jwtPkg from 'jsonwebtoken';
import crypto from 'node:crypto';
import env from '../../config/env.js';
import { TOKEN_TYPES } from '../../config/constants.js';

const { sign, verify, decode } = jwtPkg;

const JWT_ISSUER = 'nutri-diet-api';
const JWT_AUDIENCE = 'nutri-diet-client';

// ── Access Token ─────────────────────────────────────────────────────────────

/**
 * Generates a signed access JWT.
 *
 * Payload follows RFC 7519: `sub` holds the userId.
 * tenantId is embedded so repositories can scope queries without an extra DB hit.
 *
 * @param {{ userId: string, tenantId: string, role: string, email: string }} payload
 * @returns {string}
 */
export function generateAccessToken({ userId, tenantId, role, email }) {
  return sign(
    {
      sub:       userId,
      jti:       crypto.randomUUID(),
      tenantId,
      role,
      email,
      tokenType: TOKEN_TYPES.ACCESS,
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      issuer:    JWT_ISSUER,
      audience:  JWT_AUDIENCE,
    },
  );
}

/**
 * Verifies an access JWT. Throws TokenExpiredError / JsonWebTokenError on failure.
 * These are caught and mapped by error.middleware.js.
 *
 * @param {string} token
 * @returns {object} decoded payload
 */
export function verifyAccessToken(token) {
  return verify(token, env.JWT_ACCESS_SECRET, {
    issuer:   JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/**
 * Decodes an access JWT without verification (used for logout).
 *
 * @param {string} token
 * @returns {object|null}
 */
export function decodeAccessToken(token) {
  return decode(token);
}

// ── Refresh Token ─────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure random refresh token string.
 * 64 bytes = 128 hex chars — sufficient entropy to prevent brute force.
 *
 * @returns {string} raw hex token (sent to client)
 */
export function generateRawRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Hashes a raw refresh token with SHA-256 for safe DB storage.
 * SHA-256 is appropriate here because the raw token already has 512 bits
 * of entropy — unlike passwords which need a slow KDF (argon2).
 *
 * @param {string} rawToken
 * @returns {string} hex-encoded SHA-256 hash
 */
export function hashRefreshToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
