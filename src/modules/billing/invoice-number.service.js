// src/modules/billing/invoice-number.service.js
// Atomically generates sequential gap-free invoice numbers.

import prisma from '../../lib/prisma.js';

export const invoiceNumberService = {
  /**
   * Generates the next sequential invoice number in the format: ND-YYYY-XXXXXX.
   * Uses row-level locks and upserts on a sequence table.
   *
   * @param {object} [options]
   * @param {object} [options.tx] - Optional transaction client
   * @returns {Promise<string>} Sequential invoice number
   */
  async generateNextNumber(options = {}) {
    const db = options.tx || prisma;
    const currentYear = new Date().getFullYear();

    // Self-healing: Ensure tracking table exists.
    // Done as a raw operation outside transaction blocks if needed, but safe to run.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS invoice_sequences (
        year INTEGER PRIMARY KEY,
        sequence INTEGER DEFAULT 0
      )
    `);

    // Perform atomic parameterized query (uses tagged templates for parameterization)
    const results = await db.$queryRaw`
      INSERT INTO invoice_sequences (year, sequence)
      VALUES (${currentYear}, 1)
      ON CONFLICT (year)
      DO UPDATE SET sequence = invoice_sequences.sequence + 1
      RETURNING sequence
    `;

    const nextSeq = results[0]?.sequence ?? 1;
    const paddedSeq = String(nextSeq).padStart(6, '0');
    return `ND-${currentYear}-${paddedSeq}`;
  },
};
