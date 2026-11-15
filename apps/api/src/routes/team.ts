import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import { requireSuperadmin, requireAuth, DEFAULT_ROLE_PERMISSIONS } from '../middleware/auth.js';
import { InviteUserSchema, UpdateUserPermissionsSchema, UserRole } from '@infohq/shared';

export const teamRouter = new Hono<AppContext>();

// GET /api/team - List all registered team members and pending invitations (Superadmin only)
teamRouter.get('/', requireSuperadmin, async (c) => {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  try {
    const usersResult = await db
      .prepare(
        'SELECT id, clerk_user_id, email, name, role, status, permissions_json, created_at, updated_at FROM users ORDER BY created_at DESC'
      )
      .all<Record<string, unknown>>();

    const invitesResult = await db
      .prepare(
        'SELECT id, email, name, role, permissions_json, invited_by, status, created_at, expires_at FROM user_invitations WHERE status = "pending" ORDER BY created_at DESC'
      )
      .all<Record<string, unknown>>();

    const formattedUsers = (usersResult.results || []).map((row) => ({
      id: String(row.id),
      clerkUserId: String(row.clerk_user_id),
      email: row.email ? String(row.email) : null,
      name: row.name ? String(row.name) : 'Team Member',
      role: row.role as UserRole,
      status: row.status,
      permissions: row.permissions_json
        ? JSON.parse(String(row.permissions_json))
        : DEFAULT_ROLE_PERMISSIONS[(row.role as UserRole) || 'viewer'],
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    }));

    const formattedInvites = (invitesResult.results || []).map((row) => ({
      id: String(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as UserRole,
      permissions: row.permissions_json
        ? JSON.parse(String(row.permissions_json))
        : DEFAULT_ROLE_PERMISSIONS[(row.role as UserRole) || 'viewer'],
      invitedBy: String(row.invited_by),
      status: row.status,
      createdAt: Number(row.created_at),
      expiresAt: Number(row.expires_at),
    }));

    return c.json({
      members: formattedUsers,
      invitations: formattedInvites,
    });
  } catch (err: unknown) {
    console.error('Error fetching team list:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to retrieve team members.' }, 500);
  }
});

// POST /api/team/invite - Invite a team member (Superadmin only)
teamRouter.post('/invite', requireSuperadmin, async (c) => {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = InviteUserSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid invitation payload.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  const { email, name, role, permissions } = parseResult.data;
  const user = c.get('user');
  const invitedBy = user?.name || user?.email || 'Superadmin';

  const effectivePermissions = permissions || DEFAULT_ROLE_PERMISSIONS[role];
  const now = Date.now();
  const inviteId = `inv_${now}`;
  const token = `invtoken_${crypto.randomUUID()}`;
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days validity

  try {
    // 1. Insert or update user_invitations in D1
    await db
      .prepare(
        `INSERT INTO user_invitations (id, email, name, role, permissions_json, invited_by, status, token, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           name = excluded.name,
           role = excluded.role,
           permissions_json = excluded.permissions_json,
           status = 'pending',
           token = excluded.token,
           expires_at = excluded.expires_at`
      )
      .bind(
        inviteId,
        email.toLowerCase(),
        name,
        role,
        JSON.stringify(effectivePermissions),
        invitedBy,
        token,
        now,
        expiresAt
      )
      .run();

    // 2. Pre-authorize user in users table with 'invited' status
    await db
      .prepare(
        `INSERT INTO users (id, clerk_user_id, email, name, role, status, permissions_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
         ON CONFLICT(clerk_user_id) DO UPDATE SET
           name = excluded.name,
           role = excluded.role,
           permissions_json = excluded.permissions_json,
           status = 'active',
           updated_at = excluded.updated_at`
      )
      .bind(
        `usr_${now}`,
        `pending_${email.toLowerCase()}`,
        email.toLowerCase(),
        name,
        role,
        JSON.stringify(effectivePermissions),
        now,
        now
      )
      .run();

    return c.json({
      success: true,
      message: `Invitation issued for ${name} (${email}). They can now sign in with Google or Email.`,
      invitation: {
        id: inviteId,
        email,
        name,
        role,
        permissions: effectivePermissions,
        invitedBy,
        expiresAt,
      },
    }, 201);
  } catch (err: unknown) {
    console.error('Failed to issue team invitation:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to issue invitation.' }, 500);
  }
});

// PATCH /api/team/members/:id - Update member role, permissions, or suspend access (Superadmin only)
teamRouter.patch('/members/:id', requireSuperadmin, async (c) => {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const memberId = c.req.param('id');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = UpdateUserPermissionsSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'validation_error', message: 'Invalid payload.' }, 400);
  }

  const { role, status, permissions } = parseResult.data;
  const updates: string[] = [];
  const bindings: unknown[] = [];
  const now = Date.now();

  if (role !== undefined) {
    updates.push('role = ?');
    bindings.push(role);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    bindings.push(status);
  }
  if (permissions !== undefined) {
    updates.push('permissions_json = ?');
    bindings.push(JSON.stringify(permissions));
  }

  if (updates.length === 0) {
    return c.json({ message: 'No changes provided.' });
  }

  updates.push('updated_at = ?');
  bindings.push(now);
  bindings.push(memberId);

  try {
    await db
      .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ? OR clerk_user_id = ?`)
      .bind(...bindings, memberId)
      .run();

    return c.json({ success: true, message: 'Permissions successfully updated.' });
  } catch (err: unknown) {
    console.error('Failed to update member permissions:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to update member permissions.' }, 500);
  }
});

// DELETE /api/team/members/:id - Revoke and remove member from team (Superadmin only)
teamRouter.delete('/members/:id', requireSuperadmin, async (c) => {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const memberId = c.req.param('id');
  try {
    await db.prepare('DELETE FROM users WHERE id = ? OR clerk_user_id = ?').bind(memberId, memberId).run();
    return c.json({ success: true, message: 'Member access revoked.' });
  } catch (err: unknown) {
    console.error('Failed to revoke member:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to revoke member.' }, 500);
  }
});
