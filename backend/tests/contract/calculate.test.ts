import request from 'supertest';
import app from '../../src/index';

describe('POST /api/v1/calculate', () => {
  it('should calculate pricing for valid product configuration', async () => {
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
          { widthM: 1.2, heightM: 1.5 },
          { widthM: 1.0, heightM: 1.2 }
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
      notes: 'Test calculation'
    };

    const response = await request(app)
      .post('/api/v1/calculate')
      .send(productConfig)
      .expect(200);

    expect(response.body).toHaveProperty('currency');
    expect(response.body).toHaveProperty('subtotalExVat');
    expect(response.body).toHaveProperty('vatRate');
    expect(response.body).toHaveProperty('totalIncVat');
    expect(response.body).toHaveProperty('lineItems');
    
    expect(typeof response.body.subtotalExVat).toBe('number');
    expect(typeof response.body.vatRate).toBe('number');
    expect(typeof response.body.totalIncVat).toBe('number');
    expect(response.body.subtotalExVat).toBeGreaterThan(0);
    expect(response.body.totalIncVat).toBeGreaterThan(response.body.subtotalExVat);
    expect(Array.isArray(response.body.lineItems)).toBe(true);
  });

  it('should return 400 for invalid product configuration', async () => {
    const invalidConfig = {
      size: {
        widthM: -1, // Invalid: negative width
        depthM: 3.0
      }
    };

    await request(app)
      .post('/api/v1/calculate')
      .send(invalidConfig)
      .expect(400);
  });

  it('should return 400 for missing required fields', async () => {
    const incompleteConfig = {
      // Missing required 'size' field
      notes: 'Incomplete config'
    };

    await request(app)
      .post('/api/v1/calculate')
      .send(incompleteConfig)
      .expect(400);
  });

  it('should handle minimal valid configuration', async () => {
    const minimalConfig = {
      size: {
        widthM: 2.5,
        depthM: 2.0
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
  });

  it('should apply discount correctly', async () => {
    const configWithDiscount = {
      size: {
        widthM: 4.0,
        depthM: 3.0
      },
      discount: 500 // £500 discount
    };

    const configWithoutDiscount = {
      size: {
        widthM: 4.0,
        depthM: 3.0
      },
      discount: 0
    };

    const [responseWithDiscount, responseWithoutDiscount] = await Promise.all([
      request(app).post('/api/v1/calculate').send(configWithDiscount),
      request(app).post('/api/v1/calculate').send(configWithoutDiscount)
    ]);

    expect(responseWithDiscount.status).toBe(200);
    expect(responseWithoutDiscount.status).toBe(200);

    const discountDifference = responseWithoutDiscount.body.subtotalExVat - responseWithDiscount.body.subtotalExVat;
    expect(discountDifference).toBe(500);
  });

  it('should return 500 if no current pricing configuration exists', async () => {
    // This test would require clearing current pricing config
    // Implementation depends on test data management strategy
  });
});