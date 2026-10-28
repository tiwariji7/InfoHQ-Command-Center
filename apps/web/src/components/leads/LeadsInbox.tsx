import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Lead, LeadStage, LeadSource, PaginatedResponse, DashboardOverviewResponse } from '@infohq/shared';
import { fetchLeads, fetchDashboardOverview } from '../../lib/api.js';
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
  Users,
  KanbanSquare,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  RefreshCw,
  Building2,
  Calendar,
  Filter,
  X,
  AlertCircle,
} from 'lucide-react';

interface StageFilterItem {
  id: LeadStage | 'all';
  label: string;
  stageKey?: LeadStage;
}

const STAGE_FILTERS: StageFilterItem[] = [
  { id: 'all', label: 'All Leads' },
  { id: 'new', label: 'New', stageKey: 'new' },
  { id: 'contacted', label: 'Contacted', stageKey: 'contacted' },
  { id: 'proposal_sent', label: 'Proposal Sent', stageKey: 'proposal_sent' },
  { id: 'won', label: 'Won', stageKey: 'won' },
  { id: 'lost', label: 'Lost', stageKey: 'lost' },
];

const SOURCE_FILTER_OPTIONS: Array<{ id: LeadSource | 'all'; label: string }> = [
  { id: 'all', label: 'All Sources' },
  { id: 'website_contact', label: 'Website Contact' },
  { id: 'whatsapp_click', label: 'WhatsApp Click' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'referral', label: 'Referral' },
  { id: 'phone_call', label: 'Phone Call' },
  { id: 'other', label: 'Other' },
];

function getStageBadge(stage: LeadStage) {
  switch (stage) {
    case 'new':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF5FF] text-[#6B21A8] border border-purple-100">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9333EA]" />
          New
        </span>
      );
    case 'contacted':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-100">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
          Contacted
        </span>
      );
    case 'proposal_sent':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF7ED] text-[#C2410C] border border-orange-100">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
          Proposal Sent
        </span>
      );
    case 'won':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F0FDF4] text-[#15803D] border border-green-100">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          Won
        </span>
      );
    case 'lost':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-50 text-gray-600 border border-gray-200">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          Lost
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 capitalize">
          {stage}
        </span>
      );
  }
}

function getSourceBadge(source: LeadSource) {
  switch (source) {
    case 'website_contact':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
          Website Contact
        </span>
      );
    case 'whatsapp_click':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
          WhatsApp Click
        </span>
      );
    case 'linkedin':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
          LinkedIn
        </span>
      );
    case 'referral':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
          Referral
        </span>
      );
    case 'phone_call':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
          Phone Call
        </span>
      );
    case 'other':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200">
          Other
        </span>
      );
  }
}

function formatISTDate(epochMs: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(epochMs));
}

