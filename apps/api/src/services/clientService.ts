import type { D1Database } from '@cloudflare/workers-types';
import type {
  Client,
  ClientDetailResponse,
  CreateClientInput,
  UpdateClientInput,
  Project,
  Payment,
  Lead,
} from '@infohq/shared';
import { generateClientId } from '../utils/idGenerator.js';

function mapDbRowToClient(row: Record<string, unknown>): Client {
  return {
    id: String(row.id),
    name: String(row.name),
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    company: row.company ? String(row.company) : null,
    address: row.address ? String(row.address) : null,
    sourceLeadId: row.source_lead_id ? String(row.source_lead_id) : null,
    status: (row.status as Client['status']) || 'active',
    totalBilled: Number(row.total_billed || 0),
    totalPaid: Number(row.total_paid || 0),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    totalProjects: row.total_projects !== undefined ? Number(row.total_projects) : undefined,
    activeProjects: row.active_projects !== undefined ? Number(row.active_projects) : undefined,
    totalInvoices: row.total_invoices !== undefined ? Number(row.total_invoices) : undefined,
    pendingAmount: row.pending_amount !== undefined ? Number(row.pending_amount) : undefined,
  };
}

export async function getClients(
  db: D1Database,
  query?: { search?: string }
): Promise<Client[]> {
  const search = query?.search?.trim();

  // Fast single aggregated query joining projects and payments
  let sql = `
    SELECT 
      c.*,
      COUNT(DISTINCT p.id) as total_projects,
      SUM(CASE WHEN p.status IN ('planning', 'in_progress', 'review') THEN 1 ELSE 0 END) as active_projects,
      COUNT(DISTINCT pay.id) as total_invoices,
      COALESCE(SUM(CAST(pay.amount AS REAL)), 0) as total_billed,
      COALESCE(SUM(CASE WHEN pay.status = 'received' THEN CAST(pay.amount AS REAL) ELSE 0 END), 0) as total_paid
    FROM clients c
    LEFT JOIN projects p ON (p.client_id = c.id OR LOWER(p.client_name) = LOWER(c.name))
    LEFT JOIN payments pay ON (pay.client_id = c.id OR LOWER(pay.client_name) = LOWER(c.name))
  `;

  const bindings: unknown[] = [];
  if (search && search.length > 0) {
    sql += ` WHERE (c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ? OR c.phone LIKE ? OR c.id LIKE ?)`;
    const st = `%${search}%`;
    bindings.push(st, st, st, st, st);
  }

  sql += ` GROUP BY c.id ORDER BY c.created_at DESC`;

  const { results } = await db.prepare(sql).bind(...bindings).all<Record<string, unknown>>();

  return (results || []).map((r) => {
    const client = mapDbRowToClient(r);
    client.pendingAmount = Math.max(0, client.totalBilled - client.totalPaid);
    return client;
  });
}

