import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../../config/index.js';
import logger, { SecurityLogMeta } from '../../instrumentation/logger.js';
import { AppError } from './errorHandler.js';

// Extended request interface to include user info
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    isAdmin: boolean;
  };
}

/**
 * Basic authentication middleware for admin-only access
 * Uses simple API key authentication for initial implementation
 * This is a placeholder for more sophisticated auth (JWT, OAuth, etc.)
 */
export function adminGuard(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const config = getConfig();
    const authHeader = req.headers.authorization;
    
    // Extract API key from Authorization header
    // Expected format: "Bearer <api-key>" or "ApiKey <api-key>"
    let apiKey: string | undefined;
    
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && (parts[0] === 'Bearer' || parts[0] === 'ApiKey')) {
        apiKey = parts[1];
      }
    }
    
    // Check if API key is provided
    if (!apiKey) {
      const logData: SecurityLogMeta = { severity: 'medium' };
      if (req.ip) logData.ip = req.ip;
      const userAgent = req.get('User-Agent');
      if (userAgent) logData.userAgent = userAgent;
      
      logger.security('Authentication attempt without API key', logData);
      
      throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    // Validate API key against configured admin key
    if (apiKey !== config.ADMIN_API_KEY) {
      const logData: SecurityLogMeta & { apiKeyPrefix: string } = { severity: 'high', apiKeyPrefix: apiKey.substring(0, 8) + '***' };
      if (req.ip) logData.ip = req.ip;
      const userAgent = req.get('User-Agent');
      if (userAgent) logData.userAgent = userAgent;
      
      logger.security('Authentication attempt with invalid API key', logData);
      
      throw new AppError('Invalid authentication credentials', 401, 'INVALID_CREDENTIALS');
    }
    
    // Authentication successful - attach user info to request
    req.user = {
      id: 'admin',
      role: 'admin',
      isAdmin: true
    };
    
    logger.info('Admin authentication successful', {
      userId: req.user.id,
      role: req.user.role,
      path: req.path,
      method: req.method
    });
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to check if the authenticated user is an admin
 * Should be used after adminGuard or another auth middleware
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
    }
    
    if (!req.user.isAdmin) {
      const logData: SecurityLogMeta & { userId?: string } = { severity: 'medium' };
      if (req.user.id) logData.userId = req.user.id;
      
      logger.security('Authorization failure - admin access required', logData);
      
      throw new AppError('Admin access required', 403, 'INSUFFICIENT_PRIVILEGES');
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if no credentials provided
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const config = getConfig();
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // No authentication provided, continue without user context
      return next();
    }
    
    const parts = authHeader.split(' ');
    if (parts.length === 2 && (parts[0] === 'Bearer' || parts[0] === 'ApiKey')) {
      const apiKey = parts[1];
      
      if (apiKey === config.ADMIN_API_KEY) {
        req.user = {
          id: 'admin',
          role: 'admin',
          isAdmin: true
        };
        
        logger.debug('Optional authentication successful', {
          userId: req.user.id,
          role: req.user.role
        });
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, log the error but continue
    logger.debug('Optional authentication failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    next();
  }
}

/**
 * Utility function to check if a request is from an authenticated admin
 */
export function isAdmin(req: AuthenticatedRequest): boolean {
  return Boolean(req.user?.isAdmin);
}

/**
 * Middleware factory for role-based access control
 * Future extension for more granular permissions
 */
export function requireRole(requiredRole: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED');
      }
      
      if (req.user.role !== requiredRole && !req.user.isAdmin) {
        const logData: SecurityLogMeta & { userId?: string } = { severity: 'medium' };
        if (req.user.id) logData.userId = req.user.id;
        
        logger.security('Authorization failure - role access required', logData);
        
        throw new AppError(`Role '${requiredRole}' required`, 403, 'INSUFFICIENT_PRIVILEGES');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}