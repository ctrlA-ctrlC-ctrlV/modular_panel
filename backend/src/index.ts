import express from 'express';
import { createServer } from 'http';
import { getConfig } from './config/index.js';
import logger from './instrumentation/logger.js';
import { errorHandler } from './api/middleware/errorHandler.js';
import { testConnection, closePool } from './db/pool.js';
import { initializeObservability, shutdownObservability } from './instrumentation/index.js';
import healthRoutes from './api/routes/health.routes.js';
import createCorsMiddleware from './api/middleware/cors.js';

// Create Express app
function createApp(): express.Application {
  const app = express();

  // CORS middleware (must be early in the stack)
  app.use(createCorsMiddleware());

  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Add request ID for tracing
  app.use((req, res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || 
      `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    next();
  });

  // API routes will be mounted here
  // Mount all API routes under /api/v1 prefix
  const apiRouter = express.Router();
  
  // Mount health routes
  apiRouter.use('/health', healthRoutes);
  
  app.use('/api/v1', apiRouter);

  // Error handling must be last
  app.use(errorHandler);

  return app;
}

async function startServer(): Promise<void> {
  try {
    const config = getConfig();
    
    // Initialize observability stack first
    await initializeObservability();
    
    // Test database connectivity before starting server (fail fast)
    logger.info('Testing database connectivity...');
    const dbTest = await testConnection();
    
    if (!dbTest.connected) {
      logger.error('Database connectivity test failed', {
        error: dbTest.error,
        latency: dbTest.latency,
      });
      throw new Error(`Database connection failed: ${dbTest.error}`);
    }
    
    logger.info('Database connectivity test passed', {
      latency: dbTest.latency,
    });
    
    const app = createApp();
    const server = createServer(app);
    
    server.listen(config.PORT, () => {
      logger.info('Server started successfully', {
        port: config.PORT,
        environment: config.NODE_ENV,
        nodeVersion: process.version
      });
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      
      server.close(async () => {
        try {
          // Close database connections
          await closePool();
          
          // Shutdown observability
          await shutdownObservability();
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', {
            error: error instanceof Error ? error.message : String(error),
          });
          process.exit(1);
        }
      });
      
      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forceful shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Unhandled server startup error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});

// Export app for testing
export default createApp();