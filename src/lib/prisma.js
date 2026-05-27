// src/lib/prisma.js
// ─────────────────────────────────────────────────────────────────────────────
// Re-exports the Prisma singleton from the config layer.
// All repositories import from here, keeping the dependency path clean.
// ─────────────────────────────────────────────────────────────────────────────
export { default } from '../config/database.js';
