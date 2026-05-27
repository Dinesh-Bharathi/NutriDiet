// src/middlewares/auth.middleware.js
// ─────────────────────────────────────────────────────────────────────────────
// JWT authentication middleware.
//
// Responsibilities:
//  1. Extract the Bearer token from the Authorization header.
//  2. Verify and decode the JWT (throws on expiry / tampering).
//  3. Attach the decoded payload to req.user.
//  4. NEVER trust tenant_id from the request body/query — it is always taken
//     from the verified JWT payload.
//
// This middleware does NOT check roles. Role checking is handled separately
// by rbac.middleware.js so that auth and authorisation remain decoupled.
// ─────────────────────────────────────────────────────────────────────────────
import jwtPkg from 'jsonwebtoken';
const { verify } = jwtPkg;
import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';
import { TOKEN_TYPES } from '../config/constants.js';

/**
 * Extracts the Bearer token from the Authorization header.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
}

/**
 * Verifies an access JWT and attaches decoded payload to req.user.
 *
 * req.user shape:
 * {
 *   userId: string,
 *   tenantId: string,   ← ONLY source of truth for tenant context
 *   role: string,
 *   email: string,
 *   tokenType: 'access'
 * }
 *
 * @type {import('express').RequestHandler}
 */
export function authenticate(req, _res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return next(ApiError.unauthorized('Authentication token is missing'));
  }

  try {
    const decoded = verify(token, env.JWT_ACCESS_SECRET);

    if (decoded.tokenType !== TOKEN_TYPES.ACCESS) {
      return next(ApiError.unauthorized('Invalid token type'));
    }

    // Attach verified, server-signed user context — never user-supplied data
    req.user = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,  // Authoritative tenant context
      role: decoded.role,
      email: decoded.email,
      tokenType: decoded.tokenType,
    };

    return next();
  } catch (err) {
    // TokenExpiredError and JsonWebTokenError are handled by error.middleware.js
    return next(err);
  }
}

/**
 * Optional authentication — populates req.user if a valid token is present,
 * but does not reject the request if no token is provided.
 * Useful for routes that serve both authenticated and anonymous users.
 *
 * @type {import('express').RequestHandler}
 */
export function optionalAuthenticate(req, _res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = verify(token, env.JWT_ACCESS_SECRET);
    if (decoded.tokenType === TOKEN_TYPES.ACCESS) {
      req.user = {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        role: decoded.role,
        email: decoded.email,
        tokenType: decoded.tokenType,
      };
    }
  } catch {
    // Silently ignore invalid tokens for optional routes
  }

  return next();
}
