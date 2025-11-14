import { Pool, QueryResult, PoolClient } from 'pg';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Quote, CustomerInfo, QuoteEstimate, CreateQuoteRequest } from '../../schemas/quote';
import { ProductConfigInput } from '../../schemas/productConfig';
import { PriceConfig } from '../pricing/repo';
import { createQuoteSequenceService, QuoteNumberError } from './sequence';
import logger from '../../instrumentation/logger';

/**
 * Quote repository for database operations
 * Handles persistence and retrieval of quotes
 */

// Database row schema for quote table
export const QuoteDbSchema = z.object({
  id: z.string().uuid(),
  quote_number: z.string(),
  quote_date: z.string(), // ISO date string
  customer: z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional()
  }),
  product_config_id: z.string().uuid().nullable(),
  product_config_snapshot: z.record(z.unknown()),
  price_config_id: z.string().uuid(),
  currency: z.string(),
  vat_rate: z.string(), // Decimal as string from DB
  subtotal_ex_vat: z.string(), // Decimal as string from DB
  total_inc_vat: z.string(), // Decimal as string from DB
  notes: z.string().nullable(),
  status: z.enum(['active', 'deleted']),
  audit: z.object({
    createdBy: z.string(),
    updatedBy: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string().optional()
  }),
  created_at: z.string(),
  updated_at: z.string()
});

export type QuoteDb = z.infer<typeof QuoteDbSchema>;

// Custom errors
export class QuoteError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'QuoteError';
  }
}

export class QuoteNotFoundError extends QuoteError {
  constructor(quoteNumber: string) {
    super(`Quote not found: ${quoteNumber}`, 'QUOTE_NOT_FOUND');
  }
}

export class QuotePersistError extends QuoteError {
  constructor(message: string) {
    super(`Failed to persist quote: ${message}`, 'PERSIST_FAILED');
  }
}

export class InvalidQuoteDataError extends QuoteError {
  constructor(message: string) {
    super(`Invalid quote data: ${message}`, 'INVALID_DATA');
  }
}

/**
 * Quote repository interface
 */
export interface IQuoteRepository {
  createQuote(request: CreateQuoteRequest, estimate: QuoteEstimate, priceConfig: PriceConfig, createdBy?: string): Promise<Quote>;
  getQuoteByNumber(quoteNumber: string): Promise<Quote | null>;
  updateQuoteNotes(quoteNumber: string, notes: string, updatedBy?: string): Promise<void>;
  updateQuoteCustomer(quoteNumber: string, customer: Partial<CustomerInfo>, updatedBy?: string): Promise<void>;
  deleteQuote(quoteNumber: string, deletedBy?: string): Promise<void>;
  searchQuotes(filters: QuoteSearchFilters): Promise<QuoteSearchResult>;
  getQuoteStats(): Promise<QuoteStats>;
}

export interface QuoteSearchFilters {
  quoteNumber?: string;
  customerName?: string;
  fromDate?: Date;
  toDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  status?: 'active' | 'deleted';
  limit?: number;
  offset?: number;
}

export interface QuoteSearchResult {
  quotes: Array<{
    quoteNumber: string;
    quoteDate: string;
    customer: { name: string };
    currency: string;
    totalIncVat: number;
    status: string;
  }>;
  total: number;
  hasMore: boolean;
}

export interface QuoteStats {
  totalQuotes: number;
  activeQuotes: number;
  deletedQuotes: number;
  totalValue: number;
  avgQuoteValue: number;
  quotesThisMonth: number;
  quotesThisYear: number;
}

/**
 * Quote repository implementation
 */
export class QuoteRepository implements IQuoteRepository {
  private sequenceService;

  constructor(private readonly pool: Pool) {
    this.sequenceService = createQuoteSequenceService(pool);
  }

  /**
   * Create a new quote
   */
  async createQuote(
    request: CreateQuoteRequest, 
    estimate: QuoteEstimate, 
    priceConfig: PriceConfig,
    createdBy = 'system'
  ): Promise<Quote> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Generate quote number
      const quoteNumber = await this.sequenceService.generateQuoteNumber();
      
      // Create product config record (optional - for normalization)
      const productConfigId = await this.createProductConfig(
        client, 
        request.productConfig, 
        estimate
      );
      
      // Create quote record
      const quoteId = uuidv4();
      const now = new Date();
      const quoteDate = now.toISOString().split('T')[0];
      
