import request from 'supertest';
import type { Response as SuperAgentResponse } from 'superagent';
import app from '../../src/index';
import { setupTestDb, teardownTestDb } from '../setup';

describe('POST /api/v1/quotes/:quoteNumber/document', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('should generate a PDF document for an existing quote', async () => {
    const createQuoteRequest = {
      productConfig: {
        size: {
          widthM: 4.0,
          depthM: 3.0
        },
        cladding: {
          areaSqm: 18.5
        },
        electrical: {
          switches: 2,
          sockets: 4,
          heater: 1
        },
        glazing: {
          windows: [
            { widthM: 1.2, heightM: 1.5 }
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
          distanceKm: 15,
          cost: 0
        },
        extras: {
          esp_insulation: 10,
          render: 0,
          steel_door: 0,
          concrete_foundation: 0,
          other: []
        },
        discount: 0,
        notes: 'Contract test quote for document generation'
      },
      customer: {
        name: 'Document Tester',
        email: 'document.tester@example.com',
        phone: '+44 7000 000000'
      }
    };

    const createResponse = await request(app)
      .post('/api/v1/quotes')
      .send(createQuoteRequest)
      .expect(201);

    const { quoteNumber } = createResponse.body;
    expect(quoteNumber).toMatch(/^Q\d{2}-\d{6}$/);

    const documentResponse = await request(app)
      .post(`/api/v1/quotes/${quoteNumber}/document`)
      .set('Accept', 'application/pdf')
      .buffer(true)
      .parse((res: SuperAgentResponse, callback: (err: Error | null, body: Buffer) => void) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(documentResponse.headers['content-type']).toMatch(/application\/pdf/);
    expect(Buffer.isBuffer(documentResponse.body)).toBe(true);
    expect(documentResponse.body.length).toBeGreaterThan(0);
  });

  it('should return 404 when attempting to generate a document for a non-existent quote', async () => {
    await request(app)
      .post('/api/v1/quotes/Q99-999999/document')
      .set('Accept', 'application/pdf')
      .expect(404);
  });
});
