// src/modules/automation/reminder-scheduler.service.js

import { createReminderWorker } from './reminder-worker.js';
import { createComplianceTimeoutWorker } from './compliance-timeout.worker.js';
import { reminderReconciliationService } from './reminder-reconciliation.service.js';
import logger from '../../utils/logger.js';

export const reminderSchedulerService = {
  worker: null,
  timeoutWorker: null,

  /**
   * Initializes and starts the BullMQ worker.
   */
  init() {
    if (this.worker) return;
    logger.info('[REMINDER_WORKER] Initializing BullMQ reminder worker...');
    this.worker = createReminderWorker();

    logger.info('[COMPLIANCE_TIMEOUT_WORKER] Initializing BullMQ compliance timeout worker...');
    this.timeoutWorker = createComplianceTimeoutWorker();
    
    // Bootstrap the Queue Reconciliation Service
    reminderReconciliationService.bootstrap();
  },

  /**
   * Gracefully shuts down the BullMQ worker.
   */
  async shutdown() {
    if (this.worker) {
      logger.info('[REMINDER_WORKER] Shutting down BullMQ reminder worker gracefully...');
      await this.worker.close();
      this.worker = null;
    }
    if (this.timeoutWorker) {
      logger.info('[COMPLIANCE_TIMEOUT_WORKER] Shutting down BullMQ compliance timeout worker gracefully...');
      await this.timeoutWorker.close();
      this.timeoutWorker = null;
    }
  },
};

export default reminderSchedulerService;
