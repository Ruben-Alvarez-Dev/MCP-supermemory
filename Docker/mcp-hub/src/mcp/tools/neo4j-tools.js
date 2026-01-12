// ============================================================
// MCP-SUPERSERVER - Neo4j MCP Tools
// ============================================================

import { getSession } from '../../services/neo4j-client.js';
import { logger } from '../../utils/logger.js';

// ============================================================
// Neo4j Tools for MCP
// ============================================================

export const neo4jTools = {
  create_entity: {
    name: 'create_entity',
    description: 'Create a new entity node in Neo4j graph database',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Entity label (e.g., Person, Concept, Event)'
        },
        name: {
          type: 'string',
          description: 'Entity name'
        },
        properties: {
          type: 'object',
          description: 'Additional properties as key-value pairs',
          additionalProperties: true
        }
      },
      required: ['label', 'name']
    }
  },

  update_entity: {
    name: 'update_entity',
    description: 'Update an existing entity in Neo4j',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Entity internal ID'
        },
        properties: {
          type: 'object',
          description: 'Properties to update',
          additionalProperties: true
        }
      },
      required: ['id', 'properties']
    }
  },

  delete_entity: {
    name: 'delete_entity',
    description: 'Delete an entity from Neo4j',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Entity internal ID'
        },
        detach: {
          type: 'boolean',
          description: 'Delete relationships too (default: false)',
          default: false
        }
      },
      required: ['id']
    }
  },

  create_relationship: {
    name: 'create_relationship',
    description: 'Create a relationship between two entities',
    inputSchema: {
      type: 'object',
      properties: {
        from_label: {
          type: 'string',
          description: 'Source entity label'
        },
        from_name: {
          type: 'string',
          description: 'Source entity name'
        },
        to_label: {
          type: 'string',
          description: 'Target entity label'
        },
        to_name: {
          type: 'string',
          description: 'Target entity name'
        },
        relationship_type: {
          type: 'string',
          description: 'Type of relationship (e.g., KNOWS, RELATED_TO, PART_OF)'
        },
        properties: {
          type: 'object',
          description: 'Relationship properties',
          additionalProperties: true
        }
      },
      required: ['from_label', 'from_name', 'to_label', 'to_name', 'relationship_type']
    }
  },

  query_graph: {
    name: 'query_graph',
    description: 'Execute a Cypher query on Neo4j',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Cypher query to execute'
        },
        params: {
          type: 'object',
          description: 'Query parameters',
          additionalProperties: true
        }
      },
      required: ['query']
    }
  },

  find_entities: {
    name: 'find_entities',
    description: 'Find entities by label and/or properties',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Entity label to filter by'
        },
        name_contains: {
          type: 'string',
          description: 'Partial name match'
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 50)',
          default: 50
        }
      }
    }
  },

  get_entity_context: {
    name: 'get_entity_context',
    description: 'Get an entity with its relationships and neighbors',
    inputSchema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Entity label'
        },
        name: {
          type: 'string',
          description: 'Entity name'
        },
        depth: {
          type: 'number',
          description: 'Relationship depth to traverse (default: 1)',
          default: 1
        }
      },
      required: ['label', 'name']
    }
  }
};

// ============================================================
// Tool Handlers
// ============================================================