function formatISTDateTime(epochMs: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
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

export const LeadsInbox: React.FC = () => {
  const { getToken } = useAuth();

  const [leadsData, setLeadsData] = useState<PaginatedResponse<Lead> | null>(null);
  const [overviewData, setOverviewData] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Load KPI overview metrics
  const loadOverview = useCallback(async () => {
    try {
      const res = await fetchDashboardOverview(getToken);
      setOverviewData(res);
    } catch {
      // Non-blocking for inbox
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

  const handleStageChange = (stage: LeadStage | 'all') => {
    setStageFilter(stage);
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadLeads();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(1);
  };

  // Client-side source filter if specified
  const displayedLeads = (leadsData?.data || []).filter((lead) => {
    if (sourceFilter === 'all') return true;
    return lead.source === sourceFilter;
  });

  // Overview metrics
  const metrics = overviewData?.metrics;
  const totalLeadsCount = metrics?.totalLeads ?? leadsData?.pagination.total ?? 0;
  const activePipelineCount =
    (metrics?.leadsByStage.new || 0) +
    (metrics?.leadsByStage.contacted || 0) +
    (metrics?.leadsByStage.proposal_sent || 0);
  const followUpsDueCount = metrics?.followUpsDueTodayCount ?? 0;
  const wonCount = metrics?.leadsByStage.won ?? 0;

  // Next follow up urgency check
  const now = Date.now();
  const getFollowUpPill = (followUpEpoch?: number | null) => {
    if (!followUpEpoch) return null;
    const isOverdue = followUpEpoch < now;
    const isDueToday =
      new Date(followUpEpoch).toDateString() === new Date(now).toDateString();

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          Overdue: {formatISTDate(followUpEpoch)}
        </span>
      );
    }
    if (isDueToday) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Due Today: {formatISTDateTime(followUpEpoch)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#EDE9FE]/70 text-[#7C3AED] border border-[#DDD6FE]">
        <Clock size={11} />
        {formatISTDate(followUpEpoch)}
      </span>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* ========================================================= */}
      {/* 0. HEADER & ACTIONS (Half-Gradient Luxury Heading)        */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-black tracking-tight text-[#1A085C]">
            Leads &{' '}
            <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">
              Inbound Inquiries
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-0.5 font-medium">
            Centralized pipeline for website forms, WhatsApp leads, referrals, and consultation inquiries.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Refresh Action */}
          <button
            onClick={() => {
              loadOverview();
              loadLeads();
            }}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white border border-[#EDE8F5] text-brand-muted hover:text-[#7C3AED] hover:border-[#7C3AED]/40 shadow-2xs transition-all cursor-pointer"
            title="Refresh Leads & Metrics"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-[#7C3AED]' : ''} />
          </button>

          {/* Add Lead Primary CTA Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-xs sm:text-sm font-bold shadow-[0_4px_16px_rgba(124,58,237,0.25)] hover:shadow-[0_8px_24px_rgba(124,58,237,0.35)] hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>Add Inbound Lead</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. TOP 4 EXECUTIVE KPI CARDS (Vertix Glass-Card Style)    */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Inbound Leads */}
        <div
          onClick={() => handleStageChange('all')}
          className="bg-white rounded-2xl border border-[#EDE8F5] p-6 shadow-[0_4px_20px_rgba(124,58,237,0.04)] hover:border-[#7C3AED]/40 hover:-translate-y-1.5 hover:shadow-[0_16px_36px_rgba(124,58,237,0.08)] transition-all duration-300 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-brand-muted">Total Inbound Leads</span>
            <div className="w-9 h-9 rounded-xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
              <Users size={17} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-[32px] font-black tracking-tight tabular-nums bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#5B4CF5] bg-clip-text text-transparent">
              {totalLeadsCount}
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-[#EDE8F5]">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <ArrowUpRight size={13} />
              +{metrics?.newLeadsThisWeek || 0} this week
            </span>
            <span className="text-[11px] text-brand-muted group-hover:text-[#7C3AED] flex items-center gap-0.5 transition-colors font-medium">
              View All <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 2: Active Sales Pipeline */}
        <div
          onClick={() => handleStageChange('contacted')}
          className="bg-white rounded-2xl border border-[#EDE8F5] p-6 shadow-[0_4px_20px_rgba(124,58,237,0.04)] hover:border-[#7C3AED]/40 hover:-translate-y-1.5 hover:shadow-[0_16px_36px_rgba(124,58,237,0.08)] transition-all duration-300 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-brand-muted">Active Pipeline</span>
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
              <KanbanSquare size={17} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-[32px] font-black tracking-tight tabular-nums bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent">
              {activePipelineCount}
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-[#EDE8F5]">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              {metrics?.leadsByStage.proposal_sent || 0} proposals sent
            </span>
            <span className="text-[11px] text-brand-muted group-hover:text-[#7C3AED] flex items-center gap-0.5 transition-colors font-medium">
              Pipeline <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 3: Follow-ups Due Today */}
        <div
          onClick={() => {
            setStageFilter('all');
          }}
          className="bg-white rounded-2xl border border-[#EDE8F5] p-6 shadow-[0_4px_20px_rgba(124,58,237,0.04)] hover:border-[#7C3AED]/40 hover:-translate-y-1.5 hover:shadow-[0_16px_36px_rgba(124,58,237,0.08)] transition-all duration-300 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-brand-muted">Follow-ups Due Today</span>
            <div className="w-9 h-9 rounded-xl bg-[#FFF7ED] text-[#C2410C] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
              <Clock size={17} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-[32px] font-black tracking-tight tabular-nums bg-gradient-to-r from-[#EA580C] via-[#F97316] to-[#F59E0B] bg-clip-text text-transparent">
              {followUpsDueCount}
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-[#EDE8F5]">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              {followUpsDueCount > 0 ? 'Urgent attention required' : 'All clear today'}
            </span>
            <span className="text-[11px] text-brand-muted group-hover:text-[#7C3AED] flex items-center gap-0.5 transition-colors font-medium">
              Check <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* Card 4: Won / Converted Deals */}
        <div
          onClick={() => handleStageChange('won')}
          className="bg-white rounded-2xl border border-[#EDE8F5] p-6 shadow-[0_4px_20px_rgba(124,58,237,0.04)] hover:border-[#7C3AED]/40 hover:-translate-y-1.5 hover:shadow-[0_16px_36px_rgba(124,58,237,0.08)] transition-all duration-300 cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-brand-muted">Won Conversions</span>
            <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] text-[#15803D] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-[32px] font-black tracking-tight tabular-nums bg-gradient-to-r from-[#059669] via-[#10B981] to-[#34D399] bg-clip-text text-transparent">
              {wonCount}
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-[#EDE8F5]">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {totalLeadsCount > 0 ? `${Math.round((wonCount / totalLeadsCount) * 100)}% conversion rate` : '0%'}
            </span>
            <span className="text-[11px] text-brand-muted group-hover:text-[#7C3AED] flex items-center gap-0.5 transition-colors font-medium">
              Won Leads <ChevronRight size={12} />
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. FILTER & SEARCH CONTROL BAR                            */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#EDE8F5] p-4 sm:p-5 shadow-[0_2px_12px_rgba(26,8,92,0.03)] space-y-4">
        {/* Stage Filter Pills with Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {STAGE_FILTERS.map((filter) => {
            const isActive = stageFilter === filter.id;
            let count: number | null = null;
            if (metrics?.leadsByStage && filter.stageKey) {
              count = metrics.leadsByStage[filter.stageKey] ?? 0;
            } else if (filter.id === 'all') {
              count = totalLeadsCount;
            }

            return (
              <button
                key={filter.id}
                onClick={() => handleStageChange(filter.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white border-transparent shadow-[0_4px_12px_rgba(124,58,237,0.25)]'
                    : 'bg-[#FAF9FD] text-[#475569] border-[#EDE8F5] hover:bg-[#EDE9FE]/50 hover:text-[#7C3AED]'
                }`}
              >
                <span>{filter.label}</span>
                {count !== null && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-[#EDE9FE] text-[#7C3AED]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search bar & Source Filter row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by lead name, company, email, or phone number..."
              className="w-full h-11 pl-10 pr-9 rounded-xl border border-[#EDE8F5] bg-[#FAF9FD] text-xs sm:text-sm text-brand-heading placeholder:text-brand-muted/70 focus:bg-white focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-brand-muted hover:text-brand-heading rounded-full"
              >
                <X size={14} />
              </button>
            )}
          </form>

          {/* Source Dropdown Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as LeadSource | 'all')}
                className="h-11 pl-9 pr-8 rounded-xl border border-[#EDE8F5] bg-[#FAF9FD] text-xs font-semibold text-brand-heading focus:bg-white focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 outline-none appearance-none cursor-pointer transition-all"
              >
                {SOURCE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Filter
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSearchSubmit}
              className="h-11 px-4 rounded-xl bg-[#FAF9FD] hover:bg-[#EDE9FE]/60 border border-[#EDE8F5] text-xs font-bold text-brand-heading hover:text-[#7C3AED] transition-all cursor-pointer"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. ERROR MESSAGE BANNER                                   */}
      {/* ========================================================= */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-brand-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={loadLeads}
            className="px-2.5 py-1 rounded-lg bg-white border border-red-200 font-semibold hover:bg-red-50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. LEADS DATA TABLE & CARDS                               */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#EDE8F5] shadow-[0_4px_24px_rgba(124,58,237,0.04)] overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={26} className="animate-spin text-[#7C3AED]" />
            <span className="text-xs font-semibold text-brand-muted">Fetching leads pipeline...</span>
          </div>
        ) : displayedLeads.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Inbox size={26} />
            </div>
            <h3 className="text-base font-bold text-brand-heading">
              No Leads Found
            </h3>
            <p className="text-xs sm:text-sm text-brand-muted mt-1 max-w-sm mx-auto font-medium">
              {searchQuery || stageFilter !== 'all' || sourceFilter !== 'all'
                ? 'No inquiries match your current filter parameters. Try clearing your search keyword or switching stages.'
                : 'Your leads inbox is empty. Inbound inquiries from your website and WhatsApp will appear here automatically.'}
            </p>
            <div className="flex items-center justify-center gap-2.5 mt-5">
              {(searchQuery || stageFilter !== 'all' || sourceFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStageFilter('all');
                    setSourceFilter('all');
                    setPage(1);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#FAF9FD] border border-[#EDE8F5] text-xs font-bold text-brand-heading hover:bg-[#EDE9FE] transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus size={14} />
                Add Inbound Lead
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EDE8F5] bg-[#FAF9FD] text-[11px] font-bold text-brand-muted uppercase tracking-wider">
                    <th className="py-3.5 px-5">Prospect / Company</th>
                    <th className="py-3.5 px-4">Contact Details</th>
                    <th className="py-3.5 px-4">Service & Budget</th>
                    <th className="py-3.5 px-4">Channel</th>
                    <th className="py-3.5 px-4">Stage</th>
                    <th className="py-3.5 px-4">Follow-Up / IST</th>
                    <th className="py-3.5 px-5 text-right">Quick Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE8F5] text-sm">
                  {displayedLeads.map((lead) => {
                    const initials = getInitials(lead.name);
                    const whatsappDigits = getWhatsAppDigits(lead.phone);

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="hover:bg-[#FAF9FD]/80 transition-all duration-150 cursor-pointer group"
                      >
                        {/* Prospect & Company */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-brand-heading group-hover:text-[#7C3AED] transition-colors truncate max-w-[200px]">
                                {lead.name}
                              </div>
                              {lead.company ? (
                                <div className="text-[11px] font-medium text-brand-muted flex items-center gap-1 mt-0.5 truncate max-w-[180px]">
                                  <Building2 size={11} className="shrink-0" />
                                  <span>{lead.company}</span>
                                </div>
                              ) : (
                                <div className="text-[11px] font-medium text-brand-muted/70">
                                  Individual Client
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Phone & Email */}
                        <td className="py-4 px-4 text-xs">
                          {lead.phone && (
                            <div className="font-mono text-[12px] font-semibold text-brand-heading flex items-center gap-1.5">
                              <Phone size={12} className="text-[#7C3AED] shrink-0" />
                              <span>{lead.phone}</span>
                            </div>
                          )}
                          {lead.email && (
                            <div className="text-[11px] font-medium text-brand-muted flex items-center gap-1.5 mt-1 truncate max-w-[200px]">
                              <Mail size={12} className="text-brand-muted shrink-0" />
                              <span className="truncate">{lead.email}</span>
                            </div>
                          )}
                          {!lead.phone && !lead.email && (
                            <span className="text-[11px] text-brand-muted italic">
                              No direct contact
                            </span>
                          )}
                        </td>

                        {/* Service & Budget */}
                        <td className="py-4 px-4 text-xs">
                          <div className="font-semibold text-brand-heading truncate max-w-[170px]">
                            {lead.serviceNeeded || 'General Consultation'}
                          </div>
                          <div className="text-[11px] font-bold text-emerald-700 tabular-nums mt-0.5">
                            {formatCurrency(lead.budget)}
                          </div>
                        </td>

                        {/* Source Badge */}
                        <td className="py-4 px-4">
                          {getSourceBadge(lead.source)}
                        </td>

                        {/* Stage Badge */}
                        <td className="py-4 px-4">
                          {getStageBadge(lead.stage)}
                        </td>

                        {/* Follow-Up / Date */}
                        <td className="py-4 px-4 text-xs">
                          {lead.nextFollowUpAt ? (
                            getFollowUpPill(lead.nextFollowUpAt)
                          ) : (
                            <div className="text-[11px] font-medium text-brand-muted flex items-center gap-1">
                              <Calendar size={11} />
                              <span>{formatISTDate(lead.createdAt)}</span>
                            </div>
                          )}
                        </td>

                        {/* Quick Contact Action Icons */}
                        <td className="py-4 px-5 text-right">
                          <div
                            className="inline-flex items-center gap-1 justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {lead.phone && (
                              <>
                                <a
                                  href={`tel:${lead.phone}`}
                                  title="Call Client"
                                  className="w-8 h-8 rounded-lg bg-[#FAF9FD] border border-[#EDE8F5] text-brand-muted hover:text-[#7C3AED] hover:border-[#7C3AED]/30 flex items-center justify-center transition-colors shadow-2xs"
                                >
                                  <Phone size={14} />
                                </a>
                                <a
                                  href={`https://wa.me/${whatsappDigits}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="WhatsApp Chat"
                                  className="w-8 h-8 rounded-lg bg-[#FAF9FD] border border-[#EDE8F5] text-brand-muted hover:text-[#25D366] hover:border-emerald-200 hover:bg-emerald-50/50 flex items-center justify-center transition-colors shadow-2xs"
                                >
                                  <MessageCircle size={14} />
                                </a>
                              </>
                            )}
                            {lead.email && (
                              <a
                                href={`mailto:${lead.email}`}
                                title="Email Client"
                                className="w-8 h-8 rounded-lg bg-[#FAF9FD] border border-[#EDE8F5] text-brand-muted hover:text-[#7C3AED] hover:border-[#7C3AED]/30 flex items-center justify-center transition-colors shadow-2xs"
                              >
                                <Mail size={14} />
                              </a>
                            )}
                            <button
                              onClick={() => setSelectedLeadId(lead.id)}
                              title="Open Detail Drawer"
                              className="w-8 h-8 rounded-lg bg-[#EDE9FE]/50 text-[#7C3AED] hover:bg-[#EDE9FE] flex items-center justify-center transition-colors ml-1"
                            >
                              <ChevronRight size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (< 768px) */}
            <div className="md:hidden divide-y divide-[#EDE8F5]">
              {displayedLeads.map((lead) => {
                const initials = getInitials(lead.name);
                const whatsappDigits = getWhatsAppDigits(lead.phone);

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className="p-4 space-y-3 cursor-pointer hover:bg-[#FAF9FD] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {initials}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-brand-heading">
                            {lead.name}
                          </h4>
                          {lead.company && (
                            <div className="text-[11px] font-medium text-brand-muted flex items-center gap-1 mt-0.5">
                              <Building2 size={11} />
                              <span>{lead.company}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>{getStageBadge(lead.stage)}</div>
                    </div>

                    {/* Metadata Box */}
                    <div className="text-xs bg-[#FAF9FD] p-3 rounded-xl border border-[#EDE8F5] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-brand-muted font-medium">Service:</span>
                        <span className="font-semibold text-brand-heading">
                          {lead.serviceNeeded || 'General Consultation'}
                        </span>
                      </div>
                      {lead.budget && (
                        <div className="flex items-center justify-between">
                          <span className="text-brand-muted font-medium">Budget:</span>
                          <span className="font-bold text-emerald-700">
                            {formatCurrency(lead.budget)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-brand-muted font-medium">Channel:</span>
                        <span>{getSourceBadge(lead.source)}</span>
                      </div>
                      {lead.nextFollowUpAt && (
                        <div className="flex items-center justify-between pt-1 border-t border-[#EDE8F5]">
                          <span className="text-brand-muted font-medium">Follow-up:</span>
                          <span>{getFollowUpPill(lead.nextFollowUpAt)}</span>
                        </div>
                      )}
                    </div>

                    {/* Mobile Quick Action Buttons (44px min touch target) */}
                    <div
                      className="flex items-center gap-2 pt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lead.phone && (
                        <>
                          <a
                            href={`tel:${lead.phone}`}
                            className="flex-1 h-11 rounded-xl bg-white border border-[#EDE8F5] text-brand-heading font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs active:bg-[#FAF9FD]"
                          >
                            <Phone size={14} className="text-[#7C3AED]" />
                            Call
                          </a>
                          <a
                            href={`https://wa.me/${whatsappDigits}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs active:bg-emerald-100"
                          >
                            <MessageCircle size={14} />
                            WhatsApp
                          </a>
                        </>
                      )}
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex-1 h-11 rounded-xl bg-white border border-[#EDE8F5] text-brand-heading font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs active:bg-[#FAF9FD]"
                        >
                          <Mail size={14} className="text-[#7C3AED]" />
                          Email
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls Footer */}
            {leadsData && leadsData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 bg-[#FAF9FD] border-t border-[#EDE8F5] text-xs">
                <span className="text-brand-muted font-medium">
                  Showing <strong className="text-brand-heading">{displayedLeads.length}</strong> of{' '}
                  <strong className="text-brand-heading">{leadsData.pagination.total}</strong> inbound leads
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={leadsData.pagination.page <= 1}
                    className="p-2 rounded-lg border border-[#EDE8F5] bg-white text-brand-heading disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EDE9FE]/50 transition-colors cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-brand-heading font-bold tabular-nums px-2">
                    {leadsData.pagination.page} / {leadsData.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(leadsData.pagination.totalPages, p + 1))}
                    disabled={leadsData.pagination.page >= leadsData.pagination.totalPages}
                    className="p-2 rounded-lg border border-[#EDE8F5] bg-white text-brand-heading disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EDE9FE]/50 transition-colors cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
