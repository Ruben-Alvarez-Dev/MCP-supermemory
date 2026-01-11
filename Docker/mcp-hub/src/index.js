// ============================================================
// MCP-SUPERSERVER - Main Entry Point
// ============================================================
// Task: US-001-2 - Express Server with middleware integration

import { startServer } from './server.js';
import { logger } from './utils/logger.js';

logger.info('Starting MCP-SUPERSERVER Hub...');

startServer();
