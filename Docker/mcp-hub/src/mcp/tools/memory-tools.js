// ============================================================
// MCP-SUPERSERVER - Memory MCP Tools
// ============================================================
// High-level memory operations combining Neo4j and Obsidian

import { logger } from '../../utils/logger.js';
import neo4jHandlers from './neo4j-tools.js';
import obsidianHandlers from './obsidian-tools.js';

// ============================================================
// Memory Tools for MCP
// ============================================================

export const memoryTools = {
  store_memory: {
    name: 'store_memory',
    description: 'Store a memory with automatic categorization into Neo4j and Obsidian',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Memory content to store'
        },
        type: {
          type: 'string',
          description: 'Memory type (fact, concept, event, observation, task)',
          enum: ['fact', 'concept', 'event', 'observation', 'task']
        },
        tags: {
          type: 'array',
          description: 'Tags for categorization',
          items: { type: 'string' }
        },
        entities: {
          type: 'array',
          description: 'Named entities mentioned in the memory',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              label: { type: 'string' }
            }
          }
        },
        importance: {
          type: 'number',
          description: 'Importance score 0-1 (default: 0.5)',
          minimum: 0,
          maximum: 1,
          default: 0.5
        },
        source: {
          type: 'string',
          description: 'Source of the memory (user, system, external)'
        }
      },
      required: ['content', 'type']
    }
  },

  recall_memory: {
    name: 'recall_memory',
    description: 'Recall memories matching a query',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query to search for'
        },
        type: {
          type: 'string',
          description: 'Filter by memory type'
        },
        tags: {
          type: 'array',
          description: 'Filter by tags',
          items: { type: 'string' }
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 10)',
          default: 10
        }
      },
      required: ['query']
    }
  },

  create_knowledge_link: {
    name: 'create_knowledge_link',
    description: 'Create a link between two memories/concepts',
    inputSchema: {
      type: 'object',
      properties: {
        from_name: {
          type: 'string',
          description: 'Source entity/concept name'
        },
        to_name: {
          type: 'string',
          description: 'Target entity/concept name'
        },
        relationship: {
          type: 'string',
          description: 'Type of relationship (relates_to, depends_on, similar_to, causes)'
        },
        strength: {
          type: 'number',
          description: 'Strength of connection 0-1 (default: 0.5)',
          minimum: 0,
          maximum: 1,
          default: 0.5
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the relationship'
        }
      },
      required: ['from_name', 'to_name', 'relationship']
    }
  },

  get_knowledge_graph: {
    name: 'get_knowledge_graph',
    description: 'Get the knowledge graph around a concept',
    inputSchema: {
      type: 'object',
      properties: {
        concept: {
          type: 'string',
          description: 'Central concept to explore'
        },
        depth: {
          type: 'number',
          description: 'Depth of traversal (default: 2)',
          default: 2,
          minimum: 1,
          maximum: 4
        },
        limit: {
          type: 'number',
          description: 'Maximum nodes (default: 50)',
          default: 50
        }
      },
      required: ['concept']
    }
  },

  search_memories_by_date: {
    name: 'search_memories_by_date',
    description: 'Search memories by date range',
    inputSchema: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          description: 'Start date (ISO format)'
        },
        to: {
          type: 'string',
          description: 'End date (ISO format)'
        },
        type: {
          type: 'string',
          description: 'Filter by memory type'
        }
      }
    }
  },

  update_memory_importance: {
    name: 'update_memory_importance',
    description: 'Update the importance score of a memory',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Memory entity ID'
        },
        importance: {
          type: 'number',
          description: 'New importance score 0-1',
          minimum: 0,
          maximum: 1
        },
        reason: {
          type: 'string',
          description: 'Reason for importance change'
        }
      },
      required: ['id', 'importance']
    }
  },

  summarize_memories: {
    name: 'summarize_memories',
    description: 'Get a summary of stored memories by type and tags',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Filter by memory type'
        },
        tag: {
          type: 'string',
          description: 'Filter by tag'
        }
      }
    }
  }
};

// ============================================================
// Tool Handlers
// ============================================================

