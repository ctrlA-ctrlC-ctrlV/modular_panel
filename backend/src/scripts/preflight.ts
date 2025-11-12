#!/usr/bin/env tsx

/**
 * Preflight Check Script
 * 
 * Verifies environment configuration and database connectivity before application startup.
 * This script should be run before deploying or starting the application to catch
 * configuration issues early.
 * 
 * Checks performed:
 * 1. Environment variable validation
 * 2. Database connectivity test
 * 3. Database schema verification
 * 4. SSL/TLS configuration validation
 * 5. External service connectivity (if applicable)
 * 
 * Usage:
 *   npm run preflight
 *   tsx src/scripts/preflight.ts
 *   node dist/scripts/preflight.js (after build)
 * 
 * Exit codes:
 *   0: All checks passed
 *   1: Configuration errors
 *   2: Database connectivity issues
 *   3: Database schema issues
 *   4: SSL/TLS configuration issues
 *   5: External service issues
 */

import { z } from 'zod';
import { testConnection, closePool, query } from '../db/pool.js';
import { getConfig } from '../config/index.js';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const;

// Check result interface
interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
}

// Overall preflight result
interface PreflightResult {
  passed: boolean;
  checks: CheckResult[];
  totalDuration: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Utility function to colorize console output
 */
function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Print a formatted header
 */
function printHeader(text: string): void {
  const border = '='.repeat(text.length + 4);
  console.log(colorize(border, 'cyan'));
  console.log(colorize(`  ${text}  `, 'cyan'));
  console.log(colorize(border, 'cyan'));
}

/**
 * Print check result with appropriate formatting
 */
function printCheckResult(result: CheckResult): void {
  const status = result.passed 
    ? colorize('PASS', 'green') 
    : colorize('FAIL', 'red');
  
  const duration = result.duration 
    ? colorize(`(${result.duration}ms)`, 'blue') 
    : '';
    
  console.log(`[${status}] ${result.name} ${duration}`);
  
  if (result.message) {
    const prefix = result.passed ? '  ✓ ' : '  ✗ ';
    console.log(`${prefix}${result.message}`);
  }
  
  if (result.details && Object.keys(result.details).length > 0) {
    for (const [key, value] of Object.entries(result.details)) {
      console.log(`    ${colorize(key, 'yellow')}: ${value}`);
    }
  }
  
  console.log(''); // Empty line for spacing
}

/**
 * Check environment variable configuration
 */
async function checkEnvironmentConfiguration(): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    const config = getConfig();
    
    // Validate critical environment variables
    const criticalVars = {
      NODE_ENV: config.NODE_ENV,
      DATABASE_URL: config.DATABASE_URL,
      PORT: config.PORT,
      HOST: config.HOST,
    };
    
    // Check for production-specific requirements
    const warnings: string[] = [];
    
    if (config.NODE_ENV === 'production') {
      if (config.ADMIN_API_KEY === 'dev-admin-key-change-in-production') {
        warnings.push('ADMIN_API_KEY still uses default value in production');
      }
      
      if (!config.JWT_SECRET) {
        warnings.push('JWT_SECRET is not set in production');
      }
      
      if (config.ALLOWED_ORIGINS === 'http://localhost:5173') {
        warnings.push('ALLOWED_ORIGINS uses localhost in production');
      }
    }
    
    const details: Record<string, unknown> = {
      environment: config.NODE_ENV,
      port: config.PORT,
      host: config.HOST,
      logLevel: config.LOG_LEVEL,
      corsOrigins: config.ALLOWED_ORIGINS,
      metricsEnabled: config.ENABLE_METRICS,
      tracingEnabled: config.ENABLE_TRACING,
    };
    
    if (warnings.length > 0) {
      details.warnings = warnings;
    }
    
