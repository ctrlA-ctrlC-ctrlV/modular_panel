import express from 'express';
import { createServer } from 'http';
import { getConfig } from './config/index.js';
import logger from './instrumentation/logger.js';
import { errorHandler } from './api/middleware/errorHandler.js';

async function startServer(): Promise<void> {
  try {
    const config = getConfig();
    const app = express();

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
    
    // TODO: Add route imports and mounting here
    // Example: app.use('/api/v1', healthRouter);
    // Example: app.use('/api/v1', calculateRouter);
    
    app.use('/api/v1', apiRouter);

    // Error handling must be last
    app.use(errorHandler);

    const server = createServer(app);
    
    server.listen(config.PORT, () => {
      logger.info('Server started successfully', {
        port: config.PORT,
        environment: config.NODE_ENV,
        nodeVersion: process.version
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });

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