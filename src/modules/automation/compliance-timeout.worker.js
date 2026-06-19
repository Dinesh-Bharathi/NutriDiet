// src/modules/automation/compliance-timeout.worker.js

import { Queue, Worker } from 'bullmq';
import { getRedisConnectionConfig } from '../../lib/redis.js';
import { complianceService } from './compliance.service.js';
import logger from '../../utils/logger.js';

const connectionConfig = getRedisConnectionConfig();

// Create the timeout queue
export const complianceTimeoutQueue = new Queue('compliance-timeout-queue', {
  connection: {
    ...connectionConfig,
    maxRetriesPerRequest: null,
  },
});

// Worker to process timeouts
export function createComplianceTimeoutWorker() {
  const worker = new Worker(
    'compliance-timeout-queue',
    async (job) => {
      const { complianceEventId } = job.data;
      return complianceService.closeExpiredPending(complianceEventId);
    },
    {
      connection: {
        ...connectionConfig,
        maxRetriesPerRequest: null,
      },
      concurrency: 5,
    }
  );

  worker.on('error', (err) => {
    logger.error(`[COMPLIANCE_TIMEOUT_WORKER] Connection error: ${err.message}`, err);
  });

  worker.on('failed', (job, err) => {
    const jobIdStr = job ? job.id : 'unknown';
    logger.error(`[COMPLIANCE_TIMEOUT_WORKER] Job ${jobIdStr} failed with error: ${err.message}`);
  });

  worker.on('completed', (job) => {
    logger.info(`[COMPLIANCE_TIMEOUT_WORKER] Job ${job.id} completed successfully.`);
  });

  return worker;
}
