import type { D1Database } from '@cloudflare/workers-types';

/**
 * ID Generator Utility for InfoHQ Command Center
 * Format standard:
 * - Leads:   LD-YYYY-XXXXX   (e.g., LD-2026-00001)
 * - Clients: CLT-YYYY-XXXXX  (e.g., CLT-2026-00001)
 * - Invoices: INV-YYYY-XXXXX (e.g., INV-2026-00001)
 */

export async function generateLeadId(db: D1Database): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LD-${year}-`;

  try {
    const row = await db
      .prepare("SELECT id FROM leads WHERE id LIKE ? ORDER BY id DESC LIMIT 1")
      .bind(`${prefix}%`)
      .first<{ id: string }>();

    let nextNum = 1;
    if (row && row.id && row.id.startsWith(prefix)) {
      const currentSeq = parseInt(row.id.replace(prefix, ''), 10);
      if (!isNaN(currentSeq)) {
        nextNum = currentSeq + 1;
      }
    }

    const paddedNum = String(nextNum).padStart(5, '0');
    return `${prefix}${paddedNum}`;
  } catch (err) {
    console.warn('[generateLeadId fallback to timestamp/random]:', err);
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}${rand}`;
  }
}

export async function generateClientId(db: D1Database): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CLT-${year}-`;

  try {
    const row = await db
      .prepare("SELECT id FROM clients WHERE id LIKE ? ORDER BY id DESC LIMIT 1")
      .bind(`${prefix}%`)
      .first<{ id: string }>();

    let nextNum = 1;
    if (row && row.id && row.id.startsWith(prefix)) {
      const currentSeq = parseInt(row.id.replace(prefix, ''), 10);
      if (!isNaN(currentSeq)) {
        nextNum = currentSeq + 1;
      }
    }

    const paddedNum = String(nextNum).padStart(5, '0');
    return `${prefix}${paddedNum}`;
  } catch (err) {
    console.warn('[generateClientId fallback to timestamp/random]:', err);
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}${rand}`;
  }
}

export async function generateInvoiceNumber(db: D1Database): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  try {
    const row = await db
      .prepare("SELECT invoice_number FROM payments WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1")
      .bind(`${prefix}%`)
      .first<{ invoice_number: string }>();

    let nextNum = 1;
    if (row && row.invoice_number && row.invoice_number.startsWith(prefix)) {
      const currentSeq = parseInt(row.invoice_number.replace(prefix, ''), 10);
      if (!isNaN(currentSeq)) {
        nextNum = currentSeq + 1;
      }
    }

    const paddedNum = String(nextNum).padStart(5, '0');
    return `${prefix}${paddedNum}`;
  } catch (err) {
    console.warn('[generateInvoiceNumber fallback]:', err);
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}${rand}`;
  }
}

