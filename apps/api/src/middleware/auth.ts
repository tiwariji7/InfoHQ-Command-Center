import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';
import type { AppContext } from '../types/env.js';
import type { AuthUser, UserRole, ModulePermissions } from '@infohq/shared';

// Default module permissions mapped by user role
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, ModulePermissions> = {
  superadmin: {
    dashboard: true,
    leads: true,
    pipeline: true,
    clients: true,
    projects: true,
    tasks: true,
    billing: true,
    team: true,
    settings: true,
    logs: true,
  },
  project_manager: {
    dashboard: true,
    leads: true,
    pipeline: true,
    clients: true,
    projects: true,
    tasks: true,
    billing: false,
    team: false,
    settings: false,
    logs: false,
  },
  sales: {
    dashboard: true,
    leads: true,
    pipeline: true,
    clients: true,
    projects: false,
    tasks: false,
    billing: false,
    team: false,
    settings: false,
    logs: false,
  },
  developer: {
    dashboard: true,
    leads: false,
    pipeline: false,
    clients: false,
    projects: true,
    tasks: true,
    billing: false,
    team: false,
    settings: false,
    logs: false,
  },
  viewer: {
    dashboard: true,
    leads: false,
    pipeline: false,
    clients: false,
    projects: false,
    tasks: false,
    billing: false,
    team: false,
    settings: false,
    logs: false,
  },
};

/**
 * Authentication Gate:
 * 1. Verifies Clerk JWT.
 * 2. Matches user against Superadmin ENV or D1 allowlisted / invited users table.
 * 3. Enforces that UNINVITED users CANNOT access the system (returns 403 Forbidden).
 */
