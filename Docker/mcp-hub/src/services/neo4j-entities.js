// ============================================================
// Neo4j Entity Operations
// ============================================================
// Task: US-003-2 - Implement CRUD operations for entities
// Description: Create, read, update, delete entities in Neo4j

import { executeWriteTransaction, executeReadTransaction } from './neo4j-client.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new entity (node)
 */
export async function createEntity(label, properties) {
  logger.debug('Creating entity', { label, properties });

  const result = await executeWriteTransaction(async (tx) => {
    const propsString = Object.keys(properties)
      .map(key => `${key}: $${key}`)
      .join(', ');

    const cypher = `
      CREATE (e:${label} {${propsString}})
      RETURN e
    `;

    const result = await tx.run(cypher, properties);
    return result.records[0].get('e');
  });

  logger.info('Entity created', { label, id: result.identity });
  return result;
}

/**
 * Create multiple entities in batch
 */
export async function createEntities(label, entitiesArray) {
  logger.debug('Creating entities in batch', { label, count: entitiesArray.length });

  const results = await executeWriteTransaction(async (tx) => {
    const cypher = `
      UNWIND $entities AS entity
      CREATE (e:${label})
      SET e = entity
      RETURN e
    `;

    const result = await tx.run(cypher, { entities: entitiesArray });
    return result.records.map(record => record.get('e'));
  });

  logger.info('Entities created in batch', { label, count: results.length });
  return results;
}

/**
 * Get entity by ID
 */
export async function getEntityById(label, id) {
  logger.debug('Getting entity by ID', { label, id });

  const result = await executeReadTransaction(async (tx) => {
    const cypher = `
      MATCH (e:${label} {id: $id})
      RETURN e
    `;

    const result = await tx.run(cypher, { id });
    return result.records.length > 0 ? result.records[0].get('e') : null;
  });

  if (!result) {
    logger.warn('Entity not found', { label, id });
  }

  return result;
}

/**
 * Get entity by internal Neo4j ID
 */
export async function getEntityByInternalId(label, internalId) {
  logger.debug('Getting entity by internal ID', { label, internalId });

  const result = await executeReadTransaction(async (tx) => {
    const cypher = `
      MATCH (e:${label})
      WHERE id(e) = $internalId
      RETURN e
    `;

    const result = await tx.run(cypher, { internalId });
    return result.records.length > 0 ? result.records[0].get('e') : null;
  });

  return result;
}

/**
 * Find entities by properties
 */
export async function findEntities(label, properties = {}, limit = 100) {
  logger.debug('Finding entities', { label, properties, limit });

  const result = await executeReadTransaction(async (tx) => {
    const whereClause = Object.keys(properties).length > 0
      ? 'WHERE ' + Object.keys(properties).map(key => `e.${key} = $${key}`).join(' AND ')
      : '';

    const cypher = `
      MATCH (e:${label})
      ${whereClause}
      RETURN e
      LIMIT $limit
    `;

    const result = await tx.run(cypher, { ...properties, limit });
    return result.records.map(record => record.get('e'));
  });

  logger.debug('Entities found', { label, count: result.length });
  return result;
}

/**
 * Find entity by single property
 */
export async function findEntityByProperty(label, property, value) {
  logger.debug('Finding entity by property', { label, property, value });

  const result = await executeReadTransaction(async (tx) => {
    const cypher = `
      MATCH (e:${label} {${property}: $value})
      RETURN e
      LIMIT 1
    `;

    const result = await tx.run(cypher, { value });
    return result.records.length > 0 ? result.records[0].get('e') : null;
  });

  return result;
}

/**
 * Update entity properties
 */
export async function updateEntity(label, id, properties) {
  logger.debug('Updating entity', { label, id, properties });

  const result = await executeWriteTransaction(async (tx) => {
    const setString = Object.keys(properties)
      .map(key => `e.${key} = $${key}`)
      .join(', ');

    const cypher = `
      MATCH (e:${label} {id: $id})
      SET ${setString}, e.updated_at = datetime()
      RETURN e
    `;

    const result = await tx.run(cypher, { id, ...properties });
    return result.records.length > 0 ? result.records[0].get('e') : null;
  });

  if (!result) {
    logger.warn('Entity not found for update', { label, id });
  } else {
    logger.info('Entity updated', { label, id });
  }

  return result;
}

/**
 * Delete entity
 */
export async function deleteEntity(label, id) {
  logger.debug('Deleting entity', { label, id });

  const result = await executeWriteTransaction(async (tx) => {
    const cypher = `
      MATCH (e:${label} {id: $id})
      DETACH DELETE e
      RETURN count(e) as deleted
    `;

    const result = await tx.run(cypher, { id });
    return result.records[0].get('deleted').toNumber();
  });

  if (result > 0) {
    logger.info('Entity deleted', { label, id });
  } else {
    logger.warn('Entity not found for deletion', { label, id });
  }

  return result > 0;
}

/**
 * Delete multiple entities
 */
export async function deleteEntities(label, ids) {
  logger.debug('Deleting entities in batch', { label, count: ids.length });

  const result = await executeWriteTransaction(async (tx) => {
    const cypher = `
      UNWIND $ids AS id
      MATCH (e:${label} {id: id})
      DETACH DELETE e
      RETURN count(*) as deleted
    `;

    const result = await tx.run(cypher, { ids });
    return result.records[0].get('deleted').toNumber();
  });

  logger.info('Entities deleted in batch', { label, count: result });
  return result;
}

/**
 * Count entities by label
 */
export async function countEntities(label) {
  logger.debug('Counting entities', { label });

  const result = await executeReadTransaction(async (tx) => {
    const cypher = `
      MATCH (e:${label})
      RETURN count(e) as count
    `;

    const result = await tx.run(cypher);
    return result.records[0].get('count').toNumber();
  });

  return result;
}

/**
 * Get all entities with pagination
 */
export async function getAllEntities(label, skip = 0, limit = 100) {
  logger.debug('Getting all entities', { label, skip, limit });

  const result = await executeReadTransaction(async (tx) => {
    const cypher = `
      MATCH (e:${label})
      RETURN e
      ORDER BY e.created_at DESC
      SKIP $skip
      LIMIT $limit
    `;

    const result = await tx.run(cypher, { skip, limit });
    return result.records.map(record => record.get('e'));
  });

  return result;
}

export default {
  createEntity,
  createEntities,
  getEntityById,
  getEntityByInternalId,
  findEntities,
  findEntityByProperty,
  updateEntity,
  deleteEntity,
  deleteEntities,
  countEntities,
  getAllEntities
};
