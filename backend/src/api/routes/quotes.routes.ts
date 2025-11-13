import { Router } from 'express';
import { Pool } from 'pg';
import { createQuoteHandlers, QuoteControllerDependencies } from '../controllers/quotes.controller';
import { createQuoteRepository } from '../../modules/quotes/repo';
import { createCalculationService } from '../../modules/calculation/service';
import { createPricingRepository } from '../../modules/pricing/repo';
import { validate } from '../middleware/validation';
import { z } from 'zod';

/**
 * Quote routes configuration
 * Implements REST API endpoints for quote management
 * 
 * Routes:
 * POST   /quotes           - Create new quote
 * GET    /quotes           - Search quotes with filters
 * GET    /quotes/stats     - Get quote statistics
 * GET    /quotes/:quoteNumber - Get quote by number
 * PATCH  /quotes/:quoteNumber/notes - Update quote notes
 * PATCH  /quotes/:quoteNumber/customer - Update quote customer
 * DELETE /quotes/:quoteNumber - Delete quote (soft delete)
 */

// Validation schemas for route parameters
const QuoteNumberParamSchema = z.object({
  quoteNumber: z.string().min(1, 'Quote number is required')
});

const CreateQuoteBodySchema = z.object({
  productConfig: z.record(z.unknown()),
  customer: z.object({
    name: z.string().min(1, 'Customer name is required'),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional()
  }),
  notes: z.string().optional()
});

const UpdateQuoteNotesBodySchema = z.object({
  notes: z.string().min(1, 'Notes cannot be empty')
});

const UpdateQuoteCustomerBodySchema = z.object({
  customer: z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional()
  }).refine(
    (customer) => Object.keys(customer).length > 0,
    'At least one customer field must be provided'
  )
});

const QuoteSearchQuerySchema = z.object({
  quoteNumber: z.string().optional(),
  customerName: z.string().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  minAmount: z.coerce.number().min(0, 'Minimum amount must be positive').optional(),
  maxAmount: z.coerce.number().min(0, 'Maximum amount must be positive').optional(),
  status: z.enum(['active', 'deleted']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional()
});

/**
 * Create quotes router with all endpoints
 */
export function createQuotesRouter(pool: Pool): Router {
  const router = Router();
  
  // Initialize dependencies
  const deps: QuoteControllerDependencies = {
    quoteRepository: createQuoteRepository(pool),
    calculationService: createCalculationService(),
    pricingRepository: createPricingRepository(pool)
  };
  
  const handlers = createQuoteHandlers(deps);
  
  // Quote statistics endpoint (must be before parameterized routes)
  router.get('/stats', handlers.getQuoteStats);
  
  // Create new quote
  router.post('/',
    validate({ 
      body: CreateQuoteBodySchema
    }),
    handlers.createQuote
  );
  
  // Search quotes with filters
  router.get('/',
    validate({ 
      query: QuoteSearchQuerySchema
    }),
    handlers.searchQuotes
  );
  
  // Get quote by number
  router.get('/:quoteNumber',
    validate({ 
      params: QuoteNumberParamSchema
    }),
    handlers.getQuoteByNumber
  );
  
  // Update quote notes
  router.patch('/:quoteNumber/notes',
    validate({ 
      params: QuoteNumberParamSchema,
      body: UpdateQuoteNotesBodySchema
    }),
    handlers.updateQuoteNotes
  );
  
  // Update quote customer information
  router.patch('/:quoteNumber/customer',
    validate({ 
      params: QuoteNumberParamSchema,
      body: UpdateQuoteCustomerBodySchema
    }),
    handlers.updateQuoteCustomer
  );
  
  // Delete quote (soft delete)
  router.delete('/:quoteNumber',
    validate({ 
      params: QuoteNumberParamSchema
    }),
    handlers.deleteQuote
  );
  
  return router;
}

/**
 * Mount quotes routes in main application
 * Usage: app.use('/api/v1/quotes', createQuotesRouter(pool));
 */

export default createQuotesRouter;