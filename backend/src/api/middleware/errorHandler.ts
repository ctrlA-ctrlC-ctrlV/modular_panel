import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../../instrumentation/logger';
import { getConfig, isDevelopment } from '../../config';

export interface ApiError extends Error {
  statusCode: number;
  code?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

export class AppError extends Error implements ApiError {
  public readonly statusCode: number;
  public readonly code?: string | undefined;
  public readonly details?: Record<string, unknown> | undefined;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string | undefined,
    details?: Record<string, unknown> | undefined,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error classes
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 404, 'RESOURCE_NOT_FOUND', { resource, id });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'RESOURCE_CONFLICT', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 500, 'DATABASE_ERROR', { originalError: originalError?.message });
  }
}

// Error response interface
interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: Record<string, unknown>;
    stack?: string;
    timestamp: string;
    path: string;
    method: string;
    requestId?: string;
  };
}

function formatZodError(error: ZodError): Record<string, unknown> {
  return {
    validationErrors: error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: 'received' in err ? err.received : undefined
    }))
  };
}

function createErrorResponse(
  error: Error,
  req: Request,
  statusCode: number = 500,
  code?: string
): ErrorResponse {
  const config = getConfig();
  
  const errorResponse: ErrorResponse = {
    error: {
      message: error.message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.originalUrl || req.url,
      method: req.method,
    }
  };

  // Only add optional properties if they have values
  if (code !== undefined) {
    errorResponse.error.code = code;
  }
  
  const details = (error as ApiError).details;
  if (details !== undefined) {
    errorResponse.error.details = details;
  }
  
  if (isDevelopment() && error.stack !== undefined) {
    errorResponse.error.stack = error.stack;
  }
  
  const requestId = req.headers['x-request-id'] as string;
  if (requestId !== undefined) {
    errorResponse.error.requestId = requestId;
  }
  
  return errorResponse;
}

function logError(error: Error, req: Request, statusCode: number): void {
  const isClientError = statusCode >= 400 && statusCode < 500;
  const isServerError = statusCode >= 500;
  
  const meta = {
    statusCode,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id'],
    userId: (req as any).user?.id,
    body: isServerError ? req.body : undefined, // Only log body for server errors
    stack: error.stack
  };

  if (isServerError) {
    logger.error(`Server Error: ${error.message}`, error, meta);
  } else if (isClientError && statusCode >= 400 && statusCode < 404) {
    logger.warn(`Client Error: ${error.message}`, meta);
  } else {
    logger.info(`Request Error: ${error.message}`, meta);
  }
}

// Main error handling middleware
export function errorHandler(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    let statusCode = 500;
    let code: string | undefined;
    let processedError: Error = error;

    // Handle different error types
    if (error instanceof AppError) {
        statusCode = error.statusCode;
        code = error.code;
    } else if (error instanceof ZodError) {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        const validationDetails = formatZodError(error);
        processedError = new ValidationError('Request validation failed', validationDetails);
    } else if (error.name === 'CastError') {
        statusCode = 400;
        code = 'INVALID_ID';
        processedError = new ValidationError('Invalid ID format');
    } else if (error.message?.includes('duplicate key')) {
        statusCode = 409;
        code = 'DUPLICATE_RESOURCE';
        processedError = new ConflictError('Resource already exists');
    } else if (error.message?.includes('foreign key constraint')) {
        statusCode = 400;
        code = 'INVALID_REFERENCE';
        processedError = new ValidationError('Invalid reference to related resource');
    } else {
        // Unknown error - treat as internal server error
        code = 'INTERNAL_SERVER_ERROR';
        processedError = new AppError(
            isDevelopment() ? error.message : 'An unexpected error occurred',
            500,
            code,
            isDevelopment() ? { originalError: error.message } : undefined,
            false
        );
    }

    // Log the error
    logError(processedError, req, statusCode);

    // Security: Log potential security issues
    if (statusCode === 401 || statusCode === 403) {
        const securityInfo: { severity: 'medium'; ip?: string; userAgent?: string } = {
            severity: 'medium'
        };
        
        if (req.ip) {
            securityInfo.ip = req.ip;
        }
        
        const userAgent = req.get('User-Agent');
        if (userAgent) {
            securityInfo.userAgent = userAgent;
        }
        
        logger.security('Authentication/Authorization failure', securityInfo);
    }

    // Send error response
    const errorResponse = createErrorResponse(processedError, req, statusCode, code);
    res.status(statusCode).json(errorResponse);
}

// 404 handler for unmatched routes
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError('Route', req.originalUrl);
  next(error);
}

// Async error wrapper
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<void>
) {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Graceful shutdown handler
export function setupGracefulShutdown(server: any): void {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Gracefully shutting down...`);
    
    server.close((err: Error | undefined) => {
      if (err) {
        logger.error('Error during server shutdown', err);
        process.exit(1);
      }
      
      logger.info('Server closed successfully');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Unhandled rejection and exception handlers
export function setupProcessHandlers(): void {
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('Unhandled Promise Rejection', new Error(String(reason)), {
      type: 'unhandledRejection',
      promise: promise.toString()
    });
    
    // In production, we might want to exit the process
    if (getConfig().NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error, {
      type: 'uncaughtException'
    });
    
    // Always exit on uncaught exception
    process.exit(1);
  });
}