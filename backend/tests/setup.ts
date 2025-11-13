// Jest setup for backend tests
import { Pool } from 'pg';
import { getConfig } from '../src/config';

let testPool: Pool;

// Setup test database connection
export async function setupTestDb(): Promise<void> {
  const config = getConfig();
  
  testPool = new Pool({
    connectionString: config.DATABASE_URL,
    ssl: config.DATABASE_URL.includes('localhost') ? false : {
      rejectUnauthorized: false
    }
  });

  // Ensure database is accessible
  try {
    await testPool.query('SELECT 1');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
}

// Cleanup test database connection
export async function teardownTestDb(): Promise<void> {
  if (testPool) {
    await testPool.end();
  }
}

export function getTestPool(): Pool {
  return testPool;
}