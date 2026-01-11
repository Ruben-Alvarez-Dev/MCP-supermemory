// ============================================================
// Protocol Omega Middleware v2.0
// ============================================================
// Task: US-006 - Enforce mandatory logging for all AI actions
// Description: AI governance protocol ensuring no action goes unrecorded

import { logger } from '../utils/logger.js';
import { writeLogEntry, writeError } from '../services/obsidian-writer.js';
import { createModuleLogger } from '../utils/log-helpers.js';

const omegaLogger = createModuleLogger('ProtocolOmega');

/**
 * Protocol Omega configuration
 */
const omegaConfig = {
  enforceLogging: process.env.OMEGA_ENFORCE_LOGGING !== 'false',
  blockOnFailure: process.env.OMEGA_BLOCK_ON_FAILURE !== 'false',
  requireTimestamp: true,
  requireSource: true,
  requireAction: true,
  iso8601Strict: true,
  validateSchema: true
};

/**
 * Log entry schema validation
 */
const logEntrySchema = {
  timestamp: 'string',
  type: 'string',
  source: 'string',
  action: 'string',
  data: 'object'
};

/**
 * Validate ISO 8601 timestamp
 */
function isValidISO8601(timestamp) {
  if (!omegaConfig.iso8601Strict) return true;

  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  if (!isoRegex.test(timestamp)) {
    return false;
  }

  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}

/**
 * Validate log entry schema
 */
function validateLogEntry(entry) {
  const errors = [];

  // Check required fields
  if (omegaConfig.requireTimestamp && !entry.timestamp) {
    errors.push('Missing required field: timestamp');
  } else if (entry.timestamp && !isValidISO8601(entry.timestamp)) {
    errors.push('Invalid ISO 8601 timestamp format');
  }

  if (omegaConfig.requireSource && !entry.source) {
    errors.push('Missing required field: source');
  }

  if (omegaConfig.requireAction && !entry.action) {
    errors.push('Missing required field: action');
  }

  if (!entry.type) {
    errors.push('Missing required field: type');
  }

  // Validate types
  if (entry.timestamp && typeof entry.timestamp !== 'string') {
    errors.push('Field timestamp must be a string');
  }

  if (entry.source && typeof entry.source !== 'string') {
    errors.push('Field source must be a string');
  }

  if (entry.action && typeof entry.action !== 'string') {
    errors.push('Field action must be a string');
  }

  if (entry.type && typeof entry.type !== 'string') {
    errors.push('Field type must be a string');
  }

  if (entry.data && typeof entry.data !== 'object') {
    errors.push('Field data must be an object');
  }

  return errors;
}

/**
 * Pre-action check
 * Verifies that logging is available before allowing action
 */
export async function preActionCheck(context) {
  omegaLogger.debug('Pre-action check', { context });

  // Check if Obsidian logging is available
  try {
    const { obsidianConfig } = await import('../services/obsidian-writer.js');
    const fs = await import('fs/promises');

    // Check vault directory exists/writable
    await fs.mkdir(obsidianConfig.vaultPath, { recursive: true });

    return {
      allowed: true,
      reason: 'Logging available'
    };
  } catch (error) {
    const message = 'Logging system not available';

    omegaLogger.error('Pre-action check failed', {
      error: error.message,
      context
    });

    if (omegaConfig.blockOnFailure) {
      return {
        allowed: false,
        reason: message,
        error: error.message
      };
    }

    // If not blocking, just warn
    omegaLogger.warn('Proceeding despite logging failure', {
      error: error.message,
      context
    });

    return {
      allowed: true,
      reason: 'Logging failed but proceeding (blocking disabled)',
      warning: error.message
    };
  }
}

/**
 * Validate log entry format
 */
