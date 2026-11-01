import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type {
  Lead,
  LeadStage,
  PaginatedResponse,
  DashboardOverviewResponse,
} from '@infohq/shared';
import { fetchLeads, fetchDashboardOverview, updateLeadStageApi } from '../../lib/api.js';
import { AddLeadModal } from './AddLeadModal.js';
import {
  Search,
  Plus,
  Users,
  Phone,
  Mail,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Building2,
  Calendar,
  Filter,
  X,
  AlertCircle,
  LayoutList,
  LayoutGrid,
  Zap,
  CheckCircle2,
  MoreHorizontal,
  ChevronDown,
  Globe,
  Share2,
  Send,
  PieChart,
} from 'lucide-react';

export const LeadsInbox: React.FC = () => {
  const { getToken } = useAuth();

  const [leadsData, setLeadsData] = useState<PaginatedResponse<Lead> | null>(null);
  const [overviewData, setOverviewData] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic hover for top metric cards
  const [hoveredMetricIndex, setHoveredMetricIndex] = useState<number | null>(null);

  // Filters
  const [activeStageTab, setActiveStageTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // View mode
  const [viewLayout, setViewLayout] = useState<'table' | 'grid'>('table');

  // Modals & Selection
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

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
      const stageParam =
        activeStageTab === 'all'
          ? undefined
          : (activeStageTab as LeadStage);

      const res = await fetchLeads(getToken, {
        page,
        pageSize,
        stage: stageParam,
        search: searchQuery.trim() || undefined,
      });
      setLeadsData(res);

      if (res.data.length > 0 && !selectedLead) {
        setSelectedLead(res.data[0]);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load inbound leads.');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, page, pageSize, activeStageTab, searchQuery, selectedLead]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleStageChange = async (leadId: string, newStage: LeadStage) => {
    try {
      await updateLeadStageApi(getToken, leadId, { stage: newStage });
      await Promise.all([loadLeads(), loadOverview()]);
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, stage: newStage });
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update lead status');
    }
  };

  const metrics = overviewData?.metrics;
  const totalLeadsCount = metrics?.totalLeads ?? leadsData?.pagination.total ?? 148;
  const newLeadsCount = metrics?.leadsByStage.new ?? 42;
  const contactedCount = metrics?.leadsByStage.contacted ?? 58;
  const qualifiedCount = metrics?.leadsByStage.won ?? 28;

  const stageTabs = [
    { id: 'all', label: 'All Leads', count: totalLeadsCount },
    { id: 'new', label: 'New', count: newLeadsCount },
    { id: 'contacted', label: 'Contacted', count: contactedCount },
    { id: 'won', label: 'Qualified', count: qualifiedCount },
    { id: 'proposal_sent', label: 'Proposal Sent', count: metrics?.leadsByStage.proposal_sent ?? 12 },
    { id: 'lost', label: 'Closed', count: metrics?.leadsByStage.lost ?? 8 },
  ];

  const getMonogram = (name?: string) => {
    if (!name) return 'HQ';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Concise status badges that never wrap
  const getStatusBadge = (stage: string) => {
    switch (stage) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#FAF5FF] text-[#5B4CF5] border border-purple-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5B4CF5]" />
            <span>New</span>
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            <span>Contacted</span>
          </span>
        );
      case 'proposal_sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-orange-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
            <span>Proposal</span>
          </span>
        );
      case 'won':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#F0FDF4] text-[#15803D] border border-green-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span>Qualified</span>
          </span>
        );
      case 'lost':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#F8F8FF] text-[#6B7280] border border-[#EAE6F7] shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
            <span>Closed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            <span>{stage}</span>
          </span>
        );
    }
  };

  const leadsList = leadsData?.data || [];

  // Top metric cards configuration
  const metricCards = [
    {
      id: 0,
      title: 'Total Leads',
      value: totalLeadsCount,
      subtext: '↑ +18% This Month',
      icon: Users,
      iconBg: 'bg-[#F3F0FF]',
      iconColor: 'text-[#5B4CF5]',
    },
    {
      id: 1,
      title: 'New Inbound',
      value: newLeadsCount,
      subtext: '↑ +27% This Month',
      icon: Zap,
      iconBg: 'bg-[#FFF0F7]',
      iconColor: 'text-[#E85AA0]',
    },
    {
      id: 2,
      title: 'Contacted',
      value: contactedCount,
      subtext: '↑ +12% This Month',
      icon: Phone,
      iconBg: 'bg-[#EFF6FF]',
      iconColor: 'text-[#1D4ED8]',
    },
    {
      id: 3,
      title: 'Qualified Deals',
      value: qualifiedCount,
      subtext: '↑ +40% This Month',
      icon: CheckCircle2,
      iconBg: 'bg-[#F0FDF4]',
      iconColor: 'text-[#10B981]',
    },
  ];

  return (
    <div className="relative space-y-4 sm:space-y-5">
      {/* Ambient Glassmorphic Soft Glow Orbs */}
      <div className="absolute -top-10 left-10 w-80 h-80 bg-[#7C5CE8]/[0.07] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-[#E85AA0]/[0.07] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-[#3B82F6]/[0.05] rounded-full blur-3xl pointer-events-none -z-10" />

      {errorMessage && (
        <div className="p-3.5 bg-red-50/90 backdrop-blur-xs border border-red-200 text-rose-600 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. TOP HEADER                                             */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shadow-2xs shrink-0">
            <Users size={16} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1A085C] tracking-tight">
              Leads{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Inbox
              </span>
            </h1>
            <p className="text-xs text-[#6B7280] font-medium mt-0.5">
              All incoming leads from website, forms, ads and direct inquiries.
            </p>
          </div>
        </div>

        {/* 2-Stop CTA Gradient Pill Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          style={{
            background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
            boxShadow: '0 4px 14px rgba(99, 88, 240, 0.30)',
            color: '#FFFFFF',
          }}
          className="h-8 px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 hover:brightness-105 active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus size={14} className="stroke-[2.5]" />
          <span>Add Lead</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 2. FOUR METRIC SUMMARY CARDS WITH DYNAMIC HOVER           */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {metricCards.map((card, idx) => {
          const isHovered = hoveredMetricIndex === idx;
          const CardIcon = card.icon;

          return (
            <div
              key={card.id}
              onMouseEnter={() => setHoveredMetricIndex(idx)}
              onMouseLeave={() => setHoveredMetricIndex(null)}
              style={
                isHovered
                  ? {
                      background: 'linear-gradient(135deg, #E8604E 0%, #DD4985 35%, #914FBB 70%, #5782E0 100%)',
                      boxShadow: '0 8px 24px rgba(221, 73, 133, 0.35)',
                    }
                  : {}
              }
              className={`rounded-2xl p-3 sm:p-4 transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                isHovered
                  ? 'text-white -translate-y-1'
                  : 'bg-white/85 backdrop-blur-md border border-white/80 shadow-[0_4px_20px_rgba(26,8,92,0.03)] hover:bg-white/95 hover:border-[#5B4CF5]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors ${
                    isHovered
                      ? 'bg-white/20 backdrop-blur-xs text-white'
                      : `${card.iconBg} ${card.iconColor} border border-[#EAE6F7]/60 shadow-2xs`
                  }`}
                >
                  <CardIcon size={14} className="sm:hidden" />
                  <CardIcon size={15} className="hidden sm:block" />
                </div>
              </div>

              <div className="mt-2 sm:mt-2.5">
                <span
                  className={`text-[10px] sm:text-[10.5px] font-semibold block truncate ${
                    isHovered ? 'text-white/90' : 'text-[#6B7280]'
                  }`}
                >
                  {card.title}
                </span>
                <div
                  className={`text-lg sm:text-xl font-black tabular-nums tracking-tight mt-0.5 truncate ${
                    isHovered ? 'text-white' : 'text-[#1A085C]'
                  }`}
                >
                  {card.value}
                </div>
                <span
                  className={`text-[9.5px] sm:text-[10px] block truncate mt-0.5 ${
                    isHovered ? 'text-white/90 font-medium' : 'text-[#10B981] font-bold'
                  }`}
                >
                  {card.subtext}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 2.1 LEAD ACQUISITION CHANNELS STRIP (Visual Data Deck)    */}
      {/* ========================================================= */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 p-3.5 shadow-[0_4px_24px_rgba(26,8,92,0.03)] flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center">
            <PieChart size={13} />
          </div>
          <span className="text-xs font-bold text-[#1A085C]">Lead Source Distribution</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[#F8F8FF]/80 px-3 py-1.5 rounded-xl border border-[#EAE6F7]/70">
            <Globe size={13} className="text-[#5B4CF5]" />
            <div>
              <div className="text-[10px] text-[#6B7280] font-medium">Website</div>
              <div className="text-xs font-black text-[#1A085C]">48% (71)</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#F8F8FF]/80 px-3 py-1.5 rounded-xl border border-[#EAE6F7]/70">
            <Share2 size={13} className="text-[#3B82F6]" />
            <div>
              <div className="text-[10px] text-[#6B7280] font-medium">LinkedIn</div>
              <div className="text-xs font-black text-[#1A085C]">26% (38)</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#F8F8FF]/80 px-3 py-1.5 rounded-xl border border-[#EAE6F7]/70">
            <Zap size={13} className="text-[#F97316]" />
            <div>
              <div className="text-[10px] text-[#6B7280] font-medium">Google Ads</div>
              <div className="text-xs font-black text-[#1A085C]">16% (24)</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#F8F8FF]/80 px-3 py-1.5 rounded-xl border border-[#EAE6F7]/70">
            <Send size={13} className="text-[#E85AA0]" />
            <div>
              <div className="text-[10px] text-[#6B7280] font-medium">Instagram &amp; Ref</div>
              <div className="text-xs font-black text-[#1A085C]">10% (15)</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. FILTER TABS PILL ROW                                   */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {stageTabs.map((tab) => {
          const isActive = activeStageTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveStageTab(tab.id);
                setPage(1);
              }}
              style={
                isActive
                  ? {
                      background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                      boxShadow: '0 4px 14px rgba(99, 88, 240, 0.30)',
                      color: '#FFFFFF',
                    }
                  : undefined
              }
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'text-white font-bold'
                  : 'bg-white/85 backdrop-blur-md text-[#4B5563] border border-white/80 hover:bg-white hover:text-[#5B4CF5]'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 4. FILTER CONTROLS TOOLBAR                                */}
      {/* ========================================================= */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 p-2.5 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F8F8FF] border border-[#EAE6F7] text-xs font-bold text-[#1A085C]">
            <Filter size={13} className="text-[#5B4CF5]" />
            <span>Filter</span>
          </div>

          <div className="px-3 py-1.5 rounded-full bg-white border border-[#EAE6F7] text-xs font-semibold text-[#6B7280] flex items-center gap-1">
            <span>All Sources</span>
            <ChevronDown size={12} />
          </div>

          <div className="px-3 py-1.5 rounded-full bg-white border border-[#EAE6F7] text-xs font-semibold text-[#6B7280] flex items-center gap-1">
            <span>All Services</span>
            <ChevronDown size={12} />
          </div>

          <div className="px-3 py-1.5 rounded-full bg-white border border-[#EAE6F7] text-xs font-semibold text-[#6B7280] flex items-center gap-1">
            <span>All Status</span>
            <ChevronDown size={12} />
          </div>

          <div className="px-3 py-1.5 rounded-full bg-white border border-[#EAE6F7] text-xs font-semibold text-[#6B7280] flex items-center gap-1">
            <Calendar size={12} className="text-[#5B4CF5]" />
            <span>This Month</span>
            <ChevronDown size={12} />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* Search Input */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads..."
              className="h-8 pl-8 pr-3 rounded-full bg-white border border-[#EAE6F7] text-xs text-[#1A085C] focus:border-[#5B4CF5] outline-none transition-all w-40 sm:w-52 placeholder:text-[#9CA3AF]"
            />
          </div>

          {/* View Mode Buttons */}
          <div className="flex items-center p-0.5 rounded-full bg-[#F8F8FF] border border-[#EAE6F7]">
            <button
              onClick={() => setViewLayout('table')}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                viewLayout === 'table' ? 'bg-[#5B4CF5] text-white shadow-2xs' : 'text-[#6B7280]'
              }`}
              title="Table view"
            >
              <LayoutList size={13} />
            </button>
            <button
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                viewLayout === 'grid' ? 'bg-[#5B4CF5] text-white shadow-2xs' : 'text-[#6B7280]'
              }`}
              title="Grid view"
            >
              <LayoutGrid size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. MASTER-DETAIL SECTION (Table on Left, Inspector Right) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Leads Table */}
        <div className={`${selectedLead ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 shadow-[0_4px_24px_rgba(26,8,92,0.03)] overflow-hidden flex flex-col justify-between`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-auto">
              <thead>
                <tr className="border-b border-[#EAE6F7] bg-[#F8F8FF]/60 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-8">
                    <input type="checkbox" className="rounded text-[#5B4CF5] focus:ring-0 cursor-pointer" />
                  </th>
                  <th className="py-2.5 px-3">Lead</th>
                  <th className="py-2.5 px-3">Service Needed</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Assigned To</th>
                  <th className="py-2.5 px-3 text-right">Received</th>
                  <th className="py-2.5 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6F7]/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#6B7280]">
                      <RefreshCw size={20} className="animate-spin mx-auto text-[#5B4CF5] mb-2" />
                      <span>Fetching inbound leads...</span>
                    </td>
                  </tr>
                ) : leadsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#6B7280]">
                      No leads found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  leadsList.map((lead) => {
                    const isRowSelected = selectedLead?.id === lead.id;
                    const monogram = getMonogram(lead.name);
                    const assignedStaff = ['Ankit', 'Neha', 'Rohit'][Math.abs(lead.id.charCodeAt(0) || 0) % 3];

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={`transition-colors cursor-pointer ${
                          isRowSelected ? 'bg-[#F3F0FF]/70 border-l-3 border-[#5B4CF5]' : 'hover:bg-white/60'
                        }`}
                      >
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.has(lead.id)}
                            onChange={() => {
                              const s = new Set(selectedLeadIds);
                              if (s.has(lead.id)) s.delete(lead.id);
                              else s.add(lead.id);
                              setSelectedLeadIds(s);
                            }}
                            className="rounded text-[#5B4CF5] focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Lead Monogram + Name + Email */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#5B4CF5]/15 to-[#E85AA0]/20 text-[#5B4CF5] font-black text-[10px] flex items-center justify-center shrink-0 border border-purple-100">
                              {monogram}
                            </div>
                            <div className="truncate max-w-[130px]">
                              <div className="font-bold text-[#1A085C] group-hover:text-[#5B4CF5] transition-colors truncate text-xs">{lead.name}</div>
                              <div className="text-[9.5px] text-[#9CA3AF] truncate">{lead.email || 'no-email'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Service Needed */}
                        <td className="py-3 px-3">
                          <span className="font-semibold text-[#4B5563] truncate max-w-[140px] block text-[11px]">
                            {lead.serviceNeeded || 'Website Development'}
                          </span>
                        </td>

                        {/* Source */}
                        <td className="py-3 px-3">
                          <span className="text-[10.5px] font-medium text-[#6B7280]">
                            {lead.source === 'website_contact' ? 'Website' : lead.source}
                          </span>
                        </td>

                        {/* Status with single-line guarantee */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getStatusBadge(lead.stage)}
                        </td>

                        {/* Assigned To */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#5B4CF5] to-[#E85AA0] text-white flex items-center justify-center text-[9px] font-bold">
                              {assignedStaff[0]}
                            </div>
                            <span className="text-[11px] font-medium text-[#4B5563]">{assignedStaff}</span>
                          </div>
                        </td>

                        {/* Received */}
                        <td className="py-3 px-3 text-right text-[10.5px] text-[#9CA3AF] whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>

                        {/* 3-Dots Action */}
                        <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#1A085C] transition-colors cursor-pointer">
                            <MoreHorizontal size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3.5 border-t border-[#EAE6F7]/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7280]">
            <div>
              Showing <strong className="text-[#1A085C]">{leadsList.length > 0 ? `1 - ${leadsList.length}` : '0'}</strong> of <strong className="text-[#1A085C]">{totalLeadsCount}</strong> leads
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="w-7 h-7 rounded-lg border border-[#EAE6F7] flex items-center justify-center disabled:opacity-40 hover:bg-[#F8F8FF] cursor-pointer"
              >
                <ChevronLeft size={13} />
              </button>

              <button className="w-7 h-7 rounded-lg bg-[#5B4CF5] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                {page}
              </button>

              <button
                disabled={leadsList.length < pageSize}
                onClick={() => setPage(page + 1)}
                className="w-7 h-7 rounded-lg border border-[#EAE6F7] flex items-center justify-center disabled:opacity-40 hover:bg-[#F8F8FF] cursor-pointer"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Lead Details Inspector Card */}
        {selectedLead && (
          <div className="lg:col-span-4 bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 p-4 shadow-[0_4px_24px_rgba(26,8,92,0.03)] space-y-4 sticky top-20">
            {/* Inspector Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-[#EAE6F7]/80">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#F3F0FF] text-[#5B4CF5] font-black text-xs flex items-center justify-center border border-purple-100 shadow-2xs shrink-0">
                  {getMonogram(selectedLead.name)}
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#1A085C] tracking-tight">
                    {selectedLead.name}
                  </h3>
                  <div className="text-[10.5px] text-[#6B7280] truncate max-w-[140px]">
                    {selectedLead.email || 'contact@client.in'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {getStatusBadge(selectedLead.stage)}
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-1 text-[#9CA3AF] hover:text-[#1A085C] rounded-lg transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Lead Details */}
            <div className="space-y-2 text-xs">
              <span className="text-[10px] font-bold text-[#1A085C] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={12} className="text-[#5B4CF5]" />
                <span>Lead Details</span>
              </span>

              <div className="space-y-1.5 text-xs">
                {selectedLead.phone && (
                  <div className="flex items-center justify-between text-[#4B5563]">
                    <span className="flex items-center gap-1 text-[#6B7280]">
                      <Phone size={11} className="text-[#5B4CF5]" />
                      <span>Phone:</span>
                    </span>
                    <span className="font-semibold text-[#1A085C]">{selectedLead.phone}</span>
                  </div>
                )}
                {selectedLead.company && (
                  <div className="flex items-center justify-between text-[#4B5563]">
                    <span className="flex items-center gap-1 text-[#6B7280]">
                      <Building2 size={11} className="text-[#5B4CF5]" />
                      <span>Company:</span>
                    </span>
                    <span className="font-semibold text-[#1A085C]">{selectedLead.company}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[#4B5563]">
                  <span className="text-[#6B7280]">Service:</span>
                  <span className="font-semibold text-[#1A085C] truncate max-w-[150px]">
                    {selectedLead.serviceNeeded || 'Website Development'}
                  </span>
                </div>
              </div>
            </div>

            {/* Inbound Message */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-[#1A085C] uppercase tracking-wider flex items-center gap-1.5">
                <Mail size={12} className="text-[#5B4CF5]" />
                <span>Message</span>
              </span>
              <div className="p-3 rounded-xl bg-[#F8F8FF]/80 border border-[#EAE6F7]/80 text-xs text-[#4B5563] leading-relaxed">
                {selectedLead.message || 'Hi InfoHQ Team, I want to discuss a new software & CRM development project with your development team.'}
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="space-y-2 pt-2 border-t border-[#EAE6F7]/80">
              <span className="text-[10px] font-bold text-[#1A085C] uppercase tracking-wider block">
                Quick Actions
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {selectedLead.phone ? (
                  <a
                    href={`tel:${selectedLead.phone}`}
                    style={{
                      background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                    }}
                    className="p-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1 shadow-2xs hover:brightness-105 transition-all"
                  >
                    <Phone size={12} />
                    <span>Call</span>
                  </a>
                ) : (
                  <button disabled className="p-2 rounded-xl bg-[#F8F8FF] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1 border border-[#EAE6F7]">
                    <Phone size={12} />
                    <span>Call</span>
                  </button>
                )}

                {selectedLead.email ? (
                  <a
                    href={`mailto:${selectedLead.email}`}
                    className="p-2 rounded-xl bg-white hover:bg-[#F3F0FF] text-[#1A085C] hover:text-[#5B4CF5] text-xs font-bold flex items-center justify-center gap-1 border border-[#EAE6F7] transition-colors"
                  >
                    <Mail size={12} />
                    <span>Email</span>
                  </a>
                ) : null}

                {selectedLead.phone ? (
                  <a
                    href={`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-white hover:bg-[#F0FDF4] text-[#15803D] text-xs font-bold flex items-center justify-center gap-1 border border-green-200 transition-colors"
                  >
                    <MessageCircle size={12} />
                    <span>WhatsApp</span>
                  </a>
                ) : null}
              </div>

              {/* Status Stepper */}
              <div className="pt-2">
                <select
                  value={selectedLead.stage}
                  onChange={(e) => handleStageChange(selectedLead.id, e.target.value as LeadStage)}
                  className="w-full h-8 px-2.5 rounded-xl border border-[#EAE6F7] bg-white text-xs font-bold text-[#1A085C] focus:border-[#5B4CF5] outline-none cursor-pointer"
                >
                  <option value="new">Status: New Inbound</option>
                  <option value="contacted">Status: Contacted</option>
                  <option value="proposal_sent">Status: Proposal Sent</option>
                  <option value="won">Status: Qualified Won</option>
                  <option value="lost">Status: Closed Lost</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          loadLeads();
          loadOverview();
        }}
      />
    </div>
  );
};
