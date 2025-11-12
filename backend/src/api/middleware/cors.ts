import { Request, Response, NextFunction } from 'express';
import { getConfig, getAllowedOrigins } from '../../config/index.js';
import logger from '../../instrumentation/logger.js';

// CORS configuration interface
interface CorsOptions {
  origins?: string[];
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
}

/**
 * CORS middleware with configurable origins from environment
 * Supports both simple and preflight CORS requests
 */
export function corsMiddleware(options: CorsOptions = {}): (req: Request, res: Response, next: NextFunction) => void {
  const config = getConfig();
  const allowedOrigins = options.origins || getAllowedOrigins();
  
  const {
    methods = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders = [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Request-ID',
      'X-API-Key',
    ],
    exposedHeaders = ['X-Request-ID'],
    credentials = true,
    maxAge = 86400, // 24 hours
    preflightContinue = false,
  } = options;

  logger.debug('CORS middleware initialized', {
    allowedOrigins,
    methods,
    credentials,
    maxAge,
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.get('Origin');
    const requestMethod = req.method.toLowerCase();
    
    // Check if origin is allowed
    const isOriginAllowed = !origin || 
      allowedOrigins.includes('*') || 
      allowedOrigins.includes(origin) ||
      // Allow localhost in development for any port
      (config.NODE_ENV === 'development' && origin.startsWith('http://localhost'));

    if (isOriginAllowed && origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else if (allowedOrigins.includes('*')) {
      res.header('Access-Control-Allow-Origin', '*');
    }

    // Set credentials header
    if (credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight OPTIONS request
    if (requestMethod === 'options') {
      // Set allowed methods
      res.header('Access-Control-Allow-Methods', methods.join(', '));
      
      // Set allowed headers
      const requestedHeaders = req.get('Access-Control-Request-Headers');
      if (requestedHeaders) {
        const requestedHeadersList = requestedHeaders.split(',').map(h => h.trim());
        const allowedRequestedHeaders = requestedHeadersList.filter(header => 
          allowedHeaders.some(allowed => allowed.toLowerCase() === header.toLowerCase())
        );
        
        if (allowedRequestedHeaders.length > 0) {
          res.header('Access-Control-Allow-Headers', allowedRequestedHeaders.join(', '));
        }
      } else {
        res.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      }

      // Set max age for preflight cache
      res.header('Access-Control-Max-Age', maxAge.toString());

      logger.debug('CORS preflight request handled', {
        origin,
        method: req.get('Access-Control-Request-Method'),
        headers: requestedHeaders,
        isOriginAllowed,
      });

      if (!preflightContinue) {
        res.status(204).end();
        return;
      }
    } else {
      // For actual requests, set exposed headers
      if (exposedHeaders.length > 0) {
        res.header('Access-Control-Expose-Headers', exposedHeaders.join(', '));
      }

      logger.debug('CORS request processed', {
        origin,
        method: requestMethod,
        isOriginAllowed,
      });
    }

    // Block request if origin is not allowed
    if (origin && !isOriginAllowed) {
      const logData: { severity: 'medium'; ip?: string; userAgent?: string } = { 
        severity: 'medium' 
      };
      if (req.ip) logData.ip = req.ip;
      const userAgent = req.get('User-Agent');
      if (userAgent) logData.userAgent = userAgent;
      
      logger.security('CORS request blocked - origin not allowed', logData);
      
      res.status(403).json({
        error: {
          message: 'Origin not allowed by CORS policy',
          code: 'CORS_ORIGIN_NOT_ALLOWED',
          statusCode: 403,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Strict CORS middleware for production
 * Only allows explicitly configured origins
 */
export function strictCorsMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  return corsMiddleware({
    credentials: true,
    maxAge: 3600, // 1 hour
    preflightContinue: false,
  });
}

/**
 * Development CORS middleware
 * More permissive for local development
 */
export function devCorsMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  const config = getConfig();
  
  if (config.NODE_ENV === 'development') {
    return corsMiddleware({
      origins: ['*'], // Allow all origins in development
      credentials: false, // Disable credentials for wildcard origin
      maxAge: 300, // 5 minutes
    });
  }
  
  return strictCorsMiddleware();
}

/**
 * CORS middleware factory based on environment
 */
export function createCorsMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
  const config = getConfig();
  
  if (config.NODE_ENV === 'development') {
    logger.info('Using development CORS configuration');
    return devCorsMiddleware();
  } else {
    logger.info('Using production CORS configuration', {
      allowedOrigins: getAllowedOrigins(),
    });
    return strictCorsMiddleware();
  }
}

// Default export for easy importing
export default createCorsMiddleware;