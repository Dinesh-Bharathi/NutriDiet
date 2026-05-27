// src/middlewares/tenant.middleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Tenant context middleware.
//
// This middleware CONFIRMS that the authenticated user's tenant is active and
// attaches the full tenant context to req.tenant.  It must run after the
// authenticate middleware.
//
// CRITICAL RULE: tenant_id is NEVER sourced from the request body or query
// params.  It is always taken from req.user.tenantId which comes from the
// verified JWT.  This guarantees cross-tenant data isolation.
// ─────────────────────────────────────────────────────────────────────────────
import prisma from '../lib/prisma.js';
import ApiError from '../utils/ApiError.js';
import { TENANT_STATUS } from '../config/constants.js';

/**
 * Resolves and validates the tenant from the authenticated JWT payload.
 * Attaches the tenant record to req.tenant so downstream handlers don't need
 * to re-query the database.
 *
 * req.tenant shape:
 * {
 *   id: string,
 *   name: string,
 *   slug: string,
 *   plan: string,
 *   status: string,
 * }
 *
 * @type {import('express').RequestHandler}
 */
export async function resolveTenant(req, _res, next) {
  try {
    if (!req.user?.tenantId) {
      return next(ApiError.unauthorized('Tenant context is missing from token'));
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
      },
    });

    if (!tenant) {
      return next(ApiError.forbidden('Tenant not found'));
    }

    if (tenant.status === TENANT_STATUS.SUSPENDED) {
      return next(ApiError.forbidden('Your account has been suspended. Please contact support.'));
    }

    if (tenant.status === TENANT_STATUS.CANCELLED) {
      return next(ApiError.forbidden('Your subscription has been cancelled.'));
    }

    req.tenant = tenant;
    return next();
  } catch (err) {
    return next(err);
  }
}
