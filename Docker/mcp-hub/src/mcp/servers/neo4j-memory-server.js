// ============================================================
// Neo4j Memory MCP Server
// ============================================================
// Task: US-008 - MCP Server for Neo4j graph memory
// Description: Access structured graph memory through MCP

import { BaseMCPServer, createTool, createInputSchema } from '../base-server.js';
import {
  createEntity,
  getEntityById,
  findEntities,
  updateEntity,
  deleteEntity,
  countEntities
} from '../../services/neo4j-entities.js';
import {
  createRelationship,
  getEntityRelationships,
  findRelationship
} from '../../services/neo4j-relationships.js';
import {
  findConnectedEntities,
  findShortestPath,
  getRelationshipStats
} from '../../services/neo4j-query-builder.js';
import { logger } from '../../utils/logger.js';
import { createModuleLogger } from '../../utils/log-helpers.js';

const serverLogger = createModuleLogger('Neo4jMemoryServer');

/**
 * Neo4j Memory MCP Server
 * Provides tools for managing graph entities and relationships
 */
export class Neo4jMemoryServer extends BaseMCPServer {
  constructor() {
    super({
      name: 'neo4j-memory',
      version: '1.0.0',
      description: 'MCP server for Neo4j graph memory operations',
      capabilities: {
        tools: {}
      }
    });

    this.registerTools();
  }

