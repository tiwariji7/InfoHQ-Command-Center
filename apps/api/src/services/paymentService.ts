import type { D1Database } from '@cloudflare/workers-types';
import type {
  Payment,
  PaymentSummary,
  PaymentListResponse,
  CreatePaymentInput,
  UpdatePaymentInput,
  RecordPaymentInput,
} from '@infohq/shared';
import { generateInvoiceNumber } from '../utils/idGenerator.js';

function mapDbRowToPayment(row: Record<string, unknown>): Payment {
  const now = Date.now();
  const isPaid = row.status === 'received' || !!row.paid_at;
  const expiresAt = row.expires_at
    ? Number(row.expires_at)
    : row.razorpay_payment_link_id
    ? Number(row.created_at) + 24 * 60 * 60 * 1000
    : null;

  let effectiveStatus: Payment['status'] = (row.status as Payment['status']) || 'pending';
  if (isPaid) {
    effectiveStatus = 'received';
  } else if (expiresAt && expiresAt < now) {
    effectiveStatus = 'expired';
  } else if (row.status === 'failed') {
    effectiveStatus = 'failed';
  } else {
    effectiveStatus = 'pending';
  }

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    clientId: row.client_id ? String(row.client_id) : null,
    leadId: row.lead_id ? String(row.lead_id) : null,
    title: row.title
      ? String(row.title)
      : row.invoice_number
      ? String(row.invoice_number)
      : row.project_title
      ? `${String(row.project_title)} Milestone`
      : 'Milestone Payment',
    amount: Number(row.amount),
    currency: 'INR',
    status: effectiveStatus,
    paymentMethod: row.payment_method ? (String(row.payment_method) as Payment['paymentMethod']) : null,
    invoiceNumber: row.invoice_number ? String(row.invoice_number) : null,
    dueDate: row.due_date ? Number(row.due_date) : null,
    paidAt: row.paid_at ? Number(row.paid_at) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at || row.created_at),
    projectTitle: row.project_title ? String(row.project_title) : undefined,
    clientName: row.client_name ? String(row.client_name) : undefined,
    clientEmail: row.client_email ? String(row.client_email) : undefined,
    clientPhone: row.client_phone ? String(row.client_phone) : undefined,
    company: row.company ? String(row.company) : null,
    razorpayPaymentLinkId: row.razorpay_payment_link_id ? String(row.razorpay_payment_link_id) : undefined,
    razorpayPaymentLinkUrl: row.razorpay_payment_link_url ? String(row.razorpay_payment_link_url) : undefined,
    razorpayPaymentId: row.razorpay_payment_id ? String(row.razorpay_payment_id) : undefined,
    itemsJson: row.items_json ? String(row.items_json) : undefined,
    expiresAt,
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

  const now = Date.now();
  if (params.status && params.status !== 'all') {
    if (params.status === 'received') {
      conditions.push("py.status = 'received'");
    } else if (params.status === 'failed') {
      conditions.push("py.status = 'failed'");
    } else if (params.status === 'expired') {
      conditions.push("(py.status != 'received' AND ((py.expires_at IS NOT NULL AND py.expires_at < ?) OR (py.expires_at IS NULL AND py.razorpay_payment_link_id IS NOT NULL AND (COALESCE(py.updated_at, py.created_at) + 86400000) < ?)))");
      bindings.push(now, now);
    } else if (params.status === 'pending') {
      conditions.push("(py.status = 'pending' AND ((py.expires_at IS NOT NULL AND py.expires_at >= ?) OR (py.expires_at IS NULL AND (py.razorpay_payment_link_id IS NULL OR (COALESCE(py.updated_at, py.created_at) + 86400000) >= ?))))");
      bindings.push(now, now);
    } else {
      conditions.push("py.status = ?");
      bindings.push(params.status);
    }
  }

  if (params.search && params.search.trim().length > 0) {
    const term = `%${params.search.trim().toLowerCase()}%`;
    conditions.push(
      '(LOWER(COALESCE(py.title, p.title, "")) LIKE ? OR LOWER(COALESCE(py.client_name, p.client_name, c.name, "")) LIKE ? OR LOWER(COALESCE(py.invoice_number, "")) LIKE ? OR LOWER(COALESCE(py.company, p.company, c.company, "")) LIKE ?)'
    );
    bindings.push(term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      py.*,
      COALESCE(p.title, py.title) as project_title,
      COALESCE(py.client_name, p.client_name, c.name) as client_name,
      COALESCE(py.client_email, p.client_email, c.email) as client_email,
      COALESCE(py.client_phone, p.client_phone, c.phone) as client_phone,
      COALESCE(py.company, p.company, l.company, c.company) as company,
      COALESCE(py.due_date, p.deadline) as due_date,
      p.lead_id
    FROM payments py
    LEFT JOIN projects p ON py.project_id = p.id
    LEFT JOIN leads l ON p.lead_id = l.id
    LEFT JOIN clients c ON (c.id = py.client_id OR c.id = p.client_id)
    ${whereClause}
    ORDER BY 
      CASE 
        WHEN py.status = 'received' THEN 2
        WHEN py.status = 'failed' THEN 3
        ELSE 1
      END ASC,
      py.created_at DESC
  `;

  const { results } = await db.prepare(sql).bind(...bindings).all<Record<string, unknown>>();
  const payments = (results || []).map(mapDbRowToPayment);

  // Calculate summary metrics independently so table tab filters do not distort ledger cards
  const summaryConditions: string[] = [];
  const summaryBindings: unknown[] = [];
  if (params.projectId) {
    summaryConditions.push('project_id = ?');
    summaryBindings.push(params.projectId);
  }
  const summaryWhere = summaryConditions.length > 0 ? `WHERE ${summaryConditions.join(' AND ')}` : '';
  const summaryRow = await db.prepare(`
    SELECT
      SUM(CASE WHEN status != 'failed' THEN CAST(amount AS REAL) ELSE 0 END) as total_invoiced,
      SUM(CASE WHEN status = 'received' THEN CAST(amount AS REAL) ELSE 0 END) as total_collected,
      SUM(CASE WHEN status = 'pending' THEN CAST(amount AS REAL) ELSE 0 END) as total_pending,
      SUM(CASE WHEN status = 'pending' AND due_date IS NOT NULL AND due_date < ? THEN 1 ELSE 0 END) as overdue_count
    FROM payments
    ${summaryWhere}
  `).bind(now, ...summaryBindings).first<{
    total_invoiced: number | null;
    total_collected: number | null;
    total_pending: number | null;
    overdue_count: number | null;
  }>();

  const summary: PaymentSummary = {
    totalInvoiced: Math.round(Number(summaryRow?.total_invoiced || 0)),
    totalCollected: Math.round(Number(summaryRow?.total_collected || 0)),
    totalPending: Math.round(Number(summaryRow?.total_pending || 0)),
    overdueCount: Number(summaryRow?.overdue_count || 0),
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
      COALESCE(p.title, py.title) as project_title,
      COALESCE(py.client_name, p.client_name, c.name) as client_name,
      COALESCE(py.client_email, p.client_email, c.email) as client_email,
      COALESCE(py.client_phone, p.client_phone, c.phone) as client_phone,
      COALESCE(py.company, p.company, l.company, c.company) as company,
      COALESCE(py.due_date, p.deadline) as due_date,
      p.lead_id
    FROM payments py
    LEFT JOIN projects p ON py.project_id = p.id
    LEFT JOIN leads l ON p.lead_id = l.id
    LEFT JOIN clients c ON (c.id = py.client_id OR c.id = p.client_id)
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

  // Fetch parent project to get client link and contact details
  const projectRow = await db
    .prepare('SELECT client_id, client_name, client_email, client_phone, company, title FROM projects WHERE id = ?')
    .bind(input.projectId)
    .first<Record<string, unknown>>();

  let clientId = projectRow?.client_id ? String(projectRow.client_id) : null;
  let clientName = projectRow?.client_name ? String(projectRow.client_name) : null;
  let clientEmail = projectRow?.client_email ? String(projectRow.client_email) : null;
  let clientPhone = projectRow?.client_phone ? String(projectRow.client_phone) : null;
  let company = projectRow?.company ? String(projectRow.company) : null;

  // Fallback to clients table if contact info is missing on the project record
  if (clientId && (!clientEmail || !clientPhone || !clientName)) {
    const clientRow = await db
      .prepare('SELECT name, email, phone, company FROM clients WHERE id = ?')
      .bind(clientId)
      .first<Record<string, unknown>>();
    if (clientRow) {
      if (!clientName && clientRow.name) clientName = String(clientRow.name);
      if (!clientEmail && clientRow.email) clientEmail = String(clientRow.email);
      if (!clientPhone && clientRow.phone) clientPhone = String(clientRow.phone);
      if (!company && clientRow.company) company = String(clientRow.company);
    }
  }

  const invoiceNum = input.invoiceNumber || (await generateInvoiceNumber(db));

  await db.prepare(`
    INSERT INTO payments (
      id, client_id, project_id, amount, status, invoice_number, paid_at, created_at,
      client_name, client_email, client_phone, company, title, due_date, notes
    ) VALUES (?, ?, ?, ?, 'pending', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    clientId,
    input.projectId,
    String(input.amount),
    invoiceNum,
    now,
    clientName,
    clientEmail,
    clientPhone,
    company,
    input.title || `${projectRow?.title || 'Milestone'} Invoice`,
    input.dueDate || null,
    input.notes || null
  ).run();

  const created = await getPaymentById(db, id);
  if (!created) throw new Error('Failed to retrieve created payment.');
  return created;
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

  if (input.title !== undefined) {
    updates.push('title = ?');
    bindings.push(input.title);
  }
  if (input.amount !== undefined) {
    updates.push('amount = ?');
    bindings.push(String(input.amount));
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    bindings.push(input.status);
    if (input.status === 'received' && !existing.paidAt) {
      updates.push('paid_at = ?');
      bindings.push(Date.now());
    }
  }
  if (input.invoiceNumber !== undefined) {
    updates.push('invoice_number = ?');
    bindings.push(input.invoiceNumber);
  }
  if (input.dueDate !== undefined) {
    updates.push('due_date = ?');
    bindings.push(input.dueDate);
  }
  if (input.notes !== undefined) {
    updates.push('notes = ?');
    bindings.push(input.notes);
  }

  if (updates.length === 0) return existing;

  bindings.push(paymentId);
  const sql = `UPDATE payments SET ${updates.join(', ')} WHERE id = ?`;
  await db.prepare(sql).bind(...bindings).run();

  return getPaymentById(db, paymentId);
}

export async function recordPaymentReceived(
  db: D1Database,
  paymentId: string,
  input: RecordPaymentInput
): Promise<Payment | null> {
  const existing = await getPaymentById(db, paymentId);
  if (!existing) return null;

  const paidAt = input.paidAt || Date.now();
  const method = input.paymentMethod || 'bank_transfer';
  const notes = input.notes ? `${existing.notes ? existing.notes + ' | ' : ''}${input.notes}` : existing.notes;

  await db.prepare(`
    UPDATE payments 
    SET status = 'received',
        paid_at = ?,
        payment_method = ?,
        notes = ?
    WHERE id = ?
  `).bind(paidAt, method, notes, paymentId).run();

  return getPaymentById(db, paymentId);
}

export async function deletePayment(
  db: D1Database,
  paymentId: string
): Promise<boolean> {
  const res = await db.prepare('DELETE FROM payments WHERE id = ?').bind(paymentId).run();
  return (res.meta.changes || 0) > 0;
}
