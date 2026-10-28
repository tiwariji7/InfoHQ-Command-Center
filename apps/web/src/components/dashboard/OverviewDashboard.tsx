import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { DashboardOverviewResponse, RecentProjectItem, RecentPaymentItem } from '@infohq/shared';
import { fetchDashboardOverview } from '../../lib/api.js';
import {
  Users,
  FolderKanban,
  IndianRupee,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Phone,
  MessageCircle,
  Calendar,
  CheckCircle2,
  AlertCircle,
  KanbanSquare,
  TrendingUp,
  BriefcaseBusiness,
  Receipt,
  ChevronRight,
} from 'lucide-react';

interface OverviewDashboardProps {
  onNavigateTab: (tab: string) => void;
  onOpenAddLead?: () => void;
  onOpenCreateProject?: () => void;
  onOpenCreatePayment?: () => void;
  onSelectLeadId?: (leadId: string) => void;
  onSelectProjectId?: (projectId: string) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  onNavigateTab,
  onSelectLeadId,
  onSelectProjectId,
}) => {
  const { getToken } = useAuth();
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetchDashboardOverview(getToken);
        setData(res);
      } catch (err: unknown) {
        console.error('Failed to load dashboard overview:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  const formatISTDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp));
  };

  const formatISTTime = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(timestamp));
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'new':
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-[#FAF5FF] text-[#6B21A8] border border-purple-100">
            New
          </span>
        );
      case 'contacted':
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-100">
            Contacted
          </span>
        );
      case 'proposal_sent':
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-[#FFF7ED] text-[#C2410C] border border-orange-100">
            Proposal Sent
          </span>
        );
      case 'won':
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-[#F0FDF4] text-[#15803D] border border-green-100">
            Won
          </span>
        );
      case 'lost':
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-[#F4F3F9] text-[#6B7280] border border-gray-200">
            Lost
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-gray-100 text-gray-700 capitalize">
            {stage}
          </span>
        );
    }
  };

  const getProjectStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-100">
            In Progress
          </span>
        );
      case 'review':
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-[#FAF5FF] text-[#6B21A8] border border-purple-100">
            Under Review
          </span>
        );
      case 'planning':
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-[#FFF7ED] text-[#C2410C] border border-orange-100">
            Planning
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-[#F0FDF4] text-[#15803D] border border-green-100">
            Completed
          </span>
        );
      case 'on_hold':
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-[#FFF1F2] text-[#E11D48] border border-rose-100">
            On Hold
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-chip text-[11px] font-semibold bg-gray-100 text-gray-700 capitalize">
            {status}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-[20px] border border-brand-border p-16 flex flex-col items-center justify-center gap-3 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)]">
        <RefreshCw size={26} className="animate-spin text-brand-primary" />
        <span className="text-xs font-medium text-brand-muted">Loading executive command center...</span>
      </div>
    );
  }

  const metrics = data?.metrics;
  const urgentFollowUps = data?.urgentFollowUps || [];
  const recentProjects = data?.recentProjects || [];
  const recentPayments = data?.recentPayments || [];

  const totalPipelineOpportunities =
    (metrics?.leadsByStage.new || 0) +
    (metrics?.leadsByStage.contacted || 0) +
    (metrics?.leadsByStage.proposal_sent || 0);

  // Calculation for Revenue Recovery Progress
  const totalInvoiced = metrics?.totalInvoiced || 0;
  const totalCollected = metrics?.totalCollected || 0;
  const totalPending = metrics?.totalPending || 0;
  const recoveryPercentage =
    totalInvoiced > 0 ? Math.min(100, Math.round((totalCollected / totalInvoiced) * 100)) : 0;

  // Derivation of Top Clients from Projects & Payments
  const clientMap = new Map<
    string,
    { name: string; activeProjects: number; totalValue: number; latestStatus: string }
  >();

  recentProjects.forEach((p: RecentProjectItem) => {
    const key = p.clientName.trim();
    if (!key) return;
    const existing = clientMap.get(key) || {
      name: key,
      activeProjects: 0,
      totalValue: 0,
      latestStatus: p.status,
    };
    if (p.status !== 'completed') existing.activeProjects += 1;
    const parsedBudget = Number(p.budget?.replace(/[^0-9.]/g, '')) || 0;
    existing.totalValue += parsedBudget;
    clientMap.set(key, existing);
  });

  recentPayments.forEach((py: RecentPaymentItem) => {
    if (!py.clientName) return;
    const key = py.clientName.trim();
    if (!key) return;
    const existing = clientMap.get(key) || {
      name: key,
      activeProjects: 1,
      totalValue: 0,
      latestStatus: 'active',
    };
    if (py.status === 'received') existing.totalValue += Number(py.amount) || 0;
    clientMap.set(key, existing);
  });

  const topClients = Array.from(clientMap.values()).slice(0, 4);

  return (
    <div className="space-y-6 sm:space-y-7">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-brand-destructive rounded-control text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. SABSE UPAR: 4 KPI CARDS (With Gradient Numbers)        */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Leads */}
        <div
          onClick={() => onNavigateTab('leads')}
          className="bg-white rounded-[20px] border border-brand-border p-5 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] hover:border-brand-primary hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-muted">Total Inbound Leads</span>
            <div className="w-8 h-8 rounded-full bg-brand-subtle text-brand-primary flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users size={16} />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl sm:text-[30px] font-black tracking-tight tabular-nums bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
              {metrics?.totalLeads || 0}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-brand-border/60">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <ArrowUpRight size={12} />
              +{metrics?.newLeadsThisWeek || 0} this week
            </span>
            <span className="text-[11px] text-brand-muted group-hover:text-brand-primary flex items-center transition-colors">
              Inbox <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 2: Active Pipeline */}
        <div
          onClick={() => onNavigateTab('pipeline')}
          className="bg-white rounded-[20px] border border-brand-border p-5 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] hover:border-brand-primary hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-muted">Active Sales Pipeline</span>
            <div className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center group-hover:scale-105 transition-transform">
              <KanbanSquare size={16} />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl sm:text-[30px] font-black tracking-tight tabular-nums bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C5CE8] bg-clip-text text-transparent">
              {totalPipelineOpportunities}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-brand-border/60">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              {metrics?.leadsByStage.proposal_sent || 0} proposals sent
            </span>
            <span className="text-[11px] text-brand-muted group-hover:text-brand-primary flex items-center transition-colors">
              Board <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 3: Active Deliverables */}
        <div
          onClick={() => onNavigateTab('projects')}
          className="bg-white rounded-[20px] border border-brand-border p-5 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] hover:border-brand-primary hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-muted">Active Projects</span>
            <div className="w-8 h-8 rounded-full bg-[#FAF5FF] text-[#6B21A8] flex items-center justify-center group-hover:scale-105 transition-transform">
              <FolderKanban size={16} />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl sm:text-[30px] font-black tracking-tight tabular-nums bg-gradient-to-r from-[#9333EA] via-[#A855F7] to-[#EC4899] bg-clip-text text-transparent">
              {metrics?.activeProjectsCount || 0}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-brand-border/60">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
              {metrics?.completedProjectsCount || 0} delivered
            </span>
            <span className="text-[11px] text-brand-muted group-hover:text-brand-primary flex items-center transition-colors">
              Projects <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 4: Revenue Collected */}
        <div
          onClick={() => onNavigateTab('billing')}
          className="bg-white rounded-[20px] border border-brand-border p-5 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] hover:border-brand-primary hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-muted">Revenue Collected</span>
            <div className="w-8 h-8 rounded-full bg-[#F3F0FF] text-[#7C5CE8] flex items-center justify-center group-hover:scale-105 transition-transform">
              <IndianRupee size={16} />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl sm:text-[28px] font-black tracking-tight tabular-nums bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent truncate">
              {formatCurrency(totalCollected)}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-brand-border/60">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 truncate max-w-[170px]">
              Pending: {formatCurrency(totalPending)}
            </span>
            <span className="text-[11px] text-brand-muted group-hover:text-brand-primary flex items-center transition-colors shrink-0">
              Billing <ChevronRight size={12} />
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. USKE NEECHE: REVENUE + LEAD TRENDS (Half-Gradient Headings) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Card 2A: Revenue Overview & Realization Trends */}
        <div className="bg-white rounded-[20px] border border-brand-border p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-brand-heading tracking-tight">
                    <span>Revenue & </span>
                    <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">
                      Cashflow Realization
                    </span>
                  </h2>
                  <p className="text-xs text-brand-muted">
                    Total billing receivables vs actual bank collections.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('billing')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Invoices</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            {/* Progress Bar of Recovery */}
            <div className="p-4 bg-brand-page rounded-control border border-brand-border mb-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-brand-heading">Cashflow Realization Rate</span>
                <span className="font-black tabular-nums bg-gradient-to-r from-[#7C5CE8] via-[#A855F7] to-[#FF4D8D] bg-clip-text text-transparent">
                  {recoveryPercentage}% Collected
                </span>
              </div>
              <div className="h-2.5 w-full bg-[#EAE6F7] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#5B4CF5] via-[#7C5CE8] to-[#FF4D8D] rounded-full transition-all duration-700"
                  style={{ width: `${recoveryPercentage}%` }}
                />
              </div>
            </div>

            {/* Financial Metric Triple Breakdown with Gradient Data Numbers */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              <div className="p-3 bg-brand-section rounded-control border border-brand-border text-center">
                <div className="text-[11px] font-medium text-brand-muted">Total Invoiced</div>
                <div className="text-xs sm:text-sm md:text-base font-extrabold mt-1 tabular-nums truncate bg-gradient-to-r from-[#1A085C] to-[#5B4CF5] bg-clip-text text-transparent">
                  {formatCurrency(totalInvoiced)}
                </div>
              </div>
              <div className="p-3 bg-emerald-50/70 rounded-control border border-emerald-100 text-center">
                <div className="text-[11px] font-medium text-emerald-800">Received</div>
                <div className="text-xs sm:text-sm md:text-base font-extrabold mt-1 tabular-nums truncate bg-gradient-to-r from-[#059669] to-[#10B981] bg-clip-text text-transparent">
                  {formatCurrency(totalCollected)}
                </div>
              </div>
              <div className="p-3 bg-amber-50/70 rounded-control border border-amber-100 text-center">
                <div className="text-[11px] font-medium text-amber-800">Pending Dues</div>
                <div className="text-xs sm:text-sm md:text-base font-extrabold mt-1 tabular-nums truncate bg-gradient-to-r from-[#D97706] to-[#F59E0B] bg-clip-text text-transparent">
                  {formatCurrency(totalPending)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-border/60 flex items-center justify-between text-[11px] text-brand-muted">
            <span>Milestone reconciliation</span>
            <span className="font-bold bg-gradient-to-r from-[#7C5CE8] to-[#5B4CF5] bg-clip-text text-transparent">
              Verified live from D1 DB
            </span>
          </div>
        </div>

        {/* Card 2B: Lead Trends & Pipeline Velocity */}
        <div className="bg-white rounded-[20px] border border-brand-border p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-subtle text-brand-primary flex items-center justify-center">
                  <KanbanSquare size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-brand-heading tracking-tight">
                    <span>Lead Acquisition & </span>
                    <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">
                      Funnel Trends
                    </span>
                  </h2>
                  <p className="text-xs text-brand-muted">
                    Inbound prospects across discovery and conversion stages.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('pipeline')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Pipeline</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            {/* Pipeline Stage Distribution Bars */}
            <div className="space-y-3">
              {[
                {
                  label: 'New Enquiries',
                  count: metrics?.leadsByStage.new || 0,
                  color: 'bg-[#7C5CE8]',
                },
                {
                  label: 'Contacted & Discovery',
                  count: metrics?.leadsByStage.contacted || 0,
                  color: 'bg-[#3B82F6]',
                },
                {
                  label: 'Proposal Sent',
                  count: metrics?.leadsByStage.proposal_sent || 0,
                  color: 'bg-[#F97316]',
                },
                {
                  label: 'Won & Converted',
                  count: metrics?.leadsByStage.won || 0,
                  color: 'bg-[#10B981]',
                },
                {
                  label: 'Closed / Lost',
                  count: metrics?.leadsByStage.lost || 0,
                  color: 'bg-[#9CA3AF]',
                },
              ].map((stageItem) => {
                const total = metrics?.totalLeads || 1;
                const pct = Math.round((stageItem.count / (total > 0 ? total : 1)) * 100);

                return (
                  <div key={stageItem.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-brand-heading">{stageItem.label}</span>
                      <span className="font-bold tabular-nums bg-gradient-to-r from-[#5B4CF5] to-[#7C5CE8] bg-clip-text text-transparent">
                        {stageItem.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-brand-page rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stageItem.color} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(pct, stageItem.count > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-brand-border/60 flex items-center justify-between text-[11px] text-brand-muted">
            <span>Overall Conversion Rate</span>
            <span className="font-black bg-gradient-to-r from-[#059669] to-[#10B981] bg-clip-text text-transparent">
              {metrics?.totalLeads
                ? Math.round(((metrics.leadsByStage.won || 0) / metrics.totalLeads) * 100)
                : 0}
              % Won
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. PHIR: NEEDS YOUR ATTENTION + PROJECT HEALTH            */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Card 3A: Needs Your Attention (Actionable Follow-ups) */}
        <div className="bg-white rounded-[20px] border border-brand-border p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-brand-heading tracking-tight">
                    <span>Needs Your </span>
                    <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">
                      Attention
                    </span>
                  </h2>
                  <p className="text-xs text-brand-muted">
                    Scheduled discovery calls and priority follow-ups (IST).
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('leads')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>All Leads</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            {urgentFollowUps.length === 0 ? (
              <div className="p-8 text-center bg-brand-page rounded-control border border-brand-border text-xs text-brand-muted">
                <CheckCircle2 size={24} className="text-emerald-600 mx-auto mb-2" />
                <span className="block font-medium text-brand-heading">All follow-ups up to date!</span>
                <span className="text-[11px] text-brand-muted">
                  No overdue contacts or pending calls for today.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-brand-border">
                {urgentFollowUps.slice(0, 4).map((item) => {
                  const cleanPhone = item.phone ? item.phone.replace(/\D/g, '') : '';
                  const isOverdue = item.nextFollowUpAt < Date.now();

                  return (
                    <div
                      key={item.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-brand-page/50 transition-colors rounded-control px-2 -mx-2"
                    >
                      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                        <div
                          className={`w-2.5 h-2.5 rounded-full mt-1 sm:mt-0 shrink-0 ${
                            isOverdue ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-brand-heading truncate">
                              {item.name}
                            </span>
                            {item.company && (
                              <span className="text-[11px] text-brand-muted truncate">
                                ({item.company})
                              </span>
                            )}
                            {getStageBadge(item.stage)}
                          </div>
                          <div className="text-[11px] text-brand-muted mt-0.5 flex items-center gap-2">
                            <Calendar size={11} className="text-brand-muted" />
                            <span>
                              {formatISTDate(item.nextFollowUpAt)} at {formatISTTime(item.nextFollowUpAt)} IST
                            </span>
                            {isOverdue && (
                              <span className="text-rose-600 font-semibold text-[10px]">Overdue</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {cleanPhone && (
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 text-[11px] rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                            title="WhatsApp Chat"
                          >
                            <MessageCircle size={11} />
                            <span>WhatsApp</span>
                          </a>
                        )}

                        {item.phone && (
                          <a
                            href={`tel:${item.phone}`}
                            className="px-2 py-1 text-[11px] rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center gap-1 transition-colors"
                            title="Direct Phone Call"
                          >
                            <Phone size={11} />
                            <span>Call</span>
                          </a>
                        )}

                        {onSelectLeadId && (
                          <button
                            onClick={() => onSelectLeadId(item.id)}
                            className="px-2.5 py-1 text-[11px] rounded font-semibold bg-brand-subtle text-brand-primary border border-purple-200 hover:bg-brand-primary hover:text-white transition-colors cursor-pointer"
                          >
                            Open
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-brand-border/60 flex items-center justify-between text-[11px] text-brand-muted">
            <span>Pending follow-ups count</span>
            <span className="font-bold tabular-nums bg-gradient-to-r from-[#D97706] to-[#F59E0B] bg-clip-text text-transparent">
              {metrics?.followUpsDueTodayCount || 0} scheduled today
            </span>
          </div>
        </div>

        {/* Card 3B: Project Health & Milestones */}
        <div className="bg-white rounded-[20px] border border-brand-border p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-subtle text-brand-primary flex items-center justify-center">
                  <FolderKanban size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-brand-heading tracking-tight">
                    <span>Project Health & </span>
                    <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">
                      Deliverables
                    </span>
                  </h2>
                  <p className="text-xs text-brand-muted">
                    Engineering milestones, deadlines, and task completion.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('projects')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>All Projects</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            {recentProjects.length === 0 ? (
              <div className="p-8 text-center bg-brand-page rounded-control border border-brand-border text-xs text-brand-muted">
                <FolderKanban size={24} className="text-brand-muted mx-auto mb-2" />
                <span className="block font-medium text-brand-heading">No active projects yet</span>
                <span className="text-[11px] text-brand-muted">
                  Create a project to monitor delivery deadlines and sprints.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {recentProjects.slice(0, 3).map((proj: RecentProjectItem) => {
                  const taskPct =
                    proj.totalTasks > 0
                      ? Math.round((proj.completedTasks / proj.totalTasks) * 100)
                      : 0;

                  return (
                    <div
                      key={proj.id}
                      onClick={() => onSelectProjectId && onSelectProjectId(proj.id)}
                      className="p-3.5 bg-brand-page hover:bg-brand-section rounded-control border border-brand-border hover:border-brand-primary/40 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs font-bold text-brand-heading group-hover:text-brand-primary transition-colors truncate">
                            {proj.title}
                          </span>
                          <span className="text-[11px] text-brand-muted shrink-0">
                            • {proj.clientName}
                          </span>
                        </div>
                        {getProjectStatusBadge(proj.status)}
                      </div>

                      {/* Task Progress Bar */}
                      <div className="space-y-1 my-2">
                        <div className="flex items-center justify-between text-[11px] text-brand-muted">
                          <span>Sprint Progress</span>
                          <span className="font-bold tabular-nums bg-gradient-to-r from-[#7C5CE8] to-[#5B4CF5] bg-clip-text text-transparent">
                            {proj.completedTasks}/{proj.totalTasks} tasks ({taskPct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-white rounded-full overflow-hidden border border-brand-border/60">
                          <div
                            className="h-full bg-gradient-to-r from-[#7C5CE8] to-[#5B4CF5] rounded-full transition-all duration-300"
                            style={{ width: `${taskPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer Details: Budget & Deadline */}
                      <div className="flex items-center justify-between text-[11px] text-brand-muted pt-1">
                        <span>
                          Budget:{' '}
                          <strong className="font-black tabular-nums bg-gradient-to-r from-[#1A085C] to-[#5B4CF5] bg-clip-text text-transparent">
                            {proj.budget || 'Custom'}
                          </strong>
                        </span>
                        <span>
                          {proj.deadline ? (
                            <span className="inline-flex items-center gap-1 font-medium text-brand-heading">
                              <Calendar size={11} className="text-brand-muted" />
                              Due {formatISTDate(proj.deadline)}
                            </span>
                          ) : (
                            'Ongoing'
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-brand-border/60 flex items-center justify-between text-[11px] text-brand-muted">
            <span>Engineering Active Count</span>
            <span className="font-bold bg-gradient-to-r from-[#7C5CE8] to-[#5B4CF5] bg-clip-text text-transparent">
              {metrics?.activeProjectsCount || 0} active builds
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. AUR LAST MEIN: RECENT ACTIVITY + TOP CLIENTS          */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Card 4A: Recent Activity (Financials & Milestone Logs) */}
        <div className="bg-white rounded-[20px] border border-brand-border p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Receipt size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-brand-heading tracking-tight">
                    <span>Recent </span>
                    <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">
                      Activity
                    </span>
                  </h2>
                  <p className="text-xs text-brand-muted">
                    Real-time transaction logs, milestone billings, and audits.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('billing')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>All Billing</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            {recentPayments.length === 0 ? (
              <div className="p-8 text-center bg-brand-page rounded-control border border-brand-border text-xs text-brand-muted">
                <Receipt size={24} className="text-brand-muted mx-auto mb-2" />
                <span className="block font-medium text-brand-heading">No recent transactions</span>
                <span className="text-[11px] text-brand-muted">
                  Recorded invoices and payments will appear in this timeline.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-brand-border">
                {recentPayments.slice(0, 5).map((py: RecentPaymentItem) => {
                  return (
                    <div
                      key={py.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-brand-page/50 transition-colors rounded-control px-2 -mx-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            py.status === 'received'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          <IndianRupee size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-brand-heading truncate">
                            {py.title}
                          </div>
                          <div className="text-[11px] text-brand-muted truncate">
                            {py.clientName ? `${py.clientName} • ` : ''}
                            {py.invoiceNumber || 'Direct Payment'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs sm:text-sm font-black tabular-nums bg-gradient-to-r from-[#1A085C] via-[#5B4CF5] to-[#7C5CE8] bg-clip-text text-transparent">
                          {formatCurrency(Number(py.amount) || 0)}
                        </div>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 capitalize ${
                            py.status === 'received'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}
                        >
                          {py.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-brand-border/60 flex items-center justify-between text-[11px] text-brand-muted">
            <span>Audit Trail</span>
            <span className="font-bold bg-gradient-to-r from-[#7C5CE8] to-[#5B4CF5] bg-clip-text text-transparent">
              Connected to D1 Studio
            </span>
          </div>
        </div>

        {/* Card 4B: Top Clients (From Projects & Database) */}
        <div className="bg-white rounded-[20px] border border-brand-border p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center">
                  <BriefcaseBusiness size={16} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-brand-heading tracking-tight">
                    <span>Top </span>
                    <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">
                      Clients
                    </span>
                  </h2>
                  <p className="text-xs text-brand-muted">
                    Key client accounts, active contracts, and engagement volume.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('clients')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Clients Directory</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            {topClients.length === 0 ? (
              <div className="p-8 text-center bg-brand-page rounded-control border border-brand-border text-xs text-brand-muted">
                <BriefcaseBusiness size={24} className="text-brand-muted mx-auto mb-2" />
                <span className="block font-medium text-brand-heading">No active client accounts</span>
                <span className="text-[11px] text-brand-muted">
                  Clients converted from won leads or ongoing projects will appear here.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-brand-border">
                {topClients.map((client) => {
                  const initials = client.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <div
                      key={client.name}
                      onClick={() => onNavigateTab('clients')}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-brand-page/50 transition-colors rounded-control px-2 -mx-2 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C5CE8] to-[#5B4CF5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          {initials || 'CL'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-brand-heading group-hover:text-brand-primary transition-colors truncate">
                            {client.name}
                          </div>
                          <div className="text-[11px] text-brand-muted">
                            {client.activeProjects > 0
                              ? `${client.activeProjects} active project${client.activeProjects > 1 ? 's' : ''}`
                              : 'Retainer / Past Client'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs sm:text-sm font-black tabular-nums bg-gradient-to-r from-[#059669] via-[#10B981] to-[#5B4CF5] bg-clip-text text-transparent">
                          {client.totalValue > 0 ? formatCurrency(client.totalValue) : 'Active'}
                        </div>
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 mt-0.5">
                          Active Account
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-brand-border/60 flex items-center justify-between text-[11px] text-brand-muted">
            <span>Client Retention</span>
            <span className="font-bold bg-gradient-to-r from-[#7C5CE8] to-[#5B4CF5] bg-clip-text text-transparent">
              {topClients.length} key partners
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
