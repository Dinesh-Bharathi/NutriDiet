// src/config/constants.js
// ─────────────────────────────────────────────────────────────────────────────
// Application-wide domain constants.
// These values are NEVER sourced from environment variables — they represent
// business rules and domain semantics that are part of the codebase itself.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * User roles across the platform.
 * OWNER   – Full tenant control (billing, settings, member management).
 * ADMIN   – Tenant-wide administrative access, cannot change billing.
 * DIETITIAN – Licensed practitioner who manages clients and meal plans.
 * ASSISTANT – Support staff under a DIETITIAN, limited write access.
 * CLIENT  – End-user (patient/client) of the wellness practice.
 */
export const ROLES = Object.freeze({
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  DIETITIAN: 'DIETITIAN',
  ASSISTANT: 'ASSISTANT',
});

/**
 * Role hierarchy (higher index = more privilege).
 * Used by RBAC middleware to implement "at least" permission checks.
 */
export const ROLE_HIERARCHY = Object.freeze([
  ROLES.ASSISTANT,
  ROLES.DIETITIAN,
  ROLES.ADMIN,
  ROLES.OWNER,
]);

/**
 * Tenant plan tiers. Determines feature access and resource limits.
 */
export const TENANT_PLANS = Object.freeze({
  FREE: 'FREE',
  STARTER: 'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
});

/**
 * Tenant account status.
 */
export const TENANT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
  TRIAL: 'TRIAL',
});

/**
 * User account status.
 */
export const USER_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
  BANNED: 'BANNED',
});

/**
 * Standard pagination defaults.
 */
export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

/**
 * HTTP status codes used across the application.
 * Centralised here to avoid magic numbers in controllers.
 */
export const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
});

/**
 * Token types used in the JWT payload and Redis keys.
 */
export const TOKEN_TYPES = Object.freeze({
  ACCESS: 'access',
  REFRESH: 'refresh',
  INVITE: 'invite',
  RESET_PASSWORD: 'reset_password',
  VERIFY_EMAIL: 'verify_email',
});

/**
 * Gender options stored on client profiles.
 */
export const GENDER = Object.freeze({
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY',
});
