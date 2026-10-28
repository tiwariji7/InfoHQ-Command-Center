import type { D1Database } from '@cloudflare/workers-types';
import type {
  MorningBriefingDigest,
  AutomationAlert,
  AutomationLog,
  AlertType,
  AlertSeverity,
} from '@infohq/shared';
import type { Bindings } from '../types/env.js';

interface DbPaymentRow {
  id: string;
  amount: string | number;
  status: string;
  invoice_number: string | null;
  created_at: number;
  project_title: string | null;
  client_name: string | null;
}

export interface RunBriefingOptions {
  sendTelegram?: boolean;
  persistAlerts?: boolean;
}

export async function runMorningBriefingAndAudits(
  db: D1Database,
  bindings?: Bindings,
  options?: RunBriefingOptions
): Promise<MorningBriefingDigest> {
  const sendTelegram = options?.sendTelegram ?? false;
  const persistAlerts = options?.persistAlerts ?? false;
  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;
  const threeDaysLater = now + 3 * 24 * 60 * 60 * 1000;

  // Calculate IST end of today (UTC + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now + istOffset);
  istDate.setUTCHours(23, 59, 59, 999);
  const endOfTodayUtc = istDate.getTime() - istOffset;

  // 1. Fetch new leads count in last 24h
  const newLeadsRow = await db
    .prepare('SELECT COUNT(*) as count FROM leads WHERE created_at >= ?')
    .bind(twentyFourHoursAgo)
    .first<{ count: number }>();
  const newLeads24h = Number(newLeadsRow?.count || 0);

  // 2. Fetch due follow-ups (overdue or due today)
  const { results: rawFollowUps } = await db
    .prepare(`
      SELECT id, name, phone, email, service_needed, next_follow_up_at
      FROM leads
      WHERE next_follow_up_at IS NOT NULL 
        AND next_follow_up_at <= ?
        AND stage NOT IN ('won', 'lost')
      ORDER BY next_follow_up_at ASC
      LIMIT 20
    `)
    .bind(endOfTodayUtc)
    .all<Record<string, unknown>>();

  const dueFollowUps = (rawFollowUps || []).map((row) => ({
    leadId: String(row.id),
    name: String(row.name),
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    serviceNeeded: row.service_needed ? String(row.service_needed) : null,
    nextFollowUpAt: Number(row.next_follow_up_at),
    isOverdue: Number(row.next_follow_up_at) < now,
  }));

  // 3. Fetch stale leads (new stage without action > 48h)
  const { results: rawStaleLeads } = await db
    .prepare(`
      SELECT id, name, created_at
      FROM leads
      WHERE stage = 'new'
        AND created_at <= ?
      ORDER BY created_at ASC
      LIMIT 10
    `)
    .bind(fortyEightHoursAgo)
    .all<Record<string, unknown>>();
  const staleLeadsCount = (rawStaleLeads || []).length;

  // 4. Fetch pending & overdue invoices
  const { results: rawPayments } = await db
    .prepare(`
      SELECT p.id, p.amount, p.status, p.invoice_number, p.created_at,
             pr.title as project_title, pr.client_name
      FROM payments p
      LEFT JOIN projects pr ON p.project_id = pr.id
      WHERE p.status = 'pending'
      ORDER BY p.created_at ASC
    `)
    .all<DbPaymentRow>();

  let pendingInvoicesTotal = 0;
  let overdueInvoicesTotal = 0;
  const overdueInvoices: MorningBriefingDigest['overdueInvoices'] = [];

  (rawPayments || []).forEach((p) => {
    const amt = parseFloat(String(p.amount)) || 0;
    pendingInvoicesTotal += amt;

    // In this model, if invoice pending > 7 days or past due date, consider urgent/overdue
    const isPastDue = now - p.created_at > 7 * 24 * 60 * 60 * 1000;
    if (isPastDue) {
      overdueInvoicesTotal += amt;
      overdueInvoices.push({
        paymentId: p.id,
        invoiceNumber: p.invoice_number,
        clientName: p.client_name || 'Client',
        amount: amt,
        dueDate: p.created_at + 7 * 24 * 60 * 60 * 1000,
      });
    }
  });

  // 5. Approaching project deadlines
  const { results: rawProjects } = await db
    .prepare(`
      SELECT id, title, client_name, deadline
      FROM projects
      WHERE status = 'in_progress'
        AND deadline IS NOT NULL
        AND deadline <= ?
        AND deadline >= ?
      ORDER BY deadline ASC
      LIMIT 10
    `)
    .bind(threeDaysLater, now)
    .all<Record<string, unknown>>();

  const upcomingDeadlines = (rawProjects || []).map((row) => ({
    projectId: String(row.id),
    title: String(row.title),
    clientName: String(row.client_name),
    deadline: Number(row.deadline),
  }));

  // 6. Generate Alerts into automation_alerts table
  const newAlerts: Array<{
    id: string;
    type: AlertType;
    title: string;
    message: string;
    severity: AlertSeverity;
    link?: string;
  }> = [];

  // Overdue follow-up alert
  if (dueFollowUps.length > 0) {
    const overdueCount = dueFollowUps.filter((f) => f.isOverdue).length;
    newAlerts.push({
      id: `alert-followup-${Date.now()}`,
      type: 'followup_due',
      title: `${dueFollowUps.length} Lead Follow-Ups Due Today`,
      message: `${overdueCount > 0 ? `${overdueCount} overdue, ` : ''}${dueFollowUps.length} follow-up calls or emails required.`,
      severity: overdueCount > 0 ? 'warning' : 'info',
      link: '/leads',
    });
  }

  // Overdue invoices alert
  if (overdueInvoices.length > 0) {
    newAlerts.push({
      id: `alert-invoice-${Date.now()}`,
      type: 'invoice_overdue',
      title: `${overdueInvoices.length} Invoices Overdue for Payment`,
      message: `Total pending overdue: ₹${overdueInvoicesTotal.toLocaleString('en-IN')}. Follow up with clients.`,
      severity: 'critical',
      link: '/billing',
    });
  }

  // Stale leads alert
  if (staleLeadsCount > 0) {
    newAlerts.push({
      id: `alert-stale-${Date.now()}`,
      type: 'stale_lead',
      title: `${staleLeadsCount} Inactive Inbound Leads`,
      message: `${staleLeadsCount} new leads have not received an initial response in over 48 hours.`,
      severity: 'warning',
      link: '/leads',
    });
  }

  // Approaching deadline alert
  if (upcomingDeadlines.length > 0) {
    newAlerts.push({
      id: `alert-deadline-${Date.now()}`,
      type: 'milestone_deadline',
      title: `${upcomingDeadlines.length} Project Deadlines Approaching`,
      message: `Milestone delivery due within next 72 hours for active client projects.`,
      severity: 'info',
      link: '/projects',
    });
  }

  // Batch insert new alerts (only during scheduled cron or manual run)
  if (persistAlerts && newAlerts.length > 0) {
    for (const a of newAlerts) {
      await db
        .prepare(`
          INSERT INTO automation_alerts (id, type, title, message, severity, link, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        `)
        .bind(a.id, a.type, a.title, a.message, a.severity, a.link || null, now)
        .run();
    }
  }

  // 7. Write to automation_logs table (only during scheduled cron or manual run)
  const logId = `log-cron-${now}`;
  const summaryText = `Daily briefing audit: ${dueFollowUps.length} follow-ups, ${overdueInvoices.length} overdue invoices (₹${overdueInvoicesTotal}), ${newLeads24h} new leads.`;
  const detailsJson = JSON.stringify({
    newLeads24h,
    dueFollowUpsCount: dueFollowUps.length,
    staleLeadsCount,
    overdueInvoicesCount: overdueInvoices.length,
    overdueInvoicesTotal,
    pendingInvoicesTotal,
    upcomingDeadlinesCount: upcomingDeadlines.length,
  });

  if (persistAlerts) {
    await db
      .prepare(`
        INSERT INTO automation_logs (id, job_type, status, summary, details_json, created_at)
        VALUES (?, 'daily_briefing', 'success', ?, ?, ?)
      `)
      .bind(logId, summaryText, detailsJson, now)
      .run();
  }

  // 8. Telegram dispatch ONLY when explicitly requested (scheduled 8:00 AM IST cron or manual run)
  if (sendTelegram && bindings?.TELEGRAM_BOT_TOKEN && bindings?.TELEGRAM_CHAT_ID) {
    try {
      const tgText =
        `🔔 *InfoHQ Command Center — Morning Briefing*\n\n` +
        `📈 *New Leads (24h):* ${newLeads24h}\n` +
        `📅 *Follow-Ups Due Today:* ${dueFollowUps.length}\n` +
        `💰 *Overdue Payments:* ₹${overdueInvoicesTotal.toLocaleString('en-IN')} (${overdueInvoices.length} invoices)\n` +
        `🚀 *Projects with Deadlines:* ${upcomingDeadlines.length}\n\n` +
        `⚡️ [Open Command Center](https://commandcenter.infohq.in)`;

      await fetch(`https://api.telegram.org/bot${bindings.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: bindings.TELEGRAM_CHAT_ID,
          text: tgText,
          parse_mode: 'Markdown',
        }),
      });
    } catch (tgErr) {
      console.error('[Automation] Telegram dispatch skipped or failed:', tgErr);
    }
  }

  if (sendTelegram && bindings?.ADMIN_NOTIFY_WEBHOOK) {
    try {
      await fetch(bindings.ADMIN_NOTIFY_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: detailsJson,
      });
    } catch (webhookErr) {
      console.error('[Automation] Webhook dispatch skipped or failed:', webhookErr);
    }
  }

  // 9. Fetch active recent alerts
  const { results: rawAlerts } = await db
    .prepare(`
      SELECT id, type, title, message, severity, link, is_read, metadata_json, created_at
      FROM automation_alerts
      ORDER BY created_at DESC
      LIMIT 8
    `)
    .all<Record<string, unknown>>();

  const recentAlerts: AutomationAlert[] = (rawAlerts || []).map((r) => ({
    id: String(r.id),
    type: r.type as AlertType,
    title: String(r.title),
    message: String(r.message),
    severity: r.severity as AlertSeverity,
    link: r.link ? String(r.link) : null,
    isRead: Number(r.is_read) === 1,
    metadataJson: r.metadata_json ? String(r.metadata_json) : null,
    createdAt: Number(r.created_at),
  }));

  const latestCronLog: AutomationLog = {
    id: logId,
    jobType: 'daily_briefing',
    status: 'success',
    summary: summaryText,
    detailsJson,
    createdAt: now,
  };

  return {
    generatedAt: now,
    greeting: 'Daily Executive Briefing is live.',
    summary: {
      newLeads24h,
      dueFollowUpsCount: dueFollowUps.length,
      staleLeadsCount,
      overdueInvoicesCount: overdueInvoices.length,
      overdueInvoicesTotal,
      pendingInvoicesTotal,
      upcomingDeadlinesCount: upcomingDeadlines.length,
    },
    dueFollowUps,
    overdueInvoices,
    upcomingDeadlines,
    recentAlerts,
    latestCronLog,
  };
}

export async function getLatestBriefingDigest(
  db: D1Database,
  bindings?: Bindings
): Promise<MorningBriefingDigest> {
  // Read-only compilation of latest digest for frontend dashboard (does NOT dispatch Telegram or duplicate alerts)
  return runMorningBriefingAndAudits(db, bindings, { sendTelegram: false, persistAlerts: false });
}

export async function getAutomationAlerts(
  db: D1Database,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<AutomationAlert[]> {
  const limit = options?.limit || 20;
  const unreadOnly = options?.unreadOnly ?? false;

  const sql = unreadOnly
    ? `SELECT id, type, title, message, severity, link, is_read, metadata_json, created_at
       FROM automation_alerts
       WHERE is_read = 0
       ORDER BY created_at DESC
       LIMIT ?`
    : `SELECT id, type, title, message, severity, link, is_read, metadata_json, created_at
       FROM automation_alerts
       ORDER BY created_at DESC
       LIMIT ?`;

  const { results } = await db.prepare(sql).bind(limit).all<Record<string, unknown>>();

  return (results || []).map((r) => ({
    id: String(r.id),
    type: r.type as AlertType,
    title: String(r.title),
    message: String(r.message),
    severity: r.severity as AlertSeverity,
    link: r.link ? String(r.link) : null,
    isRead: Number(r.is_read) === 1,
    metadataJson: r.metadata_json ? String(r.metadata_json) : null,
    createdAt: Number(r.created_at),
  }));
}

export async function markAlertAsRead(db: D1Database, alertId: string): Promise<boolean> {
  const res = await db
    .prepare('UPDATE automation_alerts SET is_read = 1 WHERE id = ?')
    .bind(alertId)
    .run();
  return (res.meta.changes || 0) > 0;
}

export async function markAllAlertsAsRead(db: D1Database): Promise<number> {
  const res = await db.prepare('UPDATE automation_alerts SET is_read = 1 WHERE is_read = 0').run();
  return res.meta.changes || 0;
}

