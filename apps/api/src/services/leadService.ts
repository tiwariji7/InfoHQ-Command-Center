import type { D1Database } from '@cloudflare/workers-types';
import type {
  Lead,
  LeadActivity,
  LeadNote,
  CreateLeadInput,
  UpdateLeadStageInput,
  LeadListQuery,
  PaginatedResponse,
  DuplicateCheckResult,
} from '@infohq/shared';

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
    // Digits-only phone match
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

  // Count total query
  const countSql = `SELECT COUNT(*) as total FROM leads ${whereClause}`;
  const countStmt = db.prepare(countSql).bind(...bindings);
  const countRes = await countStmt.first<{ total: number }>();
  const total = countRes?.total || 0;

  // Data query with parameterized pagination
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
  const leadId = `lead_${crypto.randomUUID()}`;
  const activityId = `act_${crypto.randomUUID()}`;

  const leadRow = {
    id: leadId,
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
    'Lead created manually by Superadmin',
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
): Promise<{ lead: Lead; activities: LeadActivity[]; notes: LeadNote[] } | null> {
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

  return {
    lead: mapDbRowToLead(leadRow),
    activities,
    notes,
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

  const updateLeadStmt = db.prepare(`
    UPDATE leads
    SET stage = ?, lost_reason = ?, updated_at = ?
    WHERE id = ?
  `).bind(newStage, lostReason, now, leadId);

  const beforeJson = JSON.stringify({
    stage: previousStage,
    lostReason: leadRow.lost_reason || null,
  });

  const afterJson = JSON.stringify({
    stage: newStage,
    lostReason,
  });

  const summary = `Stage moved from "${previousStage}" to "${newStage}"${lostReason ? ` (Reason: ${lostReason})` : ''
    }`;

  const insertActivityStmt = db.prepare(`
    INSERT INTO lead_activities (id, lead_id, actor_clerk_user_id, activity_type, summary, before_json, after_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    activityId,
    leadId,
    actorClerkUserId,
    'stage_change',
    summary,
    beforeJson,
    afterJson,
    now
  );

  await db.batch([updateLeadStmt, insertActivityStmt]);

  return mapDbRowToLead({
    ...leadRow,
    stage: newStage,
    lost_reason: lostReason,
    updated_at: now,
  });
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
