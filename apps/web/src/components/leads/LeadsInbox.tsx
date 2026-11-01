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
  X,
  AlertCircle,
  Zap,
  CheckCircle2,
  Globe,
  Share2,
  Send,
  PieChart,
  ArrowUpRight,
  Clock,
  Sparkles,
} from 'lucide-react';

export const LeadsInbox: React.FC = () => {
  const { getToken } = useAuth();

  const [leadsData, setLeadsData] = useState<PaginatedResponse<Lead> | null>(null);
  const [overviewData, setOverviewData] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic hover for top metric cards
  const [hoveredMetricIndex, setHoveredMetricIndex] = useState<number | null>(null);

  // Filters & Search
  const [activeStageTab, setActiveStageTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modals & Selection
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Close profile drawer on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedLead(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load KPI overview metrics
  const loadOverview = useCallback(async () => {
    try {
      const res = await fetchDashboardOverview(getToken);
      setOverviewData(res);
    } catch {
      // Non-blocking
    }
  }, [getToken]);

  // Load leads with filters & pagination (DO NOT auto-select lead)
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
      // NOTE: selectedLead is intentionally NOT set here so client profile does NOT auto-open
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load inbound leads.');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, page, pageSize, activeStageTab, searchQuery]);

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

  // Status badges matching modern infohq.in palette
  const getStatusBadge = (stage: string) => {
    switch (stage) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF5FF] text-[#5B4CF5] border border-purple-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5B4CF5]" />
            <span>New</span>
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            <span>Contacted</span>
          </span>
        );
      case 'proposal_sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-orange-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
            <span>Proposal</span>
          </span>
        );
      case 'won':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDF4] text-[#15803D] border border-green-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span>Qualified</span>
          </span>
        );
      case 'lost':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F8F8FF] text-[#6B7280] border border-[#EAE6F7] shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
            <span>Closed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            <span>{stage}</span>
          </span>
        );
    }
  };

  const getSourceBadge = (source?: string) => {
    const src = (source || 'website_contact').toLowerCase();
    if (src.includes('website')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[#F3F0FF] text-[#5B4CF5] border border-purple-100">
          <Globe size={11} />
          <span>Website</span>
        </span>
      );
    }
    if (src.includes('linkedin')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-100">
          <Share2 size={11} />
          <span>LinkedIn</span>
        </span>
      );
    }
    if (src.includes('google') || src.includes('ads')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[#FFF7ED] text-[#C2410C] border border-orange-100">
          <Zap size={11} />
          <span>Google Ads</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[#F8F8FF] text-[#6B7280] border border-[#EAE6F7]">
        <Send size={11} />
        <span>{source || 'Direct'}</span>
      </span>
    );
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
      <div className="absolute -top-10 left-10 w-80 h-80 bg-[#7C5CE8]/[0.06] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-[#E85AA0]/[0.05] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-[#3B82F6]/[0.04] rounded-full blur-3xl pointer-events-none -z-10" />

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-rose-600 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. TOP HEADER                                             */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shadow-2xs shrink-0 border border-purple-100">
            <Users size={19} className="stroke-[2.2]" />
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
              Inbound inquiries and customer communications for InfoHQ.
            </p>
          </div>
        </div>

        {/* Executive Premium CTA Button */}
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #5B4CF5 0%, #7C5CE8 50%, #E85AA0 100%)',
            boxShadow: '0 8px 24px -2px rgba(91, 76, 245, 0.42), 0 2px 8px rgba(232, 90, 160, 0.28)',
            color: '#FFFFFF',
          }}
          className="h-10 sm:h-11 px-5 sm:px-6 rounded-full text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 cursor-pointer shadow-lg shrink-0 self-start sm:self-auto"
        >
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Plus size={14} className="stroke-[3] text-white" />
          </div>
          <span>Add New Lead</span>
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
                  : 'bg-white border border-[#E5E1F0] shadow-[0_4px_20px_rgba(26,8,92,0.06)] hover:border-[#5B4CF5]/40'
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
      {/* 2.1 LEAD ACQUISITION CHANNELS STRIP                       */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#E5E1F0] p-3.5 shadow-[0_4px_20px_rgba(26,8,92,0.06)] flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center">
            <PieChart size={13} />
          </div>
          <span className="text-xs font-bold text-[#1A085C]">Lead Source Distribution</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[#FAF9FD] px-3 py-1.5 rounded-xl border border-[#E5E1F0]">
            <Globe size={13} className="text-[#5B4CF5]" />
            <div>
              <div className="text-[10px] text-[#6B7280] font-medium">Website</div>
              <div className="text-xs font-black text-[#1A085C]">48% (71)</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#FAF9FD] px-3 py-1.5 rounded-xl border border-[#E5E1F0]">
            <Share2 size={13} className="text-[#3B82F6]" />
            <div>
              <div className="text-[10px] text-[#6B7280] font-medium">LinkedIn</div>
              <div className="text-xs font-black text-[#1A085C]">26% (38)</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#FAF9FD] px-3 py-1.5 rounded-xl border border-[#E5E1F0]">
            <Zap size={13} className="text-[#F97316]" />
            <div>
              <div className="text-[10px] text-[#6B7280] font-medium">Google Ads</div>
              <div className="text-xs font-black text-[#1A085C]">16% (24)</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#FAF9FD] px-3 py-1.5 rounded-xl border border-[#E5E1F0]">
            <Send size={13} className="text-[#E85AA0]" />
            <div>
              <div className="text-[10px] text-[#6B7280] font-medium">Instagram & Direct</div>
              <div className="text-xs font-black text-[#1A085C]">10% (15)</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. STAGE TABS & SEARCH (Clean unified bar, no filter card)*/}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
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
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'text-white font-bold'
                    : 'bg-white text-[#4B5563] border border-[#E5E1F0] hover:bg-[#FAF9FD] hover:text-[#5B4CF5] shadow-[0_2px_8px_rgba(26,8,92,0.03)]'
                }`}
              >
                {tab.label} <span className="opacity-80">({tab.count})</span>
              </button>
            );
          })}
        </div>

        {/* Clean Pill Search Bar */}
        <div className="relative shrink-0 self-end sm:self-auto w-full sm:w-64">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads by name, email..."
            className="w-full h-8.5 pl-9 pr-7 rounded-full bg-white border border-[#E5E1F0] text-xs text-[#1A085C] placeholder:text-[#9CA3AF] shadow-[0_2px_8px_rgba(26,8,92,0.03)] focus:border-[#5B4CF5] focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#1A085C] cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. LEADS TABLE (Strict 4 Columns: Lead, Service Needed,   */}
      {/*    Status, Source. No Checkbox, No Assigned, No Received)  */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#E5E1F0] shadow-[0_4px_20px_rgba(26,8,92,0.06)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-auto">
            <thead>
              <tr className="border-b border-[#E5E1F0] bg-[#FAF9FD] text-[10.5px] font-bold text-[#6B7280] uppercase tracking-wider">
                <th className="py-3 px-4 w-[38%]">Lead</th>
                <th className="py-3 px-4 w-[28%]">Service Needed</th>
                <th className="py-3 px-4 w-[17%]">Status</th>
                <th className="py-3 px-4 w-[17%]">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1F0]">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-14 text-center text-[#6B7280]">
                    <RefreshCw size={22} className="animate-spin mx-auto text-[#5B4CF5] mb-2.5" />
                    <span className="font-medium text-xs">Fetching inbound leads...</span>
                  </td>
                </tr>
              ) : leadsList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-14 text-center text-[#6B7280]">
                    <Users size={24} className="mx-auto text-[#9CA3AF] mb-2 opacity-50" />
                    <span className="font-semibold text-xs text-[#1A085C] block">No leads found</span>
                    <span className="text-[11px] text-[#9CA3AF] block mt-0.5">Try switching stage tabs or change search keywords.</span>
                  </td>
                </tr>
              ) : (
                leadsList.map((lead) => {
                  const isRowSelected = selectedLead?.id === lead.id;
                  const monogram = getMonogram(lead.name);

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`group transition-all duration-150 cursor-pointer ${
                        isRowSelected
                          ? 'bg-[#F3F0FF] border-l-4 border-l-[#5B4CF5]'
                          : 'hover:bg-[#FAF9FD]'
                      }`}
                    >
                      {/* Column 1: Lead (Monogram Avatar + Full Name + Email) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#5B4CF5]/15 to-[#E85AA0]/20 text-[#5B4CF5] font-black text-[10.5px] flex items-center justify-center shrink-0 border border-purple-100 shadow-2xs group-hover:scale-105 transition-transform">
                            {monogram}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[#1A085C] group-hover:text-[#5B4CF5] transition-colors truncate text-xs flex items-center gap-1.5">
                              <span>{lead.name}</span>
                              <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#5B4CF5]" />
                            </div>
                            <div className="text-[10px] text-[#6B7280] truncate mt-0.5">
                              {lead.email || 'No email provided'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Service Needed */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-[#1A085C] text-xs block truncate max-w-xs">
                          {lead.serviceNeeded || 'Website Development'}
                        </span>
                        {lead.company && (
                          <span className="text-[10px] text-[#9CA3AF] block truncate mt-0.5">
                            {lead.company}
                          </span>
                        )}
                      </td>

                      {/* Column 3: Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(lead.stage)}
                      </td>

                      {/* Column 4: Source */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getSourceBadge(lead.source)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-[#E5E1F0] bg-[#FAF9FD] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7280]">
          <div>
            Showing <strong className="text-[#1A085C]">{leadsList.length > 0 ? `1 - ${leadsList.length}` : '0'}</strong> of{' '}
            <strong className="text-[#1A085C]">{totalLeadsCount}</strong> leads
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="w-7 h-7 rounded-lg border border-[#E5E1F0] bg-white text-[#1A085C] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F3F0FF] hover:border-[#5B4CF5]/40 transition-colors cursor-pointer shadow-2xs"
            >
              <ChevronLeft size={13} />
            </button>

            <span className="h-7 px-3 rounded-lg bg-[#5B4CF5] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
              {page}
            </span>

            <button
              disabled={leadsList.length < pageSize}
              onClick={() => setPage(page + 1)}
              className="w-7 h-7 rounded-lg border border-[#E5E1F0] bg-white text-[#1A085C] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F3F0FF] hover:border-[#5B4CF5]/40 transition-colors cursor-pointer shadow-2xs"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. CLIENT PROFILE SIDE DRAWER OVERLAY                     */}
      {/*    (Opens ONLY when a lead is clicked, side overlay       */}
      {/*     with Cut 'X' button & complete premium profile)       */}
      {/* ========================================================= */}
      {selectedLead && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#1A085C]/25 backdrop-blur-[2px] z-40 transition-opacity animate-in fade-in duration-200"
            onClick={() => setSelectedLead(null)}
          />

          {/* Side Drawer Panel */}
          <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[460px] bg-white z-50 shadow-[-12px_0_40px_rgba(26,8,92,0.18)] border-l border-[#E5E1F0] flex flex-col animate-in slide-in-from-right duration-200">
            {/* Top Brand Strip Header */}
            <div className="relative p-5 pb-4 border-b border-[#E5E1F0] bg-gradient-to-b from-[#FAF9FD] to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#5B4CF5] animate-ping" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B4CF5]">
                    Client Profile
                  </span>
                </div>

                {/* CUT / CLOSE BUTTON */}
                <button
                  onClick={() => setSelectedLead(null)}
                  className="w-8 h-8 rounded-full bg-[#FAF5FF] hover:bg-[#F3F0FF] text-[#1A085C] hover:text-rose-600 border border-purple-100 flex items-center justify-center transition-all cursor-pointer shadow-2xs group"
                  title="Cut / Close profile (Esc)"
                >
                  <X size={15} className="group-hover:rotate-90 transition-transform duration-200" />
                </button>
              </div>

              {/* Lead Monogram & Primary Identity */}
              <div className="flex items-start gap-3.5 mt-4">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#5B4CF5] to-[#E85AA0] text-white font-black text-lg flex items-center justify-center shadow-[0_6px_20px_rgba(91,76,245,0.30)] ring-4 ring-purple-50 shrink-0">
                  {getMonogram(selectedLead.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-black text-[#1A085C] tracking-tight leading-snug truncate">
                    {selectedLead.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusBadge(selectedLead.stage)}
                    {selectedLead.company && (
                      <span className="text-[11px] font-semibold text-[#6B7280] flex items-center gap-1 truncate">
                        <Building2 size={12} className="text-[#5B4CF5] shrink-0" />
                        <span className="truncate">{selectedLead.company}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Direct High-End Communication Action Pills */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {selectedLead.phone ? (
                  <a
                    href={`tel:${selectedLead.phone}`}
                    style={{
                      background: 'linear-gradient(135deg, #5B4CF5 0%, #4338CA 100%)',
                      boxShadow: '0 4px 14px rgba(91, 76, 245, 0.30)',
                    }}
                    className="h-11 px-2.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:brightness-110 hover:-translate-y-0.5 active:scale-95 transition-all shadow-sm cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Phone size={12} className="stroke-[2.8] text-white" />
                    </div>
                    <span className="text-[11.5px] font-extrabold tracking-wide">Call Lead</span>
                  </a>
                ) : (
                  <div className="h-11 px-2.5 rounded-2xl bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#E5E1F0]">
                    <Phone size={13} />
                    <span>No Phone</span>
                  </div>
                )}

                {selectedLead.phone ? (
                  <a
                    href={`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.30)',
                    }}
                    className="h-11 px-2.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:brightness-110 hover:-translate-y-0.5 active:scale-95 transition-all shadow-sm cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <MessageCircle size={13} className="stroke-[2.8] text-white" />
                    </div>
                    <span className="text-[11.5px] font-extrabold tracking-wide">WhatsApp</span>
                  </a>
                ) : (
                  <div className="h-11 px-2.5 rounded-2xl bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#E5E1F0]">
                    <MessageCircle size={13} />
                    <span>WhatsApp</span>
                  </div>
                )}

                {selectedLead.email ? (
                  <a
                    href={`mailto:${selectedLead.email}`}
                    style={{
                      background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                      boxShadow: '0 4px 14px rgba(59, 130, 246, 0.30)',
                    }}
                    className="h-11 px-2.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:brightness-110 hover:-translate-y-0.5 active:scale-95 transition-all shadow-sm cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Mail size={12} className="stroke-[2.8] text-white" />
                    </div>
                    <span className="text-[11.5px] font-extrabold tracking-wide">Email</span>
                  </a>
                ) : (
                  <div className="h-11 px-2.5 rounded-2xl bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#E5E1F0]">
                    <Mail size={13} />
                    <span>No Email</span>
                  </div>
                )}
              </div>

              {/* Lead Stage Changer Card */}
              <div className="bg-[#FAF9FD] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold text-[#1A085C] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={12} className="text-[#5B4CF5]" />
                    <span>Update Pipeline Stage</span>
                  </span>
                  <span className="text-[10px] text-[#6B7280]">Auto-saves</span>
                </div>
                <select
                  value={selectedLead.stage}
                  onChange={(e) => handleStageChange(selectedLead.id, e.target.value as LeadStage)}
                  className="w-full h-9 px-3 rounded-lg border border-[#E5E1F0] bg-white text-xs font-bold text-[#1A085C] focus:border-[#5B4CF5] focus:outline-none cursor-pointer shadow-2xs"
                >
                  <option value="new">Stage: New Inbound</option>
                  <option value="contacted">Stage: Contacted</option>
                  <option value="proposal_sent">Stage: Proposal Sent</option>
                  <option value="won">Stage: Qualified Won</option>
                  <option value="lost">Stage: Closed Lost</option>
                </select>
              </div>

              {/* Contact Information Details Card */}
              <div className="bg-white rounded-xl p-4 border border-[#E5E1F0] shadow-2xs space-y-3">
                <span className="text-[10.5px] font-bold text-[#1A085C] uppercase tracking-wider block">
                  Contact Information
                </span>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between py-1 border-b border-[#FAF9FD]">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <Mail size={12} className="text-[#5B4CF5]" />
                      <span>Email Address</span>
                    </span>
                    <span className="font-semibold text-[#1A085C] truncate max-w-[220px]">
                      {selectedLead.email || 'None'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#FAF9FD]">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <Phone size={12} className="text-[#5B4CF5]" />
                      <span>Phone Number</span>
                    </span>
                    <span className="font-semibold text-[#1A085C]">
                      {selectedLead.phone || 'None'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-[#FAF9FD]">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <Globe size={12} className="text-[#5B4CF5]" />
                      <span>Acquisition Channel</span>
                    </span>
                    <div>{getSourceBadge(selectedLead.source)}</div>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <Clock size={12} className="text-[#5B4CF5]" />
                      <span>Received On</span>
                    </span>
                    <span className="font-semibold text-[#1A085C]">
                      {new Date(selectedLead.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Service Needed Card */}
              <div className="bg-white rounded-xl p-4 border border-[#E5E1F0] shadow-2xs space-y-2">
                <span className="text-[10.5px] font-bold text-[#1A085C] uppercase tracking-wider block">
                  Service Requirement
                </span>
                <div className="p-3 rounded-lg bg-[#FAF5FF] border border-purple-100 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-[#1A085C]">
                      {selectedLead.serviceNeeded || 'Full Stack Modern Engineering'}
                    </div>
                    <div className="text-[10px] text-[#6B7280] mt-0.5">
                      InfoHQ Core Service Layer
                    </div>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#5B4CF5] text-white">
                    Primary
                  </span>
                </div>
              </div>

              {/* Inbound Message Card */}
              <div className="bg-white rounded-xl p-4 border border-[#E5E1F0] shadow-2xs space-y-2">
                <span className="text-[10.5px] font-bold text-[#1A085C] uppercase tracking-wider block">
                  Inbound Client Message
                </span>
                <div className="p-3.5 rounded-xl bg-[#FAF9FD] border border-[#E5E1F0] text-xs text-[#374151] leading-relaxed italic">
                  "{selectedLead.message || 'No direct message provided in the submission form.'}"
                </div>
              </div>
            </div>

            {/* Bottom Drawer Footer */}
            <div className="p-4 border-t border-[#E5E1F0] bg-[#FAF9FD] flex items-center justify-between">
              <span className="text-[11px] text-[#6B7280]">
                Lead ID: <strong className="text-[#1A085C] font-mono">{selectedLead.id.slice(0, 10)}...</strong>
              </span>
              <button
                onClick={() => setSelectedLead(null)}
                className="px-5 py-2 rounded-full bg-[#1A085C] hover:bg-[#2A108C] text-white text-xs font-extrabold transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                Close Profile
              </button>
            </div>
          </div>
        </>
      )}

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
