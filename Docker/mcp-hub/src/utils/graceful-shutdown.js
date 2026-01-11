// ============================================================
// Graceful Shutdown Handler
// ============================================================
// Task: US-001-5 - Implement graceful shutdown on SIGTERM/SIGINT
// Description: Handle service termination gracefully

import { logger } from './logger.js';

const SHUTDOWN_TIMEOUT = 30000; // 30 seconds
let isShuttingDown = false;
let shutdownCallbacks = [];

/**
 * Register a callback to be executed during shutdown
 * @param {Function} callback - Async function to execute
 * @param {string} name - Name of the service (for logging)
 */
export function registerShutdownCallback(callback, name) {
  shutdownCallbacks.push({ callback, name });
  logger.debug(`Shutdown callback registered: ${name}`);
}

/**
 * Execute all registered shutdown callbacks
 */
async function executeShutdownCallbacks() {
  logger.info('Executing shutdown callbacks...');

  const results = await Promise.allSettled(
    shutdownCallbacks.map(({ callback, name }) => {
      logger.debug(`Running shutdown callback: ${name}`);
      return callback();
    })
  );

  const failed = results.filter(r => r.status === 'rejected');

  if (failed.length > 0) {
    logger.warn('Some shutdown callbacks failed', {
      failed: failed.length,
      total: shutdownCallbacks.length
    });
    failed.forEach((result, i) => {
      logger.error(`Shutdown callback failed: ${shutdownCallbacks[i].name}`, {
        error: result.reason?.message || result.reason
      });
    });
  } else {
    logger.info('All shutdown callbacks completed successfully');
  }
}

/**
 * Handle graceful shutdown
 * @param {string} signal - The signal received (SIGTERM or SIGINT)
 */
async function handleShutdown(signal) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal');
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Set timeout for shutdown
  const shutdownTimeout = setTimeout(() => {
    logger.error('Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // Execute all callbacks
    await executeShutdownCallbacks();

    logger.info('Graceful shutdown completed');
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message, stack: error.stack });
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 * Should be called once at application startup
 */
export function setupGracefulShutdown() {
  // Handle SIGTERM (Docker stop, Kubernetes termination)
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack
    });
    handleShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
      reason: reason?.message || reason,
      promise: String(promise)
    });
    handleShutdown('unhandledRejection');
  });

  logger.info('Graceful shutdown handlers registered');
}

/**
 * Check if shutdown is in progress
 * @returns {boolean}
 */
export function isShuttingDownNow() {
  return isShuttingDown;
}

export default {
  setupGracefulShutdown,
  registerShutdownCallback,
  isShuttingDownNow
};
