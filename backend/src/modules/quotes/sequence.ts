import { Pool, PoolClient } from 'pg';
import logger from '../../instrumentation/logger';

/**
 * Quote number generator using transactional sequence
 * Generates unique quote numbers in format Q{YY}-{NNNNNN}
 */

// Error classes
export class QuoteNumberError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'QuoteNumberError';
  }
}

export class SequenceError extends QuoteNumberError {
  constructor(message: string) {
    super(`Sequence error: ${message}`, 'SEQUENCE_ERROR');
  }
}

/**
 * Quote number generator service
 */
export class QuoteSequenceService {
  constructor(private readonly pool: Pool) {}

  /**
   * Generate next unique quote number
   * @returns Quote number in format Q{YY}-{NNNNNN}
   */
  async generateQuoteNumber(): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const currentYear = new Date().getFullYear();
      const yearSuffix = currentYear.toString().slice(-2); // Get last 2 digits
      
      // Get or create sequence for current year
      const sequenceValue = await this.getNextSequenceValue(client, currentYear);
      
      // Format as 6-digit number with leading zeros
      const sequenceNumber = sequenceValue.toString().padStart(6, '0');
      const quoteNumber = `Q${yearSuffix}-${sequenceNumber}`;
      
      await client.query('COMMIT');
      
      logger.info('Generated new quote number', {
        quoteNumber,
        year: currentYear,
        sequenceValue
      });
      
