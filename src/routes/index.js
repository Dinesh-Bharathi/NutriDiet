// src/routes/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Central API router.
// All module routers are mounted here under their resource paths.
// This is the ONLY place routes are assembled — keeping app.js clean.
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';

const router = Router();

// ── Route Modules ────────────────────────────────────────────────────────────
// Phase 1: foundation routes only.
// Future modules (clients, meal-plans, appointments) are added here as they
// are implemented.

// Auth routes (public — no authenticate middleware on most endpoints)
import authRouter from '../modules/auth/auth.routes.js';
router.use('/auth', authRouter);

// User management routes (protected)
// import userRouter from '../modules/users/user.routes.js';
// router.use('/users', userRouter);

// Tenant management routes (protected, OWNER / ADMIN only)
import tenantRouter from '../modules/tenants/tenant.routes.js';
router.use('/tenant', tenantRouter);

// Client management routes (protected)
import clientRouter from '../modules/clients/client.routes.js';
router.use('/clients', clientRouter);

// Assessment management routes (protected)
import assessmentRouter from '../modules/assessments/assessment.routes.js';
router.use('/assessments', assessmentRouter);

// ── Foundation ping route ────────────────────────────────────────────────────
router.get('/ping', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is operational',
    data: { timestamp: new Date().toISOString() },
  });
});

export default router;
