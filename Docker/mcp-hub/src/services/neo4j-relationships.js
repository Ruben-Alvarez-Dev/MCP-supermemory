// ============================================================
// Neo4j Relationship Operations
// ============================================================
// Task: US-003-3 - Implement CRUD operations for relationships
// Description: Create, read, update, delete relationships in Neo4j

import { executeWriteTransaction, executeReadTransaction } from './neo4j-client.js';
import { logger } from '../utils/logger.js';

/**
 * Create a relationship between two entities
 */
export async function createRelationship(
  fromLabel,
  fromId,
  relationshipType,
  toLabel,
  toId,
  properties = {}
) {
  logger.debug('Creating relationship', {
    from: { label: fromLabel, id: fromId },
    type: relationshipType,
    to: { label: toLabel, id: toId },
    properties
  });

  const result = await executeWriteTransaction(async (tx) => {
    const propsString = Object.keys(properties).length > 0
      ? ' { ' + Object.keys(properties).map(key => `r.${key} = $${key}`).join(', ') + ' }'
      : '';

    const cypher = `
      MATCH (from:${fromLabel} {id: $fromId})
      MATCH (to:${toLabel} {id: $toId})
      CREATE (from)-[r:${relationshipType}]->(to)
      SET r.created_at = datetime()
      ${propsString}
      RETURN r
    `;

    const result = await tx.run(cypher, { fromId, toId, ...properties });
    return result.records.length > 0 ? result.records[0].get('r') : null;
  });

  if (result) {
    logger.info('Relationship created', {
      from: fromLabel,
      to: toLabel,
      type: relationshipType
    });
  }

  return result;
}

/**
 * Create multiple relationships in batch
 */
export async function createRelationships(relationshipsArray) {
  logger.debug('Creating relationships in batch', {
    count: relationshipsArray.length
  });

  const results = await executeWriteTransaction(async (tx) => {
    const cypher = `
      UNWIND $relationships as rel
      MATCH (from)
      WHERE from.id = rel.fromId AND labels(from)[0] = rel.fromLabel
      MATCH (to)
      WHERE to.id = rel.toId AND labels(to)[0] = rel.toLabel
      CREATE (from)-[r:rel.type]->(to)
      SET r = rel.properties, r.created_at = datetime()
      RETURN r
    `;

    const normalized = relationshipsArray.map(rel => ({
      fromLabel: rel.fromLabel,
      fromId: rel.fromId,
      toLabel: rel.toLabel,
      toId: rel.toId,
      type: rel.type,
      properties: rel.properties || {}
    }));

    const result = await tx.run(cypher, { relationships: normalized });
    return result.records.map(record => record.get('r'));
  });

  logger.info('Relationships created in batch', { count: results.length });
  return results;
}

/**
 * Get relationships for an entity
 */
export async function getEntityRelationships(label, id, direction = 'both', type = null) {
  logger.debug('Getting entity relationships', { label, id, direction, type });

  const result = await executeReadTransaction(async (tx) => {
    let matchPattern = '';

    if (direction === 'outgoing') {
      matchPattern = `MATCH (e:${label} {id: $id})-[r${type ? `:${type}` : ''}]->(other)`;
    } else if (direction === 'incoming') {
      matchPattern = `MATCH (e:${label} {id: $id})<-[r${type ? `:${type}` : ''}]-(other)`;
    } else {
      matchPattern = `MATCH (e:${label} {id: $id})-[r${type ? `:${type}` : ''}]-(other)`;
    }

    const cypher = `
      ${matchPattern}
      RETURN r, other, labels(other) as otherLabels
    `;

    const result = await tx.run(cypher, { id });
    return result.records.map(record => ({
      relationship: record.get('r'),
      otherEntity: record.get('other'),
      otherLabels: record.get('otherLabels')
    }));
  });

  return result;
}

/**
 * Find relationship between two entities
 */
export async function findRelationship(
  fromLabel,
  fromId,
  relationshipType,
  toLabel,
  toId
) {
  logger.debug('Finding relationship', {
    from: { label: fromLabel, id: fromId },
    type: relationshipType,
    to: { label: toLabel, id: toId }
  });

  const result = await executeReadTransaction(async (tx) => {
    const cypher = `
      MATCH (from:${fromLabel} {id: $fromId})-[r:${relationshipType}]->(to:${toLabel} {id: $toId})
      RETURN r
    `;

    const result = await tx.run(cypher, { fromId, toId });
    return result.records.length > 0 ? result.records[0].get('r') : null;
  });

  return result;
}