      return quoteNumber;
    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('Failed to generate quote number', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      if (error instanceof QuoteNumberError) {
        throw error;
      }
      
      throw new QuoteNumberError(
        `Failed to generate quote number: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GENERATION_FAILED'
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get next sequence value for the given year
   * @param client - Database client
   * @param year - Year for sequence
   * @returns Next sequence value
   */
  private async getNextSequenceValue(client: PoolClient, year: number): Promise<number> {
    try {
      // First, try to get existing sequence for the year
      const selectResult = await client.query(
        'SELECT sequence_number FROM quote_sequence WHERE year = $1',
        [year]
      );
      
      if (selectResult.rows.length > 0) {
        // Update existing sequence
        const updateResult = await client.query(
          'UPDATE quote_sequence SET sequence_number = sequence_number + 1 WHERE year = $1 RETURNING sequence_number',
          [year]
        );
        
        if (updateResult.rows.length === 0) {
          throw new SequenceError('Failed to update sequence value');
        }
        
        return updateResult.rows[0].sequence_number;
      } else {
        // Create new sequence for the year starting at 1
        const insertResult = await client.query(
          'INSERT INTO quote_sequence (year, sequence_number) VALUES ($1, 1) RETURNING sequence_number',
          [year]
        );
        
        if (insertResult.rows.length === 0) {
          throw new SequenceError('Failed to create new sequence');
        }
        
        return insertResult.rows[0].sequence_number;
      }
    } catch (error) {
      if (error instanceof QuoteNumberError) {
        throw error;
      }
      
      throw new SequenceError(
        `Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate quote number format
   * @param quoteNumber - Quote number to validate
   * @returns True if valid format
   */
  static validateQuoteNumberFormat(quoteNumber: string): boolean {
    const pattern = /^Q\d{2}-\d{6}$/;
    return pattern.test(quoteNumber);
  }

  /**
   * Parse quote number into components
   * @param quoteNumber - Quote number to parse
   * @returns Parsed components or null if invalid
   */
  static parseQuoteNumber(quoteNumber: string): { year: number; sequence: number } | null {
    if (!this.validateQuoteNumberFormat(quoteNumber)) {
      return null;
    }
    
    const match = quoteNumber.match(/^Q(\d{2})-(\d{6})$/);
    if (!match) {
      return null;
    }
    
    const yearSuffix = parseInt(match[1]!, 10);
    const sequence = parseInt(match[2]!, 10);
    
    // Determine full year (assume 20xx for 00-99)
    const currentYear = new Date().getFullYear();
    const currentCentury = Math.floor(currentYear / 100) * 100;
    const year = currentCentury + yearSuffix;
    
    return { year, sequence };
  }

  /**
   * Get current sequence status for a year
   * @param year - Year to check
   * @returns Current sequence value or null if not found
   */
  async getCurrentSequenceValue(year?: number): Promise<{ year: number; value: number } | null> {
    const targetYear = year || new Date().getFullYear();
    
    try {
      const result = await this.pool.query(
        'SELECT year, sequence_number FROM quote_sequence WHERE year = $1',
        [targetYear]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return {
        year: result.rows[0].year,
        value: result.rows[0].sequence_number
      };
    } catch (error) {
      throw new QuoteNumberError(
        `Failed to get sequence value: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'QUERY_FAILED'
      );
    }
  }

  /**
   * Reset sequence for a year (admin operation)
   * @param year - Year to reset
   * @param value - New sequence value (default 0)
   */
  async resetSequence(year: number, value = 0): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if sequence exists
      const existsResult = await client.query(
        'SELECT 1 FROM quote_sequence WHERE year = $1',
        [year]
      );
      
      if (existsResult.rows.length > 0) {
        // Update existing sequence
        await client.query(
          'UPDATE quote_sequence SET sequence_number = $1 WHERE year = $2',
          [value, year]
        );
      } else {
        // Create new sequence
        await client.query(
          'INSERT INTO quote_sequence (year, sequence_number) VALUES ($1, $2)',
          [year, value]
        );
      }
      
      await client.query('COMMIT');
      
      logger.info('Reset quote sequence', {
        year,
        newValue: value
      });
    } catch (error) {
      await client.query('ROLLBACK');
      
      throw new QuoteNumberError(
        `Failed to reset sequence: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RESET_FAILED'
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get statistics about quote sequences
   * @returns Array of sequence statistics
   */
  async getSequenceStats(): Promise<Array<{ year: number; currentValue: number; lastUpdated: Date }>> {
    try {
      const result = await this.pool.query(`
        SELECT year, sequence_number, updated_at 
        FROM quote_sequence 
        ORDER BY year DESC
      `);
      
      return result.rows.map(row => ({
        year: row.year,
        currentValue: row.sequence_number,
        lastUpdated: new Date(row.updated_at || row.created_at)
      }));
    } catch (error) {
      throw new QuoteNumberError(
        `Failed to get sequence statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STATS_FAILED'
      );
    }
  }
}

/**
 * Create quote sequence service instance
 * @param pool - Database connection pool
 * @returns QuoteSequenceService instance
 */
export function createQuoteSequenceService(pool: Pool): QuoteSequenceService {
  return new QuoteSequenceService(pool);
}

/**
 * Utility functions for quote numbers
 */

/**
 * Generate quote number for testing purposes
 * @param year - Year (optional)
 * @param sequence - Sequence number (optional)
 * @returns Test quote number
 */
export function generateTestQuoteNumber(year?: number, sequence?: number): string {
  const targetYear = year || new Date().getFullYear();
  const yearSuffix = targetYear.toString().slice(-2);
  const sequenceNumber = (sequence || 1).toString().padStart(6, '0');
  
  return `Q${yearSuffix}-${sequenceNumber}`;
}

/**
 * Check if quote number belongs to current year
 * @param quoteNumber - Quote number to check
 * @returns True if from current year
 */
export function isCurrentYearQuote(quoteNumber: string): boolean {
  const parsed = QuoteSequenceService.parseQuoteNumber(quoteNumber);
  if (!parsed) {
    return false;
  }
  
  const currentYear = new Date().getFullYear();
  return parsed.year === currentYear;
}

/**
 * Get expected next quote number for current year
 * @param pool - Database pool
 * @returns Expected next quote number
 */
export async function getExpectedNextQuoteNumber(pool: Pool): Promise<string> {
  const service = createQuoteSequenceService(pool);
  const currentYear = new Date().getFullYear();
  const status = await service.getCurrentSequenceValue(currentYear);
  
  const nextSequence = status ? status.value + 1 : 1;
  const yearSuffix = currentYear.toString().slice(-2);
  const sequenceNumber = nextSequence.toString().padStart(6, '0');
  
  return `Q${yearSuffix}-${sequenceNumber}`;
}