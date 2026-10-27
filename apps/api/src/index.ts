import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext } from './types/env.js';
import { requireSuperadmin } from './middleware/auth.js';
import { leadsRouter } from './routes/leads.js';
import { projectsRouter } from './routes/projects.js';
import { paymentsRouter } from './routes/payments.js';
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

export default app;
