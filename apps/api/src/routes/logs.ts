import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import { requirePermission, requireSuperadmin } from '../middleware/auth.js';
import { queryAuditLogs, logAuditEvent } from '../services/auditLogService.js';

export const logsRouter = new Hono<AppContext>();

// GET /api/logs - Retrieve audit logs (Restricted to Superadmin or members with 'logs' permission)
logsRouter.get('/', requirePermission('logs'), async (c) => {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const search = c.req.query('search');
  const action = c.req.query('action');
  const entityType = c.req.query('entityType');
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : 50;
  const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!, 10) : 0;

  try {
    const data = await queryAuditLogs(db, {
      search,
      action,
      entityType,
      limit,
      offset,
    });
    return c.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Failed to query audit logs:', msg);
    return c.json({ error: 'internal_error', message: 'Failed to retrieve audit logs.' }, 500);
  }
});

// POST /api/logs/test - Superadmin ping to test live Telegram logs channel delivery
logsRouter.post('/test', requireSuperadmin, async (c) => {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const rawChatId =
    c.env.TELEGRAM_LOGS_CHAT_ID ||
    (c.env as unknown as Record<string, string>)['telegram_logs_chat_id'] ||
    c.env.TELEGRAM_CHAT_ID;
  const cleanChatId = String(rawChatId || '').replace(/["'\r\n\s]/g, '').trim();
  const cleanToken = String(c.env.TELEGRAM_BOT_TOKEN || '').replace(/["'\r\n\s]/g, '').trim();

  const isConfigured = Boolean(cleanToken && cleanChatId);

  const user = c.get('user');
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';
  const ua = c.req.header('user-agent') || 'Browser Client';

  // Do not pass executionCtx so the diagnostic directly awaits Telegram response and verifies it
  const result = await logAuditEvent(
    db,
    c.env,
    {
      actor: {
        id: user?.id,
        name: user?.name || 'Superadmin',
        email: user?.email,
        role: user?.role || 'superadmin',
      },
      action: 'SYSTEM_AUDIT_TEST',
      entityType: 'system',
      summary: 'Verified live audit logging and Telegram channel telemetry connection.',
      details: {
        channelConfigured: isConfigured,
        channelId: cleanChatId || 'missing',
        retentionPolicy: '30-Day Rolling Window',
        testTriggeredBy: user?.name || 'Superadmin',
      },
      ipAddress: ip,
      userAgent: ua,
    }
  );

  return c.json({
    success: true,
    logId: result.logId,
    telegramDelivered: result.telegramDispatched,
    telegramError: result.telegramError || null,
    message: result.telegramDispatched
      ? 'Test audit log recorded and verified delivered to Telegram logs channel.'
      : `Audit log recorded in D1, but Telegram dispatch failed: ${result.telegramError || 'Settings missing or channel not accessible'}`,
  });
});
