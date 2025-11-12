import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../config/index.js';
import logger from './logger.js';

// Create a Registry to register the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'pricing-calculator-backend',
  version: process.env.npm_package_version || '1.0.0'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Custom application metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10] // seconds
});

export const httpRequestCount = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

export const quoteCalculationDuration = new client.Histogram({
  name: 'quote_calculation_duration_seconds',
  help: 'Duration of quote calculations in seconds',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5] // seconds
});

export const quotesCreatedTotal = new client.Counter({
  name: 'quotes_created_total',
  help: 'Total number of quotes created'
});

export const dbConnectionPool = new client.Gauge({
  name: 'db_connection_pool_size',
  help: 'Current database connection pool size',
  labelNames: ['state'] // 'idle', 'active', 'total'
});

export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1] // seconds
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestCount);
register.registerMetric(quoteCalculationDuration);
register.registerMetric(quotesCreatedTotal);
register.registerMetric(dbConnectionPool);
register.registerMetric(dbQueryDuration);

// Express middleware to collect HTTP metrics
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path || 'unknown';
      
      httpRequestDuration
        .labels(req.method, route, res.statusCode.toString())
        .observe(duration);
        
      httpRequestCount
        .labels(req.method, route, res.statusCode.toString())
        .inc();
    });
    
    next();
  };
}

// Metrics endpoint handler
export function getMetrics(): Promise<string> {
  return register.metrics();
}

// Initialize metrics collection
export function initializeMetrics(): void {
  const config = getConfig();
  
  logger.info('Metrics collection initialized', {
    registry: 'prometheus',
    defaultMetrics: true,
    customMetrics: [
      'http_request_duration_seconds',
      'http_requests_total', 
      'quote_calculation_duration_seconds',
      'quotes_created_total',
      'db_connection_pool_size',
      'db_query_duration_seconds'
    ]
  });
}

export { register };