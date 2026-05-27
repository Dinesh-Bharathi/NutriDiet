// src/config/logger.js
// ─────────────────────────────────────────────────────────────────────────────
// Winston logger factory.  Produces a singleton logger that all other modules
// import from src/utils/logger.js.  Keeping the factory here keeps the config/
// folder responsible for all infrastructure wiring.
// ─────────────────────────────────────────────────────────────────────────────
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import env from './env.js';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// ─── Development pretty-print format ─────────────────────────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${stack ? `\n${stack}` : ''}${metaStr}`;
  }),
);

// ─── Production structured JSON format ───────────────────────────────────────
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

// ─── Rotating file transport (production) ────────────────────────────────────
const rotatingErrorTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  zippedArchive: true,
});

const rotatingCombinedTransport = new DailyRotateFile({
  filename: 'logs/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  zippedArchive: true,
});

// ─── Transport selection ──────────────────────────────────────────────────────
const transports = env.IS_PRODUCTION
  ? [
      new winston.transports.Console({ format: prodFormat }),
      rotatingErrorTransport,
      rotatingCombinedTransport,
    ]
  : [new winston.transports.Console({ format: devFormat })];

// ─── Logger instance ──────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'nutri-diet-api' },
  transports,
  // Exceptions and rejections are captured so unhandled errors are always logged
  exceptionHandlers: [new winston.transports.Console({ format: prodFormat })],
  rejectionHandlers: [new winston.transports.Console({ format: prodFormat })],
  exitOnError: false,
});

export default logger;
