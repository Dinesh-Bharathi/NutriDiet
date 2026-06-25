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
import userRouter from '../modules/users/user.routes.js';
router.use('/users', userRouter);

// Tenant management routes (protected, OWNER / ADMIN only)
import tenantRouter from '../modules/tenants/tenant.routes.js';
router.use('/tenant', tenantRouter);

// Client management routes (protected)
import clientRouter from '../modules/clients/client.routes.js';
router.use('/clients', clientRouter);

// Assessment management routes (protected)
import assessmentRouter from '../modules/assessments/assessment.routes.js';
router.use('/assessments', assessmentRouter);

// Diet Plan, Meal, and Meal Item routes (protected)
import dietPlanRouter, { mealRouter, mealItemRouter } from '../modules/diet-plans/diet-plan.routes.js';
router.use('/diet-plans', dietPlanRouter);
router.use('/meals', mealRouter);
router.use('/meal-items', mealItemRouter);

// Food Library routes (protected)
import foodLibraryRouter from '../modules/food-library/food-library.routes.js';
router.use('/food-library', foodLibraryRouter);

// Diet Plan Templates routes (protected)
import dietPlanTemplateRouter, { templateMealRouter, templateMealItemRouter } from '../modules/diet-plan-templates/diet-plan-template.routes.js';
router.use('/diet-plan-templates', dietPlanTemplateRouter);
router.use('/template-meals', templateMealRouter);
router.use('/template-meal-items', templateMealItemRouter);

// Check-ins routes (protected)
import checkInRouter from '../modules/check-ins/check-in.routes.js';
router.use('/check-ins', checkInRouter);

// Progress & Review Dashboard routes (protected)
import progressRouter from '../modules/progress/progress.routes.js';
router.use('/reviews', progressRouter);

// Settings routes (protected)
import settingsRouter from '../modules/settings/settings.routes.js';
router.use('/settings', settingsRouter);

// WhatsApp integration routes (protected)
import whatsappRouter from '../modules/whatsapp/whatsapp.routes.js';
router.use('/whatsapp', whatsappRouter);

// Notifications routes (protected)
import notificationRouter from '../modules/notifications/notification.routes.js';
router.use('/notifications', notificationRouter);

// Notification Preferences routes (protected)
import notificationPreferencesRouter from '../modules/notification-preferences/notification-preferences.routes.js';
router.use('/notification-preferences', notificationPreferencesRouter);

// Repeat Cycles & Template Cycles (protected)
import cycleRouter from '../modules/diet-plans/cycle.routes.js';
import templateCycleRouter from '../modules/diet-plan-templates/template-cycle.routes.js';
import foodLibraryV2Router from '../modules/food-library/food-library-v2.routes.js';
import mealSwapRouter from '../modules/meal-swaps/meal-swap.routes.js';
import clinicalProfileRouter from '../modules/assessments/clinical-profile.routes.js';
import dashboardRouter from '../modules/dashboard/dashboard.routes.js';

import systemRouter from '../modules/system/system.routes.js';
import storageRouter from '../modules/storage/storage.routes.js';
import pdfRouter from '../modules/pdf/pdf.routes.js';
import automationRouter from '../modules/automation/automation.routes.js';
import billingRouter from '../modules/billing/billing.routes.js';

router.use('/', cycleRouter);
router.use('/', templateCycleRouter);
router.use('/', foodLibraryV2Router);
router.use('/', mealSwapRouter);
router.use('/', clinicalProfileRouter);
router.use('/dashboard', dashboardRouter);
router.use('/system', systemRouter);
router.use('/storage', storageRouter);
router.use('/pdf', pdfRouter);
router.use('/automation', automationRouter);
router.use('/billing', billingRouter);

// ── Foundation ping route ────────────────────────────────────────────────────
router.get('/ping', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is operational',
    data: { timestamp: new Date().toISOString() },
  });
});

export default router;
