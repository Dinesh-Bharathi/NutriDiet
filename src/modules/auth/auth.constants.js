// src/modules/auth/auth.constants.js
// Auth-specific constants isolated from the global constants file.

export const COOKIE_NAMES = Object.freeze({
  ACCESS_TOKEN: 'nd_access',
  REFRESH_TOKEN: 'nd_refresh',
});

// Milliseconds — used for cookie maxAge and DB expiresAt calculation
export const TOKEN_EXPIRY_MS = Object.freeze({
  ACCESS:  15 * 60 * 1000,            // 15 minutes
  REFRESH:  7 * 24 * 60 * 60 * 1000, // 7 days
});

// Redis key prefixes (used to blocklist access tokens on logout)
export const REDIS_KEY_PREFIX = Object.freeze({
  // Key: auth:at:blocked:<jti>  Value: '1'  TTL: remaining token lifetime
  // Set on logout; checked on every authenticated request.
  ACCESS_TOKEN_BLOCKLIST: 'auth:at:blocked:',
  REFRESH_BLOCKLIST:      'auth:refresh:blocked:',
  USER_SESSION:           'auth:session:',
});
