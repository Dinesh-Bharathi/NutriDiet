// src/modules/billing/repositories/billing.errors.js
// Custom errors for database access layer — persistence only.

export class RepositoryError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

export class RepositoryNotFoundError extends RepositoryError {}
export class RepositoryConflictError extends RepositoryError {}
export class RepositoryValidationError extends RepositoryError {}
export class RepositoryDatabaseError extends RepositoryError {}

/**
 * Centralized mapping of Prisma query engine error codes to domain repository errors.
 *
 * @param {Error} error - The Prisma/database error object
 * @param {string} customMessage - Context-specific error description
 * @throws {RepositoryError} A mapped subclass of RepositoryError
 */
export function handlePrismaError(error, customMessage) {
  if (error && typeof error === 'object') {
    // P2002: Unique constraint failed
    if (error.code === 'P2002') {
      const targets = error.meta?.target || [];
      throw new RepositoryConflictError(
        `${customMessage}: Unique constraint violation on field(s) (${targets.join(', ')})`,
        error
      );
    }
    // P2025: Record to update/delete not found
    if (error.code === 'P2025') {
      throw new RepositoryNotFoundError(
        `${customMessage}: Target record not found`,
        error
      );
    }
    // P2003: Foreign key constraint failed
    if (error.code === 'P2003') {
      throw new RepositoryValidationError(
        `${customMessage}: Foreign key constraint failed on field ${error.meta?.field_name}`,
        error
      );
    }
  }

  // General unhandled database exceptions
  throw new RepositoryDatabaseError(
    `${customMessage}: Database operation failed. ${error?.message || ''}`,
    error
  );
}
