import type { D1Database } from '@cloudflare/workers-types';
import type {
  Lead,
  LeadActivity,
  LeadNote,
  LeadStatusHistory,
  CreateLeadInput,
  UpdateLeadStageInput,
  LeadListQuery,
  PaginatedResponse,
  DuplicateCheckResult,
  Client,
  Project,
  Payment,
} from '@infohq/shared';
import { generateLeadId } from '../utils/idGenerator.js';
import { createOrGetClient, getClientByIdOrName } from './clientService.js';

export class DuplicateLeadError extends Error {
  matches: DuplicateCheckResult['matches'];
  constructor(matches: DuplicateCheckResult['matches']) {
    super('Potential duplicate lead detected.');
    this.name = 'DuplicateLeadError';
    this.matches = matches;
  }
}

// Convert DB snake_case row to camelCase Lead object
function mapDbRowToLead(row: Record<string, unknown>): Lead {
  return {
    id: String(row.id),
    clientId: row.client_id ? String(row.client_id) : null,
    name: String(row.name),
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    company: row.company ? String(row.company) : null,
    serviceNeeded: row.service_needed ? String(row.service_needed) : null,
    budget: row.budget ? String(row.budget) : null,
    timeline: row.timeline ? String(row.timeline) : null,
    preferredContact: row.preferred_contact ? String(row.preferred_contact) : null,
    message: row.message ? String(row.message) : null,
    source: row.source as Lead['source'],
    stage: row.stage as Lead['stage'],
    lostReason: row.lost_reason ? String(row.lost_reason) : null,
    nextFollowUpAt: row.next_follow_up_at ? Number(row.next_follow_up_at) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function checkDuplicate(
  db: D1Database,
  params: { email?: string | null; phone?: string | null; excludeLeadId?: string }
): Promise<DuplicateCheckResult> {
  const { email, phone, excludeLeadId } = params;
  if (!email && !phone) {
    return { hasDuplicate: false, matches: [] };
  }

  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (email && email.trim().length > 0) {
    conditions.push('LOWER(email) = LOWER(?)');
    bindings.push(email.trim());
  }

  if (phone && phone.trim().length > 0) {
    const cleanPhone = phone.replace(/\D/g, '');
    conditions.push('REPLACE(REPLACE(REPLACE(phone, " ", ""), "-", ""), "+", "") LIKE ?');
    bindings.push(`%${cleanPhone}%`);
  }

  let sql = `SELECT id, name, email, phone, stage FROM leads WHERE (${conditions.join(' OR ')})`;
  if (excludeLeadId) {
    sql += ' AND id != ?';
    bindings.push(excludeLeadId);
  }
  sql += ' LIMIT 5';

  const stmt = db.prepare(sql).bind(...bindings);
  const { results } = await stmt.all<Record<string, unknown>>();

  const matches = (results || []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    email: r.email ? String(r.email) : null,
    phone: r.phone ? String(r.phone) : null,
    stage: r.stage as Lead['stage'],
  }));

  return {
    hasDuplicate: matches.length > 0,
    matches,
  };
}

