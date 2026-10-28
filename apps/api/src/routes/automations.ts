import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import { requireSuperadmin } from '../middleware/auth.js';
import {
  getLatestBriefingDigest,
  runMorningBriefingAndAudits,
  getAutomationAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
} from '../services/automationService.js';

export const automationsRouter = new Hono<AppContext>();

// Require Superadmin authentication on all automation routes
automationsRouter.use('*', requireSuperadmin);

// GET /api/automations/digest - Returns the current morning briefing digest
automationsRouter.get('/digest', async (c) => {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  try {
    const digest = await getLatestBriefingDigest(db, c.env);
    return c.json(digest);
  } catch (err: unknown) {
    console.error('Failed to get automation digest:', err);
    return c.json({ error: 'internal_error', message: 'Failed to generate automation digest.' }, 500);
  }
});

// POST /api/automations/run - Manually trigger an on-demand audit and briefing run
automationsRouter.post('/run', async (c) => {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  try {
    const digest = await runMorningBriefingAndAudits(db, c.env, { sendTelegram: true, persistAlerts: true });
    return c.json({ success: true, digest });
  } catch (err: unknown) {
    console.error('Failed to run on-demand automation audit:', err);
    return c.json({ error: 'internal_error', message: 'Failed to execute automation audit.' }, 500);
  }
});

// GET /api/automations/alerts - Fetch active automation alerts
automationsRouter.get('/alerts', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  try {
    const unreadOnly = c.req.query('unreadOnly') === 'true';
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const alerts = await getAutomationAlerts(c.env.DB, { unreadOnly, limit });
    return c.json({ alerts });
  } catch (err: unknown) {
    console.error('Failed to get automation alerts:', err);
    return c.json({ error: 'internal_error', message: 'Failed to fetch automation alerts.' }, 500);
  }
});

// PATCH /api/automations/alerts/:id/read - Mark an alert as read
automationsRouter.patch('/alerts/:id/read', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  try {
    const alertId = c.req.param('id');
    const success = await markAlertAsRead(c.env.DB, alertId);
    return c.json({ success });
  } catch (err: unknown) {
    console.error('Failed to mark alert as read:', err);
    return c.json({ error: 'internal_error', message: 'Failed to update alert.' }, 500);
  }
});

// POST /api/automations/alerts/read-all - Mark all alerts as read
automationsRouter.post('/alerts/read-all', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  try {
    const updatedCount = await markAllAlertsAsRead(c.env.DB);
    return c.json({ success: true, updatedCount });
  } catch (err: unknown) {
    console.error('Failed to mark all alerts as read:', err);
    return c.json({ error: 'internal_error', message: 'Failed to clear alerts.' }, 500);
  }
});