export const requireAuth = createMiddleware<AppContext>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        error: 'unauthorized',
        message: 'Authentication token required.',
      },
      401
    );
  }

  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  if (!token) {
    return c.json(
      {
        error: 'unauthorized',
        message: 'Invalid authorization format.',
      },
      401
    );
  }

  const secretKey = c.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return c.json(
      {
        error: 'server_configuration_error',
        message: 'Authentication service is not configured properly.',
      },
      500
    );
  }

  let claims: { sub: string; email?: string } | null = null;
  try {
    const verified = await verifyToken(token, { secretKey });
    const rawClaims = verified as unknown as Record<string, unknown>;
    const extractedEmail =
      (typeof rawClaims.email === 'string' && rawClaims.email) ||
      (typeof rawClaims.email_address === 'string' && rawClaims.email_address) ||
      (typeof rawClaims.primary_email_address === 'string' && rawClaims.primary_email_address) ||
      undefined;

    claims = {
      sub: verified.sub,
      email: extractedEmail,
    };
  } catch {
    return c.json(
      {
        error: 'unauthorized',
        message: 'Invalid or expired authentication token.',
      },
      401
    );
  }

  if (!claims || !claims.sub) {
    return c.json(
      {
        error: 'unauthorized',
        message: 'Invalid user token payload.',
      },
      401
    );
  }

  const authenticatedClerkId = claims.sub;
  const configuredSuperadminId = c.env.SUPERADMIN_CLERK_USER_ID?.trim();

  let userRole: UserRole = 'viewer';
  let userName = 'Member';
  let userEmail: string | null = claims.email ? claims.email.trim() : null;
  let isAuthorized = false;
  let customPermissions: ModulePermissions | null = null;

  // If email was not embedded in token claims, fetch from Clerk User API
  if (!userEmail && secretKey) {
    try {
      const cleanClerkKey = secretKey.replace(/^['"]|['"]$/g, '').trim();
      const clerkUserRes = await fetch(`https://api.clerk.com/v1/users/${authenticatedClerkId}`, {
        headers: {
          Authorization: `Bearer ${cleanClerkKey}`,
        },
      });
      if (clerkUserRes.ok) {
        const clerkUserData = (await clerkUserRes.json()) as {
          email_addresses?: Array<{ id: string; email_address: string }>;
          primary_email_address_id?: string;
          first_name?: string;
          last_name?: string;
        };
        const primaryEmailObj =
          clerkUserData.email_addresses?.find(
            (e) => e.id === clerkUserData.primary_email_address_id
          ) || clerkUserData.email_addresses?.[0];

        if (primaryEmailObj?.email_address) {
          userEmail = primaryEmailObj.email_address.trim();
        }
        const fullName = [clerkUserData.first_name, clerkUserData.last_name]
          .filter(Boolean)
          .join(' ')
          .trim();
        if (fullName) {
          userName = fullName;
        }
      }
    } catch (err) {
      console.warn('[Clerk User API Lookup Warning]:', err);
    }
  }

  // 1. Direct Master Superadmin bypass
  if (configuredSuperadminId && authenticatedClerkId === configuredSuperadminId) {
    isAuthorized = true;
    userRole = 'superadmin';
    userName = 'Shivam Tiwari (Superadmin)';
  }

  // 2. D1 Database RBAC & Allowlist Check
  const db = c.env.DB || c.env.COMMAND_DB;
  if (db) {
    try {
      const dbUser = await db
        .prepare(
          'SELECT id, clerk_user_id, email, name, role, status, permissions_json FROM users WHERE clerk_user_id = ?'
        )
        .bind(authenticatedClerkId)
        .first<{
          id: string;
          clerk_user_id: string;
          email: string | null;
          name: string | null;
          role: string;
          status: string;
          permissions_json: string | null;
        }>();

      if (dbUser) {
        if (dbUser.status === 'suspended') {
          return c.json(
            {
              error: 'account_suspended',
              message: 'Your account has been suspended by the Superadmin.',
            },
            403
          );
        }

        isAuthorized = true;
        userRole = (dbUser.role as UserRole) || 'viewer';
        if (dbUser.name) userName = dbUser.name;
        if (dbUser.email) userEmail = dbUser.email;
        if (dbUser.permissions_json) {
          try {
            customPermissions = JSON.parse(dbUser.permissions_json);
          } catch {
            // fallback to default
          }
        }
      } else if (isAuthorized && userRole === 'superadmin') {
        // Ensure Superadmin is registered in users table for team roster listing
        const now = Date.now();
        await db
          .prepare(
            `INSERT INTO users (id, clerk_user_id, email, name, role, status, permissions_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'superadmin', 'active', '{}', ?, ?)
             ON CONFLICT(clerk_user_id) DO UPDATE SET
               name = excluded.name,
               email = excluded.email,
               role = 'superadmin',
               status = 'active',
               updated_at = excluded.updated_at`
          )
          .bind(
            `usr_${now}`,
            authenticatedClerkId,
            userEmail ? userEmail.toLowerCase() : null,
            userName,
            now,
            now
          )
          .run();
      } else if (!isAuthorized && userEmail) {
        const now = Date.now();
        // Check if there is an existing pending placeholder or if it was suspended
        const placeholderUser = await db
          .prepare('SELECT id, status FROM users WHERE clerk_user_id = ?')
          .bind(`pending_${userEmail.toLowerCase()}`)
          .first<{ id: string; status: string }>();

        if (placeholderUser && placeholderUser.status === 'suspended') {
          return c.json(
            {
              error: 'account_suspended',
              message: 'Your account has been suspended by the Superadmin.',
            },
            403
          );
        }

        // Check if there is a pending or accepted invitation for this email (must not be expired)
        const invite = await db
          .prepare(
            'SELECT id, email, name, role, permissions_json, status, expires_at FROM user_invitations WHERE LOWER(email) = LOWER(?) AND (status = "accepted" OR (status = "pending" AND expires_at > ?))'
          )
          .bind(userEmail, now)
          .first<{
            id: string;
            email: string;
            name: string;
            role: string;
            permissions_json: string;
            status: string;
            expires_at: number;
          }>();

        if (invite) {
          // Delete any temporary placeholder record before inserting
          await db
            .prepare('DELETE FROM users WHERE clerk_user_id = ? OR (clerk_user_id LIKE "pending_%" AND LOWER(email) = LOWER(?))')
            .bind(`pending_${userEmail.toLowerCase()}`, userEmail.toLowerCase())
            .run();

          // Register or link into users table with their permanent Clerk user ID
          await db
            .prepare(
              `INSERT INTO users (id, clerk_user_id, email, name, role, status, permissions_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, "active", ?, ?, ?)
               ON CONFLICT(clerk_user_id) DO UPDATE SET
                 email = excluded.email,
                 name = excluded.name,
                 role = excluded.role,
                 status = "active",
                 permissions_json = excluded.permissions_json,
                 updated_at = excluded.updated_at`
            )
            .bind(
              `usr_${now}`,
              authenticatedClerkId,
              userEmail.toLowerCase(),
              invite.name,
              invite.role,
              invite.permissions_json,
              now,
              now
            )
            .run();

          // Mark invitation as accepted
          await db
            .prepare('UPDATE user_invitations SET status = "accepted" WHERE LOWER(email) = LOWER(?)')
            .bind(userEmail.toLowerCase())
            .run();

          isAuthorized = true;
          userRole = (invite.role as UserRole) || 'viewer';
          userName = invite.name;
          if (invite.permissions_json) {
            try {
              customPermissions = JSON.parse(invite.permissions_json);
            } catch {
              // fallback
            }
          }
        }
      }
    } catch (err) {
      console.warn('[RBAC D1 Query Warning]:', err);
    }
  }

  // Strict invite gate: Reject anyone not invited or configured
  if (!isAuthorized) {
    return c.json(
      {
        error: 'forbidden',
        message: 'Access restricted: Your account is not on the invited team roster. Contact the Superadmin for an invitation.',
      },
      403
    );
  }

  const effectivePermissions = customPermissions || DEFAULT_ROLE_PERMISSIONS[userRole];

  const authUser: AuthUser = {
    id: authenticatedClerkId,
    clerkUserId: authenticatedClerkId,
    email: userEmail,
    name: userName,
    role: userRole,
    status: 'active',
    permissions: effectivePermissions,
  };

  c.set('user', authUser);
  await next();
});

