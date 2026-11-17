import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '../types/env.js';
import type { AuditLogItem, UserRole } from '@infohq/shared';

export interface LogAuditActor {
  id?: string | null;
  name: string;
  email?: string | null;
  role: string;
}

export interface LogAuditParams {
  actor: LogAuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  summary: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function escapeTelegramHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatIstTime(timestamp: number): string {
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(timestamp)) + ' IST'
  );
}

function parseShortUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Unknown Device';
  if (ua.includes('iPhone')) return 'iPhone (Safari/App)';
  if (ua.includes('iPad')) return 'iPad (Safari/App)';
  if (ua.includes('Android')) return 'Android Mobile';
  if (ua.includes('Windows NT 10.0')) return 'Windows PC';
  if (ua.includes('Macintosh; Intel Mac OS X')) return 'Mac OS (Desktop)';
  if (ua.includes('Linux')) return 'Linux Device';
  return ua.length > 35 ? ua.slice(0, 35) + '...' : ua;
}

/**
 * Log an enterprise audit event to D1 with automatic 30-day rolling retention,
 * and dispatch real-time structured telemetry to the dedicated Telegram logs channel.
 */
export async function logAuditEvent(
  db: D1Database,
  env: Bindings,
  params: LogAuditParams,
  executionCtx?: { waitUntil: (promise: Promise<unknown>) => void }
): Promise<void> {
  const now = Date.now();
  const logId = `log_${now}_${crypto.randomUUID().slice(0, 8)}`;
  const cleanIp = params.ipAddress ? params.ipAddress.split(',')[0].trim() : '127.0.0.1';
  const cleanUa = params.userAgent || 'Unknown Device';
  const detailsJson = params.details ? JSON.stringify(params.details) : null;

  // 1. Insert audit log into D1 database
  try {
    await db
      .prepare(
        `INSERT INTO audit_logs (
          id, actor_id, actor_name, actor_email, actor_role,
          action, entity_type, entity_id, entity_name,
          summary, details_json, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        logId,
        params.actor.id || null,
        params.actor.name,
        params.actor.email || null,
        params.actor.role || 'viewer',
        params.action,
        params.entityType,
        params.entityId || null,
        params.entityName || null,
        params.summary,
        detailsJson,
        cleanIp,
        cleanUa,
        now
      )
      .run();

    // 2. Exact 30-day rolling retention prune:
    // Any log older than exactly 30 days (30 * 86,400,000 ms) from this second is deleted smoothly.
    const rollingCutoff = now - 30 * 24 * 60 * 60 * 1000;
    await db
      .prepare('DELETE FROM audit_logs WHERE created_at < ?')
      .bind(rollingCutoff)
      .run();
  } catch (dbErr) {
    console.error('[AuditLog D1 Insert Error]:', dbErr);
  }

  // 3. Dispatch real-time Telegram notification to logs channel
  const rawChatId =
    env.TELEGRAM_LOGS_CHAT_ID ||
    (env as unknown as Record<string, string>)['telegram_logs_chat_id'] ||
    env.TELEGRAM_CHAT_ID;

  if (env.TELEGRAM_BOT_TOKEN && rawChatId) {
    const telegramPromise = dispatchTelegramAuditLog({
      botToken: env.TELEGRAM_BOT_TOKEN,
      chatId: String(rawChatId).trim(),
      params,
      timestamp: now,
      ipAddress: cleanIp,
      userAgent: cleanUa,
      detailsJson,
    }).catch((tgErr) => {
      console.warn('[Telegram Audit Log Dispatch Warning]:', tgErr);
    });

    if (executionCtx && typeof executionCtx.waitUntil === 'function') {
      try {
        executionCtx.waitUntil(telegramPromise);
      } catch {
        // Fallback
      }
    }
  }
}

/**
 * Formats and posts an audit log message to Telegram channel in clean, readable HTML.
 */
async function dispatchTelegramAuditLog(opts: {
  botToken: string;
  chatId: string;
  params: LogAuditParams;
  timestamp: number;
  ipAddress: string;
  userAgent: string;
  detailsJson: string | null;
}): Promise<boolean> {
  const { botToken, chatId, params, timestamp, ipAddress, userAgent, detailsJson } = opts;
  const timeFormatted = formatIstTime(timestamp);
  const device = parseShortUserAgent(userAgent);

  // Pick an intuitive emoji based on action
  let actionEmoji = '⚡';
  const act = params.action.toUpperCase();
  if (act.includes('LOGIN')) actionEmoji = '🔐';
  else if (act.includes('LOGOUT')) actionEmoji = '🚪';
  else if (act.includes('INVITE') || act.includes('TEAM')) actionEmoji = '👥';
  else if (act.includes('PAYMENT') || act.includes('INVOICE')) actionEmoji = '💳';
  else if (act.includes('LEAD')) actionEmoji = '🎯';
  else if (act.includes('CLIENT')) actionEmoji = '🏢';
  else if (act.includes('PROJECT')) actionEmoji = '🚀';
  else if (act.includes('TASK')) actionEmoji = '✅';
  else if (act.includes('DELETE') || act.includes('REVOKE')) actionEmoji = '🗑️';

  let detailsBlock = '';
  if (detailsJson) {
    try {
      const parsed = JSON.parse(detailsJson);
      const lines = Object.entries(parsed)
        .slice(0, 8)
        .map(([k, v]) => `• ${escapeTelegramHtml(k)}: ${escapeTelegramHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}`);
      if (lines.length > 0) {
        detailsBlock = `\n🔍 <b>Action Changes:</b>\n${lines.join('\n')}\n`;
      }
    } catch {
      detailsBlock = `\n🔍 <b>Details:</b> <code>${escapeTelegramHtml(detailsJson.slice(0, 300))}</code>\n`;
    }
  }

  const message = `
🛡️ <b>[INFO-HQ AUDIT LOG]</b>
${actionEmoji} <b>Action:</b> <code>${escapeTelegramHtml(params.action)}</code>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Actor:</b> ${escapeTelegramHtml(params.actor.name)} (${escapeTelegramHtml(params.actor.role.toUpperCase())})
📧 <b>Email:</b> ${escapeTelegramHtml(params.actor.email || 'N/A')}
📁 <b>Module:</b> <b>${escapeTelegramHtml(params.entityType.toUpperCase())}</b>
🎯 <b>Target:</b> ${escapeTelegramHtml(params.entityName || params.entityId || 'N/A')}
📝 <b>Summary:</b> ${escapeTelegramHtml(params.summary)}
${detailsBlock}━━━━━━━━━━━━━━━━━━━━━━
🌐 <b>IP Address:</b> <code>${escapeTelegramHtml(ipAddress)}</code>
📱 <b>Device:</b> ${escapeTelegramHtml(device)}
🕒 <b>Time:</b> ${escapeTelegramHtml(timeFormatted)}
`.trim();

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken.replace(/^['"]|['"]$/g, '').trim()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn('[Telegram Audit Log Error Response]:', errBody);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Telegram Audit Log Fetch Exception]:', err);
    return false;
  }
}

/**
 * Query audit logs with pagination and search/module filters for Superadmin UI.
 */
export async function queryAuditLogs(
  db: D1Database,
  query: {
    search?: string;
    action?: string;
    entityType?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ logs: AuditLogItem[]; totalCount: number; retentionDays: number }> {
  const limit = Math.min(Math.max(query.limit || 50, 1), 100);
  const offset = Math.max(query.offset || 0, 0);

  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (query.action && query.action.trim()) {
    conditions.push('action = ?');
    binds.push(query.action.trim());
  }

  if (query.entityType && query.entityType.trim()) {
    conditions.push('entity_type = ?');
    binds.push(query.entityType.trim());
  }

  if (query.search && query.search.trim()) {
    const term = `%${query.search.trim()}%`;
    conditions.push('(actor_name LIKE ? OR actor_email LIKE ? OR summary LIKE ? OR entity_name LIKE ?)');
    binds.push(term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`)
    .bind(...binds)
    .first<{ total: number }>();

  const totalCount = countRow ? Number(countRow.total) : 0;

  const logsResult = await db
    .prepare(`SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset)
    .all<Record<string, unknown>>();

  const logs: AuditLogItem[] = (logsResult.results || []).map((row) => ({
    id: String(row.id),
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorName: String(row.actor_name),
    actorEmail: row.actor_email ? String(row.actor_email) : null,
    actorRole: (row.actor_role as UserRole) || 'viewer',
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: row.entity_id ? String(row.entity_id) : null,
    entityName: row.entity_name ? String(row.entity_name) : null,
    summary: String(row.summary),
    detailsJson: row.details_json ? String(row.details_json) : null,
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    createdAt: Number(row.created_at),
  }));

  return {
    logs,
    totalCount,
    retentionDays: 30,
  };
}
