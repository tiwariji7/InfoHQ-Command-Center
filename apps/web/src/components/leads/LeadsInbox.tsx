import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type {
  Lead,
  LeadStage,
  LeadSource,
  PaginatedResponse,
  DashboardOverviewResponse,
} from '@infohq/shared';
import { fetchLeads, fetchDashboardOverview, updateLeadStageApi } from '../../lib/api.js';
import { AddLeadModal } from './AddLeadModal.js';
import { LeadDetailDrawer } from './LeadDetailDrawer.js';
import {
  Search,
  Plus,
  Inbox,
  Phone,
  Mail,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Building2,
  Calendar,
  Filter,
  X,
  AlertCircle,
  LayoutList,
  Columns3,
  Flame,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface StageFilterItem {
  id: LeadStage | 'all';
  label: string;
  stageKey?: LeadStage;
}

const STAGE_FILTERS: StageFilterItem[] = [
  { id: 'all', label: 'All Inquiries' },
  { id: 'new', label: 'New', stageKey: 'new' },
  { id: 'contacted', label: 'Contacted', stageKey: 'contacted' },
  { id: 'proposal_sent', label: 'Proposal Sent', stageKey: 'proposal_sent' },
  { id: 'won', label: 'Won', stageKey: 'won' },
  { id: 'lost', label: 'Lost', stageKey: 'lost' },
];

const SOURCE_FILTER_OPTIONS: Array<{ id: LeadSource | 'all'; label: string }> = [
  { id: 'all', label: 'All Channels' },
  { id: 'website_contact', label: 'Website Contact' },
  { id: 'whatsapp_click', label: 'WhatsApp Click' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'referral', label: 'Referral' },
  { id: 'phone_call', label: 'Phone Call' },
  { id: 'other', label: 'Other' },
];

const STAGE_CONFIG: Record<
  LeadStage,
  {
    label: string;
    accentBorder: string;
    pillBg: string;
    pillText: string;
    pillBorder: string;
    dotColor: string;
  }
> = {
  new: {
    label: 'New',
    accentBorder: 'border-l-[#7C3AED]',
    pillBg: 'bg-[#FAF5FF]',
    pillText: 'text-[#6B21A8]',
    pillBorder: 'border-purple-200',
    dotColor: 'bg-[#9333EA]',
  },
  contacted: {
    label: 'Contacted',
    accentBorder: 'border-l-[#2563EB]',
    pillBg: 'bg-[#EFF6FF]',
    pillText: 'text-[#1D4ED8]',
    pillBorder: 'border-blue-200',
    dotColor: 'bg-[#2563EB]',
  },
  proposal_sent: {
    label: 'Proposal Sent',
    accentBorder: 'border-l-[#EA580C]',
    pillBg: 'bg-[#FFF7ED]',
    pillText: 'text-[#C2410C]',
    pillBorder: 'border-orange-200',
    dotColor: 'bg-[#EA580C]',
  },
  won: {
    label: 'Won',
    accentBorder: 'border-l-[#16A34A]',
    pillBg: 'bg-[#F0FDF4]',
    pillText: 'text-[#15803D]',
    pillBorder: 'border-green-200',
    dotColor: 'bg-[#16A34A]',
  },
  lost: {
    label: 'Lost',
    accentBorder: 'border-l-slate-400',
    pillBg: 'bg-slate-50',
    pillText: 'text-slate-600',
    pillBorder: 'border-slate-200',
    dotColor: 'bg-slate-400',
  },
};

function formatISTDate(epochMs: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(epochMs));
}

function formatISTTime(epochMs: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(epochMs));
}

