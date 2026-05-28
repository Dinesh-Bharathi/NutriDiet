// src/modules/auth/auth.repository.js
// Database access for auth operations — ALL queries include tenantId where applicable.
// No business logic here; pure Prisma interactions only.
import prisma from '../../lib/prisma.js';

export const authRepository = {
  // ── Tenant ──────────────────────────────────────────────────────────────────

  async tenantSlugExists(slug) {
    const record = await prisma.tenant.findUnique({
      where:  { slug },
      select: { id: true },
    });
    return !!record;
  },

  // ── User ─────────────────────────────────────────────────────────────────────

  /**
   * Finds a non-deleted user by email within a tenant identified by slug.
   * Used for login — slug identifies the tenant without trusting a client-supplied tenantId.
   */
  async findUserByEmailAndSlug(email, tenantSlug) {
    return prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
        tenant:    { slug: tenantSlug, deletedAt: null },
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, plan: true, status: true },
        },
      },
    });
  },

  /**
   * Finds a non-deleted user by ID scoped to a tenant.
   * tenantId is ALWAYS from the verified JWT — never from the request.
   */
  async findUserById(userId, tenantId) {
    return prisma.user.findFirst({
      where:   { id: userId, tenantId, deletedAt: null },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, plan: true, status: true },
        },
      },
    });
  },

  async updateLastLogin(userId) {
    return prisma.user.update({
      where: { id: userId },
      data:  { lastLoginAt: new Date() },
    });
  },

  // ── Tenant + Owner Creation (Transactional) ───────────────────────────────────

  /**
   * Creates a new Tenant and its first OWNER user in a single transaction.
   * On failure, both records are rolled back — no orphaned tenants.
   *
   * @param {{ name: string, slug: string, email: string }} tenantData
   * @param {{ email: string, passwordHash: string, firstName: string, lastName: string }} ownerData
   * @returns {Promise<import('@prisma/client').User & { tenant: object }>}
   */
  async createTenantAndOwner(tenantData, ownerData) {
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name:   tenantData.name,
          slug:   tenantData.slug,
          plan:   'FREE',
          status: 'TRIAL',
          email:  tenantData.email,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId:       tenant.id,
          email:          ownerData.email,
          passwordHash:   ownerData.passwordHash,
          firstName:      ownerData.firstName,
          lastName:       ownerData.lastName,
          role:           'OWNER',
          status:         'ACTIVE',
          emailVerifiedAt: new Date(), // Phase 3 adds proper email verification flow
        },
        include: {
          tenant: {
            select: { id: true, name: true, slug: true, plan: true, status: true },
          },
        },
      });

      return user;
    });
  },

  // ── Refresh Tokens ─────────────────────────────────────────────────────────────

  async createRefreshToken({ userId, tokenHash, expiresAt, ipAddress, userAgent }) {
    return prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt, ipAddress, userAgent },
    });
  },

  /**
   * Looks up a refresh token by its SHA-256 hash.
   * Includes the owning user + tenant for validation without extra queries.
   */
  async findRefreshTokenByHash(tokenHash) {
    return prisma.refreshToken.findUnique({
      where:   { tokenHash },
      include: {
        user: {
          include: {
            tenant: {
              select: { id: true, name: true, slug: true, plan: true, status: true },
            },
          },
        },
      },
    });
  },

  async revokeRefreshToken(id) {
    return prisma.refreshToken.update({
      where: { id },
      data:  { revokedAt: new Date() },
    });
  },

  /**
   * Revokes ALL active refresh tokens for a user.
   * Called on token reuse detection — possible token theft scenario.
   */
  async revokeAllUserRefreshTokens(userId) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
  },

  /** Housekeeping: removes expired tokens to keep the table lean. */
  async deleteExpiredTokens(userId) {
    return prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  },
};
