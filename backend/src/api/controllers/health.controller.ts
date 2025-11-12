import { Request, Response, NextFunction } from 'express';
import { testConnection, getPoolStats } from '../../db/pool.js';
import { getConfig } from '../../config/index.js';
import logger from '../../instrumentation/logger.js';

// Health check response interface
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  environment: string;
  database: {
    status: 'connected' | 'disconnected';
    latency?: number;
    error?: string;
    pool: {
      totalConnections: number;
      idleConnections: number;
      waitingRequests: number;
    };
  };
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
}

/**
 * Health check endpoint - GET /api/v1/health
 * Provides liveness and readiness checks for the application
 */
export async function getHealth(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const startTime = Date.now();
    const config = getConfig();
    
    // Test database connectivity
    const dbTest = await testConnection();
    const poolStats = getPoolStats();
    
    // Memory usage information
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const freeMemory = totalMemory - usedMemory;
    
    // Overall health status
    const isHealthy = dbTest.connected;
    
    const healthResponse: HealthCheckResponse = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: config.NODE_ENV,
      database: {
        status: dbTest.connected ? 'connected' : 'disconnected',
        pool: {
          totalConnections: poolStats.totalCount,
          idleConnections: poolStats.idleCount,
          waitingRequests: poolStats.waitingCount,
        },
      },
      memory: {
        used: usedMemory,
        free: freeMemory,
        total: totalMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100),
      },
    };
    
    // Add optional properties only if they have values
    if (dbTest.latency !== undefined) {
      healthResponse.database.latency = dbTest.latency;
    }
    
    if (dbTest.error !== undefined) {
      healthResponse.database.error = dbTest.error;
    }
    
    const responseTime = Date.now() - startTime;
    
    // Log health check
    logger.info('Health check completed', {
      status: healthResponse.status,
      responseTime,
      dbLatency: dbTest.latency,
      memoryUsage: healthResponse.memory.percentage,
    });
    
    // Return appropriate HTTP status code
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(healthResponse);
    
  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Return unhealthy response on any error
    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: getConfig().NODE_ENV,
      database: {
        status: 'disconnected',
        error: error instanceof Error ? error.message : String(error),
        pool: {
          totalConnections: 0,
          idleConnections: 0,
          waitingRequests: 0,
        },
      },
      memory: {
        used: 0,
        free: 0,
        total: 0,
        percentage: 0,
      },
    };
    
    res.status(503).json(errorResponse);
  }
}

/**
 * Liveness probe endpoint - GET /api/v1/health/live
 * Simple check to verify the application is running
 */
export async function getLiveness(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const response = {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Readiness probe endpoint - GET /api/v1/health/ready
 * Check if the application is ready to handle requests
 */
export async function getReadiness(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    // Check database connectivity for readiness
    const dbTest = await testConnection();
    
    const isReady = dbTest.connected;
    
    const response = {
      status: isReady ? 'ready' : 'not-ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbTest.connected ? 'pass' : 'fail',
          latency: dbTest.latency,
          error: dbTest.error,
        },
      },
    };
    
    const statusCode = isReady ? 200 : 503;
    res.status(statusCode).json(response);
    
  } catch (error) {
    logger.error('Readiness check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    res.status(503).json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'fail',
          error: error instanceof Error ? error.message : String(error),
        },
      },
    });
  }
}