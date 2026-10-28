import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext, Bindings } from './types/env.js';
import { requireSuperadmin } from './middleware/auth.js';
import { leadsRouter } from './routes/leads.js';
import { projectsRouter } from './routes/projects.js';
import { paymentsRouter } from './routes/payments.js';
import { overviewRouter } from './routes/overview.js';
import { automationsRouter } from './routes/automations.js';
import { runMorningBriefingAndAudits } from './services/automationService.js';
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
    allowHeaders: ['Content-Type', 'Authorization', 'x-intake-secret'],
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
    ''
  ).trim();
  return c.json({ publishableKey });
});

// Protected: Superadmin identity check
app.get('/api/me', requireSuperadmin, (c) => {
  const user = c.get('user');
  const response: MeResponse = {
    authenticated: true,
    user,
  };
  return c.json(response);
});

// Protected: Leads core router
app.route('/api/leads', leadsRouter);

// Protected: Projects and tasks router
app.route('/api/projects', projectsRouter);

// Protected: Payments and milestone billing router
app.route('/api/payments', paymentsRouter);

// Protected: Dashboard overview and analytics router
app.route('/api/overview', overviewRouter);

// Protected: Automations, daily briefing & alerts router
app.route('/api/automations', automationsRouter);

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
      runMorningBriefingAndAudits(db, env)
        .then(() => console.log('[Cloudflare Cron] Daily morning briefing & audit completed.'))
        .catch((err) => console.error('[Cloudflare Cron] Audit failed:', err))
    );
  },
};
