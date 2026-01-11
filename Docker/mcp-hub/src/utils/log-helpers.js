// ============================================================
// Log Utilities and Helpers
// ============================================================
// Task: US-002-2 - Add log utilities and helpers
// Description: Helper functions for structured logging

import { logger } from './logger.js';

/**
 * Log HTTP request with timing
 */
export function logHttpRequest(req, res, duration) {
  const level = res.statusCode >= 400 ? 'warn' : 'info';
  logger.log(level, 'HTTP Request', {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration_ms: duration,
    ip: req.ip,
    user_agent: req.get('user-agent')
  });
}

/**
 * Log MCP tool call
 */
export function logMcpCall(toolName, server, args, result, duration) {
  logger.info('MCP Tool Call', {
    tool: toolName,
    server,
    args: JSON.stringify(args),
    success: result?.success ?? true,
    duration_ms: duration
  });
}

/**
 * Log database operation
 */
export function logDbOperation(operation, entity, result, duration) {
  logger.debug('Database Operation', {
    operation,
    entity,
    success: result?.success ?? true,
    duration_ms: duration
  });
}

/**
 * Log error with context
 */
export function logError(error, context = {}) {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context
  });
}

/**
 * Create a logger for a specific module
 */
export function createModuleLogger(moduleName) {
  return {
    debug: (message, meta = {}) => logger.debug(message, { module: moduleName, ...meta }),
    info: (message, meta = {}) => logger.info(message, { module: moduleName, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { module: moduleName, ...meta }),
    error: (message, meta = {}) => logger.error(message, { module: moduleName, ...meta })
  };
}

/**
 * Log performance metric
 */
export function logPerformanceMetric(operation, duration, metadata = {}) {
  logger.info('Performance Metric', {
    operation,
    duration_ms: duration,
    ...metadata
  });
}

/**
 * Log system event
 */
export function logSystemEvent(event, data = {}) {
  logger.info('System Event', {
    event,
    timestamp: new Date().toISOString(),
    ...data
  });
}

/**
 * Create a timer for performance tracking
 */
export function createTimer(label) {
  const start = Date.now();
  return {
    end: (metadata = {}) => {
      const duration = Date.now() - start;
      logPerformanceMetric(label, duration, metadata);
      return duration;
    }
  };
}

/**
 * Structured log builder
 */
export class LogBuilder {
  constructor() {
    this.data = {};
  }

  add(key, value) {
    this.data[key] = value;
    return this;
  }

  addContext(context) {
    this.data = { ...this.data, ...context };
    return this;
  }

  info(message) {
    logger.info(message, this.data);
  }

  warn(message) {
    logger.warn(message, this.data);
  }

  error(message) {
    logger.error(message, this.data);
  }

  debug(message) {
    logger.debug(message, this.data);
  }
}

/**
 * Create a new log builder
 */
export function createLogBuilder() {
  return new LogBuilder();
}

export default {
  logHttpRequest,
  logMcpCall,
  logDbOperation,
  logError,
  createModuleLogger,
  logPerformanceMetric,
  logSystemEvent,
  createTimer,
  createLogBuilder,
  LogBuilder
};