export function validateLogFormat(entry) {
  if (!omegaConfig.validateSchema) {
    return { valid: true, errors: [] };
  }

  const errors = validateLogEntry(entry);

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Enforce Protocol Omega logging
 * Main middleware function
 */
export async function enforceProtocolOmega(entry) {
  const startTime = Date.now();

  try {
    omegaLogger.debug('Protocol Omega enforcement', {
      type: entry.type,
      source: entry.source,
      action: entry.action
    });

    // Step 1: Pre-action check
    const preCheck = await preActionCheck({
      type: entry.type,
      source: entry.source,
      action: entry.action
    });

    if (!preCheck.allowed && omegaConfig.blockOnFailure) {
      const error = new Error('Protocol Omega: Action blocked - logging not available');
      error.code = 'OMEGA_BLOCKED';
      error.details = preCheck;
      throw error;
    }

    // Step 2: Schema validation
    const validation = validateLogFormat(entry);

    if (!validation.valid) {
      const error = new Error('Protocol Omega: Invalid log entry format');
      error.code = 'OMEGA_INVALID_FORMAT';
      error.details = { validationErrors: validation.errors, entry };
      throw error;
    }

    // Step 3: Write log entry
    await writeLogEntry(entry);

    const duration = Date.now() - startTime;

    omegaLogger.info('Protocol Omega compliance verified', {
      type: entry.type,
      source: entry.source,
      action: entry.action,
      duration_ms: duration
    });

    return {
      success: true,
      logged: true,
      duration_ms: duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    omegaLogger.error('Protocol Omega violation', {
      error: error.message,
      code: error.code,
      entry,
      duration_ms: duration
    });

    // Write error about the violation
    try {
      await writeError(error, {
        source: 'protocol-omega',
        entry
      });
    } catch (writeError_) {
      omegaLogger.error('Failed to write Protocol Omega error', {
        error: writeError_.message
      });
    }

    // If enforcement is enabled, block the action
    if (omegaConfig.enforceLogging) {
      throw error;
    }

    // Otherwise, return failure but don't block
    return {
      success: false,
      logged: false,
      error: error.message,
      duration_ms: duration
    };
  }
}

/**
 * Post-action verification
 * Confirms logging was successful after action completion
 */
export async function postActionVerification(entry, actionResult) {
  omegaLogger.debug('Post-action verification', {
    type: entry.type,
    source: entry.source,
    action: entry.action
  });

  try {
    // Log the action result
    const resultEntry = {
      ...entry,
      action: `${entry.action}_result`,
      data: {
        ...entry.data,
        result: actionResult
      }
    };

    await writeLogEntry(resultEntry);

    omegaLogger.info('Post-action verification completed', {
      type: entry.type,
      source: entry.source,
      action: entry.action
    });

    return {
      verified: true
    };
  } catch (error) {
    omegaLogger.error('Post-action verification failed', {
      error: error.message,
      entry
    });

    return {
      verified: false,
      error: error.message
    };
  }
}

/**
 * Express middleware for Protocol Omega
 * Logs all HTTP requests to Obsidian
 */
export function protocolOmegaMiddleware(req, res, next) {
  // Store original end function
  const originalEnd = res.end;

  // Override end function to log after response
  res.end = function(...args) {
    // Restore original end
    res.end = originalEnd;

    // Call original end
    originalEnd.apply(this, args);

    // Log the request asynchronously
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'http_request',
      source: 'express',
      action: req.method,
      data: {
        method: req.method,
        path: req.path,
        query: req.query,
        status: res.statusCode,
        ip: req.ip,
        userAgent: req.get('user-agent')
      },
      tags: ['http', req.method.toLowerCase()]
    };

    enforceProtocolOmega(logEntry).catch(error => {
      omegaLogger.error('Failed to log HTTP request', {
        error: error.message,
        path: req.path
      });
    });
  };

  next();
}

/**
 * Wrapper for MCP tool calls with Protocol Omega enforcement
 */
export async function wrappedMcpCall(toolName, server, args, toolFunction) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'tool_call',
    source: server,
    action: toolName,
    data: {
      arguments: args
    },
    tags: ['mcp', 'tool-call', server, toolName]
  };

  // Pre-action check
  await enforceProtocolOmega({
    ...logEntry,
    action: `${toolName}_precheck`
  });

  let result;
  try {
    // Execute the actual tool call
    result = await toolFunction(...args);

    // Post-action verification
    await postActionVerification(logEntry, result);

    return result;
  } catch (error) {
    // Log the error
    await writeError(error, {
      source: server,
      tool: toolName,
      args
    });

    throw error;
  }
}

/**
 * Check Protocol Omega compliance status
 */
export function getComplianceStatus() {
  return {
    enforceLogging: omegaConfig.enforceLogging,
    blockOnFailure: omegaConfig.blockOnFailure,
    requireTimestamp: omegaConfig.requireTimestamp,
    requireSource: omegaConfig.requireSource,
    requireAction: omegaConfig.requireAction,
    iso8601Strict: omegaConfig.iso8601Strict,
    validateSchema: omegaConfig.validateSchema
  };
}

/**
 * Configure Protocol Omega
 */
export function configureProtocolOmega(config) {
  Object.assign(omegaConfig, config);
  omegaLogger.info('Protocol Omega configuration updated', omegaConfig);
}

export default {
  enforceProtocolOmega,
  preActionCheck,
  validateLogFormat,
  postActionVerification,
  protocolOmegaMiddleware,
  wrappedMcpCall,
  getComplianceStatus,
  configureProtocolOmega
};
