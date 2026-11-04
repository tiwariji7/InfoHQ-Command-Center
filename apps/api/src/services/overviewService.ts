import type { D1Database } from '@cloudflare/workers-types';
import type {
  DashboardOverviewResponse,
  DashboardMetrics,
  UrgentFollowUpItem,
  RecentProjectItem,
  RecentPaymentItem,
  Lead,
  LeadStage,
  LeadSource,
  ProjectStatus,
  PaymentStatus,
  WeeklyTrendBucket,
  MonthlyTrendsData,
} from '@infohq/shared';

function parseBudgetValue(str: string | null | undefined): number {
  if (!str) return 0;
  const clean = str.replace(/[^0-9.]/g, '');
  const val = parseFloat(clean);
  if (isNaN(val)) return 0;
  const lower = str.toLowerCase();
  if (lower.includes('lakh') || lower.includes('lac') || lower.endsWith('l')) {
    return val * 100000;
  }
  if (lower.includes('k')) {
    return val * 1000;
  }
  return val;
}

export async function getDashboardOverview(db: D1Database): Promise<DashboardOverviewResponse> {
  const now = Date.now();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now + istOffset);

  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth(); // 0-indexed
  const day = istDate.getUTCDate();

  // UTC boundaries for IST Days
  const startOfTodayUtc = Date.UTC(year, month, day, 0, 0, 0, 0) - istOffset;
  const endOfTodayUtc = startOfTodayUtc + 24 * 60 * 60 * 1000 - 1;
  const startOfYesterdayUtc = startOfTodayUtc - 24 * 60 * 60 * 1000;
  const endOfYesterdayUtc = startOfTodayUtc - 1;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Month Name (e.g., "November 2026")
  const monthName = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'long',
    year: 'numeric',
  }).format(new Date(now));

  // Determine days in current month
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  // 4 Weekly Buckets for the current month
  const weeks: WeeklyTrendBucket[] = [
    { weekLabel: 'Week 1', startDay: 1, endDay: 7 },
    { weekLabel: 'Week 2', startDay: 8, endDay: 14 },
    { weekLabel: 'Week 3', startDay: 15, endDay: 21 },
    { weekLabel: 'Week 4', startDay: 22, endDay: lastDayOfMonth },
  ].map((w) => {
    const sUtc = Date.UTC(year, month, w.startDay, 0, 0, 0, 0) - istOffset;
    const eUtc = Date.UTC(year, month, w.endDay, 23, 59, 59, 999) - istOffset;
    return {
      weekLabel: w.weekLabel,
      startDate: sUtc,
      endDate: eUtc,
      revenue: 0,
      leadsCount: 0,
    };
  });

  // 1. Leads Query & Aggregations
  const leadsQuery = await db
    .prepare('SELECT * FROM leads ORDER BY created_at DESC')
    .all<Record<string, unknown>>();
  const allLeadsRows = leadsQuery.results || [];

  let totalLeads = allLeadsRows.length;
  let newLeadsToday = 0;
  let newLeadsThisWeek = 0;
  let stageNew = 0;
  let stageContacted = 0;
  let stageProposal = 0;
  let stageWon = 0;
  let stageLost = 0;
  let followUpsDueTodayCount = 0;
  let activePipelineValue = 0;
  let activePipelineDealsCount = 0;

  const urgentFollowUps: UrgentFollowUpItem[] = [];

  for (const row of allLeadsRows) {
    const createdAt = Number(row.created_at || 0);
    const stage = String(row.stage || 'new') as LeadStage;
    const nextFollowUp = row.next_follow_up_at ? Number(row.next_follow_up_at) : null;
    const budgetVal = parseBudgetValue(row.budget ? String(row.budget) : null);

    if (createdAt >= startOfTodayUtc) newLeadsToday += 1;
    if (createdAt >= sevenDaysAgo) newLeadsThisWeek += 1;

    if (stage === 'new') stageNew += 1;
    else if (stage === 'contacted') stageContacted += 1;
    else if (stage === 'proposal_sent') stageProposal += 1;
    else if (stage === 'won') stageWon += 1;
    else if (stage === 'lost') stageLost += 1;

    if (stage !== 'won' && stage !== 'lost') {
      activePipelineDealsCount += 1;
      activePipelineValue += budgetVal;

      if (nextFollowUp && nextFollowUp <= endOfTodayUtc) {
        followUpsDueTodayCount += 1;
      }

      if (nextFollowUp && urgentFollowUps.length < 5) {
        urgentFollowUps.push({
          id: String(row.id),
          name: String(row.name),
          email: row.email ? String(row.email) : null,
          phone: row.phone ? String(row.phone) : null,
          company: row.company ? String(row.company) : null,
          stage,
          nextFollowUpAt: nextFollowUp,
        });
      }
    }

    // Weekly leads bucket aggregation
    for (const wk of weeks) {
      if (createdAt >= wk.startDate && createdAt <= wk.endDate) {
        wk.leadsCount += 1;
        break;
      }
    }
  }

  // Sort urgent follow ups by closest due date
  urgentFollowUps.sort((a, b) => a.nextFollowUpAt - b.nextFollowUpAt);

  // Recent Leads (Clean Lead items for dashboard recent list)
  const recentLeads: Lead[] = allLeadsRows.slice(0, 5).map((r) => ({
    id: String(r.id),
    clientId: r.client_id ? String(r.client_id) : null,
    name: String(r.name),
    email: r.email ? String(r.email) : null,
    phone: r.phone ? String(r.phone) : null,
    company: r.company ? String(r.company) : null,
    serviceNeeded: r.service_needed ? String(r.service_needed) : null,
    budget: r.budget ? String(r.budget) : null,
    timeline: r.timeline ? String(r.timeline) : null,
    preferredContact: r.preferred_contact ? String(r.preferred_contact) : null,
    message: r.message ? String(r.message) : null,
    source: (r.source as LeadSource) || 'other',
    stage: (r.stage as LeadStage) || 'new',
    lostReason: r.lost_reason ? String(r.lost_reason) : null,
    nextFollowUpAt: r.next_follow_up_at ? Number(r.next_follow_up_at) : null,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at || r.created_at),
  }));

  // 2. Projects Statistics & Recent Projects
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
    LIMIT 5
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

  // 3. Payments Statistics & Weekly Buckets
  const paymentsQuery = await db
    .prepare('SELECT * FROM payments ORDER BY created_at DESC')
    .all<Record<string, unknown>>();
  const allPaymentRows = paymentsQuery.results || [];

  let totalInvoiced = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let pendingInvoicesCount = 0;
  let todayRevenue = 0;
  let yesterdayRevenue = 0;

  for (const py of allPaymentRows) {
    const amt = Number(py.amount) || 0;
    const status = String(py.status || 'pending');
    const paidAt = py.paid_at ? Number(py.paid_at) : null;
    const createdAt = Number(py.created_at || 0);
    const eventTime = paidAt || createdAt;

    if (status !== 'failed') {
      totalInvoiced += amt;
    }

    if (status === 'received') {
      totalCollected += amt;

      if (eventTime >= startOfTodayUtc) {
        todayRevenue += amt;
      } else if (eventTime >= startOfYesterdayUtc && eventTime < startOfTodayUtc) {
        yesterdayRevenue += amt;
      }

      // Add to weekly bucket for current month
      for (const wk of weeks) {
        if (eventTime >= wk.startDate && eventTime <= wk.endDate) {
          wk.revenue += amt;
          break;
        }
      }
    } else if (status === 'pending') {
      totalPending += amt;
      pendingInvoicesCount += 1;
    }
  }

  // Recent Payments
  const recentPayments: RecentPaymentItem[] = allPaymentRows.slice(0, 4).map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id || ''),
    title: r.title
      ? String(r.title)
      : r.invoice_number
      ? String(r.invoice_number)
      : 'Milestone Payment',
    amount: Number(r.amount) || 0,
    status: (r.status as PaymentStatus) || 'pending',
    invoiceNumber: r.invoice_number ? String(r.invoice_number) : null,
    clientName: r.client_name ? String(r.client_name) : null,
    createdAt: Number(r.created_at),
  }));

  // 4. Clients Count
  let totalClientsCount = 0;
  try {
    const clientsCountRow = await db
      .prepare('SELECT COUNT(*) as count FROM clients')
      .first<Record<string, unknown>>();
    totalClientsCount = Number(clientsCountRow?.count || 0);
  } catch {
    // If clients table query fails, fallback
    totalClientsCount = 0;
  }

  // Monthly Trends Summary
  const totalMtdRevenue = weeks.reduce((sum, w) => sum + w.revenue, 0);
  const totalMtdLeads = weeks.reduce((sum, w) => sum + w.leadsCount, 0);
  const conversionRate = totalLeads > 0 ? (stageWon / totalLeads) * 100 : 0;
  const mtdRealizationPct = totalInvoiced > 0 ? Math.min(100, (totalCollected / totalInvoiced) * 100) : 100;
  const mtdGrowthPct = yesterdayRevenue > 0
    ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
    : todayRevenue > 0
    ? 100
    : 0;

  const monthlyTrends: MonthlyTrendsData = {
    monthName,
    totalMtdRevenue,
    totalMtdLeads,
    conversionRate,
    mtdRealizationPct,
    mtdGrowthPct,
    weeks,
  };

  const metrics: DashboardMetrics = {
    totalLeads,
    newLeadsToday,
    newLeadsThisWeek,
    leadsByStage: {
      new: stageNew,
      contacted: stageContacted,
      proposal_sent: stageProposal,
      won: stageWon,
      lost: stageLost,
    },
    followUpsDueTodayCount,
    activeProjectsCount: Number(projectsStatsRow?.active_projects || 0),
    completedProjectsCount: Number(projectsStatsRow?.completed_projects || 0),
    totalClientsCount,
    todayRevenue,
    yesterdayRevenue,
    activePipelineValue,
    activePipelineDealsCount,
    pendingInvoicesCount,
    totalInvoiced,
    totalCollected,
    totalPending,
    monthlyTrends,
  };

  return {
    metrics,
    urgentFollowUps,
    recentLeads,
    recentProjects,
    recentPayments,
  };
}
