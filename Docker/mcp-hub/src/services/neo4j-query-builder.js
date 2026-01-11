// ============================================================
// Neo4j Query Builder
// ============================================================
// Task: US-003-5 - Implement query builder for graph patterns
// Description: Build complex Cypher queries for patterns

import { executeQuery } from './neo4j-client.js';
import { logger } from '../utils/logger.js';

/**
 * Query Builder class for constructing Cypher queries
 */
export class CypherQueryBuilder {
  constructor() {
    this.matchClauses = [];
    this.whereClauses = [];
    this.returnClause = null;
    this.withClauses = [];
    this.optionalMatchClauses = [];
    this.orderByClause = null;
    this.limitValue = null;
    this.skipValue = null;
    this.params = {};
    this.paramCounter = 0;
  }

  /**
   * Add a MATCH clause
   */
  match(pattern) {
    this.matchClauses.push(pattern);
    return this;
  }

  /**
   * Add an OPTIONAL MATCH clause
   */
  optionalMatch(pattern) {
    this.optionalMatchClauses.push(pattern);
    return this;
  }

  /**
   * Add a WHERE clause
   */
  where(condition) {
    this.whereClauses.push(condition);
    return this;
  }

  /**
   * Add a WITH clause
   */
  with(clause) {
    this.withClauses.push(clause);
    return this;
  }

  /**
   * Set RETURN clause
   */
  return(clause) {
    this.returnClause = clause;
    return this;
  }

  /**
   * Set ORDER BY clause
   */
  orderBy(clause) {
    this.orderByClause = clause;
    return this;
  }

  /**
   * Set LIMIT
   */
  limit(value) {
    this.limitValue = value;
    return this;
  }

  /**
   * Set SKIP
   */
  skip(value) {
    this.skipValue = value;
    return this;
  }

  /**
   * Add a parameter with auto-generated name
   */
  addParam(value) {
    const paramName = `param${this.paramCounter++}`;
    this.params[paramName] = value;
    return `$${paramName}`;
  }

  /**
   * Build the final Cypher query
   */
  build() {
    const parts = [];

    // MATCH clauses
    for (const match of this.matchClauses) {
      parts.push(`MATCH ${match}`);
    }

    // OPTIONAL MATCH clauses
    for (const optionalMatch of this.optionalMatchClauses) {
      parts.push(`OPTIONAL MATCH ${optionalMatch}`);
    }

    // WHERE clauses
    if (this.whereClauses.length > 0) {
      parts.push(`WHERE ${this.whereClauses.join(' AND ')}`);
    }

    // WITH clauses
    for (const withClause of this.withClauses) {
      parts.push(`WITH ${withClause}`);
    }

    // RETURN clause
    if (this.returnClause) {
      parts.push(`RETURN ${this.returnClause}`);
    }

    // ORDER BY clause
    if (this.orderByClause) {
      parts.push(`ORDER BY ${this.orderByClause}`);
    }

    // SKIP clause
    if (this.skipValue !== null) {
      parts.push(`SKIP ${this.skipValue}`);
    }

    // LIMIT clause
    if (this.limitValue !== null) {
      parts.push(`LIMIT ${this.limitValue}`);
    }

    return {
      cypher: parts.join('\n'),
      params: this.params
    };
  }

  /**
   * Execute the built query
   */
  async execute() {
    const { cypher, params } = this.build();
    logger.debug('Executing query builder query', { cypher, params });
    return await executeQuery(cypher, params);
  }
}

/**
 * Pattern matching functions
 */

/**
 * Find entities connected to a given entity
 */
export async function findConnectedEntities(label, id, relationshipPattern, maxDepth = 1) {
  const depth = maxDepth === 1 ? '' : `*1..${maxDepth}`;

  const cypher = `
    MATCH (start:${label} {id: $id})-[${depth}]-(connected)
    RETURN DISTINCT connected, labels(connected) as labels
    LIMIT 100
  `;

  const result = await executeQuery(cypher, { id });
  return result.records.map(record => ({
    entity: record.get('connected'),
    labels: record.get('labels')
  }));
}

/**
 * Find entities by pattern matching
 */
export async function findByPattern(pattern, where = {}, limit = 100) {
  const qb = new CypherQueryBuilder();

  qb.match(pattern);

  // Add WHERE conditions
  const conditions = Object.entries(where).map(([key, value]) => {
    const paramName = `where_${key}`;
    qb.params[paramName] = value;
    return `${key} = $${paramName}`;
  });

  if (conditions.length > 0) {
    qb.where(conditions.join(' AND '));
  }

  qb.return('patternNode').limit(limit);

  const query = qb.build();
  query.cypher = query.cypher.replace('RETURN patternNode', 'RETURN n');

  const result = await executeQuery(query.cypher, query.params);
  return result.records.map(record => record.get('n'));
}

