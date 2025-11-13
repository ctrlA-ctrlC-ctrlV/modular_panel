import { Pool, QueryResult } from 'pg';
import { z } from 'zod';

/**
 * Pricing repository for fetching current pricing configuration
 * Handles database queries for price_config table
 */

// Database schema for price_config table
export const PriceConfigDbSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  currency: z.string(),
  current: z.boolean(),
  valid_from: z.string(), // ISO date string from DB
  valid_to: z.string().nullable(),
  base: z.object({
    baseRatePerM2: z.number(),
    fixedCharge: z.number(),
    defaultHeightM: z.number()
  }),
  cladding: z.object({
    ratePerM2: z.number()
  }),
  bathroom: z.object({
    half: z.number(),
    threeQuarter: z.number()
  }),
  glazing: z.object({
    window: z.object({
      charge: z.number(),
      ratePerM2: z.number()
    }),
    externalDoor: z.object({
      charge: z.number(),
      ratePerM2: z.number()
    }),
    skylight: z.object({
      charge: z.number(),
      ratePerM2: z.number()
    })
  }),
  electrical: z.object({
    switch: z.number(),
    doubleSocket: z.number(),
    heater: z.number()
  }),
  internal: z.object({
    internalDoorCharge: z.number(),
    internalWall: z.object({
      none: z.number(),
      panel: z.number(),
      skim_paint: z.number()
    })
  }),
  flooring: z.object({
    none: z.number(),
    wooden: z.number(),
    tile: z.number()
  }),
  delivery: z.object({
    freeKm: z.number(),
    ratePerKm: z.number()
  }),
  extras: z.object({
    ESPInstallRatePerM2: z.number(),
    renderRatePerM2: z.number(),
    steelDoorCharge: z.number()
  }),
  taxes: z.object({
    vatPct: z.number()
  }),
  created_at: z.string(),
  updated_at: z.string()
});

// Application domain model for pricing config
export const PriceConfigSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  currency: z.string(),
  current: z.boolean(),
  validFrom: z.date(),
  validTo: z.date().nullable(),
  base: z.object({
    baseRatePerM2: z.number(),
    fixedCharge: z.number(),
    defaultHeightM: z.number()
  }),
  cladding: z.object({
    ratePerM2: z.number()
  }),
  bathroom: z.object({
    half: z.number(),
    threeQuarter: z.number()
  }),
  glazing: z.object({
    window: z.object({
      charge: z.number(),
      ratePerM2: z.number()
    }),
    externalDoor: z.object({
      charge: z.number(),
      ratePerM2: z.number()
    }),
    skylight: z.object({
      charge: z.number(),
      ratePerM2: z.number()
    })
  }),
  electrical: z.object({
    switch: z.number(),
    doubleSocket: z.number(),
    heater: z.number()
  }),
  internal: z.object({
    internalDoorCharge: z.number(),
    internalWall: z.object({
      none: z.number(),
      panel: z.number(),
      skim_paint: z.number()
    })
  }),
  flooring: z.object({
    none: z.number(),
    wooden: z.number(),
    tile: z.number()
  }),
  delivery: z.object({
    freeKm: z.number(),
    ratePerKm: z.number()
  }),
  extras: z.object({
    ESPInstallRatePerM2: z.number(),
    renderRatePerM2: z.number(),
    steelDoorCharge: z.number()
  }),
  taxes: z.object({
    vatPct: z.number()
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type PriceConfigDb = z.infer<typeof PriceConfigDbSchema>;
export type PriceConfig = z.infer<typeof PriceConfigSchema>;

// Custom errors
export class PricingConfigError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PricingConfigError';
  }
}

export class CurrentPricingConfigNotFoundError extends PricingConfigError {
  constructor() {
    super('No current pricing configuration found', 'CURRENT_CONFIG_NOT_FOUND');
  }
}

export class InvalidPricingConfigError extends PricingConfigError {
  constructor(message: string) {
    super(`Invalid pricing configuration: ${message}`, 'INVALID_CONFIG');
  }
}

/**
 * Pricing repository class for database operations
 */