      const audit = {
        createdBy,
        createdAt: now.toISOString()
      };
      
      const insertQuery = `
        INSERT INTO quote (
          id, quote_number, quote_date, customer, 
          product_config_id, product_config_snapshot, price_config_id,
          currency, vat_rate, subtotal_ex_vat, total_inc_vat,
          notes, status, audit
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) RETURNING *
      `;
      
      const values = [
        quoteId,
        quoteNumber,
        quoteDate,
        JSON.stringify(request.customer),
        productConfigId,
        JSON.stringify(request.productConfig),
        priceConfig.id,
        estimate.currency,
        estimate.vatRate.toString(),
        estimate.subtotalExVat.toString(),
        estimate.totalIncVat.toString(),
        request.productConfig.notes || null,
        'active',
        JSON.stringify(audit)
      ];
      
      const result = await client.query(insertQuery, values);
      
      await client.query('COMMIT');
      
      const dbRow = result.rows[0];
      const quote = this.mapDbToDomain(dbRow, estimate.lineItems);
      
      logger.info('Quote created successfully', {
        quoteNumber,
        quoteId,
        customerName: request.customer.name,
        totalIncVat: estimate.totalIncVat,
        currency: estimate.currency
      });
      
      return quote;
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      if (error instanceof QuoteNumberError) {
        throw new QuotePersistError(`Quote number generation failed: ${error.message}`);
      }
      
