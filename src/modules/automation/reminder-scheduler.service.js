// src/modules/automation/reminder-scheduler.service.js

import { createReminderWorker } from './reminder-worker.js';
import { reminderReconciliationService } from './reminder-reconciliation.service.js';
import logger from '../../utils/logger.js';

export const reminderSchedulerService = {
  worker: null,

  /**
   * Initializes and starts the BullMQ worker.
   */
  init() {
    if (this.worker) return;
    logger.info('[REMINDER_WORKER] Initializing BullMQ reminder worker...');
    this.worker = createReminderWorker();
    
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
  },
};

export default reminderSchedulerService;
