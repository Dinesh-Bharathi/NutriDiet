// backend/src/modules/automation/migration-regenerator.js
import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { reminderGeneratorService } from './reminder-generator.service.js';

async function run() {
  try {
    logger.info('Starting migration and reminder regeneration for active automations...');
    
    // Find all active automations
    const activeAutomations = await prisma.dietPlanAutomation.findMany({
      where: { status: 'ACTIVE' },
      include: {
        client: true,
        tenant: true
      }
    });
    
    logger.info(`Found ${activeAutomations.length} active automations to regenerate.`);
    
    for (const automation of activeAutomations) {
      logger.info(`Regenerating reminders for Automation ID: ${automation.id}, Client: ${automation.client.firstName} ${automation.client.lastName} (Tenant: ${automation.tenantId})`);
      
      const count = await reminderGeneratorService.generateJobs(automation.tenantId, automation.id);
      
      logger.info(`Successfully regenerated ${count} jobs for Automation ID: ${automation.id}`);
    }
    
    logger.info('Migration and reminder regeneration completed successfully!');
  } catch (err) {
    logger.error('Error during migration and reminder regeneration:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
