// ============================================================
// Error Handling Middleware
// ============================================================
// Task: US-001-2 - Implement error handling middleware
// Description: Centralized error handling for Express

import { logger } from '../utils/logger.js';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handler middleware
 * Catches all errors and returns appropriate response
 */
export function errorHandler(err, req, res, next) {
  // Log error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Build error response
  const errorResponse = {
    error: {
      message: err.message || 'Internal Server Error',
      timestamp: new Date().toISOString(),
      path: req.path
    }
  };

  // Add details in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  // Add custom details if available
  if (err.details) {
    errorResponse.error.details = err.details;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Not found handler
 * Catches requests to undefined routes
 */
export function notFoundHandler(req, res, next) {
  const error = new ApiError(404, `Route not found: ${req.method} ${req.path}`);
  next(error);
}

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle specific error types
 */
export function handleKnownErrors(err, req, res, next) {
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        message: 'Invalid token',
        timestamp: new Date().toISOString()
      }
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        message: 'Token expired',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        details: err.details,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Pass to next handler
  next(err);
}

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleKnownErrors,
  ApiError
};
