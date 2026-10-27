import type { D1Database } from '@cloudflare/workers-types';
import type {
  DashboardOverviewResponse,
  DashboardMetrics,
  UrgentFollowUpItem,
  RecentProjectItem,
  RecentPaymentItem,
  LeadStage,
  ProjectStatus,
  PaymentStatus,
} from '@infohq/shared';

export async function getDashboardOverview(db: D1Database): Promise<DashboardOverviewResponse> {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Calculate IST end of today (UTC + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now + istOffset);
  istDate.setUTCHours(23, 59, 59, 999);
  const endOfTodayUtc = istDate.getTime() - istOffset;

  // 1. Leads Statistics & Stage Breakdown
  const leadsStatsSql = `
    SELECT 
      COUNT(*) as total_leads,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as new_this_week,
      SUM(CASE WHEN stage = 'new' THEN 1 ELSE 0 END) as stage_new,
      SUM(CASE WHEN stage = 'contacted' THEN 1 ELSE 0 END) as stage_contacted,
      SUM(CASE WHEN stage = 'proposal_sent' THEN 1 ELSE 0 END) as stage_proposal_sent,
      SUM(CASE WHEN stage = 'won' THEN 1 ELSE 0 END) as stage_won,
      SUM(CASE WHEN stage = 'lost' THEN 1 ELSE 0 END) as stage_lost,
      SUM(CASE WHEN next_follow_up_at IS NOT NULL AND next_follow_up_at <= ? AND stage NOT IN ('won', 'lost') THEN 1 ELSE 0 END) as follow_ups_due
    FROM leads
  `;

  const leadsStatsRow = await db
    .prepare(leadsStatsSql)
    .bind(sevenDaysAgo, endOfTodayUtc)
    .first<Record<string, unknown>>();

  // 2. Urgent Follow-ups
  const urgentFollowUpsSql = `
    SELECT id, name, email, phone, company, stage, next_follow_up_at
    FROM leads
    WHERE next_follow_up_at IS NOT NULL AND stage NOT IN ('won', 'lost')
    ORDER BY next_follow_up_at ASC
    LIMIT 5
  `;
  const { results: followUpRows } = await db
    .prepare(urgentFollowUpsSql)
    .all<Record<string, unknown>>();

  const urgentFollowUps: UrgentFollowUpItem[] = (followUpRows || []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    email: r.email ? String(r.email) : null,
    phone: r.phone ? String(r.phone) : null,
    company: r.company ? String(r.company) : null,
    stage: r.stage as LeadStage,
    nextFollowUpAt: Number(r.next_follow_up_at),
  }));

  // 3. Projects Statistics
  const projectsStatsSql = `
    SELECT 
      COUNT(*) as total_projects,
      SUM(CASE WHEN status != 'completed' THEN 1 ELSE 0 END) as active_projects,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects
    FROM projects
  `;
  const projectsStatsRow = await db
    .prepare(projectsStatsSql)
    .first<Record<string, unknown>>();

  // Recent Projects
  const recentProjectsSql = `
    SELECT 
      p.id,
      p.title,
      p.client_name,
      p.status,
      p.budget,
      p.deadline,
      COUNT(t.id) as total_tasks,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks
    FROM projects p
    LEFT JOIN tasks t ON p.id = t.project_id
    GROUP BY p.id
    ORDER BY 
      CASE p.status
        WHEN 'in_progress' THEN 1
        WHEN 'review' THEN 2
        WHEN 'planning' THEN 3
        WHEN 'on_hold' THEN 4
        WHEN 'completed' THEN 5
      END ASC,
      p.created_at DESC
    LIMIT 4
  `;
  const { results: recentProjectRows } = await db
    .prepare(recentProjectsSql)
    .all<Record<string, unknown>>();

  const recentProjects: RecentProjectItem[] = (recentProjectRows || []).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    clientName: String(r.client_name),
    status: r.status as ProjectStatus,
    budget: r.budget ? String(r.budget) : null,
    deadline: r.deadline ? Number(r.deadline) : null,
    totalTasks: Number(r.total_tasks || 0),
    completedTasks: Number(r.completed_tasks || 0),
  }));

  // 4. Payments Financials & Recent Activity
  const paymentsQuery = await db
    .prepare('SELECT amount, status FROM payments')
    .all<{ amount: string | number; status: string }>();

  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalPending = 0;

  for (const py of paymentsQuery.results || []) {
    const amt = Number(py.amount) || 0;
    if (py.status !== 'failed') {
      totalInvoiced += amt;
    }
    if (py.status === 'received') {
      totalCollected += amt;
    } else if (py.status === 'pending') {
      totalPending += amt;
    }
  }

  // Recent Payments
  const recentPaymentsSql = `
    SELECT 
      py.id,
      py.project_id,
      py.amount,
      py.status,
      py.invoice_number,
      py.created_at,
      p.title as project_title,
      p.client_name
    FROM payments py
    LEFT JOIN projects p ON py.project_id = p.id
    ORDER BY py.created_at DESC
    LIMIT 4
  `;
  const { results: recentPaymentRows } = await db
    .prepare(recentPaymentsSql)
    .all<Record<string, unknown>>();

  const recentPayments: RecentPaymentItem[] = (recentPaymentRows || []).map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    title: r.invoice_number
      ? String(r.invoice_number)
      : r.project_title
      ? `${String(r.project_title)} Milestone`
      : 'Milestone Payment',
    amount: Number(r.amount) || 0,
    status: r.status as PaymentStatus,
    invoiceNumber: r.invoice_number ? String(r.invoice_number) : null,
    clientName: r.client_name ? String(r.client_name) : null,
    createdAt: Number(r.created_at),
  }));

  const metrics: DashboardMetrics = {
    totalLeads: Number(leadsStatsRow?.total_leads || 0),
    newLeadsThisWeek: Number(leadsStatsRow?.new_this_week || 0),
    leadsByStage: {
      new: Number(leadsStatsRow?.stage_new || 0),
      contacted: Number(leadsStatsRow?.stage_contacted || 0),
      proposal_sent: Number(leadsStatsRow?.stage_proposal_sent || 0),
      won: Number(leadsStatsRow?.stage_won || 0),
      lost: Number(leadsStatsRow?.stage_lost || 0),
    },
    followUpsDueTodayCount: Number(leadsStatsRow?.follow_ups_due || 0),
    activeProjectsCount: Number(projectsStatsRow?.active_projects || 0),
    completedProjectsCount: Number(projectsStatsRow?.completed_projects || 0),
    totalInvoiced,
    totalCollected,
    totalPending,
  };

  return {
    metrics,
    urgentFollowUps,
    recentProjects,
    recentPayments,
  };
}
