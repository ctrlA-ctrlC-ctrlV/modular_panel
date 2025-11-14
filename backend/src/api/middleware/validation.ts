import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from './errorHandler';
import logger from '../../instrumentation/logger';

export interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  headers?: ZodSchema;
}

export interface ValidatedRequest<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string | string[]>
> extends Request<TParams, unknown, TBody, TQuery> {
  // Extends Express Request with proper typing
}

// Validation options
export interface ValidationOptions {
  /** Skip validation for certain fields */
  skipFields?: string[];
  /** Allow unknown fields in the request */
  allowUnknown?: boolean;
  /** Strip unknown fields from the request */
  stripUnknown?: boolean;
  /** Custom error messages */
  errorMessages?: Record<string, string>;
}

/**
 * Create validation middleware for request validation
 */
export function validate(
  schemas: ValidationSchemas,
  options: ValidationOptions = {}
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, unknown> = {};
    const { allowUnknown = false, stripUnknown = true } = options;

    try {
      // Validate request body
      if (schemas.body && req.body !== undefined) {
        req.body = schemas.body.parse(req.body);
      }

      // Validate request parameters
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      // Validate query parameters
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }

      // Validate headers
      if (schemas.headers) {
        req.headers = schemas.headers.parse(req.headers);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.debug('Request validation failed', {
          method: req.method,
          url: req.originalUrl,
          errors: error.errors
        });

        const validationError = new ValidationError('Request validation failed', {
          validationErrors: formatZodErrors(error.errors, options.errorMessages)
        });

        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

/**
 * Validate only request body
 */
export function validateBody<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validate({ body: schema }, options);
}

/**
 * Validate only request parameters
 */
export function validateParams<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validate({ params: schema }, options);
}

/**
 * Validate only query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>, options?: ValidationOptions) {
  return validate({ query: schema }, options);
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID parameter
  uuidParam: z.object({
    id: z.string().uuid('Invalid UUID format')
  }),

  // Pagination query
  paginationQuery: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('asc')
  }),

  // Date range query
  dateRangeQuery: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }).refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, {
    message: 'Start date must be before end date'
  }),

  // Search query
  searchQuery: z.object({
    q: z.string().min(1).max(100).optional(),
    fields: z.string().optional()
  }),
};

/**
 * Custom validation decorators
 */

// Email validation with domain checking
export const emailSchema = z.string()
  .email('Invalid email format')
  .refine(email => {
    const domain = email.split('@')[1];
    return domain && domain.length > 0;
  }, 'Invalid email domain');

// Phone number validation (international format)
export const phoneSchema = z.string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in international format (+1234567890)');

// Password validation
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain lowercase, uppercase, and number');

// File upload validation
export const fileSchema = z.object({
  filename: z.string().min(1),
  mimetype: z.string(),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB')
});

/**
 * Format Zod validation errors for API response
 */
function formatZodErrors(
  errors: z.ZodIssue[], 
  customMessages?: Record<string, string>
): Array<{
  field: string;
  message: string;
  code: string;
  received?: unknown;
}> {
  return errors.map(error => {
    const field = error.path.join('.');
    const customMessage = customMessages?.[field];
    
    return {
      field,
      message: customMessage || error.message,
      code: error.code,
      received: 'received' in error ? error.received : undefined
    };
  });
}

/**
 * Sanitization helpers
 */
export const sanitizers = {
  // Trim whitespace and normalize
  text: z.string().trim().transform(val => val.replace(/\s+/g, ' ')),
  
  // Email normalization
  email: z.string().trim().toLowerCase().email(),
  
  // URL normalization
  url: z.string().url().transform(val => {
    try {
      return new URL(val).toString();
    } catch {
      return val;
    }
  }),

  // Phone number normalization (remove spaces, dashes)
  phone: z.string().transform(val => val.replace(/[\s\-\(\)]/g, '')),

  // HTML content sanitization (basic)
  html: z.string().transform(val => 
    val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  )
};

/**
 * Advanced validation patterns
 */

// Conditional validation based on other fields
export function conditionalValidation<T>(
  condition: (data: T) => boolean,
  schema: ZodSchema
) {
  return z.unknown().superRefine((data, ctx) => {
    if (condition(data as T)) {
      const result = schema.safeParse(data);
      if (!result.success) {
        result.error.issues.forEach(issue => {
          ctx.addIssue(issue);
        });
      }
    }
  });
}

// Cross-field validation
export function crossFieldValidation<T>(
  validator: (data: T) => string | null
) {
  return z.unknown().superRefine((data, ctx) => {
    const error = validator(data as T);
    if (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error
      });
    }
  });
}

// Rate limiting based validation
export function rateLimitValidation(req: Request) {
  return z.unknown().superRefine((data, ctx) => {
    // Check if request should be rate limited based on content
    if (typeof data === 'object' && data !== null) {
      const stringData = JSON.stringify(data);
      if (stringData.length > 100000) { // 100KB
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: 100000,
          type: 'string',
          inclusive: true,
          message: 'Request payload too large'
        });
      }
    }
  });
}

// Note: File upload validation will be implemented when multer middleware is added