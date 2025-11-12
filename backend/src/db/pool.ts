import { Pool, PoolConfig, PoolClient } from 'pg';
import { getConfig, isProduction } from '../config/index.js';
import logger from '../instrumentation/logger.js';
import { dbConnectionPool, dbQueryDuration } from '../instrumentation/metrics.js';

// Database connection pool instance
let pool: Pool | null = null;

// Pool configuration interface with DigitalOcean-specific settings
interface DatabasePoolConfig extends PoolConfig {
  enableSsl?: boolean;
  sslCertificate?: string;
  maxConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  statementTimeoutMs?: number;
}

/**
 * Create and configure database connection pool with SSL support for DigitalOcean
 */
export function createDatabasePool(config: DatabasePoolConfig = {}): Pool {
  const appConfig = getConfig();
  
  if (!appConfig.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Parse DATABASE_URL to extract components
  const url = new URL(appConfig.DATABASE_URL);
  const sslMode = url.searchParams.get('sslmode') || 'prefer';
  
  // SSL configuration for DigitalOcean managed databases
  let sslConfig: boolean | object = false;
  
  if (isProduction() || config.enableSsl || sslMode === 'require') {
    sslConfig = {
      rejectUnauthorized: true,
      // For DigitalOcean managed databases, they provide CA certificates
      // In production, you would typically load this from environment or file
      ca: config.sslCertificate || process.env.DATABASE_CA_CERT,
    };
    
    // If no CA cert is provided but SSL is required, use less strict mode
    if (!config.sslCertificate && !process.env.DATABASE_CA_CERT) {
      logger.warn('SSL required but no CA certificate provided, using rejectUnauthorized: false');
      sslConfig = { rejectUnauthorized: false };
    }
  }

  const poolConfig: PoolConfig = {
    connectionString: appConfig.DATABASE_URL,
    ssl: sslConfig,
    
    // Connection pool sizing
    max: config.maxConnections || 20, // Maximum pool size
    min: 2, // Minimum pool size
    
    // Timing configurations
    connectionTimeoutMillis: config.connectionTimeoutMs || 5000, // 5 seconds
    idleTimeoutMillis: config.idleTimeoutMs || 30000, // 30 seconds
    
    // Query timeout - prevent long-running queries
    statement_timeout: config.statementTimeoutMs || 30000, // 30 seconds
    
    // Application name for database monitoring
    application_name: 'pricing-calculator-backend',
    
    // Override with any additional config
    ...config,
  };

  const newPool = new Pool(poolConfig);

  // Set up event listeners for monitoring
  newPool.on('connect', (client: PoolClient) => {
    logger.debug('Database pool: new client connected', {
      totalCount: newPool.totalCount,
      idleCount: newPool.idleCount,
      waitingCount: newPool.waitingCount,
    });
    
    // Update metrics
    dbConnectionPool.labels('active').set(newPool.totalCount - newPool.idleCount);
    dbConnectionPool.labels('idle').set(newPool.idleCount);
    dbConnectionPool.labels('total').set(newPool.totalCount);
  });

  newPool.on('remove', () => {
    logger.debug('Database pool: client removed', {
      totalCount: newPool.totalCount,
      idleCount: newPool.idleCount,
      waitingCount: newPool.waitingCount,
    });
    
    // Update metrics
    dbConnectionPool.labels('active').set(newPool.totalCount - newPool.idleCount);
    dbConnectionPool.labels('idle').set(newPool.idleCount);
    dbConnectionPool.labels('total').set(newPool.totalCount);
  });

  newPool.on('error', (err: Error) => {
    logger.error('Database pool error', {
      error: err.message,
      stack: err.stack,
      totalCount: newPool.totalCount,
      idleCount: newPool.idleCount,
      waitingCount: newPool.waitingCount,
    });
  });

  logger.info('Database pool created', {
    host: url.hostname,
    port: url.port || 5432,
    database: url.pathname.slice(1),
    ssl: !!sslConfig,
    maxConnections: poolConfig.max,
    connectionTimeout: poolConfig.connectionTimeoutMillis,
    idleTimeout: poolConfig.idleTimeoutMillis,
  });

  return newPool;
}

/**
 * Get or create the singleton database pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = createDatabasePool();
  }
  return pool;
}

/**
 * Execute a database query with metrics and error handling
 */
export async function query<T = unknown>(
  text: string, 
  params?: unknown[], 
  operationName = 'query'
): Promise<T[]> {
  const startTime = Date.now();
  
  try {
    const dbPool = getPool();
    const result = await dbPool.query(text, params);
    
    const duration = (Date.now() - startTime) / 1000;
    dbQueryDuration.labels(operationName, 'unknown').observe(duration);
    
    logger.debug('Database query executed', {
      operation: operationName,
      duration,
      rowCount: result.rowCount,
      queryLength: text.length,
    });
    
    return result.rows as T[];
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    dbQueryDuration.labels(operationName, 'error').observe(duration);
    
    logger.error('Database query failed', {
      operation: operationName,
      duration,
      error: error instanceof Error ? error.message : String(error),
      query: text.substring(0, 200), // Log first 200 chars of query
    });
    
    throw error;
  }
}

/**
 * Execute a transaction with proper error handling
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const dbPool = getPool();
  const client = await dbPool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    
    logger.debug('Database transaction completed successfully');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    
    logger.error('Database transaction failed, rolled back', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test database connectivity
 */
export async function testConnection(): Promise<{ connected: boolean; latency?: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    const dbPool = getPool();
    await dbPool.query('SELECT 1 as test');
    
    const latency = Date.now() - startTime;
    
    logger.debug('Database connectivity test passed', { latency });
    
    return {
      connected: true,
      latency,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Database connectivity test failed', {
      latency,
      error: errorMessage,
    });
    
    return {
      connected: false,
      latency,
      error: errorMessage,
    };
  }
}

/**
 * Close the database pool gracefully
 */
export async function closePool(): Promise<void> {
  if (pool) {
    logger.info('Closing database pool');
    await pool.end();
    pool = null;
  }
}

/**
 * Get current pool statistics
 */
export function getPoolStats(): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
} {
  const dbPool = getPool();
  return {
    totalCount: dbPool.totalCount,
    idleCount: dbPool.idleCount,
    waitingCount: dbPool.waitingCount,
  };
}