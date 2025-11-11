#!/usr/bin/env tsx

import { MigrationRunner } from './migrationRunner';
import { createPool } from './pool';

async function main(): Promise<void> {
  const command = process.argv[2];
  
  if (!command) {
    console.log('Usage: npm run db:migrate [up|down|status]');
    process.exit(1);
  }

  try {
    const pool = createPool();
    const runner = new MigrationRunner(pool);

    switch (command) {
      case 'up':
        await runner.runMigrations();
        break;
      
      case 'down':
        await runner.rollbackLastMigration();
        break;
      
      case 'status':
        const pending = await runner.getPendingMigrations();
        const applied = await runner.getAppliedMigrations();
        
        console.log(`Applied migrations: ${applied.length}`);
        console.log(`Pending migrations: ${pending.length}`);
        
        if (pending.length > 0) {
          console.log('\nPending:');
          pending.forEach(m => console.log(`  - ${m.name}`));
        }
        break;
      
      default:
        console.log('Unknown command. Use: up, down, or status');
        process.exit(1);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();