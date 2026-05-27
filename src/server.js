// src/server.js
// ─────────────────────────────────────────────────────────────────────────────
// HTTP server bootstrap.
//
// Responsibilities:
//  - Import and start the Express application
//  - Bind to the configured port
//  - Handle process signals for graceful shutdown
//  - Log startup info
// ─────────────────────────────────────────────────────────────────────────────
import app from "./app.js";
import env from "./config/env.js";
import logger from "./utils/logger.js";
import { disconnectDatabase } from "./config/database.js";
import { disconnectRedis } from "./lib/redis.js";

let server;

async function startServer() {
  try {
    server = app.listen(env.PORT, () => {
      logger.info(`🚀 Nutri-Diet API server started`, {
        port: env.PORT,
        environment: env.NODE_ENV,
        version: `v${env.API_VERSION}`,
        url: `http://localhost:${env.PORT}/api/${env.API_VERSION}`,
      });
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        logger.error(`Port ${env.PORT} is already in use`);
      } else {
        logger.error("Server error", { error: err.message });
      }
      process.exit(1);
    });
  } catch (err) {
    logger.error("Failed to start server", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info("HTTP server closed");

      try {
        await disconnectDatabase();
        await disconnectRedis();
        logger.info("Graceful shutdown complete");
        process.exit(0);
      } catch (err) {
        logger.error("Error during graceful shutdown", { error: err.message });
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds if connections don't close
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─── Unhandled Error Safety Nets ──────────────────────────────────────────────
// These should never fire in production-quality code, but we catch them so the
// server doesn't crash silently.

process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION – shutting down", {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("UNHANDLED REJECTION – shutting down", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  process.exit(1);
});

// ─── Start ────────────────────────────────────────────────────────────────────
startServer();
