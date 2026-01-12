// ============================================================
// MCP-SUPERSERVER - MCP Server Entry Point
// ============================================================
// This is the main entry point when running as an MCP server
// To use: node src/mcp-server.js

import { logger } from './utils/logger.js';
import { server } from './mcp/index.js';

logger.info('MCP-SUPERSERVER: Starting as MCP server...');

// The MCP server runs on stdio, no HTTP server needed
// All communication happens via stdin/stdout using MCP protocol

export { server };
