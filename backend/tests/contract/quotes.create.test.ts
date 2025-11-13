import request from 'supertest';
import app from '../../src/index';
import { setupTestDb, teardownTestDb } from '../setup';

describe('POST /api/v1/quotes', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('should create a quote with valid product configuration and customer', async () => {
    const createQuoteRequest = {
      productConfig: {
        size: {
          widthM: 4.0,
          depthM: 3.0
        },
        cladding: {
          areaSqm: 20.0
        },
        bathroom: {
          half: 0,
          three_quarter: 0
        },
        electrical: {
          switches: 2,
          sockets: 4,
          heater: 1
        },
        internal_doors: 1,
        internal_wall: {
          finish: 'panel',
          areaSqM: 15.0
        },
        glazing: {
          windows: [
            { widthM: 1.2, heightM: 1.5 }
          ],
          externalDoors: [
            { widthM: 0.8, heightM: 2.0 }
          ],
          skylights: []
        },
        floor: {
          type: 'wooden',
          areaSqM: 12.0
        },
        delivery: {
          distanceKm: 25,
          cost: 0
        },
        extras: {
          esp_insulation: 12.0,
          render: 0,
          steel_door: 0,
          concrete_foundation: 0,
          other: []
        },
        discount: 0,
        notes: 'Test quote creation'
      },
      customer: {
        name: 'John Smith',
        email: 'john.smith@example.com',
        phone: '+44 7123 456789',
        address: '123 Test Street, London, UK'
      }
    };

    const response = await request(app)
      .post('/api/v1/quotes')
      .send(createQuoteRequest)
      .expect(201);

    expect(response.body).toHaveProperty('quoteNumber');
    expect(response.body).toHaveProperty('quoteDate');
    expect(response.body).toHaveProperty('customer');
    expect(response.body).toHaveProperty('estimate');
    expect(response.body).toHaveProperty('currency');
    expect(response.body).toHaveProperty('status');

    // Validate quote number format (e.g., Q25-001234)
    expect(response.body.quoteNumber).toMatch(/^Q\d{2}-\d{6}$/);
    
    // Validate customer data
    expect(response.body.customer.name).toBe('John Smith');
    expect(response.body.customer.email).toBe('john.smith@example.com');
    
    // Validate estimate structure
    expect(response.body.estimate).toHaveProperty('currency');
    expect(response.body.estimate).toHaveProperty('subtotalExVat');
    expect(response.body.estimate).toHaveProperty('vatRate');
    expect(response.body.estimate).toHaveProperty('totalIncVat');
    expect(response.body.estimate).toHaveProperty('lineItems');
    
    expect(typeof response.body.estimate.subtotalExVat).toBe('number');
    expect(typeof response.body.estimate.vatRate).toBe('number');
    expect(typeof response.body.estimate.totalIncVat).toBe('number');
    expect(response.body.estimate.subtotalExVat).toBeGreaterThan(0);
    expect(response.body.estimate.totalIncVat).toBeGreaterThan(response.body.estimate.subtotalExVat);
    
    expect(response.body.status).toBe('active');
  });

  it('should return 400 for invalid product configuration', async () => {
    const invalidRequest = {
      productConfig: {
        size: {
          widthM: -1, // Invalid: negative width
          depthM: 3.0
        }
      },
      customer: {
        name: 'John Smith'
      }
    };

    await request(app)
      .post('/api/v1/quotes')
      .send(invalidRequest)
      .expect(400);
  });

  it('should return 400 for missing required customer fields', async () => {
    const requestWithMissingCustomer = {
      productConfig: {
        size: {
          widthM: 4.0,
          depthM: 3.0
        }
      },
      customer: {
        // Missing required 'name' field
        email: 'test@example.com'
      }
    };

    await request(app)
      .post('/api/v1/quotes')
      .send(requestWithMissingCustomer)
      .expect(400);
  });

  it('should return 400 for missing customer object', async () => {
    const requestWithoutCustomer = {
      productConfig: {
        size: {
          widthM: 4.0,
          depthM: 3.0
        }
      }
      // Missing required 'customer' field
    };

    await request(app)
      .post('/api/v1/quotes')
      .send(requestWithoutCustomer)
      .expect(400);
  });

  it('should create quote with minimal valid data', async () => {
    const minimalRequest = {
      productConfig: {
        size: {
          widthM: 2.5,
          depthM: 2.0
        }
      },
      customer: {
        name: 'Jane Doe'
      }
    };

    const response = await request(app)
      .post('/api/v1/quotes')
      .send(minimalRequest)
      .expect(201);

    expect(response.body).toHaveProperty('quoteNumber');
    expect(response.body.customer.name).toBe('Jane Doe');
    expect(response.body.estimate.subtotalExVat).toBeGreaterThan(0);
  });

  it('should generate unique quote numbers for concurrent requests', async () => {
    const requests = Array.from({ length: 3 }, (_, i) => ({
      productConfig: {
        size: {
          widthM: 3.0,
          depthM: 2.5
        }
      },
      customer: {
        name: `Customer ${i + 1}`
      }
    }));

    const responses = await Promise.all(
      requests.map(req => 
        request(app).post('/api/v1/quotes').send(req)
      )
    );

    responses.forEach(response => {
      expect(response.status).toBe(201);
    });

    const quoteNumbers = responses.map(res => res.body.quoteNumber);
    const uniqueQuoteNumbers = [...new Set(quoteNumbers)];
    
    expect(uniqueQuoteNumbers.length).toBe(quoteNumbers.length);
  });
});