/**
 * Superadmin-only gate: Enforces absolute highest authority for team invitations,
 * financial ledgers, and permission administration.
 */
export const requireSuperadmin = createMiddleware<AppContext>(async (c, next) => {
  let forbiddenResponse: Response | null = null;
  const authRejection = await requireAuth(c, async () => {
    const user = c.get('user');
    if (!user || user.role !== 'superadmin') {
      forbiddenResponse = c.json(
        {
          error: 'forbidden',
          message: 'Access restricted: Superadmin privilege required.',
        },
        403
      );
      return;
    }
    await next();
  });
  if (authRejection) return authRejection;
  if (forbiddenResponse) return forbiddenResponse;
});

/**
 * Granular module-permission middleware generator
 */
export function requirePermission(moduleKey: keyof ModulePermissions) {
  return createMiddleware<AppContext>(async (c, next) => {
    let authResponse: Response | null = null;
    const authRejection = await requireAuth(c, async () => {
      const user = c.get('user');
      if (!user) {
        authResponse = c.json({ error: 'unauthorized', message: 'User not authenticated.' }, 401);
        return;
      }
      if (user.role === 'superadmin') {
        await next();
        return;
      }
      if (user.permissions && user.permissions[moduleKey]) {
        await next();
        return;
      }
      authResponse = c.json(
        {
          error: 'forbidden',
          message: `Access restricted: You do not have permission to access the '${moduleKey}' module.`,
        },
        403
      );
    });
    if (authRejection) return authRejection;
    if (authResponse) return authResponse;
  });
}