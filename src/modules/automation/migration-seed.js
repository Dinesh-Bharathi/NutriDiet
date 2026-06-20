// backend/src/modules/automation/migration-seed.js
import { reminderTemplateService } from './reminder-template.service.js';
import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

async function run() {
  try {
    logger.info('Starting system template seeding...');
    await reminderTemplateService.seedSystemTemplates();
    logger.info('System template seeding completed successfully!');
  } catch (err) {
    logger.error('Error seeding system templates:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
