import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { MorningBriefingDigest } from '@infohq/shared';
import {
  fetchAutomationDigest,
  triggerAutomationAudit,
  markAlertRead,
} from '../../lib/api.js';
import {
  Sparkles,
  RefreshCw,
  Phone,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  BellRing,
} from 'lucide-react';

interface MorningBriefingBannerProps {
  onNavigateTab: (tab: string) => void;
  onSelectLeadId?: (leadId: string) => void;
}

export const MorningBriefingBanner: React.FC<MorningBriefingBannerProps> = ({
  onNavigateTab,
  onSelectLeadId,
}) => {
  const { getToken } = useAuth();
  const [digest, setDigest] = useState<MorningBriefingDigest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  const loadDigest = useCallback(async () => {
    try {
      const data = await fetchAutomationDigest(getToken);
      setDigest(data);
    } catch (err) {
      console.error('Failed to load automation digest:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadDigest();
  }, [loadDigest]);

  const handleRunAudit = async () => {
    setIsRunningAudit(true);
    try {
      const res = await triggerAutomationAudit(getToken);
      if (res.digest) {
        setDigest(res.digest);
      }
    } catch (err) {
      console.error('Failed to trigger manual audit:', err);
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    setDismissedAlertIds((prev) => [...prev, alertId]);
    try {
      await markAlertRead(getToken, alertId);
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  

  if (isLoading) {
    return (
      <div className="w-full bg-white rounded-2xl border border-[#EDE8F5] p-4 shadow-xs animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100" />
          <div className="space-y-1.5">
            <div className="w-36 h-3.5 bg-slate-100 rounded" />
            <div className="w-64 h-2.5 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="w-24 h-8 bg-slate-100 rounded-lg" />
      </div>
    );
  }

  const summary = digest?.summary;
  const activeAlerts = (digest?.recentAlerts || []).filter(
    (a) => !dismissedAlertIds.includes(a.id) && !a.isRead
  );

  return (
    <div className="w-full bg-white rounded-2xl border border-[#EDE8F5] shadow-xs overflow-hidden transition-all duration-200">
      {/* Top Banner Row */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-[#FAF9FD] to-[#EDE9FE]/20">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#7C3AED]/20">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-[#1A085C] tracking-tight">
                Daily Command Briefing
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Edge Cron Active (8:30 AM IST)
              </span>
            </div>
            <p className="text-xs text-brand-muted mt-0.5 font-medium">
              Automated audit of incoming leads, follow-up deadlines, and pending invoice collections.
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={handleRunAudit}
            disabled={isRunningAudit}
            className="h-9 px-3 rounded-xl bg-[#FAF9FD] hover:bg-[#EDE9FE]/50 text-[#1A085C] border border-[#EDE8F5] text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-2xs active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRunningAudit ? 'animate-spin text-[#7C3AED]' : 'text-slate-500'} />
            <span>{isRunningAudit ? 'Auditing...' : 'Run Audit Now'}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-9 px-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm shadow-[#7C3AED]/20 active:scale-98 cursor-pointer"
          >
            <span>{isExpanded ? 'Collapse' : 'View Action Items'}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Chips */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EDE8F5] border-t border-[#EDE8F5] bg-[#FAF9FD]/40">
        {/* Metric 1: Follow-Ups Due */}
        <div
          onClick={() => onNavigateTab('leads')}
          className="p-3.5 sm:p-4 hover:bg-white transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-brand-muted text-[11px] font-semibold">
            <span>Follow-Ups Today</span>
            <Clock size={13} className="text-[#7C3AED] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-[#1A085C] tabular-nums">
              {summary?.dueFollowUpsCount ?? 0}
            </span>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
              Needs Call
            </span>
          </div>
        </div>

        {/* Metric 2: Overdue / Pending Invoices */}
        <div
          onClick={() => onNavigateTab('billing')}
          className="p-3.5 sm:p-4 hover:bg-white transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-brand-muted text-[11px] font-semibold">
            <span>Pending Invoices</span>
            <Receipt size={13} className="text-[#7C3AED] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-[#1A085C] tabular-nums">
              {formatCurrency(summary?.pendingInvoicesTotal ?? 0)}
            </span>
            {summary && summary.overdueInvoicesCount > 0 && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                {summary.overdueInvoicesCount} Overdue
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: New Leads (24h) */}
        <div
          onClick={() => onNavigateTab('leads')}
          className="p-3.5 sm:p-4 hover:bg-white transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-brand-muted text-[11px] font-semibold">
            <span>Inbound Leads (24h)</span>
            <BellRing size={13} className="text-[#7C3AED] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-[#1A085C] tabular-nums">
              {summary?.newLeads24h ?? 0}
            </span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
              Live Pipeline
            </span>
          </div>
        </div>

        {/* Metric 4: Upcoming Deadlines */}
        <div
          onClick={() => onNavigateTab('projects')}
          className="p-3.5 sm:p-4 hover:bg-white transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between text-brand-muted text-[11px] font-semibold">
            <span>Project Milestones (72h)</span>
            <ShieldCheck size={13} className="text-[#7C3AED] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-[#1A085C] tabular-nums">
              {summary?.upcomingDeadlinesCount ?? 0}
            </span>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
              On Track
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Action Items Drawer */}
      {isExpanded && (
        <div className="p-4 sm:p-5 border-t border-[#EDE8F5] bg-white space-y-4 animate-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Box: Due Follow-Ups */}
            <div className="rounded-xl border border-[#EDE8F5] p-3.5 bg-[#FAF9FD]/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Phone size={14} className="text-[#7C3AED]" />
                  <h3 className="text-xs font-black text-[#1A085C] uppercase tracking-wider">
                    Today&apos;s Follow-Ups
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-brand-muted">
                  {digest?.dueFollowUps.length || 0} Scheduled
                </span>
              </div>

              {digest?.dueFollowUps && digest.dueFollowUps.length > 0 ? (
                <div className="space-y-2">
                  {digest.dueFollowUps.slice(0, 4).map((f) => (
                    <div
                      key={f.leadId}
                      className="p-2.5 bg-white rounded-lg border border-[#EDE8F5] flex items-center justify-between gap-2 shadow-2xs hover:border-[#7C3AED]/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#1A085C] truncate">
                            {f.name}
                          </span>
                          {f.isOverdue && (
                            <span className="text-[8px] font-black px-1 py-0.2 rounded bg-red-50 text-red-700 border border-red-200">
                              Overdue
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-brand-muted truncate">
                          {f.phone || f.email || 'Direct Inquiry'} • {f.serviceNeeded || 'General'}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (onSelectLeadId) onSelectLeadId(f.leadId);
                          else onNavigateTab('leads');
                        }}
                        className="px-2 py-1 rounded bg-[#EDE9FE] hover:bg-[#DDD6FE] text-[#7C3AED] text-[10px] font-bold shrink-0 transition-colors cursor-pointer"
                      >
                        Open Lead
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-brand-muted font-medium">
                  <CheckCircle2 size={18} className="mx-auto text-emerald-500 mb-1" />
                  All follow-ups for today are clear!
                </div>
              )}
            </div>

            {/* Right Box: Critical Alerts & Invoices */}
            <div className="rounded-xl border border-[#EDE8F5] p-3.5 bg-[#FAF9FD]/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600" />
                  <h3 className="text-xs font-black text-[#1A085C] uppercase tracking-wider">
                    System Alerts & Warnings
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-brand-muted">
                  {activeAlerts.length} Active
                </span>
              </div>

              {activeAlerts.length > 0 ? (
                <div className="space-y-2">
                  {activeAlerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-2.5 rounded-lg border flex items-start justify-between gap-2 shadow-2xs ${
                        alert.severity === 'critical'
                          ? 'bg-red-50/70 border-red-200 text-red-900'
                          : alert.severity === 'warning'
                          ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                          : 'bg-white border-[#EDE8F5] text-brand-heading'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold">{alert.title}</div>
                        <div className="text-[10px] opacity-80 leading-tight mt-0.5">
                          {alert.message}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {alert.link && (
                          <button
                            onClick={() => onNavigateTab(alert.link?.replace('/', '') || 'overview')}
                            className="px-2 py-1 rounded bg-white border border-[#EDE8F5] text-[10px] font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            Review
                          </button>
                        )}
                        <button
                          onClick={() => handleDismissAlert(alert.id)}
                          className="px-1.5 py-1 text-[10px] font-bold opacity-60 hover:opacity-100 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-brand-muted font-medium">
                  <CheckCircle2 size={18} className="mx-auto text-emerald-500 mb-1" />
                  No critical warnings or pending alerts.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
