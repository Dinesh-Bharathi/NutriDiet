// src/config/database.js
// ─────────────────────────────────────────────────────────────────────────────
// Prisma client singleton.  Only this module instantiates PrismaClient.
// All repositories must import the instance from src/lib/prisma.js which
// re-exports this singleton.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import env from "./env.js";
import logger from "./logger.js";

// ─── Query logging (development only) ────────────────────────────────────────
const logConfig = env.IS_DEVELOPMENT
  ? {
      log: [
        { emit: "event", level: "query" },
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
      ],
    }
  : {
      log: [{ emit: "event", level: "error" }],
    };

const prisma = new PrismaClient(logConfig);

// Log Prisma query events in development
if (env.IS_DEVELOPMENT) {
  prisma.$on("query", (e) => {
    // logger.debug('Prisma query', {
    //   query: e.query,
    //   params: e.params,
    //   duration: `${e.duration}ms`,
    // });
  });
}

prisma.$on("error", (e) => {
  logger.error("Prisma error", { message: e.message, target: e.target });
});

/**
 * Gracefully disconnect Prisma on process shutdown signals.
 * Called from server.js during graceful shutdown.
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info("Database connection closed");
}

export default prisma;
