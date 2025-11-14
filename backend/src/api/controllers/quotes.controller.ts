import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { IQuoteRepository, QuoteError, QuoteNotFoundError, QuoteSearchFilters } from '../../modules/quotes/repo';
import { CalculationService } from '../../modules/calculation/service';
import { PricingRepository } from '../../modules/pricing/repo';
import { CreateQuoteRequest, QuoteEstimate, Quote } from '../../schemas/quote';
import { ProductConfigInputSchema } from '../../schemas/productConfig';
import logger from '../../instrumentation/logger';
import { QuoteSaveAuditInput, recordQuoteSaved } from '../../modules/quotes/audit';

// Extend Express Request type to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

/**
 * Quote controller for handling quote-related HTTP requests
 * Follows REST conventions and contract specifications
 */

// Request/Response schemas for validation
const CreateQuoteRequestSchema = z.object({
  productConfig: z.record(z.unknown()), // Will be validated by ProductConfigInput schema
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional()
  }),
  notes: z.string().optional()
});

const UpdateQuoteNotesSchema = z.object({
  notes: z.string()
});

const UpdateQuoteCustomerSchema = z.object({
  customer: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional()
  })
});

const QuoteSearchParamsSchema = z.object({
  quoteNumber: z.string().optional(),
  customerName: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  status: z.enum(['active', 'deleted']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().min(0).default(0).optional()
});

export interface QuoteControllerDependencies {
  quoteRepository: IQuoteRepository;
  calculationService: CalculationService;
  pricingRepository: PricingRepository;
}

/**
 * Quote controller implementation
 */
export class QuoteController {
  constructor(private readonly deps: QuoteControllerDependencies) {}

  /**
   * Create a new quote
   * POST /quotes
   */
  async createQuote(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const actorId = req.user?.id || 'anonymous';
    
    try {
      // Validate request body
      const body = CreateQuoteRequestSchema.parse(req.body);
      
      // Parse and validate product configuration
      const productConfig = ProductConfigInputSchema.parse(body.productConfig);
      
      // Get current pricing configuration
      const priceConfig = await this.deps.pricingRepository.getCurrentPricingConfig();
      
      // Calculate quote estimate
      const estimate = await this.deps.calculationService.calculate(
        productConfig,
        priceConfig
      );
      
      // Create quote request
      const createQuoteRequest: CreateQuoteRequest = {
        productConfig,
        customer: body.customer
      };
      
      // Persist quote
      const quote = await this.deps.quoteRepository.createQuote(
        createQuoteRequest,
        estimate,
        priceConfig,
        actorId
      );
      
      const duration = Date.now() - startTime;
      
      const userAgent = req.get('User-Agent');
      const requestId = req.get('x-request-id');

      logger.info('Quote created successfully', {
        quoteNumber: quote.quoteNumber,
        customerName: quote.customer.name,
        totalIncVat: quote.estimate.totalIncVat,
        currency: quote.estimate.currency,
        duration,
        userAgent,
        ip: req.ip
      });

      const auditPayload: QuoteSaveAuditInput = {
        quote,
        priceConfigId: priceConfig.id,
        performedBy: actorId
      };

      if (req.ip) {
        auditPayload.ipAddress = req.ip;
      }

      if (userAgent) {
        auditPayload.userAgent = userAgent;
      }

      if (requestId) {
        auditPayload.requestId = requestId;
      }

      recordQuoteSaved(auditPayload);
      
      res.status(201).json({
        success: true,
        data: {
          quote: this.formatQuoteResponse(quote)
        },
        meta: {
          processedAt: new Date().toISOString(),
          duration
        }
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Invalid create quote request', {
          validationErrors: error.errors,
          requestBody: req.body,
          ip: req.ip
        });
        
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        });
        return;
      }
      
      if (error instanceof QuoteError) {
        logger.error('Quote creation failed', {
          errorCode: error.code,
          errorMessage: error.message,
          ip: req.ip
        });
        
        const statusCode = error.code === 'PERSIST_FAILED' ? 500 : 400;
        
        res.status(statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      
      logger.error('Unexpected error creating quote', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip
      });
      
      next(error);
    }
  }

  /**
   * Get quote by quote number
   * GET /quotes/:quoteNumber
   */
  async getQuoteByNumber(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const quoteNumber = req.params.quoteNumber;
      
      if (!quoteNumber || typeof quoteNumber !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_QUOTE_NUMBER',
            message: 'Quote number is required'
          }
        });
        return;
      }
      
      const quote = await this.deps.quoteRepository.getQuoteByNumber(quoteNumber);
      
      if (!quote) {
        logger.info('Quote not found', {
          quoteNumber,
          ip: req.ip
        });
        
        res.status(404).json({
          success: false,
          error: {
            code: 'QUOTE_NOT_FOUND',
            message: `Quote ${quoteNumber} not found`
          }
        });
        return;
      }
      
      const duration = Date.now() - startTime;
      
      logger.info('Quote retrieved successfully', {
        quoteNumber,
        customerName: quote.customer.name,
        duration,
        ip: req.ip
      });
      
      res.status(200).json({
        success: true,
        data: {
          quote: this.formatQuoteResponse(quote)
        },
        meta: {
          processedAt: new Date().toISOString(),
          duration
        }
      });
      
    } catch (error) {
      if (error instanceof QuoteError) {
        logger.error('Failed to retrieve quote', {
          quoteNumber: req.params.quoteNumber,
          errorCode: error.code,
          errorMessage: error.message,
          ip: req.ip
        });
        
        res.status(500).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      
      logger.error('Unexpected error retrieving quote', {
        quoteNumber: req.params.quoteNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip
      });
      
      next(error);
    }
  }

  /**
   * Update quote notes
   * PATCH /quotes/:quoteNumber/notes
   */
  async updateQuoteNotes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quoteNumber = req.params.quoteNumber;
      const body = UpdateQuoteNotesSchema.parse(req.body);
      
      // Validation is handled by middleware, but double-check for safety
      if (!quoteNumber) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_QUOTE_NUMBER',
            message: 'Quote number is required'
          }
        });
        return;
      }
      
      await this.deps.quoteRepository.updateQuoteNotes(
        quoteNumber,
        body.notes,
        req.user?.id || 'anonymous'
      );
      
      logger.info('Quote notes updated', {
        quoteNumber,
        updatedBy: req.user?.id || 'anonymous',
        ip: req.ip
      });
      
      res.status(200).json({
        success: true,
        data: {
          message: 'Notes updated successfully'
        }
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        });
        return;
      }
      
      if (error instanceof QuoteNotFoundError) {
        res.status(404).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      
      if (error instanceof QuoteError) {
        res.status(500).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      
      next(error);
    }
  }

  /**
   * Update quote customer information
   * PATCH /quotes/:quoteNumber/customer
   */
  async updateQuoteCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quoteNumber = req.params.quoteNumber;
      const body = UpdateQuoteCustomerSchema.parse(req.body);
      
      // Validation is handled by middleware, but double-check for safety
      if (!quoteNumber) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_QUOTE_NUMBER',
            message: 'Quote number is required'
          }
        });
        return;
      }
      
      // Filter out undefined values from customer update
      const customerUpdate = Object.fromEntries(
        Object.entries(body.customer).filter(([_, value]) => value !== undefined)
      );
      
      await this.deps.quoteRepository.updateQuoteCustomer(
        quoteNumber,
        customerUpdate,
        req.user?.id || 'anonymous'
      );
      
      logger.info('Quote customer updated', {
        quoteNumber,
        updatedBy: req.user?.id || 'anonymous',
        ip: req.ip
      });
      
      res.status(200).json({
        success: true,
        data: {
          message: 'Customer information updated successfully'
        }
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        });
        return;
      }
      
      if (error instanceof QuoteNotFoundError) {
        res.status(404).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      
      if (error instanceof QuoteError) {
        res.status(500).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      
      next(error);
    }
  }

  /**
   * Delete quote (soft delete)
   * DELETE /quotes/:quoteNumber
   */
  async deleteQuote(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quoteNumber = req.params.quoteNumber;
      
      // Validation is handled by middleware, but double-check for safety
      if (!quoteNumber) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_QUOTE_NUMBER',
            message: 'Quote number is required'
          }
        });
        return;
      }
      
      await this.deps.quoteRepository.deleteQuote(
        quoteNumber,
        req.user?.id || 'anonymous'
      );
      
      logger.info('Quote deleted', {
        quoteNumber,
        deletedBy: req.user?.id || 'anonymous',
        ip: req.ip
      });
      
      res.status(200).json({
        success: true,
        data: {
          message: 'Quote deleted successfully'
        }
      });
      
    } catch (error) {
      if (error instanceof QuoteNotFoundError) {
        res.status(404).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      
      if (error instanceof QuoteError) {
        res.status(500).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      
      next(error);
    }
  }

  /**
   * Search quotes with filters
   * GET /quotes
   */
  async searchQuotes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    
    try {
      const params = QuoteSearchParamsSchema.parse(req.query);
      
      const filters: QuoteSearchFilters = {};
      
      // Only add defined properties to filters
      if (params.quoteNumber) filters.quoteNumber = params.quoteNumber;
      if (params.customerName) filters.customerName = params.customerName;
      if (params.fromDate) filters.fromDate = new Date(params.fromDate);
      if (params.toDate) filters.toDate = new Date(params.toDate);
      if (params.minAmount !== undefined) filters.minAmount = params.minAmount;
      if (params.maxAmount !== undefined) filters.maxAmount = params.maxAmount;
      if (params.status) filters.status = params.status;
      if (params.limit !== undefined) filters.limit = params.limit;
      if (params.offset !== undefined) filters.offset = params.offset;
      
      const result = await this.deps.quoteRepository.searchQuotes(filters);
      const duration = Date.now() - startTime;
      
      logger.info('Quotes searched', {
        filters,
        resultCount: result.quotes.length,
        total: result.total,
        duration,
        ip: req.ip
      });
      
      res.status(200).json({
        success: true,
        data: {
          quotes: result.quotes,
          pagination: {
            total: result.total,
            limit: params.limit || 20,
            offset: params.offset || 0,
            hasMore: result.hasMore
          }
        },
        meta: {
          processedAt: new Date().toISOString(),
          duration
        }
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors
          }
        });
        return;
      }
      
      if (error instanceof QuoteError) {
        res.status(500).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      
      next(error);
    }
  }

  /**
   * Get quote statistics
   * GET /quotes/stats
   */
  async getQuoteStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await this.deps.quoteRepository.getQuoteStats();
      
      logger.info('Quote stats retrieved', {
        totalQuotes: stats.totalQuotes,
        activeQuotes: stats.activeQuotes,
        totalValue: stats.totalValue,
        ip: req.ip
      });
      
      res.status(200).json({
        success: true,
        data: {
          stats
        },
        meta: {
          processedAt: new Date().toISOString()
        }
      });
      
    } catch (error) {
      if (error instanceof QuoteError) {
        res.status(500).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      
      next(error);
    }
  }

  /**
   * Format quote for API response
   */
  private formatQuoteResponse(quote: Quote): Record<string, unknown> {
    return {
      quoteNumber: quote.quoteNumber,
      quoteDate: quote.quoteDate,
      customer: quote.customer,
      estimate: {
        currency: quote.estimate.currency,
        subtotalExVat: quote.estimate.subtotalExVat,
        vatRate: quote.estimate.vatRate,
        totalIncVat: quote.estimate.totalIncVat,
        lineItems: quote.estimate.lineItems
      },
      currency: quote.currency,
      notes: quote.notes,
      status: quote.status
    };
  }
}

/**
 * Express middleware factories
 */

export function createQuoteController(deps: QuoteControllerDependencies): QuoteController {
  return new QuoteController(deps);
}

// Individual handler functions for route binding
export function createQuoteHandlers(deps: QuoteControllerDependencies) {
  const controller = new QuoteController(deps);
  
  return {
    createQuote: controller.createQuote.bind(controller),
    getQuoteByNumber: controller.getQuoteByNumber.bind(controller),
    updateQuoteNotes: controller.updateQuoteNotes.bind(controller),
    updateQuoteCustomer: controller.updateQuoteCustomer.bind(controller),
    deleteQuote: controller.deleteQuote.bind(controller),
    searchQuotes: controller.searchQuotes.bind(controller),
    getQuoteStats: controller.getQuoteStats.bind(controller)
  };
}