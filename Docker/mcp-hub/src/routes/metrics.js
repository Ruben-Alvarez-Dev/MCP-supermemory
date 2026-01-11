// ============================================================
// Metrics Routes (Prometheus)
// ============================================================
// Task: US-001-4 - Implement /metrics endpoint
// Description: Prometheus metrics for service monitoring

import express from 'express';
import promClient from 'prom-client';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Create Registry with default metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'mcp_hub_'
});

// Custom metrics

// HTTP request duration histogram
const httpRequestDuration = new promClient.Histogram({
  name: 'mcp_hub_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
});

// MCP tool calls counter
const mcpToolCalls = new promClient.Counter({
  name: 'mcp_hub_tool_calls_total',
  help: 'Total number of MCP tool calls',
  labelNames: ['tool_name', 'server', 'status']
});

// Active connections gauge
const activeConnections = new promClient.Gauge({
  name: 'mcp_hub_active_connections',
  help: 'Number of active MCP connections'
});

// Neo4j operations metrics
const neo4jOperations = new promClient.Counter({
  name: 'mcp_hub_neo4j_operations_total',
  help: 'Total Neo4j database operations',
  labelNames: ['operation', 'status']
});

// Ollama request metrics
const ollamaRequests = new promClient.Counter({
  name: 'mcp_hub_ollama_requests_total',
  help: 'Total Ollama inference requests',
  labelNames: ['model', 'status']
});

const ollamaRequestDuration = new promClient.Histogram({
  name: 'mcp_hub_ollama_request_duration_seconds',
  help: 'Duration of Ollama requests in seconds',
  labelNames: ['model'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120]
});

// Obsidian write operations
const obsidianWrites = new promClient.Counter({
  name: 'mcp_hub_obsidian_writes_total',
  help: 'Total Obsidian markdown write operations',
  labelNames: ['status']
});

// Register all custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(mcpToolCalls);
register.registerMetric(activeConnections);
register.registerMetric(neo4jOperations);
register.registerMetric(ollamaRequests);
register.registerMetric(ollamaRequestDuration);
register.registerMetric(obsidianWrites);

/**
 * GET /metrics
 * Returns Prometheus metrics in text format
 */
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Metrics export failed', { error: error.message });
    res.status(500).end(error.message);
  }
});

/**
 * Middleware factory to track HTTP request duration
 */
export function httpMetricsMiddleware() {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route ? req.route.path : req.path;

      httpRequestDuration
        .labels(req.method, route, res.statusCode)
        .observe(duration);
    });

    next();
  };
}

/**
 * Helper functions to record metrics
 */

export function recordToolCall(toolName, server, status) {
  mcpToolCalls.labels(toolName, server, status).inc();
  logger.debug('Tool call recorded', { tool: toolName, server, status });
}

export function setActiveConnections(count) {
  activeConnections.set(count);
}

export function incrementActiveConnections() {
  activeConnections.inc();
}

export function decrementActiveConnections() {
  activeConnections.dec();
}

export function recordNeo4jOperation(operation, status) {
  neo4jOperations.labels(operation, status).inc();
}

export function recordOllamaRequest(model, status, duration) {
  ollamaRequests.labels(model, status).inc();
  if (duration) {
    ollamaRequestDuration.labels(model).observe(duration);
  }
}

export function recordObsidianWrite(status) {
  obsidianWrites.labels(status).inc();
}

// Export register for potential custom metric additions
export { register };

export default router;
