import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import { requireSuperadmin } from '../middleware/auth.js';
import { getDashboardOverview } from '../services/overviewService.js';

export const overviewRouter = new Hono<AppContext>();

// Require Superadmin authentication on all overview routes
overviewRouter.use('*', requireSuperadmin);

// GET /api/overview - Aggregated dashboard metrics & recent activities
overviewRouter.get('/', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  try {
    const overview = await getDashboardOverview(c.env.DB);
    return c.json(overview);
  } catch (err: unknown) {
    console.error('Failed to load dashboard overview:', err);
    return c.json({ error: 'internal_error', message: 'Failed to generate dashboard overview.' }, 500);
  }
});