function formatCurrency(budgetStr?: string | null): string {
  if (!budgetStr) return '—';
  const clean = budgetStr.replace(/[^0-9.]/g, '');
  const num = Number(clean);
  if (!clean || isNaN(num)) return budgetStr;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

function getWhatsAppDigits(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `91${cleaned}`;
  return cleaned;
}

function getInitials(name: string): string {
  if (!name) return 'HQ';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getSourceIconLabel(source: LeadSource) {
  switch (source) {
    case 'whatsapp_click':
      return { label: 'WhatsApp', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    case 'website_contact':
      return { label: 'Website', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
    case 'linkedin':
      return { label: 'LinkedIn', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    case 'referral':
      return { label: 'Referral', color: 'text-purple-700 bg-purple-50 border-purple-200' };
    case 'phone_call':
      return { label: 'Phone Call', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    default:
      return { label: 'Direct', color: 'text-gray-700 bg-gray-50 border-gray-200' };
  }
}

export const LeadsInbox: React.FC = () => {
  const { getToken } = useAuth();

  const [leadsData, setLeadsData] = useState<PaginatedResponse<Lead> | null>(null);
  const [overviewData, setOverviewData] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // View Mode: 'stream' (Linear / Attio row layout) | 'board' (Kanban columns)
  const [viewMode, setViewMode] = useState<'stream' | 'board'>('stream');

  // Quick Triage Filter: 'all' | 'needs_triage' | 'active_pipeline' | 'due_today' | 'won'
  const [activeQueue, setActiveQueue] = useState<
    'all' | 'needs_triage' | 'active_pipeline' | 'due_today' | 'won'
  >('all');

  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  // Load KPI overview metrics
  const loadOverview = useCallback(async () => {
    try {
      const res = await fetchDashboardOverview(getToken);
      setOverviewData(res);
    } catch {
      // Non-blocking
    }
  }, [getToken]);

  // Load leads with filters & pagination
  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchLeads(getToken, {
        page,
        pageSize,
        stage: stageFilter === 'all' ? undefined : stageFilter,
        search: searchQuery.trim() || undefined,
      });
      setLeadsData(res);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load inbound leads.');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, page, pageSize, stageFilter, searchQuery]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Handle stage change inline directly from row
  const handleInlineStageUpdate = async (leadId: string, newStage: LeadStage, e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdatingLeadId(leadId);
    try {
      await updateLeadStageApi(getToken, leadId, { stage: newStage });
      await Promise.all([loadLeads(), loadOverview()]);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update lead status');
    } finally {
      setUpdatingLeadId(null);
    }
  };

  // Quick Triage Segment Click
  const handleQueueClick = (
    queue: 'all' | 'needs_triage' | 'active_pipeline' | 'due_today' | 'won'
  ) => {
    setActiveQueue(queue);
    setPage(1);

    switch (queue) {
      case 'needs_triage':
        setStageFilter('new');
        break;
      case 'active_pipeline':
        setStageFilter('contacted');
        break;
      case 'won':
        setStageFilter('won');
        break;
      case 'due_today':
      case 'all':
      default:
        setStageFilter('all');
        break;
    }
  };

  const handleStageTabChange = (stage: LeadStage | 'all') => {
    setStageFilter(stage);
    setActiveQueue(
      stage === 'new'
        ? 'needs_triage'
        : stage === 'won'
        ? 'won'
        : stage === 'all'
        ? 'all'
        : 'active_pipeline'
    );
    setPage(1);
  };

  // Filter items based on active parameters
  const now = Date.now();
  const filteredLeads = useMemo(() => {
    let list = leadsData?.data || [];

    if (sourceFilter !== 'all') {
      list = list.filter((l) => l.source === sourceFilter);
    }

    if (activeQueue === 'due_today') {
      list = list.filter((l) => {
        if (!l.nextFollowUpAt) return false;
        const isOverdue = l.nextFollowUpAt < now;
        const isToday =
          new Date(l.nextFollowUpAt).toDateString() === new Date(now).toDateString();
        return isOverdue || isToday;
      });
    }

    return list;
  }, [leadsData?.data, sourceFilter, activeQueue, now]);

  // Derived metrics
  const metrics = overviewData?.metrics;
  const totalLeadsCount = metrics?.totalLeads ?? leadsData?.pagination.total ?? 0;
  const triageNewCount = metrics?.leadsByStage.new ?? 0;
  const activePipelineCount =
    (metrics?.leadsByStage.new || 0) +
    (metrics?.leadsByStage.contacted || 0) +
    (metrics?.leadsByStage.proposal_sent || 0);
  const followUpsDueCount = metrics?.followUpsDueTodayCount ?? 0;
  const wonCount = metrics?.leadsByStage.won ?? 0;

  // Kanban grouped columns
  const kanbanColumns = useMemo(() => {
    const stages: LeadStage[] = ['new', 'contacted', 'proposal_sent', 'won', 'lost'];
    return stages.map((stage) => {
      const items = filteredLeads.filter((l) => l.stage === stage);
      return {
        stage,
        config: STAGE_CONFIG[stage],
        items,
        count: items.length,
      };
    });
  }, [filteredLeads]);

  return (
    <div className="space-y-5">
      {/* ========================================================= */}
      {/* 1. TOP HEADER: COMMAND BAR WITH VIEW TOGGLES & ACTIONS     */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE]">
              <Sparkles size={11} />
              Inbound Triage Engine
            </span>
            <span className="text-xs text-brand-muted hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-brand-muted hidden sm:inline">
              Instant Lead Qualification & Routing
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A085C] mt-1">
            Leads{' '}
            <span className="bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#5B4CF5] bg-clip-text text-transparent">
              Command Stream
            </span>
          </h1>
        </div>

        {/* Action Controls & Layout Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* View Mode Switcher: Stream vs Board */}
          <div className="inline-flex items-center p-1 rounded-xl bg-white border border-[#EDE8F5] shadow-2xs">
            <button
              onClick={() => setViewMode('stream')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'stream'
                  ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-xs'
                  : 'text-brand-muted hover:text-brand-heading'
              }`}
              title="Linear-style Triage Stream"
            >
              <LayoutList size={14} />
              <span>Stream</span>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-xs'
                  : 'text-brand-muted hover:text-brand-heading'
              }`}
              title="Attio-style Pipeline Board"
            >
              <Columns3 size={14} />
              <span>Board</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              loadOverview();
              loadLeads();
            }}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white border border-[#EDE8F5] text-brand-muted hover:text-[#7C3AED] hover:border-[#7C3AED]/40 shadow-2xs transition-all cursor-pointer"
            title="Refresh Inbound Leads"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-[#7C3AED]' : ''} />
          </button>

          {/* Add Inbound Lead CTA */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-xs sm:text-sm font-bold shadow-[0_4px_16px_rgba(124,58,237,0.22)] hover:shadow-[0_6px_22px_rgba(124,58,237,0.32)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>New Lead</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. BESPOKE INTERACTIVE TRIAGE BAR (Attio / Superhuman Style) */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#EDE8F5] shadow-[0_4px_24px_rgba(124,58,237,0.04)] overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#EDE8F5]">
          {/* Segment 1: Needs Triage */}
          <button
            onClick={() => handleQueueClick('needs_triage')}
            className={`p-4 sm:p-5 text-left transition-all cursor-pointer group ${
              activeQueue === 'needs_triage'
                ? 'bg-[#FAF5FF] border-b-2 lg:border-b-0 border-[#7C3AED]'
                : 'hover:bg-[#FAF9FD]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-muted flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
                Needs Triage
              </span>
              <span className="text-[10px] font-bold text-[#7C3AED] bg-[#EDE9FE] px-2 py-0.5 rounded-full">
                Unqualified
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-[#1A085C]">
                {triageNewCount}
              </span>
              <span className="text-xs text-brand-muted font-medium">fresh leads</span>
            </div>
            <div className="mt-1 text-[11px] text-[#7C3AED] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Qualify queue <ArrowRight size={11} />
            </div>
          </button>

          {/* Segment 2: Active Sales Pipeline */}
          <button
            onClick={() => handleQueueClick('active_pipeline')}
            className={`p-4 sm:p-5 text-left transition-all cursor-pointer group ${
              activeQueue === 'active_pipeline'
                ? 'bg-[#EFF6FF] border-b-2 lg:border-b-0 border-[#2563EB]'
                : 'hover:bg-[#FAF9FD]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-muted flex items-center gap-1.5">
                <Flame size={13} className="text-[#2563EB]" />
                Active Deals
              </span>
              <span className="text-[10px] font-bold text-[#1D4ED8] bg-[#EFF6FF] px-2 py-0.5 rounded-full border border-blue-100">
                In Flight
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-[#1A085C]">
                {activePipelineCount}
              </span>
              <span className="text-xs text-brand-muted font-medium">engagements</span>
            </div>
            <div className="mt-1 text-[11px] text-[#2563EB] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Review pipeline <ArrowRight size={11} />
            </div>
          </button>

          {/* Segment 3: Due Today & Overdue */}
          <button
            onClick={() => handleQueueClick('due_today')}
            className={`p-4 sm:p-5 text-left transition-all cursor-pointer group ${
              activeQueue === 'due_today'
                ? 'bg-[#FFF7ED] border-b-2 lg:border-b-0 border-[#EA580C]'
                : 'hover:bg-[#FAF9FD]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-muted flex items-center gap-1.5">
                <Clock size={13} className="text-[#EA580C]" />
                Action Due
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  followUpsDueCount > 0
                    ? 'text-orange-700 bg-orange-100 border border-orange-200'
                    : 'text-gray-600 bg-gray-100'
                }`}
              >
                {followUpsDueCount > 0 ? 'Urgent' : 'Clear'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-[#EA580C]">
                {followUpsDueCount}
              </span>
              <span className="text-xs text-brand-muted font-medium">due today</span>
            </div>
            <div className="mt-1 text-[11px] text-[#EA580C] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Call / message <ArrowRight size={11} />
            </div>
          </button>

          {/* Segment 4: Converted Won */}
          <button
            onClick={() => handleQueueClick('won')}
            className={`p-4 sm:p-5 text-left transition-all cursor-pointer group ${
              activeQueue === 'won'
                ? 'bg-[#F0FDF4] border-b-2 lg:border-b-0 border-[#16A34A]'
                : 'hover:bg-[#FAF9FD]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-muted flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-[#16A34A]" />
                Won Deals
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Converted
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-[#16A34A]">
                {wonCount}
              </span>
              <span className="text-xs text-brand-muted font-medium">
                {totalLeadsCount > 0 ? `(${Math.round((wonCount / totalLeadsCount) * 100)}% win)` : ''}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-[#16A34A] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Converted accounts <ArrowRight size={11} />
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. SEARCH & DENSE FILTER STRIP                            */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#EDE8F5] p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Stage Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {STAGE_FILTERS.map((filter) => {
              const isActive = stageFilter === filter.id && activeQueue !== 'due_today';
              let count: number | null = null;
              if (metrics?.leadsByStage && filter.stageKey) {
                count = metrics.leadsByStage[filter.stageKey] ?? 0;
              } else if (filter.id === 'all') {
                count = totalLeadsCount;
              }

              return (
                <button
                  key={filter.id}
                  onClick={() => handleStageTabChange(filter.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-xs'
                      : 'bg-[#FAF9FD] text-[#475569] border border-[#EDE8F5] hover:bg-[#EDE9FE]/50 hover:text-[#7C3AED]'
                  }`}
                >
                  <span>{filter.label}</span>
                  {count !== null && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-extrabold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#EDE9FE] text-[#7C3AED]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Channel Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value as LeadSource | 'all');
                  setPage(1);
                }}
                className="h-9 pl-8 pr-7 rounded-xl border border-[#EDE8F5] bg-[#FAF9FD] text-xs font-bold text-brand-heading focus:bg-white focus:border-[#7C3AED] outline-none appearance-none cursor-pointer transition-all"
              >
                {SOURCE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Filter
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none"
              />
            </div>

            {(stageFilter !== 'all' || sourceFilter !== 'all' || activeQueue !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setStageFilter('all');
                  setSourceFilter('all');
                  setActiveQueue('all');
                  setSearchQuery('');
                  setPage(1);
                }}
                className="h-9 px-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="Reset all active filters"
              >
                <X size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar with live keyword typing */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Quick search by prospect name, phone, email, or company..."
            className="w-full h-10 pl-9 pr-9 rounded-xl border border-[#EDE8F5] bg-[#FAF9FD] text-xs font-semibold text-brand-heading placeholder:text-brand-muted/70 focus:bg-white focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-brand-muted hover:text-brand-heading"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-brand-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={loadLeads}
            className="px-2.5 py-1 rounded-lg bg-white border border-red-200 font-bold hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. VIEW MODE 1: LINEAR / ATTIO-STYLE TRIAGE STREAM       */}
      {/* ========================================================= */}
      {viewMode === 'stream' && (
        <div className="bg-white rounded-2xl border border-[#EDE8F5] shadow-[0_4px_24px_rgba(124,58,237,0.04)] overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw size={26} className="animate-spin text-[#7C3AED]" />
              <span className="text-xs font-bold text-brand-muted">Fetching triage queue...</span>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center mx-auto mb-3 shadow-2xs">
                <Inbox size={22} />
              </div>
              <h3 className="text-base font-bold text-brand-heading">
                Queue Clear
              </h3>
              <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto font-medium">
                No inquiries match your current filter parameters. Try switching stages or clearing the search keyword.
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-xs font-bold shadow-xs inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                Create New Lead
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#EDE8F5]">
              {/* Header Ribbon for Table Columns */}
              <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 bg-[#FAF9FD] text-[11px] font-bold text-brand-muted uppercase tracking-wider border-b border-[#EDE8F5]">
                <div className="col-span-4">Prospect & Channel</div>
                <div className="col-span-3">Contact Information</div>
                <div className="col-span-2">Requirement & Value</div>
                <div className="col-span-2">Pipeline Stage</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {/* Rows */}
              {filteredLeads.map((lead) => {
                const config = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.new;
                const sourceBadge = getSourceIconLabel(lead.source);
                const initials = getInitials(lead.name);
                const whatsappDigits = getWhatsAppDigits(lead.phone);

                // Urgency indicator
                const isOverdue = lead.nextFollowUpAt ? lead.nextFollowUpAt < now : false;
                const isDueToday = lead.nextFollowUpAt
                  ? new Date(lead.nextFollowUpAt).toDateString() === new Date(now).toDateString()
                  : false;

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`group relative p-4 sm:px-5 sm:py-3.5 border-l-4 ${config.accentBorder} hover:bg-[#FAF9FD]/80 transition-all cursor-pointer`}
                  >
                    {/* Desktop Grid Layout */}
                    <div className="hidden md:grid grid-cols-12 gap-3 items-center">
                      {/* Col 1: Prospect & Company (Col span 4) */}
                      <div className="col-span-4 flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-brand-heading group-hover:text-[#7C3AED] transition-colors truncate">
                              {lead.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${sourceBadge.color}`}
                            >
                              {sourceBadge.label}
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-brand-muted flex items-center gap-1 mt-0.5 truncate">
                            {lead.company ? (
                              <>
                                <Building2 size={11} className="shrink-0" />
                                <span>{lead.company}</span>
                              </>
                            ) : (
                              <span>Created {formatISTDate(lead.createdAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Col 2: Contact Info (Col span 3) */}
                      <div className="col-span-3 min-w-0 text-xs">
                        {lead.phone ? (
                          <div className="font-mono text-[11px] font-semibold text-brand-heading truncate">
                            {lead.phone}
                          </div>
                        ) : null}
                        {lead.email ? (
                          <div className="text-[11px] font-medium text-brand-muted truncate mt-0.5">
                            {lead.email}
                          </div>
                        ) : null}
                        {!lead.phone && !lead.email && (
                          <span className="text-[11px] text-brand-muted/70 italic">No contact provided</span>
                        )}
                      </div>

                      {/* Col 3: Service & Budget (Col span 2) */}
                      <div className="col-span-2 min-w-0 text-xs">
                        <div className="font-semibold text-xs text-brand-heading truncate">
                          {lead.serviceNeeded || 'General Inquiry'}
                        </div>
                        <div className="text-[11px] font-bold text-emerald-700 tabular-nums mt-0.5">
                          {formatCurrency(lead.budget)}
                        </div>
                      </div>

                      {/* Col 4: Stage & Follow-Up (Col span 2) */}
                      <div className="col-span-2 min-w-0">
                        {/* Quick inline stage switcher dropdown */}
                        <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={lead.stage}
                            disabled={updatingLeadId === lead.id}
                            onChange={(e) =>
                              handleInlineStageUpdate(lead.id, e.target.value as LeadStage, e as unknown as React.MouseEvent)
                            }
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border appearance-none pr-5 cursor-pointer outline-none transition-colors ${config.pillBg} ${config.pillText} ${config.pillBorder}`}
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="proposal_sent">Proposal Sent</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                          </select>
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-current text-[10px]">
                            ▾
                          </span>
                        </div>

                        {/* Follow-up reminder */}
                        {lead.nextFollowUpAt && (
                          <div className="mt-1 flex items-center gap-1">
                            {isOverdue ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                Overdue
                              </span>
                            ) : isDueToday ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Today {formatISTTime(lead.nextFollowUpAt)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-muted">
                                <Calendar size={10} />
                                {formatISTDate(lead.nextFollowUpAt)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Col 5: Actions (Col span 1) */}
                      <div className="col-span-1 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {lead.phone && (
                          <a
                            href={`https://wa.me/${whatsappDigits}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Direct WhatsApp"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                          >
                            <MessageCircle size={14} />
                          </a>
                        )}
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            title="Direct Call"
                            className="p-1.5 rounded-lg text-[#7C3AED] hover:bg-[#EDE9FE] transition-colors"
                          >
                            <Phone size={14} />
                          </a>
                        )}
                        <button
                          onClick={() => setSelectedLeadId(lead.id)}
                          title="Open Details Drawer"
                          className="p-1.5 rounded-lg text-brand-muted hover:text-[#7C3AED] hover:bg-[#EDE9FE] transition-colors"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Mobile Card Layout (< 768px) */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-brand-heading">
                              {lead.name}
                            </div>
                            <div className="text-[11px] text-brand-muted flex items-center gap-1">
                              {lead.company || sourceBadge.label}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${config.pillBg} ${config.pillText} ${config.pillBorder}`}
                        >
                          {config.label}
                        </span>
                      </div>

                      <div className="bg-[#FAF9FD] p-2.5 rounded-xl border border-[#EDE8F5] text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-brand-muted">Requirement:</span>
                          <span className="font-semibold text-brand-heading truncate max-w-[170px]">
                            {lead.serviceNeeded || 'General Inquiry'}
                          </span>
                        </div>
                        {lead.budget && (
                          <div className="flex items-center justify-between">
                            <span className="text-brand-muted">Budget:</span>
                            <span className="font-bold text-emerald-700">
                              {formatCurrency(lead.budget)}
                            </span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span className="text-brand-muted font-sans">Phone:</span>
                            <span>{lead.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Mobile Action Buttons */}
                      <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        {lead.phone && (
                          <>
                            <a
                              href={`tel:${lead.phone}`}
                              className="flex-1 h-10 rounded-xl bg-white border border-[#EDE8F5] text-brand-heading font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                            >
                              <Phone size={13} className="text-[#7C3AED]" />
                              Call
                            </a>
                            <a
                              href={`https://wa.me/${whatsappDigits}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                            >
                              <MessageCircle size={13} />
                              WhatsApp
                            </a>
                          </>
                        )}
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="flex-1 h-10 rounded-xl bg-white border border-[#EDE8F5] text-brand-heading font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Mail size={13} className="text-[#7C3AED]" />
                            Email
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stream Pagination */}
          {leadsData && leadsData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#FAF9FD] border-t border-[#EDE8F5] text-xs">
              <span className="text-brand-muted font-medium">
                Showing <strong className="text-brand-heading">{filteredLeads.length}</strong> of{' '}
                <strong className="text-brand-heading">{leadsData.pagination.total}</strong> triage items
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={leadsData.pagination.page <= 1}
                  className="p-1.5 rounded-lg border border-[#EDE8F5] bg-white text-brand-heading disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EDE9FE]/50 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-brand-heading font-bold tabular-nums px-2">
                  {leadsData.pagination.page} / {leadsData.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(leadsData.pagination.totalPages, p + 1))}
                  disabled={leadsData.pagination.page >= leadsData.pagination.totalPages}
                  className="p-1.5 rounded-lg border border-[#EDE8F5] bg-white text-brand-heading disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EDE9FE]/50 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. VIEW MODE 2: ATTIO-STYLE PIPELINE KANBAN BOARD        */}
      {/* ========================================================= */}
      {viewMode === 'board' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start gap-4 min-w-[1050px]">
            {kanbanColumns.map(({ stage, config, items, count }) => (
              <div
                key={stage}
                className="w-80 shrink-0 bg-[#FAF9FD] rounded-2xl border border-[#EDE8F5] p-3 flex flex-col max-h-[750px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1 py-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
                    <span className="text-xs font-bold text-brand-heading">{config.label}</span>
                  </div>
                  <span className="text-xs font-bold text-brand-muted bg-white border border-[#EDE8F5] px-2 py-0.5 rounded-full">
                    {count}
                  </span>
                </div>

                {/* Column Items */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {items.length === 0 ? (
                    <div className="p-6 text-center text-xs text-brand-muted/70 font-medium border border-dashed border-[#EDE8F5] rounded-xl bg-white/50">
                      No leads in {config.label.toLowerCase()}
                    </div>
                  ) : (
                    items.map((lead) => {
                      const whatsappDigits = getWhatsAppDigits(lead.phone);
                      const isOverdue = lead.nextFollowUpAt ? lead.nextFollowUpAt < now : false;

                      return (
                        <div
                          key={lead.id}
                          onClick={() => setSelectedLeadId(lead.id)}
                          className="bg-white rounded-xl border border-[#EDE8F5] p-3.5 shadow-2xs hover:shadow-md hover:border-[#7C3AED]/40 transition-all cursor-pointer space-y-2.5 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-xs text-brand-heading group-hover:text-[#7C3AED] transition-colors">
                                {lead.name}
                              </div>
                              {lead.company && (
                                <div className="text-[11px] font-medium text-brand-muted flex items-center gap-1 mt-0.5">
                                  <Building2 size={10} />
                                  <span>{lead.company}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              {formatCurrency(lead.budget)}
                            </span>
                          </div>

                          <div className="text-[11px] text-brand-muted font-medium truncate">
                            {lead.serviceNeeded || 'General Consultation'}
                          </div>

                          {/* Follow-up reminder */}
                          {lead.nextFollowUpAt && (
                            <div className="text-[10px]">
                              {isOverdue ? (
                                <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                  Overdue: {formatISTDate(lead.nextFollowUpAt)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-medium text-brand-muted">
                                  <Calendar size={10} />
                                  {formatISTDate(lead.nextFollowUpAt)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Quick Actions Bar */}
                          <div
                            className="pt-2 border-t border-[#EDE8F5] flex items-center justify-between"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              {lead.phone && (
                                <>
                                  <a
                                    href={`tel:${lead.phone}`}
                                    title="Call"
                                    className="p-1 rounded-md text-brand-muted hover:text-[#7C3AED] hover:bg-[#EDE9FE]"
                                  >
                                    <Phone size={12} />
                                  </a>
                                  <a
                                    href={`https://wa.me/${whatsappDigits}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="WhatsApp"
                                    className="p-1 rounded-md text-brand-muted hover:text-emerald-600 hover:bg-emerald-50"
                                  >
                                    <MessageCircle size={12} />
                                  </a>
                                </>
                              )}
                            </div>

                            {/* Move forward button */}
                            {stage !== 'won' && stage !== 'lost' && (
                              <button
                                onClick={(e) => {
                                  const nextStage: LeadStage =
                                    stage === 'new'
                                      ? 'contacted'
                                      : stage === 'contacted'
                                      ? 'proposal_sent'
                                      : 'won';
                                  handleInlineStageUpdate(lead.id, nextStage, e);
                                }}
                                disabled={updatingLeadId === lead.id}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#7C3AED] bg-[#EDE9FE] px-2 py-0.5 rounded-md hover:bg-[#DDD6FE] transition-colors"
                              >
                                <span>Advance</span>
                                <ArrowUpRight size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          loadOverview();
          loadLeads();
        }}
      />

      {/* Lead Detail Drawer */}
      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={() => {
          loadOverview();
          loadLeads();
        }}
      />
    </div>
  );
};
