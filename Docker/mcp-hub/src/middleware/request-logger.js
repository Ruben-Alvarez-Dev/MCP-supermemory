// ============================================================
// Request Logging Middleware
// ============================================================
// Task: US-001-2 - Implement request logging middleware
// Description: Log all incoming HTTP requests

import { logger } from '../utils/logger.js';

/**
 * Request logger middleware
 * Logs incoming requests with timing information
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(level, 'Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip
    });
  });

  next();
}

/**
 * Request ID middleware
 * Adds unique request ID for tracing
 */
export function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}

/**
 * Request timing middleware
 * Adds timing information to request
 */
export function requestTimer(req, res, next) {
  req.startTime = Date.now();
  next();
}

export default {
  requestLogger,
  requestId,
  requestTimer
};
