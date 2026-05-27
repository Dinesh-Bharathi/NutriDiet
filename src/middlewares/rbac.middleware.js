// src/middlewares/rbac.middleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Role-Based Access Control middleware.
//
// Must always be used AFTER authenticate middleware so req.user is populated.
//
// Two strategies:
//  1. requireRoles(...roles)   – Exact role membership check.
//  2. requireMinRole(role)     – Hierarchy check: user role >= minimum role.
//
// Usage:
//   router.delete('/:id',
//     authenticate,
//     requireRoles(ROLES.OWNER, ROLES.ADMIN),
//     asyncHandler(controller.delete)
//   );
//
//   router.get('/',
//     authenticate,
//     requireMinRole(ROLES.DIETITIAN),
//     asyncHandler(controller.list)
//   );
// ─────────────────────────────────────────────────────────────────────────────
import ApiError from '../utils/ApiError.js';
import { ROLES, ROLE_HIERARCHY } from '../config/constants.js';

/**
 * Guards a route to only the specified roles.
 *
 * @param {...string} allowedRoles - One or more role constants from ROLES.
 * @returns {import('express').RequestHandler}
 */
export function requireRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
        ),
      );
    }

    return next();
  };
}

/**
 * Guards a route to any role at or above the specified minimum in the hierarchy.
 * Example: requireMinRole(ROLES.DIETITIAN) → allows DIETITIAN, ADMIN, OWNER.
 *
 * @param {string} minimumRole - The lowest acceptable role (from ROLES).
 * @returns {import('express').RequestHandler}
 */
export function requireMinRole(minimumRole) {
  const minimumIndex = ROLE_HIERARCHY.indexOf(minimumRole);

  if (minimumIndex === -1) {
    throw new Error(`[RBAC] Unknown role provided to requireMinRole: "${minimumRole}"`);
  }

  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    const userIndex = ROLE_HIERARCHY.indexOf(req.user.role);

    if (userIndex < minimumIndex) {
      return next(
        ApiError.forbidden(
          `Access denied. Minimum required role: ${minimumRole}. Your role: ${req.user.role}`,
        ),
      );
    }

    return next();
  };
}

/**
 * Convenience export: restrict to OWNER only.
 */
export const ownerOnly = requireRoles(ROLES.OWNER);

/**
 * Convenience export: restrict to OWNER or ADMIN.
 */
export const adminOrAbove = requireRoles(ROLES.OWNER, ROLES.ADMIN);

/**
 * Convenience export: restrict to practitioners (DIETITIAN, ADMIN, OWNER).
 */
export const practitionerOrAbove = requireMinRole(ROLES.DIETITIAN);
