// src/modules/automation/scheduler-registry.js

import logger from '../../utils/logger.js';

export class SchedulerRegistry {
  constructor() {
    this.handlers = new Map();
  }

  /**
   * Registers a custom handler for a job type.
   *
   * @param {string} jobType
   * @param {object} handler
   */
  register(jobType, handler) {
    logger.info(`[AUTOMATION] Registered custom handler for ${jobType}`);
    this.handlers.set(jobType, handler);
  }

  /**
   * Gets a handler for a job type.
   *
   * @param {string} jobType
   * @returns {object|null}
   */
  getHandler(jobType) {
    return this.handlers.get(jobType) || null;
  }
}

export const schedulerRegistry = new SchedulerRegistry();
export default schedulerRegistry;