export async function getLeads(
  db: D1Database,
  query: LeadListQuery
): Promise<PaginatedResponse<Lead>> {
  const { page, pageSize, stage, source, search } = query;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (stage) {
    conditions.push('stage = ?');
    bindings.push(stage);
  }

  if (source) {
    conditions.push('source = ?');
    bindings.push(source);
  }

  if (search && search.trim().length > 0) {
    conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
    const searchTerm = `%${search.trim()}%`;
    bindings.push(searchTerm, searchTerm, searchTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM leads ${whereClause}`;
  const countStmt = db.prepare(countSql).bind(...bindings);
  const countRes = await countStmt.first<{ total: number }>();
  const total = countRes?.total || 0;

  const dataSql = `SELECT * FROM leads ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const dataStmt = db.prepare(dataSql).bind(...bindings, pageSize, offset);
  const { results } = await dataStmt.all<Record<string, unknown>>();

  const leads = (results || []).map(mapDbRowToLead);
  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    data: leads,
    pagination: {
      total,
      page,
      pageSize,
      totalPages,
    },
  };
}

export async function createLead(
  db: D1Database,
  input: CreateLeadInput,
  actorClerkUserId: string
): Promise<Lead> {
  const normalizedEmail = input.email && input.email.trim().length > 0 ? input.email.trim().toLowerCase() : null;
  const normalizedPhone = input.phone && input.phone.trim().length > 0 ? input.phone.trim() : null;

  // Check duplicate unless explicitly confirmed
  if (!input.confirmDuplicate && (normalizedEmail || normalizedPhone)) {
    const dupCheck = await checkDuplicate(db, { email: normalizedEmail, phone: normalizedPhone });
    if (dupCheck.hasDuplicate) {
      throw new DuplicateLeadError(dupCheck.matches);
    }
  }

  const now = Date.now();
  // Formatted ID: LD-YYYY-XXXXX (e.g., LD-2026-00001)
  const leadId = await generateLeadId(db);
  const activityId = `act_${crypto.randomUUID()}`;

  const leadRow = {
    id: leadId,
    client_id: null as string | null,
    name: input.name.trim(),
    email: normalizedEmail,
    phone: normalizedPhone,
    company: input.company?.trim() || null,
    service_needed: input.serviceNeeded?.trim() || null,
    budget: input.budget?.trim() || null,
    timeline: input.timeline?.trim() || null,
    preferred_contact: input.preferredContact?.trim() || null,
    message: input.message?.trim() || null,
    source: input.source,
    stage: input.stage,
    lost_reason: null as string | null,
    next_follow_up_at: input.nextFollowUpAt || null,
    created_at: now,
    updated_at: now,
  };

  const insertLeadStmt = db.prepare(`
    INSERT INTO leads (
      id, name, email, phone, company, service_needed, budget, timeline, preferred_contact, message, source, stage, next_follow_up_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    leadRow.id,
    leadRow.name,
    leadRow.email,
    leadRow.phone,
    leadRow.company,
    leadRow.service_needed,
    leadRow.budget,
    leadRow.timeline,
    leadRow.preferred_contact,
    leadRow.message,
    leadRow.source,
    leadRow.stage,
    leadRow.next_follow_up_at,
    leadRow.created_at,
    leadRow.updated_at
  );

  const afterJson = JSON.stringify({
    id: leadRow.id,
    name: leadRow.name,
    email: leadRow.email,
    phone: leadRow.phone,
    company: leadRow.company,
    source: leadRow.source,
    stage: leadRow.stage,
  });

  const insertActivityStmt = db.prepare(`
    INSERT INTO lead_activities (id, lead_id, actor_clerk_user_id, activity_type, summary, before_json, after_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    activityId,
    leadId,
    actorClerkUserId,
    'created',
    `Lead ${leadId} created manually by Superadmin`,
    null,
    afterJson,
    now
  );

  // Atomic batch execution
  await db.batch([insertLeadStmt, insertActivityStmt]);

  return mapDbRowToLead(leadRow);
}

export async function getLeadById(
  db: D1Database,
  leadId: string
): Promise<{
  lead: Lead;
  activities: LeadActivity[];
  notes: LeadNote[];
  statusHistory?: LeadStatusHistory[];
} | null> {
  const leadRow = await db
    .prepare('SELECT * FROM leads WHERE id = ?')
    .bind(leadId)
    .first<Record<string, unknown>>();

  if (!leadRow) return null;

  const activitiesRows = await db
    .prepare('SELECT * FROM lead_activities WHERE lead_id = ? ORDER BY created_at DESC')
    .bind(leadId)
    .all<Record<string, unknown>>();

  const notesRows = await db
    .prepare('SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC')
    .bind(leadId)
    .all<Record<string, unknown>>();

  // Fetch status transition history
  let historyRows: { results?: Record<string, unknown>[] } = { results: [] };
  try {
    historyRows = await db
      .prepare('SELECT * FROM lead_status_history WHERE lead_id = ? ORDER BY created_at DESC')
      .bind(leadId)
      .all<Record<string, unknown>>();
  } catch {
    // If table not yet queried
  }

  const activities: LeadActivity[] = (activitiesRows.results || []).map((r) => ({
    id: String(r.id),
    leadId: String(r.lead_id),
    actorClerkUserId: String(r.actor_clerk_user_id),
    activityType: String(r.activity_type),
    summary: String(r.summary),
    beforeJson: r.before_json ? String(r.before_json) : null,
    afterJson: r.after_json ? String(r.after_json) : null,
    createdAt: Number(r.created_at),
  }));

  const notes: LeadNote[] = (notesRows.results || []).map((r) => ({
    id: String(r.id),
    leadId: String(r.lead_id),
    body: String(r.body),
    createdByClerkUserId: String(r.created_by_clerk_user_id),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  }));

  const statusHistory: LeadStatusHistory[] = (historyRows.results || []).map((r) => ({
    id: String(r.id),
    leadId: String(r.lead_id),
    oldStatus: String(r.old_status),
    newStatus: String(r.new_status),
    reasonLost: r.reason_lost ? String(r.reason_lost) : null,
    actorId: r.actor_id ? String(r.actor_id) : null,
    createdAt: Number(r.created_at),
  }));

  return {
    lead: mapDbRowToLead(leadRow),
    activities,
    notes,
    statusHistory,
  };
}

export async function updateLeadStage(
  db: D1Database,
  leadId: string,
  input: UpdateLeadStageInput,
  actorClerkUserId: string
): Promise<Lead | null> {
  const leadRow = await db
    .prepare('SELECT * FROM leads WHERE id = ?')
    .bind(leadId)
    .first<Record<string, unknown>>();

  if (!leadRow) {
    return null;
  }

  const previousStage = leadRow.stage as Lead['stage'];
  const newStage = input.stage;
  const lostReason = newStage === 'lost' ? (input.lostReason?.trim() || null) : null;
  const now = Date.now();
  const activityId = `act_${crypto.randomUUID()}`;
  const historyId = `lsh_${crypto.randomUUID()}`;

  let assignedClientId = leadRow.client_id ? String(leadRow.client_id) : null;

  // If newly converted to WON and has no client_id, auto-generate & link Client record
  if (newStage === 'won' && !assignedClientId) {
    try {
      const client = await createOrGetClient(db, {
        name: String(leadRow.name),
        email: leadRow.email ? String(leadRow.email) : null,
        phone: leadRow.phone ? String(leadRow.phone) : null,
        company: leadRow.company ? String(leadRow.company) : null,
        sourceLeadId: leadId,
      });
      assignedClientId = client.id;
    } catch (err) {
      console.error('[updateLeadStage] Failed to create or link client:', err);
    }
  }

  const batchStmts: any[] = [];

  // 1. Update lead with new stage, lost reason, and client_id
  batchStmts.push(
    db.prepare(`
      UPDATE leads
      SET stage = ?, lost_reason = ?, client_id = COALESCE(?, client_id), updated_at = ?
      WHERE id = ?
    `).bind(newStage, lostReason, assignedClientId, now, leadId)
  );

  // 2. Insert into lead_status_history table
  try {
    batchStmts.push(
      db.prepare(`
        INSERT INTO lead_status_history (id, lead_id, old_status, new_status, reason_lost, actor_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(historyId, leadId, previousStage, newStage, lostReason, actorClerkUserId, now)
    );
  } catch {
    // Graceful fallback
  }

  // 3. Insert into lead_activities
  const summary = `Stage moved from "${previousStage}" to "${newStage}"${
    lostReason ? ` (Reason: ${lostReason})` : ''
  }${assignedClientId ? ` [Linked Client: ${assignedClientId}]` : ''}`;

  batchStmts.push(
    db.prepare(`
      INSERT INTO lead_activities (id, lead_id, actor_clerk_user_id, activity_type, summary, before_json, after_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      activityId,
      leadId,
      actorClerkUserId,
      'stage_change',
      summary,
      JSON.stringify({ stage: previousStage, lostReason: leadRow.lost_reason || null }),
      JSON.stringify({ stage: newStage, lostReason, clientId: assignedClientId }),
      now
    )
  );

  await db.batch(batchStmts);

  return mapDbRowToLead({
    ...leadRow,
    stage: newStage,
    lost_reason: lostReason,
    client_id: assignedClientId,
    updated_at: now,
  });
}

export async function getLeadRelatedData(
  db: D1Database,
  leadId: string
): Promise<{
  client: Client | null;
  projects: Project[];
  payments: Payment[];
}> {
  const leadRow = await db
    .prepare('SELECT * FROM leads WHERE id = ?')
    .bind(leadId)
    .first<Record<string, unknown>>();

  if (!leadRow) {
    return { client: null, projects: [], payments: [] };
  }

  const clientId = leadRow.client_id ? String(leadRow.client_id) : null;
  const leadName = String(leadRow.name);

  // Fetch client details if client exists
  let client: Client | null = null;
  if (clientId) {
    const detail = await getClientByIdOrName(db, clientId);
    client = detail?.client || null;
  } else {
    // Try matching by name
    const detail = await getClientByIdOrName(db, leadName);
    client = detail?.client || null;
  }

  // Fetch projects linked by lead_id or client_id
  const projectsRes = await db
    .prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as total_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as completed_tasks
      FROM projects p
      WHERE p.lead_id = ? OR (p.client_id IS NOT NULL AND p.client_id = ?) OR LOWER(p.client_name) = LOWER(?)
      ORDER BY p.created_at DESC
    `)
    .bind(leadId, clientId || '', leadName)
    .all<Record<string, unknown>>();

  const projects: Project[] = (projectsRes.results || []).map((row) => ({
    id: String(row.id),
    clientId: row.client_id ? String(row.client_id) : clientId,
    leadId: row.lead_id ? String(row.lead_id) : leadId,
    title: String(row.title),
    clientName: String(row.client_name),
    clientEmail: row.client_email ? String(row.client_email) : null,
    clientPhone: row.client_phone ? String(row.client_phone) : null,
    company: row.company ? String(row.company) : null,
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

  // Fetch payments
  const projectIds = projects.map((p) => p.id);
  let payments: Payment[] = [];

  if (projectIds.length > 0) {
    const placeholders = projectIds.map(() => '?').join(',');
    const paymentsRes = await db
      .prepare(`
        SELECT p.*, pr.title as project_title
        FROM payments p
        LEFT JOIN projects pr ON pr.id = p.project_id
        WHERE p.project_id IN (${placeholders}) OR p.client_id = ? OR LOWER(p.client_name) = LOWER(?)
        ORDER BY p.created_at DESC
      `)
      .bind(...projectIds, clientId || '', leadName)
      .all<Record<string, unknown>>();

    payments = (paymentsRes.results || []).map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      clientId: row.client_id ? String(row.client_id) : clientId,
      leadId,
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
      clientName: row.client_name ? String(row.client_name) : leadName,
      clientEmail: row.client_email ? String(row.client_email) : null,
      clientPhone: row.client_phone ? String(row.client_phone) : null,
      company: row.company ? String(row.company) : null,
      razorpayPaymentLinkId: row.razorpay_payment_link_id ? String(row.razorpay_payment_link_id) : null,
      razorpayPaymentLinkUrl: row.razorpay_payment_link_url ? String(row.razorpay_payment_link_url) : null,
      razorpayPaymentId: row.razorpay_payment_id ? String(row.razorpay_payment_id) : null,
      itemsJson: row.items_json ? String(row.items_json) : null,
    }));
  }

  return {
    client,
    projects,
    payments,
  };
}

export async function addLeadNote(
  db: D1Database,
  leadId: string,
  body: string,
  actorClerkUserId: string
): Promise<LeadNote | null> {
  const lead = await db.prepare('SELECT id FROM leads WHERE id = ?').bind(leadId).first();
  if (!lead) return null;

  const now = Date.now();
  const noteId = `note_${crypto.randomUUID()}`;
  const activityId = `act_${crypto.randomUUID()}`;

  const insertNoteStmt = db.prepare(`
    INSERT INTO lead_notes (id, lead_id, body, created_by_clerk_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(noteId, leadId, body.trim(), actorClerkUserId, now, now);

  const insertActivityStmt = db.prepare(`
    INSERT INTO lead_activities (id, lead_id, actor_clerk_user_id, activity_type, summary, before_json, after_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    activityId,
    leadId,
    actorClerkUserId,
    'note_added',
    'Added an internal note',
    null,
    JSON.stringify({ body: body.trim() }),
    now
  );

  await db.batch([insertNoteStmt, insertActivityStmt]);

  return {
    id: noteId,
    leadId,
    body: body.trim(),
    createdByClerkUserId: actorClerkUserId,
    createdAt: now,
    updatedAt: now,
  };
}

export async function setLeadFollowUp(
  db: D1Database,
  leadId: string,
  nextFollowUpAt: number | null,
  actorClerkUserId: string
): Promise<Lead | null> {
  const leadRow = await db
    .prepare('SELECT * FROM leads WHERE id = ?')
    .bind(leadId)
    .first<Record<string, unknown>>();

  if (!leadRow) return null;

  const now = Date.now();
  const activityId = `act_${crypto.randomUUID()}`;

  const updateLeadStmt = db.prepare(`
    UPDATE leads SET next_follow_up_at = ?, updated_at = ? WHERE id = ?
  `).bind(nextFollowUpAt, now, leadId);

  const summary = nextFollowUpAt
    ? `Follow-up scheduled for ${new Date(nextFollowUpAt).toLocaleDateString()}`
    : 'Follow-up cleared';

  const insertActivityStmt = db.prepare(`
    INSERT INTO lead_activities (id, lead_id, actor_clerk_user_id, activity_type, summary, before_json, after_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    activityId,
    leadId,
    actorClerkUserId,
    'follow_up_changed',
    summary,
    JSON.stringify({ nextFollowUpAt: leadRow.next_follow_up_at }),
    JSON.stringify({ nextFollowUpAt }),
    now
  );

  await db.batch([updateLeadStmt, insertActivityStmt]);

  return mapDbRowToLead({
    ...leadRow,
    next_follow_up_at: nextFollowUpAt,
    updated_at: now,
  });
}
