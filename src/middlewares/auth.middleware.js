// src/middlewares/auth.middleware.js
// ─────────────────────────────────────────────────────────────────────────────
// JWT authentication middleware.
//
// Responsibilities:
//  1. Extract the Bearer token from the Authorization header.
//  2. Verify and decode the JWT (throws on expiry / tampering).
//  3. Check the Redis jti blocklist (populated by logout).
//  4. Attach the decoded payload to req.user.
//  5. NEVER trust tenant_id from the request body/query — it is always taken
//     from the verified JWT payload.
//
// This middleware does NOT check roles. Role checking is handled separately
// by rbac.middleware.js so that auth and authorisation remain decoupled.
// ─────────────────────────────────────────────────────────────────────────────
import jwtPkg from "jsonwebtoken";
const { verify } = jwtPkg;
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import { TOKEN_TYPES } from "../config/constants.js";
import getRedisClient from "../lib/redis.js";
import { REDIS_KEY_PREFIX } from "../modules/auth/auth.constants.js";

/**
 * Extracts the Bearer token from the Authorization header.
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim() || null;
}

/**
 * Verifies an access JWT, checks the Redis jti blocklist, then populates req.user.
 *
 * Flow:
 *  1. Verify JWT signature + expiry
 *  2. Confirm tokenType === 'access'
 *  3. Check Redis blocklist by jti (set on logout — immediate invalidation)
 *  4. Populate req.user
 *
 * req.user shape:
 * {
 *   userId:    string,  ← from JWT sub claim
 *   tenantId:  string,  ← ONLY authoritative source, from signed token
 *   role:      string,
 *   email:     string,
 *   tokenType: 'access',
 *   jti:       string
 * }
 *
 * @type {import('express').RequestHandler}
 */
export async function authenticate(req, _res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return next(ApiError.unauthorized("Authentication token is missing"));
  }

  try {
    const decoded = verify(token, env.JWT_ACCESS_SECRET);

    if (decoded.tokenType !== TOKEN_TYPES.ACCESS) {
      return next(ApiError.unauthorized("Invalid token type"));
    }

    console.log("decoded", decoded);

    // ── Redis jti blocklist check ─────────────────────────────────────────────
    // logout() stores the jti in Redis with TTL = token's remaining lifetime.
    // This gives us immediate access token invalidation without a DB query.
    if (decoded.jti) {
      const redis = getRedisClient();
      const blocklisted = await redis.exists(
        REDIS_KEY_PREFIX.ACCESS_TOKEN_BLOCKLIST + decoded.jti,
      );

      console.log("blocklisted", blocklisted);
      if (blocklisted) {
        return next(
          ApiError.unauthorized("Token has been revoked. Please log in again."),
        );
      }
    }

    // Attach verified, server-signed user context — never user-supplied data.
    // JWT payload uses `sub` per RFC 7519; mapped to userId for downstream clarity.
    req.user = {
      userId: decoded.sub, // sub = userId (RFC 7519 standard)
      tenantId: decoded.tenantId, // Authoritative tenant context from signed token
      role: decoded.role,
      email: decoded.email,
      tokenType: decoded.tokenType,
      jti: decoded.jti,
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
        userId: decoded.sub,
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
