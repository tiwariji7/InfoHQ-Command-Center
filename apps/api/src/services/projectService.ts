import type { D1Database } from '@cloudflare/workers-types';
import type {
  Project,
  ProjectTask,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  ProjectDetailResponse,
} from '@infohq/shared';

function mapDbRowToProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    title: String(row.title),
    clientName: String(row.client_name),
    clientEmail: row.client_email ? String(row.client_email) : null,
    clientPhone: row.client_phone ? String(row.client_phone) : null,
    company: row.company ? String(row.company) : null,
    serviceType: String(row.service_type),
    budget: row.budget ? String(row.budget) : null,
    status: row.status as Project['status'],
    startDate: row.start_date ? Number(row.start_date) : null,
    targetDate: row.target_date ? Number(row.target_date) : null,
    description: row.description ? String(row.description) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    totalTasks: row.total_tasks !== undefined ? Number(row.total_tasks) : 0,
    completedTasks: row.completed_tasks !== undefined ? Number(row.completed_tasks) : 0,
  };
}

function mapDbRowToTask(row: Record<string, unknown>): ProjectTask {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    status: row.status as ProjectTask['status'],
    priority: row.priority as ProjectTask['priority'],
    dueDate: row.due_date ? Number(row.due_date) : null,
    completedAt: row.completed_at ? Number(row.completed_at) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function getProjects(
  db: D1Database,
  params: { status?: string; search?: string }
): Promise<Project[]> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (params.status && params.status !== 'all') {
    conditions.push('p.status = ?');
    bindings.push(params.status);
  }

  if (params.search && params.search.trim().length > 0) {
    const term = `%${params.search.trim().toLowerCase()}%`;
    conditions.push('(LOWER(p.title) LIKE ? OR LOWER(p.client_name) LIKE ? OR LOWER(p.company) LIKE ?)');
    bindings.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      p.*, 
      COUNT(t.id) as total_tasks, 
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks
    FROM projects p
    LEFT JOIN project_tasks t ON p.id = t.project_id
    ${whereClause}
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;

  const { results } = await db.prepare(sql).bind(...bindings).all<Record<string, unknown>>();
  return (results || []).map(mapDbRowToProject);
}

export async function getProjectById(
  db: D1Database,
  projectId: string
): Promise<ProjectDetailResponse | null> {
  const projectSql = `
    SELECT 
      p.*, 
      COUNT(t.id) as total_tasks, 
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks
    FROM projects p
    LEFT JOIN project_tasks t ON p.id = t.project_id
    WHERE p.id = ?
    GROUP BY p.id
  `;

  const projectRow = await db.prepare(projectSql).bind(projectId).first<Record<string, unknown>>();
  if (!projectRow) return null;

  const tasksSql = `
    SELECT * FROM project_tasks 
    WHERE project_id = ? 
    ORDER BY 
      CASE status 
        WHEN 'todo' THEN 1 
        WHEN 'in_progress' THEN 2 
        WHEN 'blocked' THEN 3 
        WHEN 'done' THEN 4 
      END ASC,
      created_at ASC
  `;

  const { results: taskRows } = await db.prepare(tasksSql).bind(projectId).all<Record<string, unknown>>();

  return {
    project: mapDbRowToProject(projectRow),
    tasks: (taskRows || []).map(mapDbRowToTask),
  };
}

export async function createProject(
  db: D1Database,
  input: CreateProjectInput,
  actorClerkUserId: string
): Promise<Project> {
  const id = `proj_${crypto.randomUUID()}`;
  const now = Date.now();

  const insertStmt = db.prepare(`
    INSERT INTO projects (
      id, lead_id, title, client_name, client_email, client_phone, company,
      service_type, budget, status, start_date, target_date, description,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    input.leadId || null,
    input.title,
    input.clientName,
    input.clientEmail || null,
    input.clientPhone || null,
    input.company || null,
    input.serviceType,
    input.budget || null,
    input.status || 'planning',
    input.startDate || null,
    input.targetDate || null,
    input.description || null,
    now,
    now
  );

  const stmts = [insertStmt];

  // If created from a lead, log an activity event in lead_activities
  if (input.leadId) {
    const activityId = `act_${crypto.randomUUID()}`;
    const activityStmt = db.prepare(`
      INSERT INTO lead_activities (
        id, lead_id, actor_clerk_user_id, activity_type, summary, before_json, after_json, created_at
      ) VALUES (?, ?, ?, 'converted_to_project', ?, NULL, ?, ?)
    `).bind(
      activityId,
      input.leadId,
      actorClerkUserId,
      `Lead converted to project: "${input.title}"`,
      JSON.stringify({ projectId: id, title: input.title, status: input.status }),
      now
    );
    stmts.push(activityStmt);
  }

  await db.batch(stmts);

  const created = await getProjectById(db, id);
  if (!created) {
    throw new Error('Project creation verification failed.');
  }
  return created.project;
}

export async function updateProject(
  db: D1Database,
  projectId: string,
  input: UpdateProjectInput
): Promise<Project | null> {
  const existing = await getProjectById(db, projectId);
  if (!existing) return null;

  const updates: string[] = [];
  const bindings: unknown[] = [];
  const now = Date.now();

  if (input.title !== undefined) {
    updates.push('title = ?');
    bindings.push(input.title);
  }
  if (input.clientName !== undefined) {
    updates.push('client_name = ?');
    bindings.push(input.clientName);
  }
  if (input.clientEmail !== undefined) {
    updates.push('client_email = ?');
    bindings.push(input.clientEmail || null);
  }
  if (input.clientPhone !== undefined) {
    updates.push('client_phone = ?');
    bindings.push(input.clientPhone || null);
  }
  if (input.company !== undefined) {
    updates.push('company = ?');
    bindings.push(input.company || null);
  }
  if (input.serviceType !== undefined) {
    updates.push('service_type = ?');
    bindings.push(input.serviceType);
  }
  if (input.budget !== undefined) {
    updates.push('budget = ?');
    bindings.push(input.budget || null);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    bindings.push(input.status);
  }
  if (input.startDate !== undefined) {
    updates.push('start_date = ?');
    bindings.push(input.startDate);
  }
  if (input.targetDate !== undefined) {
    updates.push('target_date = ?');
    bindings.push(input.targetDate);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    bindings.push(input.description || null);
  }

  if (updates.length === 0) {
    return existing.project;
  }

  updates.push('updated_at = ?');
  bindings.push(now);
  bindings.push(projectId);

  const sql = `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`;
  await db.prepare(sql).bind(...bindings).run();

  const updated = await getProjectById(db, projectId);
  return updated ? updated.project : null;
}

export async function createTask(
  db: D1Database,
  projectId: string,
  input: CreateTaskInput
): Promise<ProjectTask> {
  const id = `task_${crypto.randomUUID()}`;
  const now = Date.now();
  const completedAt = input.status === 'done' ? now : null;

  await db.prepare(`
    INSERT INTO project_tasks (
      id, project_id, title, description, status, priority, due_date, completed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    projectId,
    input.title,
    input.description || null,
    input.status || 'todo',
    input.priority || 'medium',
    input.dueDate || null,
    completedAt,
    now,
    now
  ).run();

  const row = await db.prepare('SELECT * FROM project_tasks WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!row) throw new Error('Task creation verification failed.');
  return mapDbRowToTask(row);
}

export async function updateTask(
  db: D1Database,
  projectId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<ProjectTask | null> {
  const existingRow = await db.prepare('SELECT * FROM project_tasks WHERE id = ? AND project_id = ?')
    .bind(taskId, projectId)
    .first<Record<string, unknown>>();

  if (!existingRow) return null;

  const updates: string[] = [];
  const bindings: unknown[] = [];
  const now = Date.now();

  if (input.title !== undefined) {
    updates.push('title = ?');
    bindings.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    bindings.push(input.description || null);
  }
  if (input.priority !== undefined) {
    updates.push('priority = ?');
    bindings.push(input.priority);
  }
  if (input.dueDate !== undefined) {
    updates.push('due_date = ?');
    bindings.push(input.dueDate);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    bindings.push(input.status);
    if (input.status === 'done') {
      updates.push('completed_at = ?');
      bindings.push(now);
    } else {
      updates.push('completed_at = NULL');
    }
  }

  if (updates.length === 0) {
    return mapDbRowToTask(existingRow);
  }

  updates.push('updated_at = ?');
  bindings.push(now);
  bindings.push(taskId);
  bindings.push(projectId);

  const sql = `UPDATE project_tasks SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`;
  await db.prepare(sql).bind(...bindings).run();

  const updatedRow = await db.prepare('SELECT * FROM project_tasks WHERE id = ? AND project_id = ?')
    .bind(taskId, projectId)
    .first<Record<string, unknown>>();

  return updatedRow ? mapDbRowToTask(updatedRow) : null;
}

export async function deleteTask(
  db: D1Database,
  projectId: string,
  taskId: string
): Promise<boolean> {
  const result = await db.prepare('DELETE FROM project_tasks WHERE id = ? AND project_id = ?')
    .bind(taskId, projectId)
    .run();
  return result.success;
}
