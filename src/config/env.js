// src/config/env.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralised environment configuration with strict validation.
// All application code must import config values from this module — never
// read process.env directly elsewhere.
// ─────────────────────────────────────────────────────────────────────────────
import "dotenv/config";

/**
 * Asserts that an environment variable exists and is non-empty.
 * Throws at startup so misconfigured deployments fail fast.
 *
 * @param {string} key  - The environment variable name.
 * @param {string} [defaultValue] - Optional fallback value.
 * @returns {string}
 */
function require_env(key, defaultValue) {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined || value === "") {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Parses a string to an integer, throws if conversion yields NaN.
 *
 * @param {string} raw
 * @param {string} key
 * @returns {number}
 */
function parse_int(raw, key) {
  const num = parseInt(raw, 10);
  if (Number.isNaN(num)) {
    throw new Error(
      `[Config] Environment variable ${key} must be an integer, got: "${raw}"`,
    );
  }
  return num;
}

// ─── Parsed and validated configuration ──────────────────────────────────────

const env = Object.freeze({
  // ── Application ─────────────────────────────────────────────────────────
  NODE_ENV: require_env("NODE_ENV", "development"),
  PORT: parse_int(require_env("PORT", "5000"), "PORT"),
  API_VERSION: require_env("API_VERSION", "v1"),

  // ── Database ─────────────────────────────────────────────────────────────
  DATABASE_URL: require_env("DATABASE_URL"),

  // ── JWT ──────────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: require_env("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: require_env("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRES_IN: require_env("JWT_ACCESS_EXPIRES_IN", "15m"),
  JWT_REFRESH_EXPIRES_IN: require_env("JWT_REFRESH_EXPIRES_IN", "7d"),

  // ── Redis ─────────────────────────────────────────────────────────────────
  REDIS_HOST: require_env("REDIS_HOST", "localhost"),
  REDIS_PORT: parse_int(require_env("REDIS_PORT", "6379"), "REDIS_PORT"),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || "",
  REDIS_DB: parse_int(require_env("REDIS_DB", "0"), "REDIS_DB"),
  REDIS_URL: process.env.REDIS_URL || null,

  // ── CORS ─────────────────────────────────────────────────────────────────
  CLIENT_URL: require_env("CLIENT_URL", "http://localhost:3000"),

  // ── Logging ──────────────────────────────────────────────────────────────
  LOG_LEVEL: require_env("LOG_LEVEL", "info"),

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: parse_int(
    require_env("RATE_LIMIT_WINDOW_MS", "900000"),
    "RATE_LIMIT_WINDOW_MS",
  ),
  RATE_LIMIT_MAX_REQUESTS: parse_int(
    require_env("RATE_LIMIT_MAX_REQUESTS", "100"),
    "RATE_LIMIT_MAX_REQUESTS",
  ),

  // Security ─────────────────────────────────────────────────────────────
  BCRYPT_ROUNDS: parse_int(require_env("BCRYPT_ROUNDS", "12"), "BCRYPT_ROUNDS"),
  ENCRYPTION_KEY: require_env("ENCRYPTION_KEY"),
  META_GRAPH_API_BASE_URL: require_env("META_GRAPH_API_BASE_URL", "https://graph.facebook.com"),
  META_GRAPH_API_VERSION: require_env("META_GRAPH_API_VERSION", "v19.0"),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: require_env("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "mock_verify_token"),
  WHATSAPP_APP_SECRET: require_env("WHATSAPP_APP_SECRET", "mock_app_secret"),
  WHATSAPP_VERBOSE_LOGGING: process.env.WHATSAPP_VERBOSE_LOGGING === "true",

  // Cloudflare R2 ────────────────────────────────────────────────────────
  R2_ENDPOINT: require_env(
    "R2_ENDPOINT",
    "https://mock.r2.cloudflarestorage.com",
  ),
  R2_BUCKET_NAME: require_env("R2_BUCKET_NAME", "nutri-diet-assets"),
  R2_ACCESS_KEY_ID: require_env("R2_ACCESS_KEY_ID", "mock_access_key_id"),
  R2_SECRET_ACCESS_KEY: require_env(
    "R2_SECRET_ACCESS_KEY",
    "mock_secret_access_key",
  ),
  R2_PUBLIC_URL: require_env("R2_PUBLIC_URL", "https://pub-mock.r2.dev"),

  // Razorpay ─────────────────────────────────────────────────────────────
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "rzp_test_mockkeyid123",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "mockkeysecret456",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "mockwebhooksecret789",

  // Ollama AI ────────────────────────────────────────────────────────────
  OLLAMA_HOST: require_env("OLLAMA_HOST", "http://localhost:11434"),
  OLLAMA_MODEL: require_env("OLLAMA_MODEL", "gemma3:latest"),

  // Derived helpers ───────────────────────────────────────────────────────
  get IS_PRODUCTION() {
    return this.NODE_ENV === "production";
  },
  get IS_DEVELOPMENT() {
    return this.NODE_ENV === "development";
  },
  get IS_TEST() {
    return this.NODE_ENV === "test";
  },
});

export default env;
