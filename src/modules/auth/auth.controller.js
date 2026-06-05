// src/modules/auth/auth.controller.js
// Thin HTTP adapters — extract request data, call service, send response.
// Zero business logic lives here.
import { authService } from "./auth.service.js";
import { mapAuthResponse, mapUserToProfile } from "./auth.mapper.js";
import {
  setAuthCookies,
  clearAuthCookies,
  extractRefreshToken,
  extractAccessToken,
} from "./auth.cookies.js";
import { sendSuccess } from "../../utils/ApiResponse.js";
import { HTTP_STATUS } from "../../config/constants.js";

export const authController = {
  /**
   * POST /api/v1/auth/register
   * Creates a new tenant and an OWNER user in a single transaction.
   */
  async register(req, res) {
    const meta = { ipAddress: req.ip, userAgent: req.headers["user-agent"] };

    const { user, tenant, accessToken, refreshToken } =
      await authService.register(req.body, meta);

    setAuthCookies(res, { accessToken, refreshToken });

    return sendSuccess(
      res,
      HTTP_STATUS.CREATED,
      "Registration successful. Welcome to Nutri-Diet!",
      mapAuthResponse(user, tenant, accessToken),
    );
  },

  /**
   * POST /api/v1/auth/login
   * Authenticates credentials; sets secure cookies; returns token + profile.
   */
  async login(req, res) {
    const meta = { ipAddress: req.ip, userAgent: req.headers["user-agent"] };


    const { user, tenant, accessToken, refreshToken } = await authService.login(
      req.body,
      meta,
    );

    setAuthCookies(res, { accessToken, refreshToken });

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "Login successful",
      mapAuthResponse(user, tenant, accessToken),
    );
  },

  /**
   * POST /api/v1/auth/refresh
   * Rotates the refresh token; issues a new access + refresh pair.
   * Accepts the token from the httpOnly cookie or the request body.
   */
  async refresh(req, res) {
    const rawRefreshToken = extractRefreshToken(req);
    const meta = { ipAddress: req.ip, userAgent: req.headers["user-agent"] };

    const { user, tenant, accessToken, refreshToken } =
      await authService.refresh(rawRefreshToken, meta);

    setAuthCookies(res, { accessToken, refreshToken });

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "Token refreshed successfully",
      mapAuthResponse(user, tenant, accessToken),
    );
  },

  /**
   * POST /api/v1/auth/logout
   * Revokes the refresh token and clears auth cookies.
   * Always responds 200 — idempotent.
   */
  async logout(req, res) {
    const rawRefreshToken = extractRefreshToken(req);
    const rawAccessToken  = extractAccessToken(req);
    await authService.logout(rawRefreshToken, rawAccessToken);
    clearAuthCookies(res);

    return sendSuccess(res, HTTP_STATUS.OK, "Logged out successfully");
  },

  /**
   * GET /api/v1/auth/me
   * Returns the authenticated user's profile.
   * req.user is populated by the authenticate middleware — tenantId from JWT only.
   */
  async me(req, res) {

    const { user, tenant } = await authService.getCurrentUser(
      req.user.userId,
      req.user.tenantId,
    );

    return sendSuccess(
      res,
      HTTP_STATUS.OK,
      "User profile retrieved",
      mapUserToProfile(user, tenant),
    );
  },
};
