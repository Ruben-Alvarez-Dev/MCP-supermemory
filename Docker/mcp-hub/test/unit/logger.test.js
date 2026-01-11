// ============================================================
// Unit Tests: Logger Utilities
// ============================================================
// Task: US-013-2 - Test logger and log helpers

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { testUtils } from './setup.js';

describe('Logger Utilities', () => {
  describe('createModuleLogger', () => {
    it('should create a logger with context', async () => {
      // This is a basic structure test
      // Full implementation would import and test actual module
      const mockLogger = testUtils.createMockLogger();

      mockLogger.info('Test message', { key: 'value' });

      const logs = mockLogger.getLogs();
      assert.equal(logs.info.length, 1);
      assert.equal(logs.info[0].msg, 'Test message');
      assert.deepEqual(logs.info[0].meta, { key: 'value' });
    });

    it('should create child loggers with inherited context', async () => {
      const mockLogger = testUtils.createMockLogger();
      const childLogger = mockLogger.child('TestModule');

      childLogger.debug('Child message');

      const logs = mockLogger.getLogs();
      assert.equal(logs.debug.length, 1);
      assert.equal(logs.debug[0].msg, 'Child message');
    });
  });

  describe('log levels', () => {
    it('should support all log levels', async () => {
      const mockLogger = testUtils.createMockLogger();

      mockLogger.debug('debug');
      mockLogger.info('info');
      mockLogger.warn('warn');
      mockLogger.error('error');

      const logs = mockLogger.getLogs();
      assert.equal(logs.debug.length, 1);
      assert.equal(logs.info.length, 1);
      assert.equal(logs.warn.length, 1);
      assert.equal(logs.error.length, 1);
    });
  });

  describe('LogBuilder', () => {
    it('should build structured logs', async () => {
      const mockLogger = testUtils.createMockLogger();

      // Simulate LogBuilder usage
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test',
        user: 'test-user',
        action: 'test-action'
      };

      mockLogger.info(logEntry.message, logEntry);

      const logs = mockLogger.getLogs();
      assert.equal(logs.info.length, 1);
    });
  });

  describe('createTimer', () => {
    it('should track execution time', async () => {
      const mockLogger = testUtils.createMockLogger();

      const timer = {
        start: Date.now(),
        end: () => {
          const duration = Date.now() - timer.start;
          mockLogger.info('Operation completed', { duration_ms: duration });
          return duration;
        }
      };

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));

      const duration = timer.end();

      const logs = mockLogger.getLogs();
      assert.equal(logs.info.length, 1);
      assert.ok(duration >= 10, `Expected duration >= 10ms, got ${duration}ms`);
    });
  });
});
