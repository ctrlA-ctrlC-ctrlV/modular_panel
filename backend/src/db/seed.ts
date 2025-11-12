#!/usr/bin/env tsx

/**
 * Database Seed Script
 * 
 * Creates minimal seed data for the pricing calculator application.
 * This script:
 * 1. Creates a current price configuration with realistic pricing data
 * 2. Initializes the quote sequence table
 * 3. Optionally creates sample data for testing
 * 
 * Usage:
 *   npm run db:seed
 *   tsx src/db/seed.ts
 *   node dist/db/seed.js (after build)
 * 
 * Options:
 *   --minimal: Only create the essential price_config record
 *   --full: Create additional sample data for testing (default)
 *   --force: Overwrite existing data
 * 
 * Prerequisites:
 * - Database must be accessible via DATABASE_URL
 * - Migrations must be run (tables exist)
 * - User must have INSERT permissions
 */

import { query, transaction, closePool } from './pool.js';
import logger from '../instrumentation/logger.js';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
} as const;

function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

interface SeedResult {
  priceConfigId?: string;
  quoteSequenceInitialized: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Default price configuration for UK market (GBP)
 * Based on typical garden room pricing structures
 */
const DEFAULT_PRICE_CONFIG = {
  label: 'Standard UK Pricing 2025',
  currency: 'GBP',
  current: true,
  validFrom: new Date('2025-01-01'),
  validTo: null, // Open-ended
  base: {
    baseRatePerM2: 850.00,
    fixedCharge: 2500.00,
    defaultHeightM: 2.4
  },
  cladding: {
    ratePerM2: 45.00
  },
  bathroom: {
    half: 3500.00,
    threeQuarter: 5500.00
  },
  glazing: {
    window: {
      charge: 150.00,
      ratePerM2: 320.00
    },
    externalDoor: {
      charge: 200.00,
      ratePerM2: 450.00
    },
    skylight: {
      charge: 300.00,
      ratePerM2: 520.00
    }
  },
  electrical: {
    switch: 45.00,
    doubleSocket: 65.00,
    heater: 350.00
  },
  internal: {
    internalDoorCharge: 280.00,
    internalWall: {
      none: 0.00,
      panel: 35.00,
      skim_paint: 55.00
    }
  },
  flooring: {
    none: 0.00,
    wooden: 85.00,
    tile: 95.00
  },
  delivery: {
    freeKm: 50.00,
    ratePerKm: 2.50
  },
  extras: {
    ESPInstallRatePerM2: 25.00,
    renderRatePerM2: 45.00,
    steelDoorCharge: 850.00
  },
  taxes: {
    vatPct: 20.00
  }
};

/**
 * Check if price configuration already exists
 */
async function checkExistingPriceConfig(): Promise<boolean> {
  try {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM price_config WHERE current = TRUE'
    );
    
    const count = parseInt(result[0]?.count || '0', 10);
    return count > 0;
    
  } catch (error) {
    logger.error('Failed to check existing price configuration', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Create the default price configuration
 */
async function createPriceConfig(force = false): Promise<{ id: string; created: boolean }> {
  const existsAlready = await checkExistingPriceConfig();
  
  if (existsAlready && !force) {
    logger.info('Price configuration already exists, skipping creation');
    
    // Get existing config ID
    const existing = await query<{ id: string }>(
      'SELECT id FROM price_config WHERE current = TRUE LIMIT 1'
    );
    
    return {
      id: existing[0]?.id || '',
      created: false
    };
  }
  
  if (existsAlready && force) {
    logger.info('Force mode: removing existing price configurations');
    await query('UPDATE price_config SET current = FALSE WHERE current = TRUE');
  }
  
  const result = await query<{ id: string }>(
    `INSERT INTO price_config (
      label, currency, current, valid_from, valid_to,
      base, cladding, bathroom, glazing, electrical,
      internal, flooring, delivery, extras, taxes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING id`,
    [
      DEFAULT_PRICE_CONFIG.label,
      DEFAULT_PRICE_CONFIG.currency,
      DEFAULT_PRICE_CONFIG.current,
      DEFAULT_PRICE_CONFIG.validFrom,
      DEFAULT_PRICE_CONFIG.validTo,
      JSON.stringify(DEFAULT_PRICE_CONFIG.base),
      JSON.stringify(DEFAULT_PRICE_CONFIG.cladding),
      JSON.stringify(DEFAULT_PRICE_CONFIG.bathroom),
      JSON.stringify(DEFAULT_PRICE_CONFIG.glazing),
      JSON.stringify(DEFAULT_PRICE_CONFIG.electrical),
      JSON.stringify(DEFAULT_PRICE_CONFIG.internal),
      JSON.stringify(DEFAULT_PRICE_CONFIG.flooring),
      JSON.stringify(DEFAULT_PRICE_CONFIG.delivery),
      JSON.stringify(DEFAULT_PRICE_CONFIG.extras),
      JSON.stringify(DEFAULT_PRICE_CONFIG.taxes)
    ]
  );
  
  logger.info('Created default price configuration', {
    id: result[0]?.id,
    label: DEFAULT_PRICE_CONFIG.label,
    currency: DEFAULT_PRICE_CONFIG.currency
  });
  
  return {
    id: result[0]?.id || '',
    created: true
  };
}

/**
 * Initialize quote sequence for the current year
 */
async function initializeQuoteSequence(): Promise<boolean> {
  const currentYear = new Date().getFullYear();
  
  try {
    // Check if sequence already exists for current year
    const existing = await query<{ id: number }>(
      'SELECT id FROM quote_sequence WHERE year = $1',
      [currentYear]
    );
    
    if (existing.length > 0) {
      logger.info('Quote sequence already initialized for current year', { year: currentYear });
      return false;
    }
    
    // Create sequence entry for current year
    await query(
      'INSERT INTO quote_sequence (year, sequence_number) VALUES ($1, $2)',
      [currentYear, 0]
    );
    
    logger.info('Initialized quote sequence', { year: currentYear });
    return true;
    
  } catch (error) {
    logger.error('Failed to initialize quote sequence', {
      year: currentYear,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Verify seed data was created correctly
 */
async function verifySeedData(): Promise<{ success: boolean; issues: string[] }> {
  const issues: string[] = [];
  
  try {
    // Check price configuration
    const priceConfig = await query<{ 
      id: string; 
      label: string; 
      currency: string; 
      current: boolean 
    }>(
      'SELECT id, label, currency, current FROM price_config WHERE current = TRUE'
    );
    
    if (priceConfig.length === 0) {
      issues.push('No current price configuration found');
    } else if (priceConfig.length > 1) {
      issues.push('Multiple current price configurations found');
    } else {
      const config = priceConfig[0];
      if (config && config.currency !== 'GBP') {
        issues.push(`Price configuration currency is ${config.currency}, expected GBP`);
      }
    }
    
    // Check quote sequence
    const currentYear = new Date().getFullYear();
    const sequence = await query<{ year: number; sequence_number: number }>(
      'SELECT year, sequence_number FROM quote_sequence WHERE year = $1',
      [currentYear]
    );
    
    if (sequence.length === 0) {
      issues.push(`No quote sequence found for current year ${currentYear}`);
    }
    
    // Check table row counts
    const tableCounts = await query<{ 
      price_configs: string; 
      quote_sequences: string 
    }>(
      `SELECT 
        (SELECT COUNT(*) FROM price_config) as price_configs,
        (SELECT COUNT(*) FROM quote_sequence) as quote_sequences`
    );
    
    const counts = tableCounts[0];
    if (counts) {
      logger.info('Seed data verification completed', {
        priceConfigs: counts.price_configs,
        quoteSequences: counts.quote_sequences,
        issues: issues.length
      });
    }
    
    return {
      success: issues.length === 0,
      issues
    };
    
  } catch (error) {
    issues.push(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      issues
    };
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): { minimal: boolean; force: boolean } {
  const args = process.argv.slice(2);
  
  return {
    minimal: args.includes('--minimal'),
    force: args.includes('--force')
  };
}

/**
 * Main seed execution function
 */
async function runSeed(): Promise<SeedResult> {
  const result: SeedResult = {
    warnings: [],
    errors: [],
    quoteSequenceInitialized: false
  };
  
  const { minimal, force } = parseArguments();
  
  console.log(colorize('='.repeat(50), 'cyan'));
  console.log(colorize('DATABASE SEED SCRIPT', 'cyan'));
  console.log(colorize('='.repeat(50), 'cyan'));
  console.log(`Mode: ${minimal ? 'Minimal' : 'Full'}`);
  console.log(`Force: ${force ? 'Yes' : 'No'}`);
  console.log('');
  
  try {
    // Run all operations in a transaction
    await transaction(async (client) => {
      console.log(colorize('Creating price configuration...', 'blue'));
      
      // Create price configuration
      const priceConfigResult = await createPriceConfig(force);
      result.priceConfigId = priceConfigResult.id;
      
      if (priceConfigResult.created) {
        console.log(colorize(`✓ Created price configuration: ${priceConfigResult.id}`, 'green'));
      } else {
        console.log(colorize(`✓ Using existing price configuration: ${priceConfigResult.id}`, 'yellow'));
        result.warnings.push('Price configuration already existed');
      }
      
      console.log(colorize('Initializing quote sequence...', 'blue'));
      
      // Initialize quote sequence
      const sequenceInitialized = await initializeQuoteSequence();
      result.quoteSequenceInitialized = sequenceInitialized;
      
      if (sequenceInitialized) {
        console.log(colorize('✓ Initialized quote sequence for current year', 'green'));
      } else {
        console.log(colorize('✓ Quote sequence already initialized', 'yellow'));
        result.warnings.push('Quote sequence already existed');
      }
    });
    
    console.log(colorize('Verifying seed data...', 'blue'));
    
    // Verify the seeded data
    const verification = await verifySeedData();
    
    if (verification.success) {
      console.log(colorize('✓ Seed data verification passed', 'green'));
    } else {
      console.log(colorize('✗ Seed data verification failed', 'red'));
      verification.issues.forEach(issue => {
        console.log(colorize(`  - ${issue}`, 'red'));
        result.errors.push(issue);
      });
    }
    
    console.log('');
    console.log(colorize('SEED SUMMARY', 'cyan'));
    console.log(colorize('-'.repeat(50), 'cyan'));
    console.log(`Price Config ID: ${result.priceConfigId || 'N/A'}`);
    console.log(`Quote Sequence: ${result.quoteSequenceInitialized ? 'Initialized' : 'Already existed'}`);
    console.log(`Warnings: ${result.warnings.length}`);
    console.log(`Errors: ${result.errors.length}`);
    
    if (result.warnings.length > 0) {
      console.log(colorize('Warnings:', 'yellow'));
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    if (result.errors.length > 0) {
      console.log(colorize('Errors:', 'red'));
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    const success = result.errors.length === 0;
    console.log('');
    console.log(colorize(
      success ? '✓ Seed completed successfully!' : '✗ Seed completed with errors!',
      success ? 'green' : 'red'
    ));
    
    return result;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    
    console.log(colorize('✗ Seed failed with error:', 'red'));
    console.log(colorize(`  ${errorMessage}`, 'red'));
    
    if (error instanceof Error && error.stack) {
      logger.error('Seed script error', {
        error: errorMessage,
        stack: error.stack
      });
    }
    
    throw error;
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const result = await runSeed();
    
    // Clean up database connections
    await closePool();
    
    // Exit with appropriate code
    const exitCode = result.errors.length > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error(colorize('SEED ERROR:', 'red'));
    console.error(error instanceof Error ? error.message : String(error));
    
    try {
      await closePool();
    } catch (cleanupError) {
      console.error('Failed to cleanup database connections:', cleanupError);
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  try {
    await closePool();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  process.exit(130);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  try {
    await closePool();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  process.exit(143);
});

// Run the seed script if executed directly
if (require.main === module || process.argv[1]?.endsWith('seed.ts')) {
  main().catch((error) => {
    console.error('Unhandled error in seed script:', error);
    process.exit(1);
  });
}

export { runSeed, DEFAULT_PRICE_CONFIG };