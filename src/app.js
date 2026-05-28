// src/app.js
// ─────────────────────────────────────────────────────────────────────────────
// Express application factory.
// This module creates and configures the Express app but does NOT start the
// HTTP server.  The server bootstrap lives in src/server.js.
// Separation allows clean integration testing (import app without binding a port).
// ─────────────────────────────────────────────────────────────────────────────
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import xssClean from "xss-clean";
import hpp from "hpp";

import env from "./config/env.js";
import logger from "./utils/logger.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found.middleware.js";
import apiRouter from "./routes/index.js";

const app = express();

// ─── Trust proxy (required when behind nginx / load balancer) ─────────────────
app.set("trust proxy", 1);

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: env.IS_PRODUCTION, // Disabled in dev for easier testing
    crossOriginEmbedderPolicy: false,
  }),
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = env.ALLOWED_ORIGINS.split(",");

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests
      if (!origin) {
        return callback(null, true);
      }

      // Exact matches
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow tenant subdomains
      const isTenantSubdomain =
        origin.endsWith(".nutridiet.com") || origin.endsWith(".vercel.app");

      if (isTenantSubdomain) {
        return callback(null, true);
      }

      return callback(new Error("CORS not allowed"));
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
  },
  skip: () => env.IS_TEST, // Disable in test environment
});
app.use("/api", globalLimiter);

// ─── Request Parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use(compression());

// ─── Sanitisation & Security ──────────────────────────────────────────────────
app.use(mongoSanitize()); // Prevent NoSQL injection via $-prefixed keys
app.use(xssClean()); // Sanitise user input against XSS
app.use(hpp()); // Prevent HTTP parameter pollution

// ─── HTTP Request Logging ─────────────────────────────────────────────────────
if (!env.IS_TEST) {
  const morganFormat = env.IS_PRODUCTION ? "combined" : "dev";
  app.use(
    morgan(morganFormat, {
      stream: {
        write: (message) => logger.http(message.trim()),
      },
      skip: (req) => req.path === "/health", // Don't log health checks
    }),
  );
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Service is healthy",
    data: {
      status: "UP",
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: process.env.npm_package_version ?? "1.0.0",
    },
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use(`/api/${env.API_VERSION}`, apiRouter);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use(notFoundMiddleware);

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