const handlers = {
  async create_entity({ label, name, properties = {} }) {
    const session = getSession();
    try {
      const result = await session.run(
        `CREATE (e:${label} {name: $name, ...$props})
         RETURN e, elementId(e) as id`,
        { name, props: { ...properties, createdAt: new Date().toISOString() } }
      );

      const record = result.records[0];
      const node = record.get('e');
      const id = record.get('id');

      logger.info('Neo4j: Entity created', { label, name, id });

      return {
        success: true,
        id,
        label,
        name,
        properties: node.properties
      };
    } finally {
      await session.close();
    }
  },

  async update_entity({ id, properties }) {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (e) WHERE elementId(e) = $id
         SET e += $props
         RETURN e`,
        { id, props: { ...properties, updatedAt: new Date().toISOString() } }
      );

      if (result.records.length === 0) {
        throw new Error(`Entity not found: ${id}`);
      }

      const node = result.records[0].get('e');

      logger.info('Neo4j: Entity updated', { id });

      return {
        success: true,
        id,
        properties: node.properties
      };
    } finally {
      await session.close();
    }
  },

  async delete_entity({ id, detach = false }) {
    const session = getSession();
    try {
      const query = detach
        ? `MATCH (e) WHERE elementId(e) = $id DETACH DELETE e`
        : `MATCH (e) WHERE elementId(e) = $id DELETE e`;

      const result = await session.run(query, { id });

      logger.info('Neo4j: Entity deleted', { id, detach });

      return {
        success: true,
        id,
        deleted: result.summary.counters._stats.nodesDeleted > 0
      };
    } finally {
      await session.close();
    }
  },

  async create_relationship({ from_label, from_name, to_label, to_name, relationship_type, properties = {} }) {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (from:${from_label} {name: $from_name})
         MATCH (to:${to_label} {name: $to_name})
         CREATE (from)-[r:${relationship_type.toUpperCase()}]->(to)
         SET r += $props
         RETURN r, elementId(r) as id`,
        {
          from_name,
          to_name,
          props: { ...properties, createdAt: new Date().toISOString() }
        }
      );

      if (result.records.length === 0) {
        throw new Error('One or both entities not found');
      }

      const relationship = result.records[0].get('r');
      const id = result.records[0].get('id');

      logger.info('Neo4j: Relationship created', {
        from: from_name,
        to: to_name,
        type: relationship_type,
        id
      });

      return {
        success: true,
        id,
        from: from_name,
        to: to_name,
        type: relationship_type,
        properties: relationship.properties
      };
    } finally {
      await session.close();
    }
  },

  async query_graph({ query, params = {} }) {
    const session = getSession();
    try {
      const result = await session.run(query, params);

      const records = result.records.map(record => {
        const obj = {};
        record.keys.forEach(key => {
          obj[key] = record.get(key);
        });
        return obj;
      });

      logger.info('Neo4j: Query executed', {
        query: query.substring(0, 100),
        results: records.length
      });

      return {
        success: true,
        records,
        summary: {
          recordsReturned: records.length,
          resultAvailableAfter: result.summary.resultAvailableAfter,
          resultConsumedAfter: result.summary.resultConsumedAfter
        }
      };
    } finally {
      await session.close();
    }
  },

  async find_entities({ label, name_contains, limit = 50 }) {
    const session = getSession();
    try {
      let query = `MATCH (e${label ? ':' + label : ''}`;
      const params = { limit };

      if (name_contains) {
        query += `) WHERE e.name CONTAINS $name_contains`;
        params.name_contains = name_contains;
      } else {
        query += ')';
      }

      query += ` RETURN e LIMIT $limit`;

      const result = await session.run(query, params);

      const entities = result.records.map(record => {
        const node = record.get('e');
        return {
          id: node.elementId,
          label: node.labels[0],
          properties: node.properties
        };
      });

      logger.info('Neo4j: Entities found', {
        count: entities.length,
        label,
        name_contains
      });

      return {
        success: true,
        entities,
        count: entities.length
      };
    } finally {
      await session.close();
    }
  },

  async get_entity_context({ label, name, depth = 1 }) {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (e:${label} {name: $name})-[r*1..${depth}]-(related)
         RETURN e, r, related`,
        { name }
      );

      const entity = result.records.length > 0 ? {
        id: result.records[0].get('e').elementId,
        label: result.records[0].get('e').labels[0],
        properties: result.records[0].get('e').properties
      } : null;

      const relationships = result.records.flatMap(record => {
        const rels = record.get('r');
        return rels.map(r => ({
          type: r.type,
          properties: r.properties
        }));
      });

      const related = result.records.map(record => {
        const node = record.get('related');
        return {
          id: node.elementId,
          label: node.labels[0],
          properties: node.properties
        };
      });

      logger.info('Neo4j: Entity context retrieved', {
        label,
        name,
        depth,
        relatedCount: related.length
      });

      return {
        success: true,
        entity,
        relationships: relationships.length,
        related
      };
    } finally {
      await session.close();
    }
  }
};

// Attach handlers to tool definitions
Object.keys(neo4jTools).forEach(key => {
  neo4jTools[key].handler = handlers[key];
});

export default handlers;
