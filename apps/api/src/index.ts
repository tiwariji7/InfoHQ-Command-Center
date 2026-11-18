import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext, Bindings } from './types/env.js';
import { requireSuperadmin, requireAuth } from './middleware/auth.js';
import { leadsRouter } from './routes/leads.js';
import { projectsRouter } from './routes/projects.js';
import { paymentsRouter } from './routes/payments.js';
import { overviewRouter } from './routes/overview.js';
import { automationsRouter } from './routes/automations.js';
import { intakeRouter } from './routes/intake.js';
import { webhooksRouter } from './routes/webhooks.js';
import { clientsRouter } from './routes/clients.js';
import { teamRouter } from './routes/team.js';
import { portalRouter } from './routes/portal.js';
import { logsRouter } from './routes/logs.js';
import { logAuditEvent } from './services/auditLogService.js';
import { runMorningBriefingAndAudits } from './services/automationService.js';
import { autoSyncPendingRazorpayPayments } from './services/billingService.js';
import type { HealthResponse, MeResponse } from '@infohq/shared';

const app = new Hono<AppContext>();

// Auto-alias COMMAND_DB to DB if COMMAND_DB is bound in Cloudflare Worker
app.use('*', async (c, next) => {
  if (c.env && !c.env.DB && c.env.COMMAND_DB) {
    c.env.DB = c.env.COMMAND_DB;
  }
  await next();
});

// CORS configuration for local frontend and production origin
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      if (!origin) return '*';
      if (origin.startsWith('http://localhost:')) return origin;
      if (origin.endsWith('.infohq.in') || origin === 'https://infohq.in') return origin;
      return null;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-intake-secret', 'x-razorpay-signature'],
    maxAge: 86400,
  })
);

// Global Error Handler
app.onError((err, c) => {
  // Safe logging without leaking secrets or PII
  console.error(`[API Error] ${c.req.method} ${c.req.path}:`, err.message);
  return c.json(
    {
      error: 'internal_server_error',
      message: 'An unexpected error occurred. Please try again.',
    },
    500
  );
});

// 404 Handler
app.notFound((c) => {
  return c.json(
    {
      error: 'not_found',
      message: `Route ${c.req.method} ${c.req.path} not found.`,
    },
    404
  );
});

// Public health check
app.get('/api/health', (c) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  };
  return c.json(response);
});

// Public auth configuration (exposes ONLY client-safe Clerk Publishable Key from Cloudflare environment)
app.get('/api/auth/config', (c) => {
  const publishableKey = (
    c.env?.VITE_CLERK_PUBLISHABLE_KEY ||
    c.env?.CLERK_PUBLISHABLE_KEY ||
    'pk_live_Y2xlcmsuaW5mb2hxLmluJA'
  ).trim();
  return c.json({ publishableKey });
});

// Protected: User identity and permissions check (checks allowlist & RBAC)
app.get('/api/me', requireAuth, (c) => {
  const user = c.get('user');
  const response: MeResponse = {
    authenticated: true,
    user,
  };
  return c.json(response);
});

// Protected: Log user login event with IP, device, and timestamp
app.post('/api/auth/log-session', requireAuth, async (c) => {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable' }, 503);
  }
  const user = c.get('user');
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
  const ua = c.req.header('user-agent') || 'Browser Client';

  await logAuditEvent(
    db,
    c.env,
    {
      actor: {
        id: user?.id,
        name: user?.name || user?.email || 'Authenticated User',
        email: user?.email,
        role: user?.role || 'viewer',
      },
      action: 'USER_LOGIN',
      entityType: 'auth',
      entityId: user?.id,
      entityName: user?.email || user?.name,
      summary: `${user?.name || user?.email} signed in to InfoHQ Command Center`,
      details: {
        role: user?.role,
        clerkUserId: user?.clerkUserId,
        email: user?.email,
      },
      ipAddress: ip,
      userAgent: ua,
    },
    c.executionCtx
  );

  return c.json({ success: true });
});

// Protected: Log user logout event
app.post('/api/auth/log-logout', requireAuth, async (c) => {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable' }, 503);
  }
  const user = c.get('user');
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
  const ua = c.req.header('user-agent') || 'Browser Client';

  await logAuditEvent(
    db,
    c.env,
    {
      actor: {
        id: user?.id,
        name: user?.name || user?.email || 'Authenticated User',
        email: user?.email,
        role: user?.role || 'viewer',
      },
      action: 'USER_LOGOUT',
      entityType: 'auth',
      entityId: user?.id,
      entityName: user?.email || user?.name,
      summary: `${user?.name || user?.email} signed out of InfoHQ Command Center`,
      details: {
        role: user?.role,
        clerkUserId: user?.clerkUserId,
      },
      ipAddress: ip,
      userAgent: ua,
    },
    c.executionCtx
  );

  return c.json({ success: true });
});

// Public: Website and landing page inbound lead intake webhook
app.route('/api/intake', intakeRouter);

// Public: Client Portal (Token magic link gated, no login required for client)
app.route('/api/portal', portalRouter);

// Public: Razorpay & external payment webhooks (supports all common URL variants)
app.route('/api/webhooks', webhooksRouter);
app.route('/api/webhook', webhooksRouter);
app.route('/webhooks', webhooksRouter);
app.route('/webhook', webhooksRouter);
app.route('/api/razorpay', webhooksRouter);
app.route('/razorpay', webhooksRouter);

// Protected: Leads core router
app.route('/api/leads', leadsRouter);

// Protected: Clients master router
app.route('/api/clients', clientsRouter);

// Protected: Projects and tasks router
app.route('/api/projects', projectsRouter);

// Protected: Payments and milestone billing router
app.route('/api/payments', paymentsRouter);

// Protected: Dashboard overview and analytics router
app.route('/api/overview', overviewRouter);

// Protected: Automations, daily briefing & alerts router
app.route('/api/automations', automationsRouter);

// Protected: Team members and RBAC management router (Superadmin only)
app.route('/api/team', teamRouter);

// Protected: Enterprise Audit Logs router (Superadmin & authorized members)
app.route('/api/logs', logsRouter);

// Export Cloudflare Worker fetch & scheduled cron handler
export default {
  fetch: app.fetch,
  async scheduled(
    event: { cron: string },
    env: Bindings,
    ctx: { waitUntil: (promise: Promise<unknown>) => void }
  ) {
    console.log(`[Cloudflare Cron] Scheduled trigger: ${event.cron} at ${new Date().toISOString()}`);
    const db = env.DB || env.COMMAND_DB;
    if (!db) {
      console.error('[Cloudflare Cron] Database binding not found.');
      return;
    }

    ctx.waitUntil(
      Promise.all([
        runMorningBriefingAndAudits(db, env, { sendTelegram: true, persistAlerts: true }),
        autoSyncPendingRazorpayPayments(db, env, ctx),
      ])
        .then(() => console.log('[Cloudflare Cron] Daily morning briefing & payment sync completed.'))
        .catch((err) => console.error('[Cloudflare Cron] Cron task failed:', err))
    );
  },
};
