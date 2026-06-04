// src/modules/auth/auth.service.js
// Business logic for authentication and session management.
// No Express imports — pure domain logic that can be unit-tested in isolation.
import argon2 from "argon2";
import { authRepository } from "./auth.repository.js";
import {
  generateAccessToken,
  generateRawRefreshToken,
  hashRefreshToken,
  decodeAccessToken,
} from "./auth.tokens.js";
import { TOKEN_EXPIRY_MS, REDIS_KEY_PREFIX } from "./auth.constants.js";
import ApiError from "../../utils/ApiError.js";
import logger from "../../utils/logger.js";
import { TENANT_STATUS, USER_STATUS } from "../../config/constants.js";
import getRedisClient, { isRedisAvailable } from "../../lib/redis.js";

// Argon2id parameters — OWASP recommended minimums for production
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
};

export const authService = {
  // ── Register ─────────────────────────────────────────────────────────────────

  /**
   * Registers a new tenant + OWNER user in a single transaction.
   *
   * @param {object} dto  - Validated register payload
   * @param {object} meta - { ipAddress, userAgent }
   */
  async register(dto, meta) {
    // 1. Guard: slug must be globally unique
    const slugTaken = await authRepository.tenantSlugExists(dto.tenantSlug);
    if (slugTaken) {
      throw ApiError.conflict(
        "This organisation URL is already taken. Please choose a different slug.",
      );
    }

    // 2. Hash password with argon2id
    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTIONS);

    // 3. Atomic tenant + owner creation
    const user = await authRepository.createTenantAndOwner(
      { name: dto.tenantName, slug: dto.tenantSlug, email: dto.email },
      {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    );

    logger.info("New tenant registered", {
      tenantId: user.tenantId,
      tenantSlug: dto.tenantSlug,
      userId: user.id,
    });

    // 4. Issue session
    const tokens = await _issueSession(user, meta);
    return { user, tenant: user.tenant, ...tokens };
  },

  // ── Login ─────────────────────────────────────────────────────────────────────

  /**
   * Authenticates a user by email + password within a specific tenant (slug).
   * Returns token pair on success; throws on any failure with generic messages
   * to prevent user/tenant enumeration.
   */
  async login(dto, meta) {
    // 1. Lookup — email is unique per tenant; slug disambiguates cross-tenant

    logger.info("Login attempt received", { email: dto.email, tenantSlug: dto.tenantSlug });
    const user = await authRepository.findUserByEmailAndSlug(
      dto.email,
      dto.tenantSlug,
    );

    // Generic message prevents tenant/user enumeration
    if (!user) {
      throw ApiError.unauthorized("Invalid email, password, or organisation");
    }

    // 2. Password verification
    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      logger.warn("Failed login attempt", {
        email: dto.email,
        tenantSlug: dto.tenantSlug,
      });
      throw ApiError.unauthorized("Invalid email, password, or organisation");
    }

    // 3. Account status checks
    if (user.status !== USER_STATUS.ACTIVE) {
      throw ApiError.forbidden(
        "Your account is inactive. Contact your administrator.",
      );
    }

    if (user.tenant.status === TENANT_STATUS.SUSPENDED) {
      throw ApiError.forbidden(
        "Your organisation account is suspended. Please contact support.",
      );
    }

    if (user.tenant.status === TENANT_STATUS.CANCELLED) {
      throw ApiError.forbidden(
        "Your organisation subscription has been cancelled.",
      );
    }

    // 4. Non-blocking housekeeping
    authRepository
      .deleteExpiredTokens(user.id)
      .catch((e) =>
        logger.warn("Failed to delete expired tokens", {
          userId: user.id,
          error: e.message,
        }),
      );

    // 5. Update last login (fire-and-forget — not critical path)
    authRepository.updateLastLogin(user.id).catch(() => {});

    logger.info("User logged in", {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });

    const tokens = await _issueSession(user, meta);
    return { user, tenant: user.tenant, ...tokens };
  },

  // ── Refresh ───────────────────────────────────────────────────────────────────

  /**
   * Rotates the refresh token:
   *  - Validates the incoming raw token
   *  - Detects reuse (stolen token) and nukes all sessions if found
   *  - Revokes the old token and issues a fresh pair
   */
  async refresh(rawRefreshToken, meta) {
    if (!rawRefreshToken) {
      throw ApiError.unauthorized("Refresh token is required");
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);
    const storedToken = await authRepository.findRefreshTokenByHash(tokenHash);

    if (!storedToken) {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    // Reuse detection: token already revoked means possible token theft
    if (storedToken.revokedAt !== null) {
      logger.error(
        "Refresh token reuse detected — revoking all user sessions",
        {
          userId: storedToken.userId,
        },
      );
      await authRepository.revokeAllUserRefreshTokens(storedToken.userId);
      throw ApiError.unauthorized(
        "Security alert: refresh token reuse detected. All sessions have been terminated.",
      );
    }

    if (new Date() > storedToken.expiresAt) {
      await authRepository.revokeRefreshToken(storedToken.id);
      throw ApiError.unauthorized(
        "Refresh token has expired. Please log in again.",
      );
    }

    const { user } = storedToken;

    // Re-validate user + tenant status on each refresh
    if (!user || user.deletedAt || user.status !== USER_STATUS.ACTIVE) {
      throw ApiError.unauthorized("Account is no longer active");
    }

    const tenantStatus = user.tenant?.status;
    if (
      tenantStatus === TENANT_STATUS.SUSPENDED ||
      tenantStatus === TENANT_STATUS.CANCELLED
    ) {
      throw ApiError.forbidden("Organisation account is not active");
    }

    // Rotate: revoke old, issue new
    await authRepository.revokeRefreshToken(storedToken.id);
    const tokens = await _issueSession(user, meta);

    return { user, tenant: user.tenant, ...tokens };
  },

  // ── Logout ────────────────────────────────────────────────────────────────────

  /**
   * Revokes the refresh token in DB and blocklists the access token jti in Redis.
   * After this call, both the refresh token AND the current access token are dead.
   * The access token blocklist entry TTL mirrors the token's own expiry so Redis
   * cleans it up automatically — no manual housekeeping needed.
   *
   * @param {string|null} rawRefreshToken
   * @param {string|null} rawAccessToken  - The Bearer token being used right now
   */
  async logout(rawRefreshToken, rawAccessToken) {
    const redis = getRedisClient();

    // 1. Revoke refresh token in DB
    if (rawRefreshToken) {
      const tokenHash   = hashRefreshToken(rawRefreshToken);
      const storedToken = await authRepository.findRefreshTokenByHash(tokenHash);
      if (storedToken && !storedToken.revokedAt) {
        await authRepository.revokeRefreshToken(storedToken.id);
        logger.info("User logged out", { userId: storedToken.userId });
      }
    }

    // 2. Blocklist the access token jti in Redis so /me immediately returns 401
    if (rawAccessToken) {
      const payload = decodeAccessToken(rawAccessToken);
      if (payload?.jti && payload?.exp) {
        const ttlSeconds = payload.exp - Math.floor(Date.now() / 1000);
        if (ttlSeconds > 0) {
          if (redis && isRedisAvailable()) {
            try {
              const key = REDIS_KEY_PREFIX.ACCESS_TOKEN_BLOCKLIST + payload.jti;
              // SETEX: set with expiry — key auto-deletes when the token would have expired anyway
              await redis.setex(key, ttlSeconds, '1');
              logger.info("Access token blocklisted", { jti: payload.jti, ttlSeconds });
            } catch (err) {
              logger.warn("Redis blocklist failed", { error: err.message, jti: payload.jti });
            }
          } else {
            logger.info("Redis unavailable, skipping access token blocklisting", { jti: payload.jti });
          }
        }
      }
    }
  },

  // ── Current User ─────────────────────────────────────────────────────────────

  /**
   * Returns the authenticated user's profile.
   * userId and tenantId come from the verified JWT — never from the request body.
   */
  async getCurrentUser(userId, tenantId) {
    const user = await authRepository.findUserById(userId, tenantId);
    if (!user) throw ApiError.notFound("User");
    return { user, tenant: user.tenant };
  },
};

// ── Private Helper ────────────────────────────────────────────────────────────

/**
 * Generates an access + refresh token pair and persists the hashed refresh token.
 *
 * @param {object} user - Prisma User record
 * @param {object} meta - { ipAddress?, userAgent? }
 * @returns {{ accessToken: string, refreshToken: string }}
 */
async function _issueSession(user, meta = {}) {
  const accessToken = generateAccessToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  });

  const rawRefreshToken = generateRawRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS.REFRESH);

  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash,
    expiresAt,
    ipAddress: meta.ipAddress ?? null,
    userAgent: meta.userAgent ?? null,
  });

  return { accessToken, refreshToken: rawRefreshToken };
}
