// ============================================================
// Express Server Setup
// ============================================================
// Task: US-001-2 - Express Server with middleware
// Description: Main HTTP server for MCP Hub

import express from 'express';
import { logger } from './utils/logger.js';
import { setupGracefulShutdown, registerShutdownCallback } from './utils/graceful-shutdown.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger, requestId } from './middleware/request-logger.js';
import { httpMetricsMiddleware } from './routes/metrics.js';
import healthRoutes from './routes/health.js';
import metricsRoutes from './routes/metrics.js';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ============================================================
// Middleware Setup
// ============================================================

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID
app.use(requestId);

// Request logging
app.use(requestLogger);

// Metrics collection
app.use(httpMetricsMiddleware());

// Trust proxy for proper IP detection behind reverse proxy
app.set('trust proxy', true);

// ============================================================
// Routes
// ============================================================

// Health check routes
app.use('/health', healthRoutes);

// Metrics route (Prometheus)
app.use('/metrics', metricsRoutes);

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'MCP Hub',
    version: process.env.npm_package_version || '1.0.0',
    description: 'MCP Superserver Hub with Wanaku router',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      mcp: '/mcp/*'
    },
    documentation: 'https://github.com/Ruben-Alvarez-Dev/MCP-superserver'
  });
});

// ============================================================
// Error Handling
// ============================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ============================================================
// Server Startup
// ============================================================

let server;

function startServer() {
  server = app.listen(PORT, HOST, () => {
    logger.info(`MCP Hub server started`, {
      host: HOST,
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      node_version: process.version,
      timestamp: new Date().toISOString()
    });
  });

  // Register server shutdown callback
  registerShutdownCallback(async () => {
    logger.info('Closing HTTP server...');

    return new Promise((resolve) => {
      server.close((err) => {
        if (err) {
          logger.error('Error closing server', { error: err.message });
          resolve();
        } else {
          logger.info('HTTP server closed successfully');
          resolve();
        }

        // Force close after 10 seconds
        setTimeout(() => {
          logger.warn('Forcing server close after timeout');
          resolve();
        }, 10000);
      });
    });
  }, 'http-server');

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} already in use`);
      process.exit(1);
    } else {
      logger.error('Server error', { error: error.message });
      process.exit(1);
    }
  });
}

// ============================================================
// Graceful Shutdown Setup
// ============================================================

setupGracefulShutdown();

// ============================================================
// Start Server
// ============================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app;
export { startServer };
