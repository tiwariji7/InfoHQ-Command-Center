import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { DashboardOverviewResponse } from '@infohq/shared';
import { fetchDashboardOverview } from '../../lib/api.js';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  IndianRupee,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Phone,
  MessageCircle,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Kanban,
  CheckSquare,
} from 'lucide-react';

interface OverviewDashboardProps {
  onNavigateTab: (tab: 'leads' | 'pipeline' | 'projects' | 'payments') => void;
  onOpenAddLead?: () => void;
  onOpenCreateProject?: () => void;
  onOpenCreatePayment?: () => void;
  onSelectLeadId?: (leadId: string) => void;
  onSelectProjectId?: (projectId: string) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  onNavigateTab,
  onOpenAddLead,
  onOpenCreateProject,
  onOpenCreatePayment,
  onSelectLeadId,
  onSelectProjectId,
}) => {
  const { getToken } = useAuth();
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await fetchDashboardOverview(getToken);
      setData(res);
    } catch (err: unknown) {
      console.error('Failed to load dashboard overview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getToken]);

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
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            New
          </span>
        );
      case 'contacted':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Contacted
          </span>
        );
      case 'proposal_sent':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Proposal Sent
          </span>
        );
      case 'won':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200">
            Won
          </span>
        );
      case 'lost':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            Lost
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200 capitalize">
            {stage}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="hq-card bg-white border-brand-border p-16 flex flex-col items-center justify-center gap-3">
        <RefreshCw size={24} className="animate-spin text-brand-primary" />
        <span className="text-xs text-brand-muted">Loading command center overview...</span>
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

  return (
    <div className="space-y-6">
      {/* Top Welcome & Actions Banner */}
      <div className="hq-card bg-white border-brand-border p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-chip bg-brand-subtle flex items-center justify-center text-brand-primary">
                <LayoutDashboard size={18} />
              </div>
              <h1 className="text-2xl font-bold text-brand-heading">Command Center Overview</h1>
            </div>
            <p className="text-sm text-brand-body mt-1">
              Live executive pulse across opportunities, client delivery milestones, and cashflow receivables.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => loadDashboard(true)}
              disabled={isRefreshing}
              className="p-2 text-brand-muted hover:text-brand-heading rounded-control border border-brand-border hover:bg-brand-section transition-colors"
              title="Refresh dashboard"
              aria-label="Refresh dashboard"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-brand-primary' : ''} />
            </button>

            {onOpenAddLead && (
              <button onClick={onOpenAddLead} className="hq-btn-secondary text-xs flex items-center gap-1.5">
                <Plus size={14} />
                <span>New Lead</span>
              </button>
            )}

            {onOpenCreateProject && (
              <button onClick={onOpenCreateProject} className="hq-btn-secondary text-xs flex items-center gap-1.5">
                <Plus size={14} />
                <span>New Project</span>
              </button>
            )}

            {onOpenCreatePayment && (
              <button onClick={onOpenCreatePayment} className="hq-btn-primary text-xs flex items-center gap-1.5">
                <Plus size={14} />
                <span>Record Invoice</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-brand-destructive rounded-control text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Leads Card */}
        <div
          onClick={() => onNavigateTab('leads')}
          className="hq-card bg-white border-brand-border p-4 sm:p-5 hover:border-brand-primary/40 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
              Total Inbound Leads
            </span>
            <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
              <Users size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-brand-heading mt-2 tabular-nums">
            {metrics?.totalLeads || 0}
          </div>
          <div className="text-[11px] text-green-700 font-medium mt-1 flex items-center gap-1">
            <span>+{metrics?.newLeadsThisWeek || 0} this week</span>
            <ArrowUpRight size={12} />
          </div>
        </div>

        {/* Active Pipeline Card */}
        <div
          onClick={() => onNavigateTab('pipeline')}
          className="hq-card bg-white border-brand-border p-4 sm:p-5 hover:border-brand-primary/40 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
              Active Pipeline
            </span>
            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Kanban size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-brand-heading mt-2 tabular-nums">
            {totalPipelineOpportunities}
          </div>
          <div className="text-[11px] text-brand-muted mt-1">
            {metrics?.leadsByStage.proposal_sent || 0} proposals pending decision
          </div>
        </div>

        {/* Active Projects Card */}
        <div
          onClick={() => onNavigateTab('projects')}
          className="hq-card bg-white border-brand-border p-4 sm:p-5 hover:border-brand-primary/40 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
              Active Deliverables
            </span>
            <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <Briefcase size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-brand-heading mt-2 tabular-nums">
            {metrics?.activeProjectsCount || 0}
          </div>
          <div className="text-[11px] text-brand-muted mt-1">
            {metrics?.completedProjectsCount || 0} completed successfully
          </div>
        </div>

        {/* Cashflow Receivables Card */}
        <div
          onClick={() => onNavigateTab('payments')}
          className="hq-card bg-white border-brand-border p-4 sm:p-5 hover:border-brand-primary/40 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
              Collected / Pending
            </span>
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <IndianRupee size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold text-brand-heading mt-2 tabular-nums">
            {formatCurrency(metrics?.totalCollected || 0)}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            Pending: {formatCurrency(metrics?.totalPending || 0)}
          </div>
        </div>
      </div>

      {/* Urgent Follow-ups Banner (Actionable IST Follow-ups) */}
      <div className="hq-card bg-white border-brand-border overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-chip bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock size={15} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-brand-heading">Priority Follow-up Schedule (IST)</h2>
              <p className="text-[11px] text-brand-muted">
                Contacts requiring scheduled contact or discovery follow-ups.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('leads')}
            className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
          >
            <span>View All Leads</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        {urgentFollowUps.length === 0 ? (
          <div className="p-8 text-center text-xs text-brand-muted">
            <CheckCircle2 size={20} className="text-green-600 mx-auto mb-2" />
            <span>All follow-ups are up to date. No pending follow-ups scheduled for today.</span>
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {urgentFollowUps.map((item) => {
              const cleanPhone = item.phone ? item.phone.replace(/\D/g, '') : '';
              const isOverdue = item.nextFollowUpAt < Date.now();

              return (
                <div
                  key={item.id}
                  className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-section/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1.5 sm:mt-0 shrink-0 ${
                        isOverdue ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-brand-heading">{item.name}</span>
                        {item.company && (
                          <span className="text-[11px] text-brand-muted">({item.company})</span>
                        )}
                        {getStageBadge(item.stage)}
                      </div>
                      <div className="text-[11px] text-brand-muted mt-0.5 flex items-center gap-2">
                        <Calendar size={12} className="text-brand-muted" />
                        <span>
                          {formatISTDate(item.nextFollowUpAt)} at {formatISTTime(item.nextFollowUpAt)} IST
                        </span>
                        {isOverdue && (
                          <span className="text-red-600 font-semibold text-[10px]">Overdue</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {cleanPhone && (
                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 text-[11px] rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle size={12} />
                        <span>WhatsApp</span>
                      </a>
                    )}

                    {item.phone && (
                      <a
                        href={`tel:${item.phone}`}
                        className="px-2 py-1 text-[11px] rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center gap-1 transition-colors"
                        title="Direct Call"
                      >
                        <Phone size={12} />
                        <span>Call</span>
                      </a>
                    )}

                    {onSelectLeadId && (
                      <button
                        onClick={() => onSelectLeadId(item.id)}
                        className="px-2.5 py-1 text-[11px] rounded font-semibold bg-brand-subtle text-brand-primary border border-purple-200 hover:bg-brand-primary hover:text-white transition-colors"
                      >
                        Open Lead
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Pipeline Velocity & Billing Activity */}
        <div className="space-y-5">
          {/* Pipeline Stage Distribution */}
          <div className="hq-card bg-white border-brand-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-chip bg-brand-subtle flex items-center justify-center text-brand-primary">
                  <Kanban size={15} />
                </div>
                <h2 className="text-sm font-bold text-brand-heading">Opportunity Distribution</h2>
              </div>
              <button
                onClick={() => onNavigateTab('pipeline')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
              >
                <span>Pipeline Board</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { label: 'New Inquiries', count: metrics?.leadsByStage.new || 0, color: 'bg-purple-600', text: 'text-purple-700' },
                { label: 'Contacted', count: metrics?.leadsByStage.contacted || 0, color: 'bg-blue-600', text: 'text-blue-700' },
                { label: 'Proposal Sent', count: metrics?.leadsByStage.proposal_sent || 0, color: 'bg-amber-600', text: 'text-amber-700' },
                { label: 'Won / Converted', count: metrics?.leadsByStage.won || 0, color: 'bg-green-600', text: 'text-green-700' },
                { label: 'Closed / Lost', count: metrics?.leadsByStage.lost || 0, color: 'bg-gray-400', text: 'text-gray-600' },
              ].map((stageItem) => {
                const total = metrics?.totalLeads || 1;
                const percentage = Math.round((stageItem.count / (total > 0 ? total : 1)) * 100);

                return (
                  <div key={stageItem.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-brand-heading">{stageItem.label}</span>
                      <span className="font-semibold text-brand-heading tabular-nums">
                        {stageItem.count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-brand-section rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stageItem.color} rounded-full transition-all duration-300`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Milestone Billing Activity */}
          <div className="hq-card bg-white border-brand-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-chip bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <IndianRupee size={15} />
                </div>
                <h2 className="text-sm font-bold text-brand-heading">Recent Milestone Invoices</h2>
              </div>
              <button
                onClick={() => onNavigateTab('payments')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
              >
                <span>View All Invoices</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            {recentPayments.length === 0 ? (
              <div className="py-8 text-center text-xs text-brand-muted border border-dashed border-brand-border rounded-control bg-brand-section/50">
                No milestone invoices recorded yet. Click &quot;Record Invoice&quot; to set up receivables.
              </div>
            ) : (
              <div className="space-y-2">
                {recentPayments.map((py) => {
                  const isReceived = py.status === 'received';

                  return (
                    <div
                      key={py.id}
                      className="p-3 rounded-control border border-brand-border bg-white flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-brand-heading truncate">{py.title}</div>
                        <div className="text-[11px] text-brand-muted mt-0.5 truncate">
                          {py.clientName || 'Direct Client'} {py.invoiceNumber && `• ${py.invoiceNumber}`}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-brand-heading">{formatCurrency(py.amount)}</div>
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold mt-0.5 ${
                            isReceived
                              ? 'bg-green-100 text-green-800'
                              : py.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isReceived ? 'Received' : py.status === 'failed' ? 'Failed' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Client Deliverables */}
        <div className="space-y-5">
          <div className="hq-card bg-white border-brand-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-chip bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Briefcase size={15} />
                </div>
                <h2 className="text-sm font-bold text-brand-heading">Active Client Projects</h2>
              </div>
              <button
                onClick={() => onNavigateTab('projects')}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
              >
                <span>View All Projects</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

            {recentProjects.length === 0 ? (
              <div className="py-8 text-center text-xs text-brand-muted border border-dashed border-brand-border rounded-control bg-brand-section/50">
                No active projects found. Convert won leads or create a new delivery project.
              </div>
            ) : (
              <div className="space-y-3">
                {recentProjects.map((proj) => {
                  const percentComplete =
                    proj.totalTasks > 0
                      ? Math.round((proj.completedTasks / proj.totalTasks) * 100)
                      : 0;

                  return (
                    <div
                      key={proj.id}
                      onClick={() => onSelectProjectId && onSelectProjectId(proj.id)}
                      className="p-3.5 rounded-control border border-brand-border bg-white hover:border-brand-primary/40 cursor-pointer transition-all space-y-2 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-xs text-brand-heading group-hover:text-brand-primary transition-colors truncate">
                          {proj.title}
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 capitalize shrink-0">
                          {proj.status === 'review' ? 'In Review' : proj.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-brand-muted">
                        <span>Client: {proj.clientName}</span>
                        {proj.deadline && (
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            <span>Due {formatISTDate(proj.deadline)}</span>
                          </span>
                        )}
                      </div>

                      {/* Task Progress Bar */}
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[10px] text-brand-muted mb-1">
                          <span className="flex items-center gap-1">
                            <CheckSquare size={11} />
                            <span>
                              {proj.completedTasks} of {proj.totalTasks} deliverables done
                            </span>
                          </span>
                          <span className="font-semibold text-brand-heading">{percentComplete}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-brand-section rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-primary rounded-full transition-all duration-300"
                            style={{ width: `${percentComplete}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick System Diagnostics & Connection State */}
          <div className="hq-card bg-white border-brand-border p-5">
            <h3 className="text-xs font-bold text-brand-heading uppercase tracking-wider mb-3">
              Infrastructure Status
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-brand-border">
                <span className="text-brand-muted">Cloudflare D1 Studio</span>
                <span className="font-mono text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  <span>COMMAND_DB (Connected)</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-brand-border">
                <span className="text-brand-muted">Production Domain</span>
                <span className="font-mono text-brand-heading flex items-center gap-1">
                  <ExternalLink size={12} className="text-brand-primary" />
                  <span>commandcenter.infohq.in</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-brand-muted">Clerk Authentication</span>
                <span className="text-green-700 font-semibold">Superadmin Enforced</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
