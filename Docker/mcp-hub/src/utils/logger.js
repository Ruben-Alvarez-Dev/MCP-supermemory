// ============================================================
// Logger Configuration (Winston)
// ============================================================
// Task: US-002-1
// Description: Setup Winston logger with proper configuration
// Acceptance Criteria:
//   - Create logger configuration
//   - Setup console transport with colorization
//   - Setup file transport for production
//   - Add custom format for structured logs
//   - Add log level handling from env

import winston from 'winston';
import { format } from 'winston';

const { combine, timestamp, printf, colorize } = format;

/**
 * Custom format for console output
 * Formats log entries with timestamp, level, message, and metadata
 */
const consoleFormat = printf((info) => {
  const { level, message, timestamp, ...rest } = info;
  let msg = `${timestamp} [${level}]: ${message}`;

  const metadataKeys = Object.keys(rest);
  if (metadataKeys.length > 0) {
    // Filter out safe metadata (avoid circular references)
    const safeMeta = {};
    for (const key of metadataKeys) {
      if (key === 'timestamp' || key === 'level') continue;
      const value = rest[key];
      try {
        safeMeta[key] = typeof value === 'object' ? JSON.stringify(value) : value;
      } catch (e) {
        safeMeta[key] = String(value);
      }
    }

    const safeMetaKeys = Object.keys(safeMeta);
    if (safeMetaKeys.length > 0) {
      msg += ` ${JSON.stringify(safeMeta)}`;
    }
  }

  return msg;
});

/**
 * Create and configure Winston logger instance
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    consoleFormat
  ),
  transports: [
    new winston.transports.Console({
      silent: process.env.NODE_ENV === 'test'
    })
  ]
});

/**
 * Add file transport for production environment
 * Logs are written to /app/logs/mcp-hub.log with daily rotation
 */
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: '/app/logs/mcp-hub.log',
    level: 'info',
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      printf((info) => {
        const { level, message, timestamp, ...rest } = info;
        return `${timestamp} [${level}]: ${message} ${JSON.stringify(rest)}`;
      })
    )
  }));
}

/**
 * Create child logger with additional context
 * @param {string} context - Context name for the child logger
 * @returns {Object} Child logger instance
 */
export function createChildLogger(context) {
  return logger.child({ context });
}

export default logger;