  /**
   * Register all Neo4j memory tools
   */
  registerTools() {
    // Create entity tool
    this.registerTool(createTool(
      'create_entity',
      'Create a new entity (node) in the Neo4j graph',
      createInputSchema({
        label: {
          type: 'string',
          description: 'Entity label (e.g., Person, Concept, Event)'
        },
        id: {
          type: 'string',
          description: 'Unique identifier for the entity'
        },
        properties: {
          type: 'object',
          description: 'Additional properties for the entity',
          additionalProperties: true
        }
      }, ['label', 'id']),
      async (args) => {
        const { label, id, properties = {} } = args;

        serverLogger.info('Creating entity', { label, id });

        const entity = await createEntity(label, { id, ...properties });

        return {
          success: true,
          entity: {
            label,
            id,
            ...properties
          },
          internalId: entity.identity.toInt()
        };
      }
    ));

    // Get entity tool
    this.registerTool(createTool(
      'get_entity',
      'Get an entity by ID from the Neo4j graph',
      createInputSchema({
        label: {
          type: 'string',
          description: 'Entity label'
        },
        id: {
          type: 'string',
          description: 'Entity identifier'
        }
      }, ['label', 'id']),
      async (args) => {
        const { label, id } = args;

        serverLogger.info('Getting entity', { label, id });

        const entity = await getEntityById(label, id);

        if (!entity) {
          return {
            success: false,
            error: 'Entity not found'
          };
        }

        return {
          success: true,
          entity: entity.properties
        };
      }
    ));

    // Find entities tool
    this.registerTool(createTool(
      'find_entities',
      'Find entities by label and properties',
      createInputSchema({
        label: {
          type: 'string',
          description: 'Entity label'
        },
        properties: {
          type: 'object',
          description: 'Properties to match',
          additionalProperties: true
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 100
        }
      }, ['label']),
      async (args) => {
        const { label, properties = {}, limit = 100 } = args;

        serverLogger.info('Finding entities', { label, properties, limit });

        const entities = await findEntities(label, properties, limit);

        return {
          success: true,
          count: entities.length,
          entities: entities.map(e => e.properties)
        };
      }
    ));

    // Update entity tool
    this.registerTool(createTool(
      'update_entity',
      'Update an existing entity in the Neo4j graph',
      createInputSchema({
        label: {
          type: 'string',
          description: 'Entity label'
        },
        id: {
          type: 'string',
          description: 'Entity identifier'
        },
        properties: {
          type: 'object',
          description: 'Properties to update',
          additionalProperties: true
        }
      }, ['label', 'id', 'properties']),
      async (args) => {
        const { label, id, properties } = args;

        serverLogger.info('Updating entity', { label, id, properties });

        const entity = await updateEntity(label, id, properties);

        if (!entity) {
          return {
            success: false,
            error: 'Entity not found'
          };
        }

        return {
          success: true,
          entity: entity.properties
        };
      }
    ));

    // Delete entity tool
    this.registerTool(createTool(
      'delete_entity',
      'Delete an entity from the Neo4j graph',
      createInputSchema({
        label: {
          type: 'string',
          description: 'Entity label'
        },
        id: {
          type: 'string',
          description: 'Entity identifier'
        }
      }, ['label', 'id']),
      async (args) => {
        const { label, id } = args;

        serverLogger.info('Deleting entity', { label, id });

        const deleted = await deleteEntity(label, id);

        return {
          success: deleted,
          message: deleted ? 'Entity deleted successfully' : 'Entity not found'
        };
      }
    ));

    // Count entities tool
    this.registerTool(createTool(
      'count_entities',
      'Count entities by label',
      createInputSchema({
        label: {
          type: 'string',
          description: 'Entity label'
        }
      }, ['label']),
      async (args) => {
        const { label } = args;

        serverLogger.info('Counting entities', { label });

        const count = await countEntities(label);

        return {
          success: true,
          label,
          count
        };
      }
    ));

    // Create relationship tool
    this.registerTool(createTool(
      'create_relationship',
      'Create a relationship between two entities',
      createInputSchema({
        fromLabel: {
          type: 'string',
          description: 'Source entity label'
        },
        fromId: {
          type: 'string',
          description: 'Source entity identifier'
        },
        relationshipType: {
          type: 'string',
          description: 'Type of relationship (e.g., KNOWS, RELATED_TO, PART_OF)'
        },
        toLabel: {
          type: 'string',
          description: 'Target entity label'
        },
        toId: {
          type: 'string',
          description: 'Target entity identifier'
        },
        properties: {
          type: 'object',
          description: 'Additional properties for the relationship',
          additionalProperties: true
        }
      }, ['fromLabel', 'fromId', 'relationshipType', 'toLabel', 'toId']),
      async (args) => {
        const { fromLabel, fromId, relationshipType, toLabel, toId, properties = {} } = args;

        serverLogger.info('Creating relationship', {
          from: fromLabel,
          fromId,
          type: relationshipType,
          to: toLabel,
          toId
        });

        const relationship = await createRelationship(
          fromLabel,
          fromId,
          relationshipType,
          toLabel,
          toId,
          properties
        );

        return {
          success: true,
          relationship: {
            from: fromId,
            type: relationshipType,
            to: toId,
            properties
          }
        };
      }
    ));

    // Get relationships tool
    this.registerTool(createTool(
      'get_relationships',
      'Get relationships for an entity',
      createInputSchema({
        label: {
          type: 'string',
          description: 'Entity label'
        },
        id: {
          type: 'string',
          description: 'Entity identifier'
        },
        direction: {
          type: 'string',
          description: 'Relationship direction (incoming, outgoing, or both)',
          enum: ['incoming', 'outgoing', 'both'],
          default: 'both'
        },
        type: {
          type: 'string',
          description: 'Filter by relationship type (optional)'
        }
      }, ['label', 'id']),
      async (args) => {
        const { label, id, direction = 'both', type } = args;

        serverLogger.info('Getting relationships', { label, id, direction, type });

        const relationships = await getEntityRelationships(label, id, direction, type);

        return {
          success: true,
          count: relationships.length,
          relationships: relationships.map(r => ({
            type: r.relationship.type,
            from: r.otherEntity.properties,
            to: r.otherEntity.properties
          }))
        };
      }
    ));

    // Query graph tool (pattern matching)
    this.registerTool(createTool(
      'query_graph',
      'Query the graph for connected entities and patterns',
      createInputSchema({
        label: {
          type: 'string',
          description: 'Starting entity label'
        },
        id: {
          type: 'string',
          description: 'Starting entity identifier'
        },
        pattern: {
          type: 'string',
          description: 'Pattern type (connected, path, stats)',
          enum: ['connected', 'path', 'stats'],
          default: 'connected'
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum depth for graph traversal',
          default: 2
        }
      }, ['label', 'id']),
      async (args) => {
        const { label, id, pattern = 'connected', maxDepth = 2 } = args;

        serverLogger.info('Querying graph', { label, id, pattern, maxDepth });

        let result;

        switch (pattern) {
          case 'connected':
            const connected = await findConnectedEntities(label, id, maxDepth);
            result = {
              type: 'connected_entities',
              entities: connected.map(c => ({
                entity: c.entity.properties,
                labels: c.labels
              }))
            };
            break;

          case 'path':
            // For path finding, we need a target - will use a generic find
            result = {
              type: 'path',
              message: 'Path finding requires specific target entities. Use get_relationships for direct connections.'
            };
            break;

          case 'stats':
            const stats = await getRelationshipStats(label, id);
            result = {
              type: 'relationship_stats',
              stats
            };
            break;

          default:
            result = { type: 'unknown', error: 'Invalid pattern type' };
        }

        return {
          success: true,
          result
        };
      }
    ));

    // Find shortest path tool
    this.registerTool(createTool(
      'find_shortest_path',
      'Find the shortest path between two entities',
      createInputSchema({
        fromLabel: {
          type: 'string',
          description: 'Source entity label'
        },
        fromId: {
          type: 'string',
          description: 'Source entity identifier'
        },
        toLabel: {
          type: 'string',
          description: 'Target entity label'
        },
        toId: {
          type: 'string',
          description: 'Target entity identifier'
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum path length',
          default: 5
        }
      }, ['fromLabel', 'fromId', 'toLabel', 'toId']),
      async (args) => {
        const { fromLabel, fromId, toLabel, toId, maxDepth = 5 } = args;

        serverLogger.info('Finding shortest path', {
          from: fromLabel,
          fromId,
          to: toLabel,
          toId,
          maxDepth
        });

        const path = await findShortestPath(fromLabel, fromId, toLabel, toId, maxDepth);

        if (!path) {
          return {
            success: true,
            found: false,
            message: 'No path found between entities'
          };
        }

        return {
          success: true,
          found: true,
          path: {
            length: path.length,
            nodes: path.nodes,
            relationships: path.relationshipTypes
          }
        };
      }
    ));

    serverLogger.info('Neo4j Memory tools registered', {
      count: this.tools.size
    });
  }
}

/**
 * Create and start the Neo4j Memory server
 */
export async function createNeo4jMemoryServer() {
  const server = new Neo4jMemoryServer();
  await server.initialize();
  return server;
}

export default {
  Neo4jMemoryServer,
  createNeo4jMemoryServer
};
