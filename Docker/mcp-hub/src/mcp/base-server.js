// ============================================================
// Base MCP Server
// ============================================================
// Task: US-007-3 - MCP Server Base Implementation
// Description: Base class for all MCP server implementations

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '../utils/logger.js';
import { createModuleLogger } from '../utils/log-helpers.js';

const mcpLogger = createModuleLogger('MCPServer');

/**
 * Base MCP Server class
 * All MCP servers should extend this class
 */
export class BaseMCPServer {
  constructor(config) {
    this.name = config.name;
    this.version = config.version || '1.0.0';
    this.description = config.description || '';
    this.tools = new Map();
    this.resources = new Map();
    this.server = null;
    this.transport = null;
    this.capabilities = config.capabilities || {};
  }

  /**
   * Get server info
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      capabilities: this.capabilities,
      toolCount: this.tools.size,
      resourceCount: this.resources.size
    };
  }

  /**
   * Register a tool
   */
  registerTool(tool) {
    const { name, description, inputSchema, handler } = tool;

    if (!name || !description || !inputSchema || !handler) {
      throw new Error('Tool must have name, description, inputSchema, and handler');
    }

    this.tools.set(name, {
      name,
      description,
      inputSchema,
      handler
    });

    mcpLogger.debug(`Tool registered: ${name}`);
  }

  /**
   * Register multiple tools
   */
  registerTools(toolsArray) {
    for (const tool of toolsArray) {
      this.registerTool(tool);
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * List all tools
   */
  listTools() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  /**
   * Call a tool
   */
  async callTool(name, args) {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    mcpLogger.debug(`Calling tool: ${name}`, { args });

    try {
      const result = await tool.handler(args);

      mcpLogger.info(`Tool ${name} executed successfully`);

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      mcpLogger.error(`Tool ${name} execution failed`, {
        error: error.message
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              tool: name
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Register a resource
   */
  registerResource(resource) {
    const { uri, name, description, mimeType, handler } = resource;

    if (!uri || !handler) {
      throw new Error('Resource must have uri and handler');
    }

    this.resources.set(uri, {
      uri,
      name: name || uri,
      description: description || '',
      mimeType: mimeType || 'text/plain',
      handler
    });

    mcpLogger.debug(`Resource registered: ${uri}`);
  }

  /**
   * List all resources
   */
  listResources() {
    return Array.from(this.resources.values()).map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }));
  }

  /**
   * Read a resource
   */
  async readResource(uri) {
    const resource = this.resources.get(uri);

    if (!resource) {
      throw new Error(`Resource ${uri} not found`);
    }

    mcpLogger.debug(`Reading resource: ${uri}`);

    try {
      const content = await resource.handler();

      mcpLogger.info(`Resource ${uri} read successfully`);

      return {
        contents: [
          {
            uri,
            mimeType: resource.mimeType,
            text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
          }
        ]
      };
    } catch (error) {
      mcpLogger.error(`Resource ${uri} read failed`, {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Initialize the MCP server
   */
  async initialize() {
    mcpLogger.info(`Initializing MCP server: ${this.name}`);

    // Create server instance
    this.server = new Server(
      {
        name: this.name,
        version: this.version
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          ...this.capabilities
        }
      }
    );

    // Register tool handler
    this.server.setRequestHandler('tools/list', async () => {
      return { tools: this.listTools() };
    });

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      return this.callTool(name, args || {});
    });

    // Register resource handler
    this.server.setRequestHandler('resources/list', async () => {
      return { resources: this.listResources() };
    });

    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;
      return this.readResource(uri);
    });

    mcpLogger.info(`MCP server ${this.name} initialized successfully`);
  }

  /**
   * Start the server (connect transport)
   */
  async start() {
    if (!this.server) {
      await this.initialize();
    }

    mcpLogger.info(`Starting MCP server: ${this.name}`);

    // Use stdio transport
    this.transport = new StdioServerTransport();

    await this.server.connect(this.transport);

    mcpLogger.info(`MCP server ${this.name} started`);
  }

  /**
   * Stop the server
   */
  async stop() {
    mcpLogger.info(`Stopping MCP server: ${this.name}`);

    if (this.server) {
      await this.server.close();
      this.server = null;
    }

    if (this.transport) {
      this.transport = null;
    }

    mcpLogger.info(`MCP server ${this.name} stopped`);
  }

  /**
   * Get server instance
   */
  getServer() {
    return this.server;
  }

  /**
   * Check if server is running
   */
  isRunning() {
    return this.server !== null && this.transport !== null;
  }
}

/**
 * Helper function to create input schema for tools
 */
export function createInputSchema(properties, required = []) {
  return {
    type: 'object',
    properties,
    required
  };
}

/**
 * Helper function to create a tool definition
 */
export function createTool(name, description, inputSchema, handler) {
  return {
    name,
    description,
    inputSchema,
    handler
  };
}

export default {
  BaseMCPServer,
  createInputSchema,
  createTool
};