/**
 * Find common neighbors between two entities
 */
export async function findCommonNeighbors(label1, id1, label2, id2, neighborLabel) {
  const cypher = `
    MATCH (e1:${label1} {id: $id1})-[]-(neighbor:${neighborLabel})-[]-(e2:${label2} {id: $id2})
    RETURN DISTINCT neighbor
    LIMIT 50
  `;

  const result = await executeQuery(cypher, { id1, id2 });
  return result.records.map(record => record.get('neighbor'));
}

/**
 * Find shortest path between entities
 */
export async function findShortestPath(label1, id1, label2, id2, maxDepth = 5) {
  const cypher = `
    MATCH path = shortestPath(
      (start:${label1} {id: $id1})-[*1..${maxDepth}]-(end:${label2} {id: $id2})
    )
    RETURN path,
           [n in nodes(path) | {id: n.id, labels: labels(n)}] as nodes,
           [r in relationships(path) | type(r)] as relTypes,
           length(path) as length
  `;

  const result = await executeQuery(cypher, { id1, id2 });

  if (result.records.length === 0) {
    return null;
  }

  const record = result.records[0];
  return {
    path: record.get('path'),
    nodes: record.get('nodes'),
    relationshipTypes: record.get('relTypes'),
    length: record.get('length').toNumber()
  };
}

/**
 * Find all paths between entities
 */
export async function findAllPaths(label1, id1, label2, id2, maxDepth = 3, limit = 50) {
  const cypher = `
    MATCH path = (start:${label1} {id: $id1})-[*1..${maxDepth}]-(end:${label2} {id: $id2})
    RETURN path,
           [n in nodes(path) | {id: n.id, labels: labels(n)}] as nodes,
           [r in relationships(path) | type(r)] as relTypes,
           length(path) as length
    ORDER BY length
    LIMIT $limit
  `;

  const result = await executeQuery(cypher, { id1, id2, limit });

  return result.records.map(record => ({
    path: record.get('path'),
    nodes: record.get('nodes'),
    relationshipTypes: record.get('relTypes'),
    length: record.get('length').toNumber()
  }));
}

/**
 * Find subgraph around an entity
 */
export async function findSubgraph(label, id, radius = 2, maxNodes = 100) {
  const cypher = `
    MATCH (start:${label} {id: $id})-[r*1..${radius}]-(end)
    RETURN start, r, end, labels(end) as labels
    LIMIT $maxNodes
  `;

  const result = await executeQuery(cypher, { id, maxNodes });

  return {
    startNode: result.records[0]?.get('start'),
    relationships: result.records.flatMap(r => r.get('r')),
    nodes: result.records.map(r => ({
      entity: r.get('end'),
      labels: r.get('labels')
    }))
  };
}

/**
 * Aggregate relationship statistics
 */
export async function getRelationshipStats(label, id) {
  const cypher = `
    MATCH (e:${label} {id: $id})-[r]-(other)
    RETURN type(r) as relationshipType,
           labels(other)[0] as targetLabel,
           count(r) as count
    ORDER BY count DESC
  `;

  const result = await executeQuery(cypher, { id });

  return result.records.map(record => ({
    relationshipType: record.get('relationshipType'),
    targetLabel: record.get('targetLabel'),
    count: record.get('count').toNumber()
  }));
}

/**
 * Search entities by text properties
 */
export async function searchByText(label, searchText, properties = ['name', 'description'], limit = 50) {
  const searchParams = properties.map((prop, i) => {
    const paramName = `search_${i}`;
    return `toLower(e.${prop}) CONTAINS toLower($${paramName})`;
  }).join(' OR ');

  const params = {};
  properties.forEach((prop, i) => {
    params[`search_${i}`] = searchText;
  });

  const cypher = `
    MATCH (e:${label})
    WHERE ${searchParams}
    RETURN e
    LIMIT $limit
  `;

  const result = await executeQuery(cypher, { ...params, limit });
  return result.records.map(record => record.get('e'));
}

export default {
  CypherQueryBuilder,
  findConnectedEntities,
  findByPattern,
  findCommonNeighbors,
  findShortestPath,
  findAllPaths,
  findSubgraph,
  getRelationshipStats,
  searchByText
};
