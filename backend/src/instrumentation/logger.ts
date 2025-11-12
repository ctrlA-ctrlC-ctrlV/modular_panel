import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import { getConfig, isProduction } from '../config';

// Explicit interfaces for structured log meta
export interface HttpLogMeta {
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip?: string;
  contentLength?: string | number;
}

export interface DatabaseLogMeta {
  table?: string;
  query?: string;
  duration?: number;
  rowCount?: number;
}

export interface SecurityLogMeta {
  ip?: string;
  userAgent?: string;
  userId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AuditLogMeta {
  userId?: string;
  resource?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
}

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${level}: ${message}${stack ? `\n${stack}` : ''}${metaString ? `\n${metaString}` : ''}`;
  })
);

// Structured format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

class Logger {
  private winston: winston.Logger;

  constructor() {
    const config = getConfig();
    
    this.winston = winston.createLogger({
      level: config.LOG_LEVEL,
      format: isProduction() ? productionFormat : developmentFormat,
      defaultMeta: {
        service: 'pricing-calculator-api',
        version: process.env.npm_package_version || '1.0.0',
        environment: config.NODE_ENV,
      },
      transports: this.createTransports(),
      exceptionHandlers: [
        new winston.transports.Console(),
        ...(isProduction() ? [new winston.transports.File({ filename: 'logs/exceptions.log' })] : [])
      ],
      rejectionHandlers: [
        new winston.transports.Console(),
        ...(isProduction() ? [new winston.transports.File({ filename: 'logs/rejections.log' })] : [])
      ],
      exitOnError: false
    });
  }

  private createTransports(): winston.transport[] {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true
      })
    ];

    if (isProduction()) {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 100 * 1024 * 1024, // 100MB
          maxFiles: 10
        })
      );
    }

    return transports;
  }

  // Core logging methods
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const logMeta = { ...meta };
    
    if (error instanceof Error) {
      logMeta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    } else if (error) {
      logMeta.error = error;
    }

    this.winston.error(message, logMeta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.winston.warn(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.winston.info(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.winston.debug(message, meta);
  }

  // HTTP request logging
  http(message: string, meta: HttpLogMeta): void {
    this.winston.http(message, meta);
  }

  // Database operation logging
  database(operation: string, meta: DatabaseLogMeta): void {
    this.winston.debug(`Database ${operation}`, {
      type: 'database',
      operation,
      ...meta
    });
  }

  // Business logic logging
  business(event: string, meta?: Record<string, unknown>): void {
    this.winston.info(`Business event: ${event}`, {
      type: 'business',
      event,
      ...meta
    });
  }

  // Security logging
  security(event: string, meta: SecurityLogMeta): void {
    this.winston.warn(`Security event: ${event}`, {
      type: 'security',
      event,
      ...meta
    });
  }

  // Performance logging
  performance(operation: string, duration: number, meta?: Record<string, unknown>): void {
    const level = duration > 1000 ? 'warn' : 'debug';
    this.winston[level](`Performance: ${operation} took ${duration}ms`, {
      type: 'performance',
      operation,
      duration,
      ...meta
    });
  }

  // Audit logging for compliance
  audit(action: string, meta: AuditLogMeta): void {
    this.winston.info(`Audit: ${action}`, {
      type: 'audit',
      action,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  // Create child logger with additional context
  child(defaultMeta: Record<string, unknown>): Logger {
    const childLogger = Object.create(this);
    childLogger.winston = this.winston.child(defaultMeta);
    return childLogger;
  }

  // Get the underlying winston instance for advanced usage
  getWinstonInstance(): winston.Logger {
    return this.winston;
  }
}

// Create singleton logger instance
const logger = new Logger();

// Express middleware for request logging
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      const logData: HttpLogMeta = {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode,
        responseTime: duration,
      };
      
      const userAgent = req.get('User-Agent');
      if (userAgent) logData.userAgent = userAgent;
      
      const ip = req.ip || req.socket.remoteAddress || undefined;
      if (ip) logData.ip = ip;
      
      const contentLength = res.get('Content-Length');
      if (contentLength) logData.contentLength = contentLength;
      
      logger.http('HTTP Request', logData);
    });
    
    next();
  };
}

// Performance measurement decorator
export function measurePerformance(operation: string) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (
      ...args: unknown[]
    ) => unknown | Promise<unknown>;
    
    descriptor.value = async function (
      ...args: unknown[]
    ): Promise<unknown> {
      const startTime = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        logger.performance(operation, Date.now() - startTime);
        return result;
      } catch (error) {
        logger.performance(operation, Date.now() - startTime, { error: true });
        throw error;
      }
    };
    
    return descriptor;
  };
}

export default logger;