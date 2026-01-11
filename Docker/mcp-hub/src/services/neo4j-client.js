// ============================================================
// Neo4j Database Service
// ============================================================
// Task: US-003-1 - Configure Neo4j driver with connection pooling
// Description: Neo4j driver configuration and connection management

import neo4j from 'neo4j-driver';
import { logger } from '../utils/logger.js';

let driver = null;
let isConnected = false;

/**
 * Neo4j connection configuration
 */
const neo4jConfig = {
  uri: process.env.NEO4J_URI || 'bolt://neo4j:7687',
  user: process.env.NEO4J_USER || 'neo4j',
  password: process.env.NEO4J_PASSWORD || 'password',
  database: process.env.NEO4J_DATABASE || 'neo4j',
  maxConnectionPoolSize: parseInt(process.env.NEO4J_MAX_POOL_SIZE || '50'),
  maxTransactionRetryTime: parseInt(process.env.NEO4J_MAX_RETRY_TIME || '30000'),
  connectionAcquisitionTimeout: parseInt(process.env.NEO4J_ACQUISITION_TIMEOUT || '60000'),
};

/**
 * Initialize Neo4j driver
 */
export function initializeNeo4j() {
  try {
    logger.info('Initializing Neo4j driver', {
      uri: neo4jConfig.uri,
      database: neo4jConfig.database,
      maxPoolSize: neo4jConfig.maxConnectionPoolSize
    });

    driver = neo4j.driver(
      neo4jConfig.uri,
      neo4j.auth.basic(neo4jConfig.user, neo4jConfig.password),
      {
        maxConnectionPoolSize: neo4jConfig.maxConnectionPoolSize,
        maxTransactionRetryTime: neo4jConfig.maxTransactionRetryTime,
        connectionAcquisitionTimeout: neo4jConfig.connectionAcquisitionTimeout,
        logging: {
          level: process.env.NEO4J_LOG_LEVEL || 'info',
          logger: (level, message) => {
            logger.log(level === 'error' ? 'error' : 'debug', `Neo4j Driver: ${message}`);
          }
        }
      }
    );

    isConnected = true;
    logger.info('Neo4j driver initialized successfully');

    return driver;
  } catch (error) {
    logger.error('Failed to initialize Neo4j driver', {
      error: error.message,
      stack: error.stack
    });
    isConnected = false;
    throw error;
  }
}

/**
 * Get Neo4j driver instance
 */
export function getDriver() {
  if (!driver) {
    throw new Error('Neo4j driver not initialized. Call initializeNeo4j() first.');
  }
  return driver;
}

/**
 * Get Neo4j session
 */
export function getSession(database = neo4jConfig.database) {
  const drv = getDriver();
  return drv.session({ database });
}

/**
 * Execute a Cypher query
 */
export async function executeQuery(cypher, params = {}, database = neo4jConfig.database) {
  const session = getSession(database);
  const timer = performance.now();

  try {
    logger.debug('Executing Neo4j query', { cypher, params });

    const result = await session.run(cypher, params);
    const duration = performance.now() - timer;

    logger.debug('Neo4j query completed', {
      cypher,
      records: result.records.length,
      duration_ms: duration.toFixed(2)
    });

    return {
      records: result.records,
      keys: result.keys,
      summary: result.summary
    };
  } catch (error) {
    const duration = performance.now() - timer;
    logger.error('Neo4j query failed', {
      cypher,
      error: error.message,
      duration_ms: duration.toFixed(2)
    });
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Execute a write transaction
 */
export async function executeWriteTransaction(transactionFn, database = neo4jConfig.database) {
  const session = getSession(database);

  try {
    logger.debug('Starting Neo4j write transaction');

    const result = await session.writeTransaction(transactionFn);

    logger.info('Neo4j write transaction completed');

    return result;
  } catch (error) {
    logger.error('Neo4j write transaction failed', {
      error: error.message
    });
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Execute a read transaction
 */
export async function executeReadTransaction(transactionFn, database = neo4jConfig.database) {
  const session = getSession(database);

  try {
    logger.debug('Starting Neo4j read transaction');

    const result = await session.readTransaction(transactionFn);

    logger.debug('Neo4j read transaction completed');

    return result;
  } catch (error) {
    logger.error('Neo4j read transaction failed', {
      error: error.message
    });
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Check Neo4j connection health
 */
export async function checkHealth() {
  if (!driver) {
    return {
      status: 'unhealthy',
      message: 'Neo4j driver not initialized'
    };
  }

  try {
    const session = getSession();
    const result = await session.run('RETURN 1 AS num');
    await session.close();

    return {
      status: 'healthy',
      message: 'Neo4j connection OK',
      database: neo4jConfig.database,
      uri: neo4jConfig.uri
    };
  } catch (error) {
    isConnected = false;
    return {
      status: 'unhealthy',
      message: error.message,
      uri: neo4jConfig.uri
    };
  }
}

/**
 * Close Neo4j driver
 */
export async function closeNeo4j() {
  if (!driver) {
    logger.warn('Neo4j driver not initialized, nothing to close');
    return;
  }

  try {
    logger.info('Closing Neo4j driver...');
    await driver.close();
    isConnected = false;
    logger.info('Neo4j driver closed successfully');
  } catch (error) {
    logger.error('Error closing Neo4j driver', { error: error.message });
    throw error;
  }
}

/**
 * Check if Neo4j is connected
 */
export function isNeo4jConnected() {
  return isConnected && driver !== null;
}

/**
 * Get Neo4j configuration
 */
export function getNeo4jConfig() {
  return { ...neo4jConfig };
}

export default {
  initializeNeo4j,
  getDriver,
  getSession,
  executeQuery,
  executeWriteTransaction,
  executeReadTransaction,
  checkHealth,
  closeNeo4j,
  isNeo4jConnected,
  getNeo4jConfig
};