export class PricingRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Get the current active pricing configuration
   * @returns Current pricing configuration
   * @throws {CurrentPricingConfigNotFoundError} If no current config is found
   * @throws {InvalidPricingConfigError} If the config data is invalid
   */
  async getCurrentPricingConfig(): Promise<PriceConfig> {
    const query = `
      SELECT 
        id,
        label,
        currency,
        current,
        valid_from,
        valid_to,
        base,
        cladding,
        bathroom,
        glazing,
        electrical,
        internal,
        flooring,
        delivery,
        extras,
        taxes,
        created_at,
        updated_at
      FROM price_config 
      WHERE current = true 
        AND valid_from <= CURRENT_DATE
        AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
      ORDER BY valid_from DESC
      LIMIT 1
    `;

    try {
      const result: QueryResult<PriceConfigDb> = await this.pool.query(query);
      
      if (result.rows.length === 0) {
        throw new CurrentPricingConfigNotFoundError();
      }

      const dbRow = result.rows[0]!;
      return this.mapDbToDomain(dbRow);
    } catch (error) {
      if (error instanceof PricingConfigError) {
        throw error;
      }
      throw new PricingConfigError(
        `Failed to fetch current pricing configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get pricing configuration by ID
   * @param id - Pricing configuration ID
   * @returns Pricing configuration or null if not found
   * @throws {InvalidPricingConfigError} If the config data is invalid
   */
  async getPricingConfigById(id: string): Promise<PriceConfig | null> {
    const query = `
      SELECT 
        id,
        label,
        currency,
        current,
        valid_from,
        valid_to,
        base,
        cladding,
        bathroom,
        glazing,
        electrical,
        internal,
        flooring,
        delivery,
        extras,
        taxes,
        created_at,
        updated_at
      FROM price_config 
      WHERE id = $1
    `;

    try {
      const result: QueryResult<PriceConfigDb> = await this.pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const dbRow = result.rows[0]!;
      return this.mapDbToDomain(dbRow);
    } catch (error) {
      if (error instanceof PricingConfigError) {
        throw error;
      }
      throw new PricingConfigError(
        `Failed to fetch pricing configuration by ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get all pricing configurations with optional filters
   * @param options - Filter options
   * @returns Array of pricing configurations
   */
  async getPricingConfigs(options?: {
    current?: boolean;
    validOn?: Date;
    limit?: number;
    offset?: number;
  }): Promise<PriceConfig[]> {
    let query = `
      SELECT 
        id,
        label,
        currency,
        current,
        valid_from,
        valid_to,
        base,
        cladding,
        bathroom,
        glazing,
        electrical,
        internal,
        flooring,
        delivery,
        extras,
        taxes,
        created_at,
        updated_at
      FROM price_config 
      WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.current !== undefined) {
      query += ` AND current = $${paramIndex}`;
      params.push(options.current);
      paramIndex++;
    }

    if (options?.validOn) {
      query += ` AND valid_from <= $${paramIndex} AND (valid_to IS NULL OR valid_to >= $${paramIndex})`;
      params.push(options.validOn.toISOString().split('T')[0]);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }

    if (options?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
      paramIndex++;
    }

    try {
      const result: QueryResult<PriceConfigDb> = await this.pool.query(query, params);
      return result.rows.map(row => this.mapDbToDomain(row));
    } catch (error) {
      throw new PricingConfigError(
        `Failed to fetch pricing configurations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Check if current pricing configuration exists
   * @returns True if current config exists, false otherwise
   */
  async hasCurrentPricingConfig(): Promise<boolean> {
    const query = `
      SELECT 1 
      FROM price_config 
      WHERE current = true 
        AND valid_from <= CURRENT_DATE
        AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query);
      return result.rows.length > 0;
    } catch (error) {
      throw new PricingConfigError(
        `Failed to check current pricing configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Map database row to domain model
   * @param dbRow - Database row
   * @returns Domain model
   */
  private mapDbToDomain(dbRow: PriceConfigDb): PriceConfig {
    try {
      // Validate the database row first
      const validatedDbRow = PriceConfigDbSchema.parse(dbRow);

      return PriceConfigSchema.parse({
        id: validatedDbRow.id,
        label: validatedDbRow.label,
        currency: validatedDbRow.currency,
        current: validatedDbRow.current,
        validFrom: new Date(validatedDbRow.valid_from),
        validTo: validatedDbRow.valid_to ? new Date(validatedDbRow.valid_to) : null,
        base: validatedDbRow.base,
        cladding: validatedDbRow.cladding,
        bathroom: validatedDbRow.bathroom,
        glazing: validatedDbRow.glazing,
        electrical: validatedDbRow.electrical,
        internal: validatedDbRow.internal,
        flooring: validatedDbRow.flooring,
        delivery: validatedDbRow.delivery,
        extras: validatedDbRow.extras,
        taxes: validatedDbRow.taxes,
        createdAt: new Date(validatedDbRow.created_at),
        updatedAt: new Date(validatedDbRow.updated_at)
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new InvalidPricingConfigError(`Schema validation failed: ${errorMessage}`);
      }
      throw new InvalidPricingConfigError(`Mapping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Factory function to create pricing repository instance
 * @param pool - Database connection pool
 * @returns PricingRepository instance
 */
export function createPricingRepository(pool: Pool): PricingRepository {
  return new PricingRepository(pool);
}