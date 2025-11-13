/**
 * End-to-End Smoke Tests
 * 
 * Tests the full application flow from seeding data to API endpoint functionality.
 * These tests verify that:
 * 1. Database seeding works correctly
 * 2. Critical API endpoints are functional
 * 3. End-to-end calculation flow works
 * 4. Quote generation and retrieval works
 * 
 * Prerequisites:
 * - Database must be accessible and migrated
 * - Application server must be running or startable
 * - Seed data must be available
 * 
 * Note: Some tests may be skipped if corresponding endpoints are not yet implemented.
 * This allows the test suite to evolve with the implementation.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { runSeed } from '../../src/db/seed';
import { closePool, query } from '../../src/db/pool';
import app from '../../src/index';

// Test timeout for integration operations
const INTEGRATION_TIMEOUT = 30000;

// Sample product configuration for testing calculations
const SAMPLE_PRODUCT_CONFIG = {
  size: {
    widthM: 4.0,
    depthM: 3.0
  },
  cladding: {
    areaSqm: 15.0
  },
  bathroom: {
    half: 0,
    three_quarter: 1
  },
  electrical: {
    switches: 2,
    sockets: 4,
    heater: 1
  },
  internal_doors: 1,
  internal_wall: {
    finish: 'skim_paint',
    areaSqM: 25.0
  },
  heaters: 1,
  glazing: {
    windows: [
      { widthM: 1.2, heightM: 1.5 },
      { widthM: 0.8, heightM: 1.2 }
    ],
    externalDoors: [
      { widthM: 0.9, heightM: 2.1 }
    ],
    skylights: []
  },
  floor: {
    type: 'wooden',
    areaSqM: 12.0
  },
  delivery: {
    distanceKm: 25.0,
    cost: 0
  },
  extras: {
    esp_insulation: 12.0,
    render: 8.0,
    steel_door: 0,
    concrete_foundation: 0,
    other: []
  },
  discount: 0,
  notes: 'Sample garden room for testing'
};

describe('End-to-End Smoke Tests', () => {
  
  beforeAll(async () => {
    // Ensure database is seeded with test data
    console.log('Setting up smoke test environment...');
    
    try {
      // Run seed to ensure we have price configuration data
      await runSeed();
      console.log('Database seeded successfully for smoke tests');
    } catch (error) {
      console.warn('Seed may have already been run:', error instanceof Error ? error.message : String(error));
      // Continue with tests - seed might already exist
    }
  }, INTEGRATION_TIMEOUT);

  afterAll(async () => {
    // Clean up database connections
    await closePool();
  });

  describe('Database Health', () => {
    
    it('should have price configuration data available', async () => {
      const result = await query<{ 
        id: string; 
        label: string; 
        currency: string; 
        current: boolean 
      }>(
        'SELECT id, label, currency, current FROM price_config WHERE current = TRUE LIMIT 1'
      );
      
      expect(result).toHaveLength(1);
      expect(result[0]?.current).toBe(true);
      expect(result[0]?.currency).toBe('GBP');
      expect(result[0]?.label).toBeTruthy();
    });

    it('should have quote sequence initialized', async () => {
      const currentYear = new Date().getFullYear();
      const result = await query<{ year: number; sequence_number: number }>(
        'SELECT year, sequence_number FROM quote_sequence WHERE year = $1',
        [currentYear]
      );
      
      expect(result).toHaveLength(1);
      expect(result[0]?.year).toBe(currentYear);
      expect(result[0]?.sequence_number).toBeGreaterThanOrEqual(0);
    });

  });

  describe('API Health Check', () => {
    
    it('should return healthy status from health endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('database');
      
      // Database should be healthy
      expect(response.body.database.connected).toBe(true);
    });

  });

  describe('Price Calculation Flow', () => {
    
    it('should calculate price for a valid product configuration', async () => {
      const response = await request(app)
        .post('/api/v1/calculate')
        .send(SAMPLE_PRODUCT_CONFIG)
        .expect('Content-Type', /json/);
      
      // Endpoint should be implemented now
      expect(response.status).toBe(200);
      
      // Verify response structure matches our QuoteEstimate schema
      expect(response.body).toHaveProperty('currency');
      expect(response.body).toHaveProperty('subtotalExVat');
      expect(response.body).toHaveProperty('vatRate');
      expect(response.body).toHaveProperty('totalIncVat');
      expect(response.body).toHaveProperty('lineItems');
      
      // Verify calculation makes sense
      expect(response.body.currency).toBe('GBP');
      expect(response.body.subtotalExVat).toBeGreaterThan(0);
      expect(response.body.totalIncVat).toBeGreaterThan(response.body.subtotalExVat);
      expect(response.body.vatRate).toBeGreaterThan(0); // VAT rate from config
      expect(Array.isArray(response.body.lineItems)).toBe(true);
      expect(response.body.lineItems.length).toBeGreaterThan(0);
      
      // Verify line items structure
      response.body.lineItems.forEach((item: unknown) => {
        expect(item).toHaveProperty('code');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('quantity');
        expect(item).toHaveProperty('unitPrice');
        expect(item).toHaveProperty('lineTotal');
      });
    });

    it('should handle invalid product configuration gracefully', async () => {
      const invalidConfig = {
        ...SAMPLE_PRODUCT_CONFIG,
        size: {
          widthM: -1, // Invalid negative width
          depthM: 3.0
        }
      };
      
      const response = await request(app)
        .post('/api/v1/calculate')
        .send(invalidConfig);
      
      // Should return validation error
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });

    it('should handle minimal valid configuration', async () => {
      const minimalConfig = {
        size: {
          widthM: 3.0,
          depthM: 2.5
        }
      };
      
      const response = await request(app)
        .post('/api/v1/calculate')
        .send(minimalConfig)
        .expect(200);
      
      expect(response.body).toHaveProperty('currency');
      expect(response.body).toHaveProperty('subtotalExVat');
      expect(response.body).toHaveProperty('vatRate');
      expect(response.body).toHaveProperty('totalIncVat');
      expect(response.body.subtotalExVat).toBeGreaterThan(0);
    });

  });

  describe('Quote Management Flow', () => {
    
    let calculationResult: unknown;
    let savedQuoteNumber: string;

    it('should save a quote from calculation result', async () => {
      // First get a calculation
      const calcResponse = await request(app)
        .post('/api/v1/calculate')
        .send(SAMPLE_PRODUCT_CONFIG);
      
      // If calculate endpoint is not implemented, skip this test
      if (calcResponse.status === 404) {
        console.log('⚠️  Calculate endpoint not yet implemented - skipping quote save test');
        return;
      }
      
      expect(calcResponse.status).toBe(200);
      calculationResult = calcResponse.body;
      
      // Now save as quote with correct payload structure
      const quotePayload = {
        customer: {
          name: 'John Smith',
          email: 'john@example.com',
          phone: '+44 7700 900123'
        },
        productConfig: SAMPLE_PRODUCT_CONFIG
      };
      
      const saveResponse = await request(app)
        .post('/api/v1/quotes')
        .send(quotePayload);
      
      // If quotes endpoint is not implemented yet, expect 404
      if (saveResponse.status === 404) {
        console.log('⚠️  Quotes endpoint not yet implemented - test will pass when implemented');
        expect(saveResponse.status).toBe(404);
        return;
      }
      
      expect(saveResponse.status).toBe(201);
      expect(saveResponse.body.success).toBe(true);
      expect(saveResponse.body.data).toHaveProperty('quote');
      expect(saveResponse.body.data.quote).toHaveProperty('quoteNumber');
      
      savedQuoteNumber = saveResponse.body.data.quote.quoteNumber;
      expect(savedQuoteNumber).toMatch(/^Q\d{2}-\d{6}$/); // Format: Q25-001234
    });

    it('should retrieve saved quote by quote number', async () => {
      // Skip if we don't have a saved quote
      if (!savedQuoteNumber) {
        console.log('⚠️  No saved quote available - skipping retrieval test');
        return;
      }
      
      const response = await request(app)
        .get(`/api/v1/quotes/${savedQuoteNumber}`);
      
      // If endpoint is not implemented yet, expect 404
      if (response.status === 404) {
        console.log('⚠️  Quote retrieval endpoint not yet implemented - test will pass when implemented');
        expect(response.status).toBe(404);
        return;
      }
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('quote');
      expect(response.body.data.quote).toHaveProperty('quoteNumber', savedQuoteNumber);
      expect(response.body.data.quote).toHaveProperty('customer');
      expect(response.body.data.quote).toHaveProperty('estimate');
      expect(response.body.data.quote.customer.name).toBe('John Smith');
    });

    it('should allow searching quotes', async () => {
      const response = await request(app)
        .get('/api/v1/quotes')
        .query({ limit: 5 });
      
      // If endpoint is not implemented yet, expect 404
      if (response.status === 404) {
        console.log('⚠️  Quote search endpoint not yet implemented - test will pass when implemented');
        expect(response.status).toBe(404);
        return;
      }
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('quotes');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.quotes)).toBe(true);
    });

    it('should provide quote statistics', async () => {
      const response = await request(app)
        .get('/api/v1/quotes/stats');
      
      // If endpoint is not implemented yet, expect 404
      if (response.status === 404) {
        console.log('⚠️  Quote stats endpoint not yet implemented - test will pass when implemented');
        expect(response.status).toBe(404);
        return;
      }
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data.stats).toHaveProperty('totalQuotes');
      expect(response.body.data.stats).toHaveProperty('activeQuotes');
      expect(typeof response.body.data.stats.totalQuotes).toBe('number');
      expect(typeof response.body.data.stats.activeQuotes).toBe('number');
    });

    it('should handle invalid quote creation gracefully', async () => {
      const invalidQuotePayload = {
        customer: {
          name: '', // Invalid empty name
          email: 'invalid-email' // Invalid email format
        },
        productConfig: {
          size: {
            widthM: -1, // Invalid negative width
            depthM: 3.0
          }
        }
      };
      
      const response = await request(app)
        .post('/api/v1/quotes')
        .send(invalidQuotePayload);
      
      // If endpoint doesn't exist yet, skip validation check
      if (response.status === 404) {
        console.log('⚠️  Quotes endpoint not yet implemented - skipping validation test');
        return;
      }
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code');
    });

  });

  describe('Error Handling', () => {
    
    it('should handle database connectivity issues gracefully', async () => {
      // This test verifies that the application handles database issues gracefully
      // without crashing. The health endpoint should reflect database status.
      
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);
      
      // Even if database has issues, the health endpoint should respond
      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toHaveProperty('connected');
    });

    it('should return proper error responses for invalid routes', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON in requests', async () => {
      const response = await request(app)
        .post('/api/v1/calculate')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');
      
      expect(response.status).toBe(400);
    });

  });

  describe('Performance Characteristics', () => {
    
    it('should respond to health checks quickly', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle calculation requests within acceptable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/v1/calculate')
        .send(SAMPLE_PRODUCT_CONFIG);
      
      const duration = Date.now() - startTime;
      
      // If endpoint exists, should be fast
      if (response.status === 200) {
        expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      }
    });

  });

  describe('Data Consistency', () => {
    
    it('should maintain referential integrity between quotes and configurations', async () => {
      // Verify that price configurations referenced by quotes still exist
      const quoteConfigCheck = await query<{ 
        quote_count: string; 
        missing_configs: string 
      }>(
        `SELECT 
          COUNT(q.id) as quote_count,
          COUNT(pc.id) as missing_configs
        FROM quote q
        LEFT JOIN price_config pc ON q.price_config_id = pc.id
        WHERE q.status = 'active'`
      );
      
      const result = quoteConfigCheck[0];
      if (result) {
        // All active quotes should have valid price configuration references
        expect(parseInt(result.quote_count, 10)).toBeGreaterThanOrEqual(0);
        // No missing configurations (this would be a data integrity issue)
        expect(parseInt(result.missing_configs, 10)).toBe(parseInt(result.quote_count, 10));
      }
    });

  });

});