/**
 * Database Health Integration Tests
 * 
 * Tests database connectivity and pool behavior with real PostgreSQL connection.
 * These tests verify:
 * - Basic connectivity to the database
 * - Query execution capability
 * - Connection pool statistics and behavior
 * - SSL/TLS configuration validation
 * - Error handling and recovery
 * 
 * Prerequisites:
 * - DATABASE_URL must be set in environment
 * - PostgreSQL instance must be accessible
 * - Database must exist and accept connections
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { 
  getPool, 
  testConnection, 
  query, 
  closePool,
  getPoolStats,
} from '../../src/db/pool.js';
import { getConfig } from '../../src/config/index.js';

describe('Database Health Integration Tests', () => {
  
  beforeAll(async () => {
    // Ensure configuration is loaded
    const config = getConfig();
    expect(config.DATABASE_URL).toBeDefined();
  });

  afterAll(async () => {
    // Clean up pool connections after all tests
    await closePool();
  });

  describe('Database Connectivity', () => {
    
    it('should successfully connect to the database', async () => {
      const result = await testConnection();
      
      expect(result.connected).toBe(true);
      expect(result.latency).toBeDefined();
      expect(result.latency).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    }, 10000); // 10 second timeout for network operations

    it('should execute a simple query', async () => {
      const result = await query<{ test: number }>('SELECT 1 as test');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].test).toBe(1);
    });

    it('should retrieve database version', async () => {
      const result = await query<{ version: string }>('SELECT version()');
      
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].version).toContain('PostgreSQL');
    });

    it('should execute query with parameters', async () => {
      const testValue = 'test-parameter';
      const result = await query<{ value: string }>(
        'SELECT $1::text as value',
        [testValue]
      );
      
      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].value).toBe(testValue);
    });

  });

  describe('Connection Pool Behavior', () => {

    it('should create and maintain connection pool', () => {
      const pool = getPool();
      
      expect(pool).toBeDefined();
      expect(pool.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should provide pool statistics', () => {
      const stats = getPoolStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalCount).toBeGreaterThanOrEqual(0);
      expect(stats.idleCount).toBeGreaterThanOrEqual(0);
      expect(stats.waitingCount).toBeGreaterThanOrEqual(0);
      
      // Total count should be the sum of active and idle
      expect(stats.totalCount).toBeGreaterThanOrEqual(stats.idleCount);
    });

    it('should reuse connections from the pool', async () => {
      // Execute multiple queries
      await query('SELECT 1');
      await query('SELECT 2');
      await query('SELECT 3');
      
      const stats = getPoolStats();
      
      // Pool should not create excessive connections
      expect(stats.totalCount).toBeLessThanOrEqual(20); // Max pool size from config
    });

    it('should handle concurrent queries', async () => {
      const queries = Array.from({ length: 5 }, (_, i) => 
        query<{ num: number }>(`SELECT ${i + 1} as num`)
      );
      
      const results = await Promise.all(queries);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result[0].num).toBe(index + 1);
      });
    });

  });

  describe('Database Schema Validation', () => {

    it('should verify pricing_calculator database exists', async () => {
      const result = await query<{ current_database: string }>(
        'SELECT current_database()'
      );
      
      expect(result).toBeDefined();
      expect(result[0].current_database).toBe('pricing_calculator');
    });

    it('should check for required tables existence', async () => {
      const result = await query<{ table_name: string }>(
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_type = 'BASE TABLE'
         ORDER BY table_name`
      );
      
      const tableNames = result.map(row => row.table_name);
      
      // Verify core tables from migration 001
      expect(tableNames).toContain('price_config');
      expect(tableNames).toContain('product_config');
      expect(tableNames).toContain('quote');
      expect(tableNames).toContain('quote_sequence');
    });

    it('should verify migrations table exists', async () => {
      const result = await query<{ table_name: string }>(
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_name = 'migrations'`
      );
      
      expect(result.length).toBeGreaterThan(0);
    });

  });

  describe('Error Handling', () => {

    it('should handle invalid query syntax', async () => {
      await expect(
        query('SELECT * FROM nonexistent_table_xyz')
      ).rejects.toThrow();
    });

    it('should handle query with invalid parameters', async () => {
      await expect(
        query('SELECT $1::integer as value', ['not-a-number'])
      ).rejects.toThrow();
    });

    it('should provide meaningful error information', async () => {
      try {
        await query('INVALID SQL SYNTAX HERE');
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
        if (error instanceof Error) {
          expect(error.message).toBeTruthy();
        }
      }
    });

  });

  describe('SSL/TLS Configuration', () => {

    it('should report SSL status in connection', async () => {
      const result = await query<{ ssl: boolean }>(
        'SELECT ssl_is_used() as ssl'
      );
      
      expect(result).toBeDefined();
      expect(typeof result[0].ssl).toBe('boolean');
      
      // In production or with sslmode=require, SSL should be true
      const config = getConfig();
      const sslRequired = config.DATABASE_URL.includes('sslmode=require');
      
      if (sslRequired) {
        expect(result[0].ssl).toBe(true);
      }
    });

  });

  describe('Connection Lifecycle', () => {

    it('should successfully close and recreate pool', async () => {
      // Get initial pool
      const pool1 = getPool();
      expect(pool1).toBeDefined();
      
      // Close the pool
      await closePool();
      
      // Get a new pool (should recreate)
      const pool2 = getPool();
      expect(pool2).toBeDefined();
      
      // Verify new pool works
      const result = await query<{ test: number }>('SELECT 1 as test');
      expect(result[0].test).toBe(1);
    });

  });

  describe('Performance Characteristics', () => {

    it('should execute simple queries within acceptable latency', async () => {
      const startTime = Date.now();
      await query('SELECT 1');
      const duration = Date.now() - startTime;
      
      // Query should complete in less than 100ms for simple operations
      expect(duration).toBeLessThan(100);
    });

    it('should handle batch queries efficiently', async () => {
      const batchSize = 10;
      const startTime = Date.now();
      
      const queries = Array.from({ length: batchSize }, (_, i) => 
        query(`SELECT ${i} as num`)
      );
      
      await Promise.all(queries);
      const duration = Date.now() - startTime;
      
      // Batch should benefit from connection pooling
      // Average time per query should be reasonable
      const avgTimePerQuery = duration / batchSize;
      expect(avgTimePerQuery).toBeLessThan(100);
    });

  });

  describe('Database Capabilities', () => {

    it('should support transactions (BEGIN/COMMIT)', async () => {
      const pool = getPool();
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        await client.query('SELECT 1');
        await client.query('COMMIT');
        
        // If we got here, transaction support works
        expect(true).toBe(true);
      } finally {
        client.release();
      }
    });

    it('should support JSON operations', async () => {
      const jsonData = { test: 'value', number: 42 };
      const result = await query<{ data: Record<string, unknown> }>(
        'SELECT $1::jsonb as data',
        [JSON.stringify(jsonData)]
      );
      
      expect(result[0].data).toEqual(jsonData);
    });

    it('should support timestamp operations', async () => {
      const result = await query<{ now: Date }>(
        'SELECT NOW() as now'
      );
      
      expect(result[0].now).toBeDefined();
      expect(result[0].now instanceof Date || typeof result[0].now === 'string').toBe(true);
    });

  });

  describe('Connection Security', () => {

    it('should use application name for monitoring', async () => {
      const result = await query<{ application_name: string }>(
        'SELECT application_name FROM pg_stat_activity WHERE pid = pg_backend_pid()'
      );
      
      expect(result[0].application_name).toBe('pricing-calculator-backend');
    });

    it('should be connected to correct database', async () => {
      const result = await query<{ current_user: string; current_database: string }>(
        'SELECT current_user, current_database()'
      );
      
      expect(result[0].current_database).toBe('pricing_calculator');
      expect(result[0].current_user).toBeTruthy();
    });

  });

});
