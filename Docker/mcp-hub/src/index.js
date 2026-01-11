// ============================================================
// MCP-SUPERSERVER - Main Entry Point
// ============================================================
// Wanaku-based MCP router with middleware and all MCP servers

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { logger } from './middleware/logger.js';
import { mcpRouter } from './router.js';
import { healthRouter } from './routes/health.js';
import { metricsRouter } from './routes/metrics.js';

// Load environment variables
dotenv.config();

const app = express();
const HTTP_PORT = process.env.MCP_HUB_PORT || 3000;
const WS_PORT = HTTP_PORT + 1;

// ============================================================
// EXPRESS MIDDLEWARE
// ============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.body
  });
  next();
});

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// ============================================================
// ROUTES
// ============================================================

app.use('/health', healthRouter);
app.use('/metrics', metricsRouter);
app.use('/mcp', mcpRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// HTTP SERVER
// ============================================================

const server = createServer(app);

server.listen(HTTP_PORT, () => {
  logger.info(`MCP-SUPERSERVER Hub listening on port ${HTTP_PORT}`);
  logger.info(`Health: http://localhost:${HTTP_PORT}/health`);
  logger.info(`Metrics: http://localhost:${HTTP_PORT}/metrics`);
  logger.info(`MCP endpoint: http://localhost:${HTTP_PORT}/mcp`);
});

// ============================================================
// WEBSOCKET SERVER (for MCP streaming)
// ============================================================

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      logger.debug('WebSocket message received', { message });

      // Route to appropriate MCP server
      // This is handled by the router
      const response = await mcpRouter.handleWebSocketMessage(message);
      ws.send(JSON.stringify(response));
    } catch (error) {
      logger.error('WebSocket message error', { error: error.message });
      ws.send(JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error', { error: error.message });
  });
});

logger.info(`WebSocket server listening on port ${WS_PORT}`);

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

const shutdown = (signal) => {
  logger.info(`${signal} received, starting graceful shutdown`);

  server.close(() => {
    logger.info('HTTP server closed');
    wss.close(() => {
      logger.info('WebSocket server closed');
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================================
// UNCAUGHT EXCEPTIONS
// ============================================================

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});
