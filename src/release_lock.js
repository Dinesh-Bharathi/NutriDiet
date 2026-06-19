import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Attempting to release lingering advisory locks...');
  try {
    const activities = await prisma.$queryRawUnsafe(`
      SELECT pid, query, state 
      FROM pg_stat_activity 
      WHERE pid <> pg_backend_pid() 
        AND (query LIKE '%advisory%' OR state = 'idle');
    `);
    console.log('Active connections to terminate:', activities);

    for (const act of activities) {
      console.log(`Terminating backend pid: ${act.pid}`);
      try {
        await prisma.$queryRawUnsafe(`SELECT pg_terminate_backend(${act.pid});`);
        console.log(`Terminated pid ${act.pid}`);
      } catch (err) {
        console.error(`Failed to terminate pid ${act.pid}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error running release lock script:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
