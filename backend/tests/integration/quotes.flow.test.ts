import request from 'supertest';
import app from '../../src/index';
import { setupTestDb, teardownTestDb, getTestPool } from '../setup';

describe('Quote Flow Integration', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('should complete full quote flow: calculate → save → retrieve', async () => {
    // Step 1: Calculate pricing
    const productConfig = {
      size: {
        widthM: 4.0,
        depthM: 3.0
      },
      cladding: {
        areaSqm: 20.0
      },
      bathroom: {
        half: 0,
        three_quarter: 1
      },
      electrical: {
        switches: 3,
        sockets: 6,
        heater: 2
      },
      internal_doors: 2,
      internal_wall: {
        finish: 'skim_paint',
        areaSqM: 25.0
      },
      glazing: {
        windows: [
          { widthM: 1.5, heightM: 1.8 },
          { widthM: 1.2, heightM: 1.5 }
        ],
        externalDoors: [
          { widthM: 0.9, heightM: 2.1 }
        ],
        skylights: [
          { widthM: 1.0, heightM: 1.0 }
        ]
      },
      floor: {
        type: 'tile',
        areaSqM: 12.0
      },
      delivery: {
        distanceKm: 35,
        cost: 0
      },
      extras: {
        esp_insulation: 12.0,
        render: 20.0,
        steel_door: 1,
        concrete_foundation: 12.0,
        other: [
          { title: 'Additional electrical work', cost: 500 }
        ]
      },
      discount: 1000,
      notes: 'Integration test quote'
    };

    const calculateResponse = await request(app)
      .post('/api/v1/calculate')
      .send(productConfig)
      .expect(200);

    expect(calculateResponse.body).toHaveProperty('currency');
    expect(calculateResponse.body).toHaveProperty('subtotalExVat');
    expect(calculateResponse.body).toHaveProperty('vatRate');
    expect(calculateResponse.body).toHaveProperty('totalIncVat');
    expect(calculateResponse.body).toHaveProperty('lineItems');
    
    const calculationResult = calculateResponse.body;

    // Step 2: Save quote using calculation result
    const saveQuoteRequest = {
      productConfig,
      customer: {
        name: 'Alice Johnson',
        email: 'alice.johnson@example.com',
        phone: '+44 7987 654321',
        address: '456 Integration Ave, Manchester, UK'
      }
    };

    const saveResponse = await request(app)
      .post('/api/v1/quotes')
      .send(saveQuoteRequest)
      .expect(201);

    expect(saveResponse.body).toHaveProperty('quoteNumber');
    expect(saveResponse.body).toHaveProperty('quoteDate');
    expect(saveResponse.body).toHaveProperty('customer');
    expect(saveResponse.body).toHaveProperty('estimate');
    
    const savedQuote = saveResponse.body;
    
    // Verify the calculation matches
    expect(savedQuote.estimate.currency).toBe(calculationResult.currency);
    expect(savedQuote.estimate.subtotalExVat).toBe(calculationResult.subtotalExVat);
    expect(savedQuote.estimate.vatRate).toBe(calculationResult.vatRate);
    expect(savedQuote.estimate.totalIncVat).toBe(calculationResult.totalIncVat);
    
    // Step 3: Retrieve quote by number
    const retrieveResponse = await request(app)
      .get(`/api/v1/quotes/${savedQuote.quoteNumber}`)
      .expect(200);

    expect(retrieveResponse.body).toHaveProperty('quoteNumber');
    expect(retrieveResponse.body.quoteNumber).toBe(savedQuote.quoteNumber);
    expect(retrieveResponse.body.customer.name).toBe('Alice Johnson');
    expect(retrieveResponse.body.customer.email).toBe('alice.johnson@example.com');
    expect(retrieveResponse.body.estimate.totalIncVat).toBe(calculationResult.totalIncVat);
    expect(retrieveResponse.body.status).toBe('active');

    // Verify the quote persisted correctly
    expect(retrieveResponse.body.quoteDate).toBe(savedQuote.quoteDate);
    expect(retrieveResponse.body.estimate).toEqual(savedQuote.estimate);
  });

  it('should handle quote creation with minimal configuration', async () => {
    // Step 1: Calculate with minimal config
    const minimalConfig = {
      size: {
        widthM: 3.0,
        depthM: 2.5
      }
    };

    const calculateResponse = await request(app)
      .post('/api/v1/calculate')
      .send(minimalConfig)
      .expect(200);

    // Step 2: Save quote with minimal data
    const saveQuoteRequest = {
      productConfig: minimalConfig,
      customer: {
        name: 'Bob Wilson'
      }
    };

    const saveResponse = await request(app)
      .post('/api/v1/quotes')
      .send(saveQuoteRequest)
      .expect(201);

    // Step 3: Retrieve and verify
    const quoteNumber = saveResponse.body.quoteNumber;
    const retrieveResponse = await request(app)
      .get(`/api/v1/quotes/${quoteNumber}`)
      .expect(200);

    expect(retrieveResponse.body.customer.name).toBe('Bob Wilson');
    expect(retrieveResponse.body.estimate.totalIncVat).toBe(calculateResponse.body.totalIncVat);
  });

  it('should return 404 for non-existent quote number', async () => {
    await request(app)
      .get('/api/v1/quotes/Q99-999999')
      .expect(404);
  });

  it('should maintain calculation consistency across multiple calls', async () => {
    const config = {
      size: {
        widthM: 4.0,
        depthM: 3.0
      },
      discount: 500
    };

    // Make multiple calculation calls with the same config
    const responses = await Promise.all([
      request(app).post('/api/v1/calculate').send(config),
      request(app).post('/api/v1/calculate').send(config),
      request(app).post('/api/v1/calculate').send(config)
    ]);

    // All should return 200
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // All should have the same calculation results
    const [first, ...rest] = responses;
    rest.forEach(response => {
      expect(response.body.subtotalExVat).toBe(first.body.subtotalExVat);
      expect(response.body.totalIncVat).toBe(first.body.totalIncVat);
      expect(response.body.vatRate).toBe(first.body.vatRate);
    });
  });

  it('should handle concurrent quote creation with unique numbers', async () => {
    const configs = Array.from({ length: 5 }, (_, i) => ({
      productConfig: {
        size: {
          widthM: 3.0 + i,
          depthM: 2.0 + i
        }
      },
      customer: {
        name: `Concurrent Customer ${i + 1}`,
        email: `customer${i + 1}@example.com`
      }
    }));

    // Create multiple quotes concurrently
    const responses = await Promise.all(
      configs.map(config => 
        request(app).post('/api/v1/quotes').send(config)
      )
    );

    // All should succeed
    responses.forEach(response => {
      expect(response.status).toBe(201);
    });

    // All should have unique quote numbers
    const quoteNumbers = responses.map(res => res.body.quoteNumber);
    const uniqueNumbers = [...new Set(quoteNumbers)];
    expect(uniqueNumbers.length).toBe(quoteNumbers.length);

    // Verify all can be retrieved
    const retrieveResponses = await Promise.all(
      quoteNumbers.map(qnum => 
        request(app).get(`/api/v1/quotes/${qnum}`)
      )
    );

    retrieveResponses.forEach((response, index) => {
      expect(response.status).toBe(200);
      expect(response.body.customer.name).toBe(configs[index].customer.name);
    });
  });
});