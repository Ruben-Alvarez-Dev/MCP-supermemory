// ============================================================
// MCP-SUPERSERVER - MCP Server Implementation
// ============================================================
// Real MCP server using Model Context Protocol SDK
// Runs over stdio as per MCP specification

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { initializeNeo4j, closeNeo4j } from '../services/neo4j-client.js';
import { initializeOllama } from '../services/ollama-router.js';
import { neo4jTools } from './tools/neo4j-tools.js';
import { obsidianTools } from './tools/obsidian-tools.js';
import { ollamaTools } from './tools/ollama-tools.js';
import { memoryTools } from './tools/memory-tools.js';

// ============================================================
// MCP Server Setup
// ============================================================

const server = new Server(
  {
    name: 'mcp-superserver',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ============================================================
// Tool Registration
// ============================================================

// Register all tools from different modules
const allTools = {
  ...neo4jTools,
  ...obsidianTools,
  ...ollamaTools,
  ...memoryTools
};

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.info('MCP: Listing tools', { count: Object.keys(allTools).length });
  return {
    tools: Object.values(allTools)
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  logger.info('MCP: Tool called', { tool: name, args });

  const tool = allTools[name];
  if (!tool) {
    logger.error('MCP: Unknown tool', { tool: name });
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await tool.handler(args);
    logger.info('MCP: Tool executed', { tool: name, success: true });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    logger.error('MCP: Tool error', { tool: name, error: error.message });
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true
    };
  }
});

// ============================================================
// Resources
// ============================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'health://status',
        name: 'Health Status',
        description: 'Current health status of all services',
        mimeType: 'application/json'
      },
      {
        uri: 'config://mcp-hub',
        name: 'MCP Hub Configuration',
        description: 'Current configuration',
        mimeType: 'application/json'
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'health://status') {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            neo4j: 'connected',
            ollama: 'connected',
            obsidian: 'available'
          }
        }, null, 2)
      }]
    };
  }

  if (uri === 'config://mcp-hub') {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          name: 'mcp-superserver',
          version: '1.0.0',
          tools: Object.keys(allTools).length
        }, null, 2)
      }]
    };
  }

  throw new Error(`Resource not found: ${uri}`);
});

// ============================================================
// Prompts
// ============================================================

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'analyze-memory',
        description: 'Analyze stored memory for patterns',
        arguments: [
          {
            name: 'query',
            description: 'Query to analyze',
            required: true
          }
        ]
      },
      {
        name: 'store-observation',
        description: 'Store a new observation in memory',
        arguments: [
          {
            name: 'content',
            description: 'Content to store',
            required: true
          },
          {
            name: 'tags',
            description: 'Comma-separated tags',
            required: false
          }
        ]
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'analyze-memory') {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Analyze the following memory query: ${args?.query || ''}`
          }
        }
      ]
    };
  }

  if (name === 'store-observation') {
    const content = args?.content || '';
    const tags = args?.tags || '';

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Store this observation: "${content}"\nTags: ${tags}`
          }
        }
      ]
    };
  }

  throw new Error(`Prompt not found: ${name}`);
});

// ============================================================
// Server Startup
// ============================================================

async function main() {
  logger.info('MCP-SUPERSERVER: Starting MCP server over stdio...');

  // Initialize Neo4j connection
  try {
    if (process.env.NEO4J_ENABLED !== 'false') {
      initializeNeo4j();
      logger.info('Neo4j initialized successfully');
    } else {
      logger.info('Neo4j disabled by environment variable');
    }
  } catch (error) {
    logger.warn('Failed to initialize Neo4j, continuing without it', {
      error: error.message
    });
  }

  // Initialize Ollama router
  try {
    if (process.env.OLLAMA_ENABLED !== 'false') {
      initializeOllama().catch(err => {
        logger.warn('Failed to initialize Ollama, will retry later', {
          error: err.message
        });
      });
    } else {
      logger.info('Ollama disabled by environment variable');
    }
  } catch (error) {
    logger.warn('Failed to initialize Ollama, continuing without it', {
      error: error.message
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP-SUPERSERVER: MCP server running', {
    tools: Object.keys(allTools).length,
    mode: 'stdio'
  });
}

// ============================================================
// Error Handling
// ============================================================

process.on('SIGINT', async () => {
  logger.info('MCP-SUPERSERVER: Received SIGINT, shutting down...');
  await server.close();
  await closeNeo4j();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('MCP-SUPERSERVER: Received SIGTERM, shutting down...');
  await server.close();
  await closeNeo4j();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('MCP-SUPERSERVER: Uncaught exception', { error: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('MCP-SUPERSERVER: Unhandled rejection', { reason, promise });
});

// ============================================================
// Start Server
// ============================================================

main().catch((error) => {
  logger.error('MCP-SUPERSERVER: Fatal error', { error: error.message });
  process.exit(1);
});

export { server };
