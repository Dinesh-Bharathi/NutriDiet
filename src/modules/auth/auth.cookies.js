// src/modules/auth/auth.cookies.js
// httpOnly cookie management for access and refresh tokens.
// Environment-aware: secure flag on in production, lax in development.
import env from "../../config/env.js";
import { COOKIE_NAMES, TOKEN_EXPIRY_MS } from "./auth.constants.js";

const BASE_OPTIONS = {
  httpOnly: true,
  secure: env.IS_PRODUCTION,
  sameSite: env.IS_PRODUCTION ? "none" : "lax",
};

/**
 * Writes both auth cookies onto the response.
 * Refresh token cookie is scoped to /api/v1/auth to minimise attack surface.
 *
 * @param {import('express').Response} res
 * @param {{ accessToken: string, refreshToken: string }} tokens
 */
export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, {
    ...BASE_OPTIONS,
    maxAge: TOKEN_EXPIRY_MS.ACCESS,
    path: "/",
  });

  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
    ...BASE_OPTIONS,
    maxAge: TOKEN_EXPIRY_MS.REFRESH,
    path: "/api", // Accessible to all /api routes so refresh works regardless of version
  });
}

/**
 * Clears both auth cookies by setting past expiry.
 *
 * @param {import('express').Response} res
 */
export function clearAuthCookies(res) {
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: "/" });
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: "/api" });
}

/**
 * Extracts the raw refresh token from the request.
 * Priority: httpOnly cookie → request body (for non-browser REST clients).
 *
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function extractRefreshToken(req) {
  return (
    req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] ?? req.body?.refreshToken ?? null
  );
}

/**
 * Extracts the raw access token from the request.
 * Priority: Authorization Bearer header → nd_access cookie.
 * Used during logout to blocklist the active access token in Redis.
 *
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function extractAccessToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() || null;
  }
  return req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] ?? null;
}