/**
 * Update relationship properties
 */
export async function updateRelationship(
  fromLabel,
  fromId,
  relationshipType,
  toLabel,
  toId,
  properties
) {
  logger.debug('Updating relationship', {
    from: { label: fromLabel, id: fromId },
    type: relationshipType,
    to: { label: toLabel, id: toId },
    properties
  });

  const result = await executeWriteTransaction(async (tx) => {
    const setString = Object.keys(properties)
      .map(key => `r.${key} = $${key}`)
      .join(', ');

    const cypher = `
      MATCH (from:${fromLabel} {id: $fromId})-[r:${relationshipType}]->(to:${toLabel} {id: $toId})
      SET ${setString}, r.updated_at = datetime()
      RETURN r
    `;

    const result = await tx.run(cypher, { fromId, toId, ...properties });
    return result.records.length > 0 ? result.records[0].get('r') : null;
  });

  if (result) {
    logger.info('Relationship updated', {
      from: fromLabel,
      to: toLabel,
      type: relationshipType
    });
  }

  return result;
}

/**
 * Delete relationship
 */
export async function deleteRelationship(
  fromLabel,
  fromId,
  relationshipType,
  toLabel,
  toId
) {
  logger.debug('Deleting relationship', {
    from: { label: fromLabel, id: fromId },
    type: relationshipType,
    to: { label: toLabel, id: toId }
  });

  const result = await executeWriteTransaction(async (tx) => {
    const cypher = `
      MATCH (from:${fromLabel} {id: $fromId})-[r:${relationshipType}]->(to:${toLabel} {id: $toId})
      DELETE r
      RETURN count(r) as deleted
    `;

    const result = await tx.run(cypher, { fromId, toId });
    return result.records[0].get('deleted').toNumber();
  });

  if (result > 0) {
    logger.info('Relationship deleted', {
      from: fromLabel,
      to: toLabel,
      type: relationshipType
    });
  }

  return result > 0;
}

/**
 * Delete all relationships for an entity
 */
export async function deleteEntityRelationships(label, id) {
  logger.debug('Deleting all relationships for entity', { label, id });

  const result = await executeWriteTransaction(async (tx) => {
    const cypher = `
      MATCH (e:${label} {id: $id})-[r]-()
      DELETE r
      RETURN count(r) as deleted
    `;

    const result = await tx.run(cypher, { id });
    return result.records[0].get('deleted').toNumber();
  });

  logger.info('All relationships deleted for entity', { label, id, count: result });
  return result;
}

/**
 * Count relationships for an entity
 */
export async function countRelationships(label, id, type = null) {
  logger.debug('Counting relationships', { label, id, type });

  const result = await executeReadTransaction(async (tx) => {
    const cypher = `
      MATCH (e:${label} {id: $id})-[r${type ? `:${type}` : ''}]-()
      RETURN count(r) as count
    `;

    const result = await tx.run(cypher, { id });
    return result.records[0].get('count').toNumber();
  });

  return result;
}

/**
 * Get relationship path between entities (shortest path)
 */
export async function getShortestPath(
  fromLabel,
  fromId,
  toLabel,
  toId,
  maxDepth = 5
) {
  logger.debug('Finding shortest path', {
    from: { label: fromLabel, id: fromId },
    to: { label: toLabel, id: toId },
    maxDepth
  });

  const result = await executeReadTransaction(async (tx) => {
    const cypher = `
      MATCH path = shortestPath(
        (from:${fromLabel} {id: $fromId})-[*1..${maxDepth}]-(to:${toLabel} {id: $toId})
      )
      RETURN path, [r in relationships(path) | type(r)] as relationshipTypes,
             [n in nodes(path) | {id: n.id, labels: labels(n)}] as nodes
    `;

    const result = await tx.run(cypher, { fromId, toId });
    return result.records.length > 0 ? result.records[0] : null;
  });

  return result;
}

export default {
  createRelationship,
  createRelationships,
  getEntityRelationships,
  findRelationship,
  updateRelationship,
  deleteRelationship,
  deleteEntityRelationships,
  countRelationships,
  getShortestPath
};