const handlers = {
  async store_memory({ content, type, tags = [], entities = [], importance = 0.5, source = 'user' }) {
    const timestamp = new Date().toISOString();
    const dateStr = timestamp.split('T')[0];

    // Create unique memory ID
    const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const memoryName = `Memory_${memoryId}`;

    // Store in Neo4j as entity
    try {
      await neo4jHandlers.create_entity({
        label: 'Memory',
        name: memoryName,
        properties: {
          id: memoryId,
          content,
          type,
          importance,
          source,
          createdAt: timestamp
        }
      });

      // Add tags as relationships
      const tagLabel = 'Tag';
      for (const tag of tags) {
        try {
          // Create tag entity if not exists
          await neo4jHandlers.create_entity({
            label: tagLabel,
            name: tag,
            properties: {}
          });

          // Link memory to tag
          await neo4jHandlers.create_relationship({
            from_label: 'Memory',
            from_name: memoryName,
            to_label: tagLabel,
            to_name: tag,
            relationship_type: 'TAGGED_WITH'
          });
        } catch (e) {
          // Tag might already exist
          logger.debug('Tag creation skipped', { tag, error: e.message });
        }
      }

      // Link entities
      for (const entity of entities) {
        try {
          await neo4jHandlers.create_relationship({
            from_label: 'Memory',
            from_name: memoryName,
            to_label: entity.label || 'Entity',
            to_name: entity.name,
            relationship_type: 'MENTIONS'
          });
        } catch (e) {
          logger.debug('Entity link skipped', { entity, error: e.message });
        }
      }

      logger.info('Memory: Stored in Neo4j', { memoryId, type });
    } catch (error) {
      logger.error('Memory: Neo4j storage failed', { error: error.message });
    }

    // Store in Obsidian
    try {
      const filename = `memory/${dateStr}/${memoryId}.md`;

      await obsidianHandlers.create_note({
        filename,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)}: ${content.substring(0, 50)}...`,
        content,
        tags: ['memory', type, ...tags],
        template: 'log'
      });

      logger.info('Memory: Stored in Obsidian', { memoryId, filename });
    } catch (error) {
      logger.error('Memory: Obsidian storage failed', { error: error.message });
    }

    return {
      success: true,
      memoryId,
      type,
      importance,
      timestamp,
      stored: {
        neo4j: true,
        obsidian: true
      }
    };
  },

  async recall_memory({ query, type, tags, limit = 10 }) {
    const results = {
      neo4j: [],
      obsidian: []
    };

    // Search Neo4j
    try {
      const cypher = `
        MATCH (m:Memory)
        WHERE m.content CONTAINS $query
        ${type ? 'AND m.type = $type' : ''}
        RETURN m
        ORDER BY m.importance DESC
        LIMIT $limit
      `;

      const neoResult = await neo4jHandlers.query_graph({
        query: cypher,
        params: { query, type, limit }
      });

      results.neo4j = neoResult.records.map(r => ({
        id: r.m.properties.id,
        content: r.m.properties.content,
        type: r.m.properties.type,
        importance: r.m.properties.importance,
        createdAt: r.m.properties.createdAt
      }));

      logger.info('Memory: Neo4j recall', {
        query,
        found: results.neo4j.length
      });
    } catch (error) {
      logger.error('Memory: Neo4j recall failed', { error: error.message });
    }

    // Search Obsidian
    try {
      const obsResult = await obsidianHandlers.search_notes({
        query,
        case_sensitive: false,
        include_content: true,
        limit
      });

      // Filter by directory if type specified
      results.obsidian = obsResult.results.filter(r => {
        if (!type) return true;
        return r.path.includes(`memory/${type}`) || r.tags?.includes(type);
      });

      logger.info('Memory: Obsidian recall', {
        query,
        found: results.obsidian.length
      });
    } catch (error) {
      logger.error('Memory: Obsidian recall failed', { error: error.message });
    }

    // Combine and deduplicate
    const allMemories = [
      ...results.neo4j.map(m => ({ ...m, source: 'neo4j' })),
      ...results.obsidian.map(m => ({
        id: m.filename,
        content: m.snippets?.map(s => s.text).join('\n') || '',
        source: 'obsidian',
        path: m.path
      }))
    ];

    return {
      success: true,
      query,
      memories: allMemories.slice(0, limit),
      counts: {
        neo4j: results.neo4j.length,
        obsidian: results.obsidian.length,
        total: allMemories.length
      }
    };
  },

  async create_knowledge_link({ from_name, to_name, relationship, strength = 0.5, notes }) {
    try {
      const result = await neo4jHandlers.create_relationship({
        from_label: 'Concept',
        from_name,
        to_label: 'Concept',
        to_name,
        relationship_type: relationship.toUpperCase(),
        properties: {
          strength,
          notes,
          createdAt: new Date().toISOString()
        }
      });

      logger.info('Memory: Knowledge link created', {
        from: from_name,
        to: to_name,
        type: relationship
      });

      return {
        success: true,
        ...result
      };
    } catch (error) {
      // If concepts don't exist, create them first
      try {
        await neo4jHandlers.create_entity({
          label: 'Concept',
          name: from_name,
          properties: {}
        });
        await neo4jHandlers.create_entity({
          label: 'Concept',
          name: to_name,
          properties: {}
        });

        // Retry link creation
        const result = await neo4jHandlers.create_relationship({
          from_label: 'Concept',
          from_name,
          to_label: 'Concept',
          to_name,
          relationship_type: relationship.toUpperCase(),
          properties: { strength, notes }
        });

        return {
          success: true,
          created: true,
          ...result
        };
      } catch (retryError) {
        throw new Error(`Failed to create link: ${retryError.message}`);
      }
    }
  },

  async get_knowledge_graph({ concept, depth = 2, limit = 50 }) {
    try {
      const result = await neo4jHandlers.query_graph({
        query: `
          MATCH (c:Concept {name: $concept})-[r*1..${depth}]-(related)
          RETURN c, r, related
          LIMIT $limit
        `,
        params: { concept, limit }
      });

      const nodes = [];
      const links = [];

      for (const record of result.records) {
        const center = record.get('c');
        const related = record.get('related');
        const relationships = record.get('r');

        // Add center node
        if (!nodes.find(n => n.name === center.properties.name)) {
          nodes.push({
            id: center.elementId,
            name: center.properties.name,
            label: center.labels[0]
          });
        }

        // Add related nodes and links
        for (let i = 0; i < related.length; i++) {
          const relNode = related[i];
          const rel = relationships[i];

          if (!nodes.find(n => n.name === relNode.properties.name)) {
            nodes.push({
              id: relNode.elementId,
              name: relNode.properties.name,
              label: relNode.labels[0]
            });
          }

          links.push({
            source: center.properties.name,
            target: relNode.properties.name,
            type: rel.type,
            strength: rel.properties.strength || 0.5
          });
        }
      }

      logger.info('Memory: Knowledge graph retrieved', {
        concept,
        nodes: nodes.length,
        links: links.length
      });

      return {
        success: true,
        concept,
        graph: {
          nodes,
          links
        }
      };
    } catch (error) {
      logger.error('Memory: Graph retrieval failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        graph: { nodes: [], links: [] }
      };
    }
  },

  async search_memories_by_date({ from, to, type }) {
    try {
      const cypher = `
        MATCH (m:Memory)
        WHERE m.createdAt >= $from AND m.createdAt <= $to
        ${type ? 'AND m.type = $type' : ''}
        RETURN m
        ORDER BY m.createdAt DESC
      `;

      const result = await neo4jHandlers.query_graph({
        query: cypher,
        params: { from, to, type }
      });

      const memories = result.records.map(r => ({
        id: r.m.properties.id,
        content: r.m.properties.content,
        type: r.m.properties.type,
        importance: r.m.properties.importance,
        createdAt: r.m.properties.createdAt
      }));

      return {
        success: true,
        from,
        to,
        memories,
        count: memories.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        memories: []
      };
    }
  },

  async update_memory_importance({ id, importance, reason }) {
    try {
      const result = await neo4jHandlers.update_entity({
        id,
        properties: {
          importance,
          importanceReason: reason,
          importanceUpdatedAt: new Date().toISOString()
        }
      });

      logger.info('Memory: Importance updated', { id, importance, reason });

      return {
        success: true,
        id,
        importance,
        reason
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  async summarize_memories({ type, tag }) {
    try {
      const cypher = `
        MATCH (m:Memory)
        ${type ? 'WHERE m.type = $type' : ''}
        RETURN m.type as type, count(m) as count, avg(m.importance) as avgImportance
        ORDER BY count DESC
      `;

      const result = await neo4jHandlers.query_graph({
        query: cypher,
        params: { type }
      });

      const summary = result.records.map(r => ({
        type: r.type,
        count: r.count.toInt(),
        avgImportance: parseFloat(r.avgImportance)
      }));

      // Get tags if requested
      let tagSummary = [];
      if (tag) {
        const tagResult = await neo4jHandlers.query_graph({
          query: `
            MATCH (m:Memory)-[:TAGGED_WITH]->(t:Tag {name: $tag})
            RETURN count(m) as count
          `,
          params: { tag }
        });

        tagSummary = [{
          tag,
          count: tagResult.records[0]?.count?.toInt() || 0
        }];
      }

      return {
        success: true,
        byType: summary,
        byTag: tagSummary,
        total: summary.reduce((sum, s) => sum + s.count, 0)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Attach handlers to tool definitions
Object.keys(memoryTools).forEach(key => {
  memoryTools[key].handler = handlers[key];
});

export default handlers;
