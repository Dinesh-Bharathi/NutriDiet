// src/modules/auth/auth.routes.js
// Auth route declarations. All endpoints are public except /me.
import { Router } from 'express';
import { authController } from './auth.controller.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import asyncHandler from '../../utils/asyncHandler.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// ── Stricter rate limiter for auth endpoints ──────────────────────────────────
// Separate from the global limiter in app.js — allows tighter control on
// login/register without affecting the rest of the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:       20,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders:   false,
});

// More aggressive limit for registration to prevent tenant spam
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max:       5,
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again in 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── Public Routes ─────────────────────────────────────────────────────────────

// POST /api/v1/auth/register
router.post(
  '/register',
  registerLimiter,
  validate(registerSchema),
  asyncHandler(authController.register),
);

// POST /api/v1/auth/login
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(authController.login),
);

// POST /api/v1/auth/refresh
// Accepts refresh token from httpOnly cookie OR request body
router.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(authController.refresh),
);

// POST /api/v1/auth/logout
// Idempotent — always succeeds; clears cookies regardless of token validity
router.post(
  '/logout',
  asyncHandler(authController.logout),
);

// ── Protected Routes ──────────────────────────────────────────────────────────

// GET /api/v1/auth/me
// authenticate populates req.user from JWT; tenantId is NEVER from request body
router.get(
  '/me',
  authenticate,
  asyncHandler(authController.me),
);

export default router;
