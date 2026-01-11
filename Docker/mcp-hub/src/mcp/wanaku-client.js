// ============================================================
// Wanaku MCP Router Client
// ============================================================
// Task: US-007-2 - Implement Wanaku client wrapper
// Description: Client for interacting with Wanaku MCP router

import { logger } from '../utils/logger.js';
import { createModuleLogger } from '../utils/log-helpers.js';

const wanakuLogger = createModuleLogger('WanakuClient');

/**
 * Wanaku configuration
 */
const wanakuConfig = {
  host: process.env.WANAKU_HOST || 'localhost',
  port: process.env.WANAKU_PORT || 3000,
  protocol: process.env.WANAKU_PROTOCOL || 'http',
  timeout: parseInt(process.env.WANAKU_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.WANAKU_MAX_RETRIES || '3')
};

/**
 * Wanaku MCP Router Client
 */
export class WanakuClient {
  constructor(config = {}) {
    this.config = { ...wanakuConfig, ...config };
    this.baseUrl = `${this.config.protocol}://${this.config.host}:${this.config.port}`;
    this.registeredServers = new Map();
  }

  /**
   * Get Wanaku base URL
   */
  getBaseUrl() {
    return this.baseUrl;
  }

  /**
   * Health check for Wanaku router
   */
  async healthCheck() {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      wanakuLogger.info('Wanaku health check successful', {
        duration_ms: duration
      });

      return {
        status: 'healthy',
        data,
        response_time_ms: duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      wanakuLogger.error('Wanaku health check failed', {
        error: error.message,
        duration_ms: duration
      });

      return {
        status: 'unhealthy',
        error: error.message,
        response_time_ms: duration
      };
    }
  }

  /**
   * Register an MCP server with Wanaku
   */
  async registerServer(serverConfig) {
    const { name, endpoint, tools, capabilities } = serverConfig;

    wanakuLogger.info('Registering MCP server with Wanaku', {
      name,
      endpoint,
      toolCount: tools?.length || 0
    });

    try {
      // Store server configuration locally
      this.registeredServers.set(name, {
        endpoint,
        tools: tools || [],
        capabilities: capabilities || {},
        registered_at: new Date().toISOString(),
        status: 'registered'
      });

      wanakuLogger.info('MCP server registered successfully', { name });

      return {
        success: true,
        server: name,
        message: `Server ${name} registered successfully`
      };
    } catch (error) {
      wanakuLogger.error('Failed to register MCP server', {
        name,
        error: error.message
      });

      return {
        success: false,
        server: name,
        error: error.message
      };
    }
  }

  /**
   * Unregister an MCP server
   */
  async unregisterServer(serverName) {
    wanakuLogger.info('Unregistering MCP server', { serverName });

    try {
      const server = this.registeredServers.get(serverName);

      if (!server) {
        throw new Error(`Server ${serverName} not found`);
      }

      this.registeredServers.delete(serverName);

      wanakuLogger.info('MCP server unregistered successfully', { serverName });

      return {
        success: true,
        server: serverName,
        message: `Server ${serverName} unregistered successfully`
      };
    } catch (error) {
      wanakuLogger.error('Failed to unregister MCP server', {
        serverName,
        error: error.message
      });

      return {
        success: false,
        server: serverName,
        error: error.message
      };
    }
  }

  /**
   * List all registered servers
   */
  listServers() {
    const servers = Array.from(this.registeredServers.entries()).map(([name, config]) => ({
      name,
      ...config
    }));

    wanakuLogger.debug('Listing registered servers', { count: servers.length });

    return servers;
  }

  /**
   * Get server by name
   */
  getServer(serverName) {
    return this.registeredServers.get(serverName);
  }

  /**
   * Check if server exists
   */
  hasServer(serverName) {
    return this.registeredServers.has(serverName);
  }

  /**
   * Route tool call to appropriate server
   */
  async routeToolCall(toolName, args, options = {}) {
    const { serverName, timeout } = options;

    wanakuLogger.debug('Routing tool call', {
      toolName,
      serverName,
      args
    });

    if (!serverName) {
      // Find server that has this tool
      for (const [name, server] of this.registeredServers.entries()) {
        if (server.tools.includes(toolName)) {
          return this.callServerTool(name, toolName, args, { timeout });
        }
      }

      throw new Error(`Tool ${toolName} not found in any registered server`);
    }

    return this.callServerTool(serverName, toolName, args, { timeout });
  }

  /**
   * Call tool on specific server
   */
  async callServerTool(serverName, toolName, args, options = {}) {
    const server = this.registeredServers.get(serverName);

    if (!server) {
      throw new Error(`Server ${serverName} not registered`);
    }

    if (!server.tools.includes(toolName)) {
      throw new Error(`Tool ${toolName} not available on server ${serverName}`);
    }

    wanakuLogger.info('Calling server tool', {
      server: serverName,
      tool: toolName,
      args
    });

    try {
      const response = await fetch(`${server.endpoint}/tools/${toolName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(options.timeout || this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      wanakuLogger.info('Server tool call successful', {
        server: serverName,
        tool: toolName
      });

      return result;
    } catch (error) {
      wanakuLogger.error('Server tool call failed', {
        server: serverName,
        tool: toolName,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Discover available tools across all servers
   */
  discoverTools() {
    const tools = [];

    for (const [serverName, server] of this.registeredServers.entries()) {
      for (const tool of server.tools) {
        tools.push({
          name: tool,
          server: serverName,
          capabilities: server.capabilities
        });
      }
    }

    wanakuLogger.debug('Discovered tools', { count: tools.length });

    return tools;
  }

  /**
   * Get server statistics
   */
  getStats() {
    const stats = {
      total_servers: this.registeredServers.size,
      total_tools: 0,
      servers_by_status: {},
      tools_by_server: {}
    };

    for (const [name, server] of this.registeredServers.entries()) {
      stats.total_tools += server.tools.length;
      stats.tools_by_server[name] = server.tools.length;

      const status = server.status || 'unknown';
      stats.servers_by_status[status] = (stats.servers_by_status[status] || 0) + 1;
    }

    return stats;
  }
}

/**
 * Global Wanaku client instance
 */
let globalClient = null;

/**
 * Initialize global Wanaku client
 */
export function initializeWanaku(config) {
  if (globalClient) {
    wanakuLogger.warn('Wanaku client already initialized');
    return globalClient;
  }

  globalClient = new WanakuClient(config);
  wanakuLogger.info('Wanaku client initialized', {
    baseUrl: globalClient.getBaseUrl()
  });

  return globalClient;
}

/**
 * Get global Wanaku client instance
 */
export function getWanakuClient() {
  if (!globalClient) {
    throw new Error('Wanaku client not initialized. Call initializeWanaku() first.');
  }

  return globalClient;
}

/**
 * Check if Wanaku client is initialized
 */
export function isWanakuInitialized() {
  return globalClient !== null;
}

export default {
  WanakuClient,
  initializeWanaku,
  getWanakuClient,
  isWanakuInitialized,
  wanakuConfig
};
