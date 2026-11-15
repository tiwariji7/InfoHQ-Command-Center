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
    claims = {
      sub: verified.sub,
      email: (verified as unknown as { email?: string }).email,
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
  let userEmail: string | null = claims.email || null;
  let isAuthorized = false;
  let customPermissions: ModulePermissions | null = null;

  // 1. Direct Master Superadmin bypass
  if (configuredSuperadminId && authenticatedClerkId === configuredSuperadminId) {
    isAuthorized = true;
    userRole = 'superadmin';
    userName = 'Shivam Tiwari (Superadmin)';
  }

  // 1.1 If userEmail is not in token claims, fetch user email from Clerk backend API
  if (!userEmail && secretKey) {
    try {
      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${authenticatedClerkId}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (clerkRes.ok) {
        const clerkUserData = (await clerkRes.json()) as {
          first_name?: string;
          last_name?: string;
          email_addresses?: Array<{ email_address: string; id: string }>;
          primary_email_address_id?: string;
        };
        const primary = clerkUserData.email_addresses?.find(
          (e) => e.id === clerkUserData.primary_email_address_id
        ) || clerkUserData.email_addresses?.[0];
        if (primary?.email_address) {
          userEmail = primary.email_address;
        }
        if (clerkUserData.first_name) {
          userName = `${clerkUserData.first_name} ${clerkUserData.last_name || ''}`.trim();
        }
      }
    } catch (clerkErr) {
      console.warn('[Clerk User Fetch Notice]:', clerkErr);
    }
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
      } else if (!isAuthorized && userEmail) {
        // Check if there is an accepted invitation for this email
        const invite = await db
          .prepare(
            'SELECT id, email, name, role, permissions_json, status FROM user_invitations WHERE LOWER(email) = LOWER(?) AND status = "accepted"'
          )
          .bind(userEmail)
          .first<{
            id: string;
            email: string;
            name: string;
            role: string;
            permissions_json: string;
            status: string;
          }>();

        if (invite) {
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

          // Register into users table
          const now = Date.now();
          await db
            .prepare(
              'INSERT INTO users (id, clerk_user_id, email, name, role, status, permissions_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, "active", ?, ?, ?)'
            )
            .bind(
              `usr_${now}`,
              authenticatedClerkId,
              userEmail,
              userName,
              userRole,
              invite.permissions_json,
              now,
              now
            )
            .run();
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
  const authResult = await requireAuth(c, async () => {
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
  if (authResult) return authResult;
  if (forbiddenResponse) return forbiddenResponse;
});

/**
 * Granular module-permission middleware generator
 */
export function requirePermission(moduleKey: keyof ModulePermissions) {
  return createMiddleware<AppContext>(async (c, next) => {
    let authResponse: Response | null = null;
    const authResult = await requireAuth(c, async () => {
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
    if (authResult) return authResult;
    if (authResponse) return authResponse;
  });
}
