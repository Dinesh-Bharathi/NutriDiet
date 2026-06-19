// src/modules/automation/reminder-queue.js

import { Queue } from 'bullmq';
import { getRedisConnectionConfig } from '../../lib/redis.js';

const connectionConfig = getRedisConnectionConfig();

export const reminderQueue = new Queue('reminder-jobs-queue', {
  connection: {
    ...connectionConfig,
    maxRetriesPerRequest: null,
  },
});

export const reminderDeadLetterQueue = new Queue('reminder-dead-letter', {
  connection: {
    ...connectionConfig,
    maxRetriesPerRequest: null,
  },
});
