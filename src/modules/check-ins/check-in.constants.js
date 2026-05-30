// src/modules/check-ins/check-in.constants.js
// Domain constants for client check-ins.

export const CHECK_IN_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  REVIEWED: 'REVIEWED',
});

export const CHECK_IN_SORT_FIELDS = Object.freeze([
  'checkInDate',
  'submittedAt',
  'createdAt',
  'weightKg',
]);