    return {
      name: 'Environment Configuration',
      passed: warnings.length === 0,
      message: warnings.length === 0 
        ? 'All environment variables properly configured'
        : `Configuration loaded with ${warnings.length} warnings`,
      details,
      duration: Date.now() - startTime,
    };
    
  } catch (error) {
    return {
      name: 'Environment Configuration',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown configuration error',
      details: {
        error: error instanceof Error ? error.stack : String(error),
      },
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Test database connectivity
 */
async function checkDatabaseConnectivity(): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    const result = await testConnection();
    
    if (!result.connected) {
      return {
        name: 'Database Connectivity',
        passed: false,
        message: result.error || 'Failed to connect to database',
        details: {
          latency: result.latency,
          error: result.error,
        },
        duration: Date.now() - startTime,
      };
    }
    
    return {
      name: 'Database Connectivity',
      passed: true,
      message: 'Successfully connected to database',
      details: {
        latency: result.latency,
        connected: result.connected,
      },
      duration: Date.now() - startTime,
    };
    
  } catch (error) {
    return {
      name: 'Database Connectivity',
      passed: false,
      message: 'Database connection test failed',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Verify database schema and required tables
 */
async function checkDatabaseSchema(): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    // Check if we're connected to the correct database
    const dbResult = await query<{ current_database: string }>(
      'SELECT current_database()'
    );
    
    const currentDb = dbResult[0]?.current_database;
    if (currentDb !== 'pricing_calculator') {
      return {
        name: 'Database Schema',
        passed: false,
        message: `Connected to wrong database: ${currentDb}`,
        details: {
          expected: 'pricing_calculator',
          actual: currentDb,
        },
        duration: Date.now() - startTime,
      };
    }
    
    // Check for required tables
    const tableResult = await query<{ table_name: string }>(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    
    const existingTables = tableResult.map(row => row.table_name);
    const requiredTables = ['price_config', 'product_config', 'quote', 'quote_sequence'];
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    // Check for migrations table
    const migrationResult = await query<{ table_name: string }>(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_name = 'migrations'`
    );
    
    const hasMigrations = migrationResult.length > 0;
    
    const details: Record<string, unknown> = {
      database: currentDb,
      tablesFound: existingTables.length,
      requiredTables,
      existingTables,
      migrationsTable: hasMigrations,
    };
    
    if (missingTables.length > 0) {
      details.missingTables = missingTables;
      return {
        name: 'Database Schema',
        passed: false,
        message: `Missing required tables: ${missingTables.join(', ')}`,
        details,
        duration: Date.now() - startTime,
      };
    }
    
    if (!hasMigrations) {
      details.warning = 'Migrations table not found - migrations may not have been run';
    }
    
    return {
      name: 'Database Schema',
      passed: true,
      message: 'All required tables found',
      details,
      duration: Date.now() - startTime,
    };
    
  } catch (error) {
    return {
      name: 'Database Schema',
      passed: false,
      message: 'Failed to verify database schema',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Verify SSL/TLS configuration
 */
async function checkSSLConfiguration(): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    const config = getConfig();
    const sslRequired = config.DATABASE_URL.includes('sslmode=require');
    
    // Check SSL status from database perspective
    const sslResult = await query<{ ssl: boolean }>(
      'SELECT ssl_is_used() as ssl'
    );
    
    const sslActive = sslResult[0]?.ssl;
    
    const details: Record<string, unknown> = {
      sslRequired,
      sslActive,
      databaseUrl: config.DATABASE_URL.replace(/:\/\/[^@]*@/, '://***:***@'), // Mask credentials
    };
    
    if (sslRequired && !sslActive) {
      return {
        name: 'SSL/TLS Configuration',
        passed: false,
        message: 'SSL required but not active',
        details,
        duration: Date.now() - startTime,
      };
    }
    
    if (config.NODE_ENV === 'production' && !sslActive) {
      details.warning = 'SSL not active in production environment';
    }
    
    return {
      name: 'SSL/TLS Configuration',
      passed: true,
      message: sslActive ? 'SSL connection active' : 'SSL not required',
      details,
      duration: Date.now() - startTime,
    };
    
  } catch (error) {
    return {
      name: 'SSL/TLS Configuration',
      passed: false,
      message: 'Failed to check SSL configuration',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Check database performance characteristics
 */
async function checkDatabasePerformance(): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    // Run a series of performance tests
    const tests = [
      { name: 'Simple query', query: 'SELECT 1' },
      { name: 'Current timestamp', query: 'SELECT NOW()' },
      { name: 'Database version', query: 'SELECT version()' },
    ];
    
    const results: Array<{ name: string; duration: number }> = [];
    
    for (const test of tests) {
      const testStart = Date.now();
      await query(test.query);
      const duration = Date.now() - testStart;
      results.push({ name: test.name, duration });
    }
    
    const avgLatency = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const maxLatency = Math.max(...results.map(r => r.duration));
    
    // Performance thresholds
    const ACCEPTABLE_AVG_LATENCY = 50; // ms
    const ACCEPTABLE_MAX_LATENCY = 200; // ms
    
    const performanceOk = avgLatency <= ACCEPTABLE_AVG_LATENCY && maxLatency <= ACCEPTABLE_MAX_LATENCY;
    
    const details: Record<string, unknown> = {
      averageLatency: `${avgLatency.toFixed(2)}ms`,
      maxLatency: `${maxLatency}ms`,
      testResults: results.map(r => `${r.name}: ${r.duration}ms`),
      thresholds: {
        avgLatency: `${ACCEPTABLE_AVG_LATENCY}ms`,
        maxLatency: `${ACCEPTABLE_MAX_LATENCY}ms`,
      },
    };
    
    return {
      name: 'Database Performance',
      passed: performanceOk,
      message: performanceOk 
        ? 'Database performance within acceptable limits'
        : 'Database performance below acceptable thresholds',
      details,
      duration: Date.now() - startTime,
    };
    
  } catch (error) {
    return {
      name: 'Database Performance',
      passed: false,
      message: 'Failed to test database performance',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Run all preflight checks
 */
async function runPreflightChecks(): Promise<PreflightResult> {
  const startTime = Date.now();
  
  printHeader('PREFLIGHT CHECKS');
  console.log('Verifying system readiness...\n');
  
  const checks: CheckResult[] = [];
  
  // Define all checks to run
  const checkFunctions = [
    checkEnvironmentConfiguration,
    checkDatabaseConnectivity,
    checkDatabaseSchema,
    checkSSLConfiguration,
    checkDatabasePerformance,
  ];
  
  // Run each check and collect results
  for (const checkFn of checkFunctions) {
    try {
      const result = await checkFn();
      checks.push(result);
      printCheckResult(result);
    } catch (error) {
      const errorResult: CheckResult = {
        name: checkFn.name || 'Unknown Check',
        passed: false,
        message: 'Check execution failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
      checks.push(errorResult);
      printCheckResult(errorResult);
    }
  }
  
  const totalDuration = Date.now() - startTime;
  const passed = checks.filter(c => c.passed).length;
  const failed = checks.length - passed;
  const allPassed = failed === 0;
  
  const result: PreflightResult = {
    passed: allPassed,
    checks,
    totalDuration,
    summary: {
      total: checks.length,
      passed,
      failed,
    },
  };
  
  return result;
}

/**
 * Print final summary
 */
function printSummary(result: PreflightResult): void {
  console.log('='.repeat(60));
  console.log(colorize('PREFLIGHT SUMMARY', 'bright'));
  console.log('='.repeat(60));
  
  const status = result.passed 
    ? colorize('PASSED', 'green') 
    : colorize('FAILED', 'red');
    
  console.log(`Status: ${status}`);
  console.log(`Duration: ${colorize(`${result.totalDuration}ms`, 'blue')}`);
  console.log(`Checks: ${colorize(result.summary.total.toString(), 'cyan')} total, ${colorize(result.summary.passed.toString(), 'green')} passed, ${colorize(result.summary.failed.toString(), 'red')} failed`);
  
  if (!result.passed) {
    console.log('');
    console.log(colorize('Failed checks:', 'red'));
    result.checks
      .filter(c => !c.passed)
      .forEach(c => {
        console.log(`  - ${c.name}: ${c.message}`);
      });
  }
  
  console.log('');
  
  if (result.passed) {
    console.log(colorize('✓ System is ready for deployment/startup!', 'green'));
  } else {
    console.log(colorize('✗ Please resolve the issues above before proceeding.', 'red'));
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const result = await runPreflightChecks();
    printSummary(result);
    
    // Clean up database connections
    await closePool();
    
    // Exit with appropriate code
    process.exit(result.passed ? 0 : 1);
    
  } catch (error) {
    console.error(colorize('PREFLIGHT ERROR:', 'red'));
    console.error(error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    try {
      await closePool();
    } catch (cleanupError) {
      console.error('Failed to cleanup database connections:', cleanupError);
    }
    
    process.exit(5);
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

// Run the preflight checks if this script is executed directly
if (require.main === module || process.argv[1]?.endsWith('preflight.ts')) {
  main().catch((error) => {
    console.error('Unhandled error in preflight script:', error);
    process.exit(5);
  });
}