export async function createOrGetClient(
  db: D1Database,
  params: {
    name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    address?: string | null;
    sourceLeadId?: string | null;
  }
): Promise<Client> {
  const cleanName = params.name.trim();
  const cleanEmail = params.email?.trim().toLowerCase() || null;
  const cleanPhone = params.phone?.trim() || null;

  // 1. Check if client already exists by email, phone, or name
  let existingQuery = 'SELECT * FROM clients WHERE LOWER(name) = LOWER(?)';
  const bindings: unknown[] = [cleanName];

  if (cleanEmail) {
    existingQuery += ' OR LOWER(email) = LOWER(?)';
    bindings.push(cleanEmail);
  }
  if (cleanPhone) {
    existingQuery += ' OR phone = ?';
    bindings.push(cleanPhone);
  }

  existingQuery += ' LIMIT 1';
  const existing = await db.prepare(existingQuery).bind(...bindings).first<Record<string, unknown>>();

  const now = Date.now();

  if (existing) {
    // Update missing fields
    const updatedCompany = existing.company || params.company?.trim() || null;
    const updatedEmail = existing.email || cleanEmail;
    const updatedPhone = existing.phone || cleanPhone;
    const updatedLeadId = existing.source_lead_id || params.sourceLeadId || null;

    await db
      .prepare(`
        UPDATE clients 
        SET company = ?, email = ?, phone = ?, source_lead_id = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(updatedCompany, updatedEmail, updatedPhone, updatedLeadId, now, existing.id)
      .run();

    return mapDbRowToClient({
      ...existing,
      company: updatedCompany,
      email: updatedEmail,
      phone: updatedPhone,
      source_lead_id: updatedLeadId,
      updated_at: now,
    });
  }

  // 2. Generate custom unique formatted Client ID: CLT-YYYY-XXXXX
  const newClientId = await generateClientId(db);

  await db
    .prepare(`
      INSERT INTO clients (
        id, name, email, phone, company, address, source_lead_id, status, total_billed, total_paid, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, ?, ?)
    `)
    .bind(
      newClientId,
      cleanName,
      cleanEmail,
      cleanPhone,
      params.company?.trim() || null,
      params.address?.trim() || null,
      params.sourceLeadId || null,
      now,
      now
    )
    .run();

  return {
    id: newClientId,
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    company: params.company?.trim() || null,
    address: params.address?.trim() || null,
    sourceLeadId: params.sourceLeadId || null,
    status: 'active',
    totalBilled: 0,
    totalPaid: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getClientByIdOrName(
  db: D1Database,
  idOrName: string
): Promise<ClientDetailResponse | null> {
  const cleanTerm = idOrName.trim();

  // Find client record
  const clientRow = await db
    .prepare(`
      SELECT * FROM clients 
      WHERE id = ? OR LOWER(name) = LOWER(?)
      LIMIT 1
    `)
    .bind(cleanTerm, cleanTerm)
    .first<Record<string, unknown>>();

  if (!clientRow) {
    return null;
  }

  const clientId = String(clientRow.id);
  const clientName = String(clientRow.name);

  // Fetch real projects linked to this client
  const projectsRes = await db
    .prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as total_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as completed_tasks
      FROM projects p
      WHERE p.client_id = ? OR LOWER(p.client_name) = LOWER(?)
      ORDER BY p.created_at DESC
    `)
    .bind(clientId, clientName)
    .all<Record<string, unknown>>();

  const projects: Project[] = (projectsRes.results || []).map((row) => ({
    id: String(row.id),
    clientId: row.client_id ? String(row.client_id) : clientId,
    leadId: row.lead_id ? String(row.lead_id) : null,
    title: String(row.title),
    clientName: String(row.client_name),
    clientEmail: row.client_email ? String(row.client_email) : clientRow.email ? String(clientRow.email) : null,
    clientPhone: row.client_phone ? String(row.client_phone) : clientRow.phone ? String(clientRow.phone) : null,
    company: row.company ? String(row.company) : clientRow.company ? String(clientRow.company) : null,
    serviceType: row.service_type ? String(row.service_type) : undefined,
    budget: row.budget ? String(row.budget) : null,
    status: row.status as Project['status'],
    startDate: row.start_date ? Number(row.start_date) : null,
    targetDate: row.deadline ? Number(row.deadline) : null,
    description: row.description ? String(row.description) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    totalTasks: Number(row.total_tasks || 0),
    completedTasks: Number(row.completed_tasks || 0),
  }));

  // Fetch real payments/invoices linked to this client
  const paymentsRes = await db
    .prepare(`
      SELECT p.*, pr.title as project_title
      FROM payments p
      LEFT JOIN projects pr ON pr.id = p.project_id
      WHERE p.client_id = ? OR LOWER(p.client_name) = LOWER(?)
      ORDER BY p.created_at DESC
    `)
    .bind(clientId, clientName)
    .all<Record<string, unknown>>();

  const payments: Payment[] = (paymentsRes.results || []).map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    clientId: row.client_id ? String(row.client_id) : clientId,
    leadId: null,
    title: row.title ? String(row.title) : undefined,
    amount: Number(row.amount),
    currency: 'INR',
    status: row.status as Payment['status'],
    paymentMethod: row.payment_method ? String(row.payment_method) : null,
    invoiceNumber: row.invoice_number ? String(row.invoice_number) : null,
    dueDate: row.due_date ? Number(row.due_date) : null,
    paidAt: row.paid_at ? Number(row.paid_at) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: Number(row.created_at),
    projectTitle: row.project_title ? String(row.project_title) : undefined,
    clientName: row.client_name ? String(row.client_name) : clientName,
    clientEmail: row.client_email ? String(row.client_email) : clientRow.email ? String(clientRow.email) : null,
    clientPhone: row.client_phone ? String(row.client_phone) : clientRow.phone ? String(clientRow.phone) : null,
    company: row.company ? String(row.company) : clientRow.company ? String(clientRow.company) : null,
    razorpayPaymentLinkId: row.razorpay_payment_link_id ? String(row.razorpay_payment_link_id) : null,
    razorpayPaymentLinkUrl: row.razorpay_payment_link_url ? String(row.razorpay_payment_link_url) : null,
    razorpayPaymentId: row.razorpay_payment_id ? String(row.razorpay_payment_id) : null,
    itemsJson: row.items_json ? String(row.items_json) : null,
  }));

  // Fetch optional source lead
  let lead: Lead | null = null;
  if (clientRow.source_lead_id) {
    const leadRow = await db
      .prepare('SELECT * FROM leads WHERE id = ?')
      .bind(clientRow.source_lead_id)
      .first<Record<string, unknown>>();
    if (leadRow) {
      lead = {
        id: String(leadRow.id),
        clientId: leadRow.client_id ? String(leadRow.client_id) : clientId,
        name: String(leadRow.name),
        email: leadRow.email ? String(leadRow.email) : null,
        phone: leadRow.phone ? String(leadRow.phone) : null,
        company: leadRow.company ? String(leadRow.company) : null,
        serviceNeeded: leadRow.service_needed ? String(leadRow.service_needed) : null,
        budget: leadRow.budget ? String(leadRow.budget) : null,
        timeline: leadRow.timeline ? String(leadRow.timeline) : null,
        preferredContact: leadRow.preferred_contact ? String(leadRow.preferred_contact) : null,
        message: leadRow.message ? String(leadRow.message) : null,
        source: leadRow.source as Lead['source'],
        stage: leadRow.stage as Lead['stage'],
        lostReason: leadRow.lost_reason ? String(leadRow.lost_reason) : null,
        nextFollowUpAt: leadRow.next_follow_up_at ? Number(leadRow.next_follow_up_at) : null,
        createdAt: Number(leadRow.created_at),
        updatedAt: Number(leadRow.updated_at),
      };
    }
  }

  const client = mapDbRowToClient(clientRow);
  client.totalProjects = projects.length;
  client.activeProjects = projects.filter((p) => p.status !== 'completed').length;
  client.totalInvoices = payments.length;
  client.totalBilled = payments.reduce((sum, p) => sum + p.amount, 0);
  client.totalPaid = payments.filter((p) => p.status === 'received').reduce((sum, p) => sum + p.amount, 0);
  client.pendingAmount = Math.max(0, client.totalBilled - client.totalPaid);

  return {
    client,
    projects,
    payments,
    lead,
  };
}

