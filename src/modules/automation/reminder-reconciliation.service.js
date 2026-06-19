// src/modules/automation/reminder-reconciliation.service.js

import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { reminderQueue } from './reminder-queue.js';
import { reminderProducer } from './reminder-producer.js';

export const reminderReconciliationService = {
  /**
   * Reconciles the database pending jobs and BullMQ queue delayed/waiting jobs.
   * Repairs any orphans or mismatches detected.
   */
  async reconcile() {
    logger.info('[RECONCILIATION] Starting reminder queue reconciliation...');
    const startTime = Date.now();

    try {
      // 1. Fetch all PENDING jobs from the database
      const dbPendingJobs = await prisma.reminderJob.findMany({
        where: { status: 'PENDING' },
      });

      // 2. Fetch all delayed, waiting, and active jobs from BullMQ
      const bullmqJobs = await reminderQueue.getJobs(['delayed', 'waiting', 'active']);

      const dbJobMap = new Map(dbPendingJobs.map(job => [job.id, job]));
      const bullJobMap = new Map(bullmqJobs.map(job => [job.id, job]));

      // 3. Find Orphan DB Jobs (PENDING in DB, but missing in BullMQ)
      const orphanDbJobs = dbPendingJobs.filter(job => !bullJobMap.has(job.id));

      // 4. Find Orphan BullMQ Jobs (In BullMQ, but not found or not PENDING in DB)
      const orphanBullmqJobs = bullmqJobs.filter(job => {
        const dbJob = dbJobMap.get(job.id);
        return !dbJob || dbJob.status !== 'PENDING';
      });

      logger.info(`[RECONCILIATION] Diagnostics:
        Total PENDING DB Jobs: ${dbPendingJobs.length}
        Total BullMQ Jobs: ${bullmqJobs.length}
        Orphan DB Jobs (to schedule): ${orphanDbJobs.length}
        Orphan BullMQ Jobs (to cancel): ${orphanBullmqJobs.length}
      `);

      let enqueuedCount = 0;
      let expiredCount = 0;
      let cancelledCount = 0;

      // 5. Repair Orphan DB Jobs
      const now = new Date();
      for (const dbJob of orphanDbJobs) {
        if (new Date(dbJob.scheduledFor) > now) {
          try {
            await reminderProducer.queueJob(dbJob);
            enqueuedCount++;
          } catch (err) {
            logger.error(`[RECONCILIATION] Failed to queue orphan job ${dbJob.id}: ${err.message}`);
          }
        } else {
          // Expired job, mark as CANCELLED so it does not stay PENDING forever
          await prisma.reminderJob.update({
            where: { id: dbJob.id },
            data: {
              status: 'CANCELLED',
              errorText: 'Reconciliation: expired before queue scheduling',
            },
          });
          expiredCount++;
        }
      }

      // 6. Repair Orphan BullMQ Jobs
      for (const bullJob of orphanBullmqJobs) {
        try {
          await bullJob.remove();
          cancelledCount++;
        } catch (err) {
          logger.error(`[RECONCILIATION] Failed to remove orphan BullMQ job ${bullJob.id}: ${err.message}`);
        }
      }

      logger.info(`[RECONCILIATION] Reconciliation complete in ${Date.now() - startTime}ms.
        Orphans enqueued: ${enqueuedCount}
        Expired DB jobs cancelled: ${expiredCount}
        Orphan BullMQ jobs removed: ${cancelledCount}
      `);

      return {
        success: true,
        enqueuedCount,
        expiredCount,
        cancelledCount,
        diagnostics: {
          dbPending: dbPendingJobs.length,
          bullmq: bullmqJobs.length,
        },
      };
    } catch (err) {
      logger.error(`[RECONCILIATION] Mismatch/Reconciliation failed: ${err.message}`, err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Bootstraps the reconciliation scheduler: runs on startup and once daily.
   */
  bootstrap() {
    logger.info('[RECONCILIATION] Bootstrapping reconciliation service...');
    
    // Run reconciliation on startup after a brief delay to allow system boot
    setTimeout(async () => {
      try {
        await this.reconcile();
      } catch (err) {
        logger.error(`[RECONCILIATION] Startup reconciliation failed: ${err.message}`);
      }
    }, 5000);

    // Schedule daily reconciliation (once every 24 hours)
    setInterval(async () => {
      try {
        await this.reconcile();
      } catch (err) {
        logger.error(`[RECONCILIATION] Daily reconciliation failed: ${err.message}`);
      }
    }, 24 * 60 * 60 * 1000);
  },
};

export default reminderReconciliationService;
