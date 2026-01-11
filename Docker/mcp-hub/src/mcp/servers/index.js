// ============================================================
// MCP Servers Index
// ============================================================
// Central export point for all MCP servers

export { WanakuClient, initializeWanaku, getWanakuClient } from '../wanaku-client.js';
export { BaseMCPServer, createInputSchema, createTool } from '../base-server.js';
export {
  Neo4jMemoryServer,
  createNeo4jMemoryServer
} from './neo4j-memory-server.js';
export {
  ObsidianMemoryServer,
  createObsidianMemoryServer
} from './obsidian-memory-server.js';
export {
  OllamaServer,
  createOllamaServer
} from './ollama-server.js';
export {
  SequentialThinkingServer,
  createSequentialThinkingServer
} from './sequential-thinking-server.js';
export {
  TaskMasterServer,
  createTaskMasterServer
} from './task-master-server.js';

// Server metadata
export const MCPServers = {
  neo4jMemory: {
    name: 'neo4j-memory',
    version: '1.0.0',
    description: 'MCP server for Neo4j graph memory operations',
    class: 'Neo4jMemoryServer',
    creator: createNeo4jMemoryServer
  },
  obsidianMemory: {
    name: 'obsidian-memory',
    version: '1.0.0',
    description: 'MCP server for Obsidian vault operations',
    class: 'ObsidianMemoryServer',
    creator: createObsidianMemoryServer
  },
  ollama: {
    name: 'ollama',
    version: '1.0.0',
    description: 'MCP server for Ollama model operations',
    class: 'OllamaServer',
    creator: createOllamaServer
  },
  sequentialThinking: {
    name: 'sequential-thinking',
    version: '1.0.0',
    description: 'MCP server for reasoning chains',
    class: 'SequentialThinkingServer',
    creator: createSequentialThinkingServer
  },
  taskMaster: {
    name: 'task-master',
    version: '1.0.0',
    description: 'MCP server for task management',
    class: 'TaskMasterServer',
    creator: createTaskMasterServer
  }
};

/**
 * Get all available server info
 */
export function getAllServers() {
  return Object.values(MCPServers);
}

/**
 * Get server by name
 */
export function getServerInfo(name) {
  return MCPServers[name];
}

/**
 * Create server by name
 */
export async function createServer(name, config = {}) {
  const serverInfo = MCPServers[name];

  if (!serverInfo) {
    throw new Error(`Unknown server: ${name}`);
  }

  return serverInfo.creator(config);
}

export default {
  MCPServers,
  getAllServers,
  getServerInfo,
  createServer
};
