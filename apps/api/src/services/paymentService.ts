import type { D1Database } from '@cloudflare/workers-types';
import type {
  Payment,
  PaymentSummary,
  PaymentListResponse,
  CreatePaymentInput,
  UpdatePaymentInput,
  RecordPaymentInput,
} from '@infohq/shared';

function mapDbRowToPayment(row: Record<string, unknown>): Payment {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    title: String(row.title),
    amount: Number(row.amount),
    currency: String(row.currency || 'INR'),
    status: row.status as Payment['status'],
    paymentMethod: row.payment_method ? (row.payment_method as Payment['paymentMethod']) : null,
    invoiceNumber: row.invoice_number ? String(row.invoice_number) : null,
    dueDate: row.due_date ? Number(row.due_date) : null,
    paidAt: row.paid_at ? Number(row.paid_at) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    projectTitle: row.project_title ? String(row.project_title) : undefined,
    clientName: row.client_name ? String(row.client_name) : undefined,
    company: row.company ? String(row.company) : null,
  };
}

export async function getPayments(
  db: D1Database,
  params: { projectId?: string; status?: string; search?: string }
): Promise<PaymentListResponse> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (params.projectId) {
    conditions.push('py.project_id = ?');
    bindings.push(params.projectId);
  }

  if (params.status && params.status !== 'all') {
    conditions.push('py.status = ?');
    bindings.push(params.status);
  }

  if (params.search && params.search.trim().length > 0) {
    const term = `%${params.search.trim().toLowerCase()}%`;
    conditions.push(
      '(LOWER(py.title) LIKE ? OR LOWER(p.title) LIKE ? OR LOWER(p.client_name) LIKE ? OR LOWER(py.invoice_number) LIKE ? OR LOWER(py.notes) LIKE ?)'
    );
    bindings.push(term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      py.*,
      p.title as project_title,
      p.client_name,
      p.company
    FROM payments py
    LEFT JOIN projects p ON py.project_id = p.id
    ${whereClause}
    ORDER BY 
      CASE py.status
        WHEN 'pending' THEN 1
        WHEN 'overdue' THEN 2
        WHEN 'paid' THEN 3
        WHEN 'cancelled' THEN 4
      END ASC,
      py.created_at DESC
  `;

  const { results } = await db.prepare(sql).bind(...bindings).all<Record<string, unknown>>();
  const payments = (results || []).map(mapDbRowToPayment);

  // Calculate summary metrics
  const now = Date.now();
  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let overdueCount = 0;

  for (const py of payments) {
    if (py.status !== 'cancelled') {
      totalInvoiced += py.amount;
    }
    if (py.status === 'paid') {
      totalCollected += py.amount;
    } else if (py.status === 'pending') {
      totalPending += py.amount;
      if (py.dueDate && py.dueDate < now) {
        overdueCount += 1;
      }
    } else if (py.status === 'overdue') {
      totalPending += py.amount;
      overdueCount += 1;
    }
  }

  const summary: PaymentSummary = {
    totalInvoiced,
    totalCollected,
    totalPending,
    overdueCount,
  };

  return {
    payments,
    summary,
  };
}

export async function getPaymentById(
  db: D1Database,
  paymentId: string
): Promise<Payment | null> {
  const sql = `
    SELECT 
      py.*,
      p.title as project_title,
      p.client_name,
      p.company
    FROM payments py
    LEFT JOIN projects p ON py.project_id = p.id
    WHERE py.id = ?
  `;
  const row = await db.prepare(sql).bind(paymentId).first<Record<string, unknown>>();
  return row ? mapDbRowToPayment(row) : null;
}

export async function createPayment(
  db: D1Database,
  input: CreatePaymentInput
): Promise<Payment> {
  const id = `pay_${crypto.randomUUID()}`;
  const now = Date.now();

  // Fetch project to link lead_id if exists
  const projectRow = await db.prepare('SELECT lead_id FROM projects WHERE id = ?')
    .bind(input.projectId)
    .first<{ lead_id: string | null }>();

  const leadId = projectRow?.lead_id || null;

  await db.prepare(`
    INSERT INTO payments (
      id, project_id, lead_id, title, amount, currency, status,
      invoice_number, due_date, paid_at, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, NULL, ?, ?, ?)
  `).bind(
    id,
    input.projectId,
    leadId,
    input.title,
    input.amount,
    input.currency || 'INR',
    input.invoiceNumber || null,
    input.dueDate || null,
    input.notes || null,
    now,
    now
  ).run();

  const created = await getPaymentById(db, id);
  if (!created) throw new Error('Payment creation verification failed.');
  return created;
}

export async function recordPaymentReceived(
  db: D1Database,
  paymentId: string,
  input: RecordPaymentInput
): Promise<Payment | null> {
  const existing = await getPaymentById(db, paymentId);
  if (!existing) return null;

  const now = Date.now();
  const paidAt = input.paidAt || now;

  let combinedNotes = existing.notes || '';
  if (input.notes) {
    combinedNotes = combinedNotes ? `${combinedNotes} | ${input.notes}` : input.notes;
  }

  await db.prepare(`
    UPDATE payments
    SET status = 'paid', payment_method = ?, paid_at = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    input.paymentMethod,
    paidAt,
    combinedNotes || null,
    now,
    paymentId
  ).run();

  return getPaymentById(db, paymentId);
}

export async function updatePayment(
  db: D1Database,
  paymentId: string,
  input: UpdatePaymentInput
): Promise<Payment | null> {
  const existing = await getPaymentById(db, paymentId);
  if (!existing) return null;

  const updates: string[] = [];
  const bindings: unknown[] = [];
  const now = Date.now();

  if (input.title !== undefined) {
    updates.push('title = ?');
    bindings.push(input.title);
  }
  if (input.amount !== undefined) {
    updates.push('amount = ?');
    bindings.push(input.amount);
  }
  if (input.currency !== undefined) {
    updates.push('currency = ?');
    bindings.push(input.currency);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    bindings.push(input.status);
    if (input.status === 'paid' && !existing.paidAt) {
      updates.push('paid_at = ?');
      bindings.push(now);
    }
  }
  if (input.invoiceNumber !== undefined) {
    updates.push('invoice_number = ?');
    bindings.push(input.invoiceNumber || null);
  }
  if (input.dueDate !== undefined) {
    updates.push('due_date = ?');
    bindings.push(input.dueDate);
  }
  if (input.notes !== undefined) {
    updates.push('notes = ?');
    bindings.push(input.notes || null);
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = ?');
  bindings.push(now);
  bindings.push(paymentId);

  const sql = `UPDATE payments SET ${updates.join(', ')} WHERE id = ?`;
  await db.prepare(sql).bind(...bindings).run();

  return getPaymentById(db, paymentId);
}

export async function deletePayment(
  db: D1Database,
  paymentId: string
): Promise<boolean> {
  const result = await db.prepare('DELETE FROM payments WHERE id = ?').bind(paymentId).run();
  return result.success;
}
