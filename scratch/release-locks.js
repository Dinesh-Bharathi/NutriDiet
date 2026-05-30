// scratch/release-locks.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Releasing advisory locks...');
  try {
    await prisma.$executeRawUnsafe('SELECT pg_advisory_unlock_all();');
    console.log('Advisory locks released.');
    
    console.log('Terminating other active sessions...');
    const result = await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = current_database() 
        AND pid <> pg_backend_pid();
    `);
    console.log('Active sessions terminated:', result);
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
