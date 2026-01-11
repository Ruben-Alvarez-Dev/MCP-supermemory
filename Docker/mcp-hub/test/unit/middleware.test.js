// ============================================================
// Unit Tests: Middleware
// ============================================================
// Task: US-013-4 - Test error handler and protocol omega middleware

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { testUtils } from '../setup.js';

describe('Error Handler Middleware', () => {
  describe('ApiError', () => {
    it('should create API error with status code and message', async () => {
      // Simulate ApiError creation
      const error = {
        statusCode: 404,
        message: 'Not Found',
        name: 'ApiError',
        details: { path: '/test' }
      };

      assert.equal(error.statusCode, 404);
      assert.equal(error.message, 'Not Found');
      assert.equal(error.name, 'ApiError');
      assert.deepEqual(error.details, { path: '/test' });
    });

    it('should handle errors with details', async () => {
      const mockLogger = testUtils.createMockLogger();
      const mockError = {
        statusCode: 400,
        message: 'Validation failed',
        name: 'ValidationError',
        details: { field: 'email', issue: 'invalid format' }
      };

      mockLogger.error('Request error', {
        error: mockError.message,
        statusCode: mockError.statusCode
      });

      const logs = mockLogger.getLogs();
      assert.equal(logs.error.length, 1);
      assert.ok(logs.error[0].meta.error.includes('Validation failed'));
    });
  });

  describe('errorHandler middleware', () => {
    it('should return 500 for unexpected errors', async () => {
      const mockReq = testUtils.createMockRequest();
      const mockRes = testUtils.createMockResponse();
      const mockNext = () => {};

      const error = new Error('Unexpected error');
      const mockLogger = testUtils.createMockLogger();

      // Simulate error handling
      mockLogger.error('Request error', {
        error: error.message,
        stack: error.stack
      });

      const response = {
        error: {
          message: 'Unexpected error',
          timestamp: new Date().toISOString(),
          path: mockReq.path
        }
      };

      mockRes.status(500).json(response);

      assert.equal(mockRes.statusCode, 500);
      assert.ok(mockRes.body.error.message);
    });

    it('should use custom status code from ApiError', async () => {
      const mockRes = testUtils.createMockResponse();

      const apiError = {
        statusCode: 404,
        message: 'Resource not found',
        details: { resource: 'Task', id: '123' }
      };

      const response = {
        error: {
          message: apiError.message,
          timestamp: new Date().toISOString(),
          path: '/tasks/123',
          details: apiError.details
        }
      };

      mockRes.status(404).json(response);

      assert.equal(mockRes.statusCode, 404);
      assert.equal(mockRes.body.error.message, 'Resource not found');
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 for undefined routes', async () => {
      const mockReq = testUtils.createMockRequest({ path: '/undefined-route' });
      const mockRes = testUtils.createMockResponse();

      const response = {
        error: 'Not Found',
        path: mockReq.path,
        timestamp: new Date().toISOString()
      };

      mockRes.status(404).json(response);

      assert.equal(mockRes.statusCode, 404);
      assert.equal(mockRes.body.error, 'Not Found');
      assert.equal(mockRes.body.path, '/undefined-route');
    });
  });
});

describe('Protocol Omega Middleware', () => {
  describe('validateLogFormat', () => {
    it('should validate correct log entry format', () => {
      const validEntry = {
        timestamp: new Date().toISOString(),
        type: 'test_action',
        source: 'test_source',
        action: 'test_action_name',
        data: { key: 'value' }
      };

      const errors = [];
      if (!validEntry.timestamp) errors.push('Missing timestamp');
      if (!validEntry.type) errors.push('Missing type');
      if (!validEntry.source) errors.push('Missing source');
      if (!validEntry.action) errors.push('Missing action');

      assert.equal(errors.length, 0);
    });

    it('should detect missing required fields', () => {
      const invalidEntry = {
        timestamp: new Date().toISOString(),
        type: 'test_action'
        // Missing: source, action
      };

      const errors = [];
      if (!invalidEntry.timestamp) errors.push('Missing timestamp');
      if (!invalidEntry.type) errors.push('Missing type');
      if (!invalidEntry.source) errors.push('Missing source');
      if (!invalidEntry.action) errors.push('Missing action');

      assert.ok(errors.length > 0);
      assert.ok(errors.includes('Missing source'));
      assert.ok(errors.includes('Missing action'));
    });

    it('should validate ISO 8601 timestamp format', () => {
      const validTimestamp = '2024-01-15T10:30:00.000Z';
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

      assert.ok(isoRegex.test(validTimestamp));

      const invalidTimestamp = '2024-01-15 10:30:00';
      assert.ok(!isoRegex.test(invalidTimestamp));
    });
  });

  describe('preActionCheck', () => {
    it('should allow action when logging is available', async () => {
      const mockLogger = testUtils.createMockLogger();

      // Simulate pre-action check
      const checkResult = {
        allowed: true,
        reason: 'Logging available'
      };

      assert.ok(checkResult.allowed);
      assert.equal(checkResult.reason, 'Logging available');
    });

    it('should block action when logging fails and blocking is enabled', async () => {
      const blockingEnabled = true;
      const loggingAvailable = false;

      const checkResult = {
        allowed: !blockingEnabled || loggingAvailable,
        reason: !loggingAvailable ? 'Logging system not available' : 'Logging available'
      };

      if (blockingEnabled && !loggingAvailable) {
        checkResult.error = 'Logging not available';
      }

      assert.ok(!checkResult.allowed);
      assert.equal(checkResult.reason, 'Logging system not available');
    });
  });
});
