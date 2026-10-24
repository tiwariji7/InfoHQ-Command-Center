import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';
import type { AppContext } from '../types/env.js';
import type { AuthUser } from '@infohq/shared';

export const requireSuperadmin = createMiddleware<AppContext>(async (c, next) => {
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
    // Fail closed if secrets are missing in worker environment
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
    const verified = await verifyToken(token, {
      secretKey,
    });
    claims = {
      sub: verified.sub,
      email: (verified as unknown as { email?: string }).email,
    };
  } catch (err) {
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

  // Allowlist verification: check against environment allowlist or D1 users table
  let isSuperadmin = false;
  let userEmail: string | null = claims.email || null;

  if (configuredSuperadminId && authenticatedClerkId === configuredSuperadminId) {
    isSuperadmin = true;
  }

  // Also query D1 if DB binding exists
  if (c.env.DB) {
    try {
      const dbUser = await c.env.DB.prepare(
        'SELECT id, clerk_user_id, email, role, status FROM users WHERE clerk_user_id = ? AND role = "superadmin" AND status = "active"'
      )
        .bind(authenticatedClerkId)
        .first<{ id: string; clerk_user_id: string; email: string | null; role: string; status: string }>();

      if (dbUser) {
        isSuperadmin = true;
        if (dbUser.email) {
          userEmail = dbUser.email;
        }
      }
    } catch {
      // If table is not yet initialized or query fails, rely only on configuredSuperadminId
    }
  }

  if (!isSuperadmin) {
    return c.json(
      {
        error: 'forbidden',
        message: 'Access restricted: account is not authorized as Superadmin.',
      },
      403
    );
  }

  const authUser: AuthUser = {
    id: authenticatedClerkId,
    clerkUserId: authenticatedClerkId,
    email: userEmail,
    role: 'superadmin',
    status: 'active',
  };

  c.set('user', authUser);
  await next();
});
