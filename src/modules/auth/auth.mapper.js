// src/modules/auth/auth.mapper.js
// Transforms raw Prisma user/tenant records into safe response shapes.
// Ensures passwordHash and other internals are never serialised.

/**
 * Maps a Prisma User + Tenant record to a safe public profile object.
 *
 * @param {object} user   - Prisma User record (with tenant relation included)
 * @param {object} [tenant] - Optional tenant override (if not nested on user)
 * @returns {object}
 */
export function mapUserToProfile(user, tenant) {
  const t = tenant ?? user.tenant;
  return {
    user: {
      id:        user.id,
      email:     user.email,
      firstName: user.firstName,
      lastName:  user.lastName,
      fullName:  `${user.firstName} ${user.lastName}`,
      role:      user.role,
      status:    user.status,
      avatarUrl: user.avatarUrl ?? null,
      createdAt: user.createdAt,
    },
    tenant: t
      ? {
          id:                t.id,
          name:              t.name,
          slug:              t.slug,
          countryCode:       t.countryCode ?? null,
          timezone:          t.timezone ?? 'UTC',
          locale:            t.locale ?? 'en-US',
          currencyCode:      t.currencyCode ?? 'USD',
          measurementSystem: t.measurementSystem ?? 'METRIC',
          updatedAt:         t.updatedAt,
          features: {
            multiBranch: false,
            clientPortal: false,
            mobileApp: false,
            whiteLabel: false,
          },
        }
      : null,
  };
}

/**
 * Builds the standard auth response payload returned on login / register / refresh.
 * The accessToken is included in the body for non-browser (mobile / API) clients.
 * Browsers should use the httpOnly cookie set on the response.
 *
 * @param {object} user
 * @param {object} tenant
 * @param {string} accessToken
 * @returns {object}
 */
export function mapAuthResponse(user, tenant, accessToken) {
  return {
    user:        mapUserToProfile(user, tenant),
    accessToken, // Also available via httpOnly cookie
  };
}
