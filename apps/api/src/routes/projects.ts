import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import { requireSuperadmin } from '../middleware/auth.js';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
} from '@infohq/shared';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  createTask,
  updateTask,
  deleteTask,
} from '../services/projectService.js';

export const projectsRouter = new Hono<AppContext>();

// Require Superadmin authentication on all project routes
projectsRouter.use('*', requireSuperadmin);

// GET /api/projects - List projects with optional status and search filter
projectsRouter.get('/', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const status = c.req.query('status');
  const search = c.req.query('search');

  try {
    const projects = await getProjects(c.env.DB, { status, search });
    return c.json({ projects });
  } catch (err: unknown) {
    console.error('Error fetching projects:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to retrieve projects.' }, 500);
  }
});

// GET /api/projects/all-tasks - Get aggregated tasks across all projects with project context
projectsRouter.get('/all-tasks', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  try {
    const sql = `
      SELECT 
        t.id,
        t.project_id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.completed_at,
        t.created_at,
        t.updated_at,
        p.title as project_title,
        p.client_name as client_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      ORDER BY 
        CASE 
          WHEN t.status = 'in_progress' THEN 1
          WHEN t.status = 'todo' THEN 2
          ELSE 3
        END,
        t.updated_at DESC
    `;
    const { results } = await c.env.DB.prepare(sql).all<Record<string, unknown>>();
    const formattedTasks = (results || []).map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      title: String(row.title),
      description: row.description ? String(row.description) : null,
      status: row.status,
      priority: row.priority || 'medium',
      dueDate: row.due_date ? Number(row.due_date) : null,
      completedAt: row.completed_at ? Number(row.completed_at) : null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      project_title: row.project_title ? String(row.project_title) : undefined,
      client_name: row.client_name ? String(row.client_name) : undefined,
    }));
    return c.json({ tasks: formattedTasks });
  } catch (err: unknown) {
    console.error('Error fetching all tasks:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to retrieve tasks.' }, 500);
  }
});

// POST /api/projects - Create a new project (optionally converted from a lead)
projectsRouter.post('/', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = CreateProjectSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid project fields.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  const user = c.get('user');

  try {
    const project = await createProject(c.env.DB, parseResult.data, user?.clerkUserId || 'superadmin');
    return c.json({ project }, 201);
  } catch (err: unknown) {
    console.error('Error creating project:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to create project.' }, 500);
  }
});

// GET /api/projects/:id - Get project details with full task list
projectsRouter.get('/:id', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const projectId = c.req.param('id');
  try {
    const data = await getProjectById(c.env.DB, projectId);
    if (!data) {
      return c.json({ error: 'not_found', message: 'Project not found.' }, 404);
    }
    return c.json(data);
  } catch (err: unknown) {
    console.error('Error fetching project detail:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to retrieve project details.' }, 500);
  }
});

// PATCH /api/projects/:id - Update project fields or status
projectsRouter.patch('/:id', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const projectId = c.req.param('id');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = UpdateProjectSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid update payload.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  try {
    const updated = await updateProject(c.env.DB, projectId, parseResult.data);
    if (!updated) {
      return c.json({ error: 'not_found', message: 'Project not found.' }, 404);
    }
    return c.json({ project: updated });
  } catch (err: unknown) {
    console.error('Error updating project:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to update project.' }, 500);
  }
});

// POST /api/projects/:id/tasks - Add a task to project
projectsRouter.post('/:id/tasks', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const projectId = c.req.param('id');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = CreateTaskSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid task payload.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  try {
    const task = await createTask(c.env.DB, projectId, parseResult.data);
    return c.json({ task }, 201);
  } catch (err: unknown) {
    console.error('Error creating task:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to create task.' }, 500);
  }
});

// PATCH /api/projects/:id/tasks/:taskId - Update a task (status, priority, title, etc.)
projectsRouter.patch('/:id/tasks/:taskId', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const projectId = c.req.param('id');
  const taskId = c.req.param('taskId');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = UpdateTaskSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid task update payload.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  try {
    const updated = await updateTask(c.env.DB, projectId, taskId, parseResult.data);
    if (!updated) {
      return c.json({ error: 'not_found', message: 'Task not found.' }, 404);
    }
    return c.json({ task: updated });
  } catch (err: unknown) {
    console.error('Error updating task:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to update task.' }, 500);
  }
});

// DELETE /api/projects/:id/tasks/:taskId - Delete a task
projectsRouter.delete('/:id/tasks/:taskId', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const projectId = c.req.param('id');
  const taskId = c.req.param('taskId');

  try {
    const success = await deleteTask(c.env.DB, projectId, taskId);
    return c.json({ success });
  } catch (err: unknown) {
    console.error('Error deleting task:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to delete task.' }, 500);
  }
});
