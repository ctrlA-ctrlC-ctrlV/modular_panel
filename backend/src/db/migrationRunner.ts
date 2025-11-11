import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export interface Migration {
  id: string;
  name: string;
  up: string;
  down: string;
  appliedAt?: Date;
}

export class MigrationRunner {
  private pool: Pool;
  private migrationsDir: string;

  constructor(pool: Pool, migrationsDir: string = path.join(__dirname, 'migrations')) {
    this.pool = pool;
    this.migrationsDir = migrationsDir;
  }

  async init(): Promise<void> {
    // Create migrations table if it doesn't exist
    const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await this.pool.query(createMigrationsTable);
  }

  async getAppliedMigrations(): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT id FROM migrations ORDER BY applied_at ASC'
    );
    return result.rows.map(row => row.id);
  }

  async getPendingMigrations(): Promise<Migration[]> {
    const appliedMigrations = await this.getAppliedMigrations();
    const allMigrations = this.loadMigrations();
    
    return allMigrations.filter(migration => 
      !appliedMigrations.includes(migration.id)
    );
  }

  private loadMigrations(): Migration[] {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(file => {
      const content = fs.readFileSync(path.join(this.migrationsDir, file), 'utf-8');
      const parts = content.split('-- DOWN');
      
      return {
        id: file.replace('.sql', ''),
        name: file,
        up: (parts[0] || '').replace('-- UP', '').trim(),
        down: parts[1] ? parts[1].trim() : ''
      };
    });
  }

  async runMigrations(): Promise<void> {
    await this.init();
    const pendingMigrations = await this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pendingMigrations.length} migrations...`);

    for (const migration of pendingMigrations) {
      await this.runSingleMigration(migration);
    }

    console.log('All migrations completed successfully');
  }

  private async runSingleMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Run the migration SQL
      await client.query(migration.up);
      
      // Record the migration as applied
      await client.query(
        'INSERT INTO migrations (id, name) VALUES ($1, $2)',
        [migration.id, migration.name]
      );
      
      await client.query('COMMIT');
      console.log(`Applied migration: ${migration.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Failed to apply migration ${migration.name}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async rollbackLastMigration(): Promise<void> {
    const appliedMigrations = await this.getAppliedMigrations();
    
    if (appliedMigrations.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastMigrationId = appliedMigrations[appliedMigrations.length - 1];
    const allMigrations = this.loadMigrations();
    const migration = allMigrations.find(m => m.id === lastMigrationId);

    if (!migration) {
      throw new Error(`Migration ${lastMigrationId} not found`);
    }

    if (!migration.down) {
      throw new Error(`No rollback script for migration ${lastMigrationId}`);
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Run the rollback SQL
      await client.query(migration.down);
      
      // Remove the migration record
      await client.query(
        'DELETE FROM migrations WHERE id = $1',
        [migration.id]
      );
      
      await client.query('COMMIT');
      console.log(`Rolled back migration: ${migration.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Failed to rollback migration ${migration.name}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }
}