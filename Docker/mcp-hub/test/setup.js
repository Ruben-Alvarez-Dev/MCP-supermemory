// ============================================================
// Test Framework Setup
// ============================================================
// Task: US-013-1 - Set up test framework and configuration
// Description: Configure Node.js test runner with mocks

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';

// Test utilities
export const testUtils = {
  /**
   * Create a mock logger
   */
  createMockLogger() {
    const logs = {
      debug: [],
      info: [],
      warn: [],
      error: []
    };

    return {
      debug: (msg, meta) => logs.debug.push({ msg, meta }),
      info: (msg, meta) => logs.info.push({ msg, meta }),
      warn: (msg, meta) => logs.warn.push({ msg, meta }),
      error: (msg, meta) => logs.error.push({ msg, meta }),
      child: (context) => testUtils.createMockLogger(),
      getLogs: () => logs,
      clearLogs: () => {
        logs.debug = [];
        logs.info = [];
        logs.warn = [];
        logs.error = [];
      }
    };
  },

  /**
   * Create a mock Neo4j session
   */
  createMockNeo4jSession() {
    return {
      run: async (cypher, params) => ({
        records: [],
        keys: [],
        summary: { query: { text: cypher } }
      }),
      close: async () => {}
    };
  },

  /**
   * Create a mock Neo4j driver
   */
  createMockNeo4jDriver() {
    return {
      session: () => testUtils.createMockNeo4jSession(),
      close: async () => {}
    };
  },

  /**
   * Wait for async operations
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Create a test request object
   */
  createMockRequest(options = {}) {
    return {
      method: options.method || 'GET',
      path: options.path || '/test',
      query: options.query || {},
      body: options.body || {},
      headers: options.headers || {},
      ip: options.ip || '127.0.0.1',
      get: (header) => options.headers?.[header],
      ...options
    };
  },

  /**
   * Create a test response object
   */
  createMockResponse() {
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      _data: null,

      status(code) {
        this.statusCode = code;
        return this;
      },

      json(data) {
        this.body = data;
        this._data = data;
        return this;
      },

      send(data) {
        this.body = data;
        this._data = data;
        return this;
      },

      setHeader(name, value) {
        this.headers[name] = value;
        return this;
      },

      getHeadersSent() {
        return Object.keys(this.headers).length > 0;
      }
    };

    return res;
  },

  /**
   * Assert that an object has expected properties
   */
  assertHasProperties(obj, props) {
    for (const prop of props) {
      assert.ok(Object.prototype.hasOwnProperty.call(obj, prop),
        `Expected object to have property "${prop}"`);
    }
  },

  /**
   * Assert that a function throws
   */
  async assertThrows(fn, expectedError) {
    try {
      await fn();
      assert.fail('Expected function to throw');
    } catch (error) {
      if (expectedError) {
        assert.ok(error.message.includes(expectedError),
          `Expected error message to include "${expectedError}", got "${error.message}"`);
      }
    }
  }
};

export { describe, it, before, after, mock, assert };