      logger.error('Failed to create quote', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerName: request.customer.name
      });
      
      throw new QuotePersistError(
        `Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
    } finally {
      client.release();
    }
  }

  /**
   * Get quote by quote number
   */
  async getQuoteByNumber(quoteNumber: string): Promise<Quote | null> {
    try {
      const query = `
        SELECT q.*, pc.base, pc.cladding, pc.bathroom, pc.glazing, pc.electrical,
               pc.internal, pc.flooring, pc.delivery, pc.extras, pc.taxes
        FROM quote q
        JOIN price_config pc ON q.price_config_id = pc.id
        WHERE q.quote_number = $1 AND q.status = 'active'
      `;
      
      const result = await this.pool.query(query, [quoteNumber]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const dbRow = result.rows[0];
      
      // Reconstruct line items from pricing config and product config snapshot
      const lineItems = this.reconstructLineItems(dbRow);
      
      return this.mapDbToDomain(dbRow, lineItems);
      
    } catch (error) {
      logger.error('Failed to get quote by number', {
        quoteNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new QuoteError(
        `Failed to retrieve quote: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RETRIEVAL_FAILED'
      );
    }
  }

  /**
   * Update quote notes
   */
  async updateQuoteNotes(quoteNumber: string, notes: string, updatedBy = 'system'): Promise<void> {
    try {
      const updateQuery = `
        UPDATE quote 
        SET notes = $1, 
            audit = jsonb_set(audit, '{updatedBy}', $2) ||
                   jsonb_set(audit, '{updatedAt}', $3)
        WHERE quote_number = $4 AND status = 'active'
      `;
      
      const result = await this.pool.query(updateQuery, [
        notes,
        JSON.stringify(updatedBy),
        JSON.stringify(new Date().toISOString()),
        quoteNumber
      ]);
      
      if (result.rowCount === 0) {
        throw new QuoteNotFoundError(quoteNumber);
      }
      
      logger.info('Quote notes updated', { quoteNumber, updatedBy });
      
    } catch (error) {
      if (error instanceof QuoteError) {
        throw error;
      }
      
      throw new QuoteError(
        `Failed to update quote notes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPDATE_FAILED'
      );
    }
  }

  /**
   * Update quote customer information
   */
  async updateQuoteCustomer(
    quoteNumber: string, 
    customerUpdate: Partial<CustomerInfo>, 
    updatedBy = 'system'
  ): Promise<void> {
    try {
      // First get current customer data
      const selectQuery = 'SELECT customer FROM quote WHERE quote_number = $1 AND status = \'active\'';
      const selectResult = await this.pool.query(selectQuery, [quoteNumber]);
      
      if (selectResult.rows.length === 0) {
        throw new QuoteNotFoundError(quoteNumber);
      }
      
      const currentCustomer = selectResult.rows[0].customer;
      const updatedCustomer = { ...currentCustomer, ...customerUpdate };
      
      const updateQuery = `
        UPDATE quote 
        SET customer = $1,
            audit = jsonb_set(audit, '{updatedBy}', $2) ||
                   jsonb_set(audit, '{updatedAt}', $3)
        WHERE quote_number = $4 AND status = 'active'
      `;
      
      const result = await this.pool.query(updateQuery, [
        JSON.stringify(updatedCustomer),
        JSON.stringify(updatedBy),
        JSON.stringify(new Date().toISOString()),
        quoteNumber
      ]);
      
      if (result.rowCount === 0) {
        throw new QuoteNotFoundError(quoteNumber);
      }
      
      logger.info('Quote customer updated', { quoteNumber, updatedBy });
      
    } catch (error) {
      if (error instanceof QuoteError) {
        throw error;
      }
      
      throw new QuoteError(
        `Failed to update quote customer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UPDATE_FAILED'
      );
    }
  }

  /**
   * Soft delete quote
   */
  async deleteQuote(quoteNumber: string, deletedBy = 'system'): Promise<void> {
    try {
      const updateQuery = `
        UPDATE quote 
        SET status = 'deleted',
            audit = jsonb_set(audit, '{updatedBy}', $1) ||
                   jsonb_set(audit, '{updatedAt}', $2)
        WHERE quote_number = $3 AND status = 'active'
      `;
      
      const result = await this.pool.query(updateQuery, [
        JSON.stringify(deletedBy),
        JSON.stringify(new Date().toISOString()),
        quoteNumber
      ]);
      
      if (result.rowCount === 0) {
        throw new QuoteNotFoundError(quoteNumber);
      }
      
      logger.info('Quote deleted', { quoteNumber, deletedBy });
      
    } catch (error) {
      if (error instanceof QuoteError) {
        throw error;
      }
      
      throw new QuoteError(
        `Failed to delete quote: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETE_FAILED'
      );
    }
  }

  /**
   * Search quotes with filters
   */
  async searchQuotes(filters: QuoteSearchFilters): Promise<QuoteSearchResult> {
    try {
      let query = `
        SELECT quote_number, quote_date, customer, currency, total_inc_vat, status,
               COUNT(*) OVER() as total_count
        FROM quote 
        WHERE 1=1
      `;
      
      const params: unknown[] = [];
      let paramIndex = 1;
      
      // Add filters
      if (filters.quoteNumber) {
        query += ` AND quote_number ILIKE $${paramIndex}`;
        params.push(`%${filters.quoteNumber}%`);
        paramIndex++;
      }
      
      if (filters.customerName) {
        query += ` AND customer->>'name' ILIKE $${paramIndex}`;
        params.push(`%${filters.customerName}%`);
        paramIndex++;
      }
      
      if (filters.fromDate) {
        query += ` AND quote_date >= $${paramIndex}`;
        params.push(filters.fromDate.toISOString().split('T')[0]);
        paramIndex++;
      }
      
      if (filters.toDate) {
        query += ` AND quote_date <= $${paramIndex}`;
        params.push(filters.toDate.toISOString().split('T')[0]);
        paramIndex++;
      }
      
      if (filters.minAmount !== undefined) {
        query += ` AND total_inc_vat >= $${paramIndex}`;
        params.push(filters.minAmount.toString());
        paramIndex++;
      }
      
      if (filters.maxAmount !== undefined) {
        query += ` AND total_inc_vat <= $${paramIndex}`;
        params.push(filters.maxAmount.toString());
        paramIndex++;
      }
      
      if (filters.status) {
        query += ` AND status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      } else {
        // Default to active quotes only
        query += ` AND status = 'active'`;
      }
      
      query += ` ORDER BY quote_date DESC, created_at DESC`;
      
      // Add pagination
      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      
      const result = await this.pool.query(query, params);
      
      const quotes = result.rows.map(row => ({
        quoteNumber: row.quote_number,
        quoteDate: row.quote_date,
        customer: { name: row.customer.name },
        currency: row.currency,
        totalIncVat: parseFloat(row.total_inc_vat),
        status: row.status
      }));
      
      const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
      const hasMore = offset + quotes.length < total;
      
      return { quotes, total, hasMore };
      
    } catch (error) {
      throw new QuoteError(
        `Failed to search quotes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEARCH_FAILED'
      );
    }
  }

  /**
   * Get quote statistics
   */
  async getQuoteStats(): Promise<QuoteStats> {
    try {
      const query = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active') as active_quotes,
          COUNT(*) FILTER (WHERE status = 'deleted') as deleted_quotes,
          COUNT(*) as total_quotes,
          SUM(total_inc_vat::numeric) FILTER (WHERE status = 'active') as total_value,
          AVG(total_inc_vat::numeric) FILTER (WHERE status = 'active') as avg_quote_value,
          COUNT(*) FILTER (WHERE DATE_TRUNC('month', quote_date) = DATE_TRUNC('month', CURRENT_DATE) AND status = 'active') as quotes_this_month,
          COUNT(*) FILTER (WHERE DATE_TRUNC('year', quote_date) = DATE_TRUNC('year', CURRENT_DATE) AND status = 'active') as quotes_this_year
        FROM quote
      `;
      
      const result = await this.pool.query(query);
      const row = result.rows[0];
      
      return {
        totalQuotes: parseInt(row.total_quotes || '0', 10),
        activeQuotes: parseInt(row.active_quotes || '0', 10),
        deletedQuotes: parseInt(row.deleted_quotes || '0', 10),
        totalValue: parseFloat(row.total_value || '0'),
        avgQuoteValue: parseFloat(row.avg_quote_value || '0'),
        quotesThisMonth: parseInt(row.quotes_this_month || '0', 10),
        quotesThisYear: parseInt(row.quotes_this_year || '0', 10)
      };
      
    } catch (error) {
      throw new QuoteError(
        `Failed to get quote stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STATS_FAILED'
      );
    }
  }

  /**
   * Create product config record for normalization
   */
  private async createProductConfig(
    client: PoolClient, 
    productConfig: ProductConfigInput, 
    estimate: QuoteEstimate
  ): Promise<string> {
    const productConfigId = uuidv4();
    
    const insertQuery = `
      INSERT INTO product_config (
        id, size, cladding, bathroom, electrical, internal_doors,
        internal_wall, heaters, glazing, floor, delivery, extras,
        discount, estimate, notes, permitted_development_flags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `;
    
    const values = [
      productConfigId,
      JSON.stringify(productConfig.size),
      JSON.stringify(productConfig.cladding || {}),
      JSON.stringify(productConfig.bathroom || {}),
      JSON.stringify(productConfig.electrical || {}),
      productConfig.internal_doors || 0,
      JSON.stringify(productConfig.internal_wall || {}),
      productConfig.heaters || 0,
      JSON.stringify(productConfig.glazing || {}),
      JSON.stringify(productConfig.floor || {}),
      JSON.stringify(productConfig.delivery || {}),
      JSON.stringify(productConfig.extras || {}),
      productConfig.discount || 0,
      JSON.stringify(estimate),
      productConfig.notes || null,
      JSON.stringify(productConfig.permittedDevelopmentFlags || [])
    ];
    
    await client.query(insertQuery, values);
    return productConfigId;
  }

  /**
   * Reconstruct line items from pricing config and product snapshot
   */
  private reconstructLineItems(dbRow: QuoteDb): Array<{ code: string; description: string; quantity: number; unitPrice: number; lineTotal: number }> {
    // For now, return a basic line item structure
    // In a full implementation, this would reconstruct the calculation
    return [{
      code: 'TOTAL',
      description: 'Quote Total',
      quantity: 1,
      unitPrice: parseFloat(dbRow.subtotal_ex_vat),
      lineTotal: parseFloat(dbRow.subtotal_ex_vat)
    }];
  }

  /**
   * Map database row to domain model
   */
  private mapDbToDomain(dbRow: QuoteDb, lineItems: Array<{ code: string; description: string; quantity: number; unitPrice: number; lineTotal: number }>): Quote {
    try {
      return {
        quoteNumber: dbRow.quote_number,
        quoteDate: dbRow.quote_date,
        customer: dbRow.customer,
        estimate: {
          currency: dbRow.currency,
          subtotalExVat: parseFloat(dbRow.subtotal_ex_vat),
          vatRate: parseFloat(dbRow.vat_rate),
          totalIncVat: parseFloat(dbRow.total_inc_vat),
          lineItems
        },
        currency: dbRow.currency,
        notes: dbRow.notes || undefined,
        status: dbRow.status as 'active' | 'deleted'
      };
    } catch (error) {
      throw new InvalidQuoteDataError(
        `Failed to map quote data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Create quote repository instance
 */
export function createQuoteRepository(pool: Pool): QuoteRepository {
  return new QuoteRepository(pool);
}