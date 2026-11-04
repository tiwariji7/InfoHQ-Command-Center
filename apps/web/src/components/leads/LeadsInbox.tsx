import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type {
  Lead,
  LeadStage,
  PaginatedResponse,
  DashboardOverviewResponse,
  Client,
  Project,
  Payment,
} from '@infohq/shared';
import { fetchLeads, fetchDashboardOverview, updateLeadStageApi, fetchLeadRelatedData } from '../../lib/api.js';
import { AddLeadModal } from './AddLeadModal.js';
import { RevealGroup, RevealItem, CountUp } from '../motion/index.js';
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
  Calendar,
  ChevronDown,
  Edit3,
  User,
  FileText,
  GripHorizontal,
} from 'lucide-react';
import { useDraggable } from '../../lib/useDraggable.js';

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
  const [leadDrawerTab, setLeadDrawerTab] = useState<'overview' | 'projects' | 'invoices' | 'payments'>('overview');
  const [leadRelated, setLeadRelated] = useState<{ client: Client | null; projects: Project[]; payments: Payment[] } | null>(null);
  const { cardRef: leadCardRef, position: leadPos, handlePointerDown: handleLeadPointerDown, resetPosition: resetLeadPosition } = useDraggable('leads_drawer');

  // Fetch linked client, converted projects and invoices when lead is selected
  useEffect(() => {
    if (!selectedLead) {
      setLeadRelated(null);
      return;
    }
    let isMounted = true;
    fetchLeadRelatedData(getToken, selectedLead.id)
      .then((data) => {
        if (isMounted) setLeadRelated(data);
      })
      .catch((err) => {
        console.warn('[fetchLeadRelatedData error]:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [getToken, selectedLead]);

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
  const loadLeads = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
      setErrorMessage(null);
    }
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
      if (!isBackground) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load inbound leads.');
      }
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  }, [getToken, page, pageSize, activeStageTab, searchQuery]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadLeads(false);
  }, [loadLeads]);

  // Silent live auto-refresh without page reloads or spinners
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadLeads(true);
        loadOverview();
      }
    }, 5000);

    const onVisible = () => {
      if (!document.hidden) {
        loadLeads(true);
        loadOverview();
      }
    };

    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loadLeads, loadOverview]);

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

  const formatLeadDateTime = (timestamp?: number | string | null) => {
    if (!timestamp) return '29 Oct 2026, 11:18 AM';
    const epoch = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    if (isNaN(epoch)) return String(timestamp);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(new Date(epoch));
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
      <RevealGroup className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {metricCards.map((card, idx) => {
          const isHovered = hoveredMetricIndex === idx;
          const CardIcon = card.icon;

          return (
            <RevealItem
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
                  <CountUp value={Number(card.value) || 0} />
                </div>
                <span
                  className={`text-[9.5px] sm:text-[10px] block truncate mt-0.5 ${
                    isHovered ? 'text-white/90 font-medium' : 'text-[#10B981] font-bold'
                  }`}
                >
                  {card.subtext}
                </span>
              </div>
            </RevealItem>
          );
        })}
      </RevealGroup>

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
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end items-center sm:pr-5 p-3 transition-opacity animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          data-lenis-prevent="true"
          onClick={() => setSelectedLead(null)}
        >
          {/* Side Drawer Popup (Matches Payment page Client Profile size exactly, rounded-3xl, draggable from all 4 sides) */}
          <div
            ref={leadCardRef}
            className="popup-card relative w-full sm:w-[420px] max-w-[420px] h-[calc(100vh-2.5rem)] max-h-[820px] bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(26,8,92,0.30)] border border-[#E5E1F0] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            style={{ transform: `translate3d(${leadPos.x}px, ${leadPos.y}px, 0)` }}
            data-lenis-prevent="true"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ========================================================= */}
            {/* 4-SIDE DRAG GRIPS (Left & Right Edge Drag Strips)         */}
            {/* ========================================================= */}
            <div
              onPointerDown={handleLeadPointerDown}
              onDoubleClick={resetLeadPosition}
              className="absolute left-0 top-12 bottom-8 w-3.5 z-30 cursor-grab active:cursor-grabbing hover:bg-purple-500/10 transition-colors"
              style={{ touchAction: 'none' }}
              title="Drag left border to move card"
            />
            <div
              onPointerDown={handleLeadPointerDown}
              onDoubleClick={resetLeadPosition}
              className="absolute right-0 top-12 bottom-8 w-3.5 z-30 cursor-grab active:cursor-grabbing hover:bg-purple-500/10 transition-colors"
              style={{ touchAction: 'none' }}
              title="Drag right border to move card"
            />

            {/* ========================================================= */}
            {/* 1. TOP TITLE BAR (Pinned at top & Top Drag Handle)        */}
            {/* ========================================================= */}
            <div
              onPointerDown={handleLeadPointerDown}
              onDoubleClick={resetLeadPosition}
              style={{ touchAction: 'none' }}
              className="px-4 py-3 border-b border-[#E5E1F0] flex items-center justify-between bg-white shrink-0 z-20 cursor-grab active:cursor-grabbing select-none"
              title="Click and drag from any edge to move • Double-click to reset position"
            >
              <div className="flex items-center gap-2 text-[#1A085C]">
                <button
                  onClick={() => setSelectedLead(null)}
                  data-no-drag="true"
                  className="p-1 -ml-1 text-[#6B7280] hover:text-[#1A085C] rounded-md transition-colors cursor-pointer"
                  title="Back"
                >
                  <User size={15} className="text-[#5B4CF5]" />
                </button>
                <h2 className="text-xs font-bold text-[#1A085C] tracking-tight">Lead Details</h2>
              </div>

              {/* Drag Handle Indicator */}
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F3F0FF]/80 text-[#7C5CE8] text-[10px] font-semibold"
                title="Drag from 4 sides or header to move"
              >
                <GripHorizontal size={14} />
                <span className="hidden sm:inline">Move</span>
              </div>

              <button
                onClick={() => setSelectedLead(null)}
                data-no-drag="true"
                className="w-7 h-7 rounded-lg text-[#6B7280] hover:text-[#1A085C] hover:bg-[#F3F0FF] flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* SCROLLABLE BODY (Scrollable on cursor hover across entire card) */}
            <div
              className="flex-1 min-h-0 overflow-y-auto popup-scroll flex flex-col focus:outline-none"
              style={{ touchAction: 'pan-y' }}
              data-lenis-prevent="true"
              tabIndex={0}
            >
              {/* 2. PROFILE HEADER */}
              <div className="p-4 bg-gradient-to-b from-[#FBFBFE] to-white border-b border-[#E5E1F0] shrink-0">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5B4CF5] to-[#7C5CE8] text-white font-black text-sm flex items-center justify-center shadow-md shrink-0">
                    {getMonogram(selectedLead.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#1A085C] truncate">{selectedLead.name}</h3>
                      {/* Status badge next to name */}
                      {getStatusBadge(selectedLead.stage)}
                      {(selectedLead.clientId || leadRelated?.client?.id) && (
                        <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                          {selectedLead.clientId || leadRelated?.client?.id}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 space-y-0.5 text-[11px] text-[#6B7280]">
                      {selectedLead.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail size={11} className="text-[#9CA3AF] shrink-0" />
                          <span className="truncate">{selectedLead.email}</span>
                        </div>
                      )}
                      {selectedLead.phone && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone size={11} className="text-[#9CA3AF] shrink-0" />
                          <span>{selectedLead.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Pills: Call, WhatsApp, Email ONLY (No 3-dots) */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-1">
                  {selectedLead.phone ? (
                    <a
                      href={`tel:${selectedLead.phone}`}
                      className="h-9 px-3 rounded-full bg-white hover:bg-[#F3F0FF] border border-[#E5E1F0] hover:border-[#5B4CF5] text-[#1A085C] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                    >
                      <Phone size={13} className="text-[#5B4CF5] group-hover:scale-110 transition-transform" />
                      <span>Call</span>
                    </a>
                  ) : (
                    <div className="h-9 px-3 rounded-full bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#E5E1F0]">
                      <Phone size={13} />
                      <span>No Phone</span>
                    </div>
                  )}

                  {selectedLead.phone ? (
                    <a
                      href={`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-9 px-3 rounded-full bg-white hover:bg-emerald-50 border border-[#E5E1F0] hover:border-emerald-500 text-[#1A085C] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                    >
                      <MessageCircle size={13} className="text-[#10B981] group-hover:scale-110 transition-transform" />
                      <span>WhatsApp</span>
                    </a>
                  ) : (
                    <div className="h-9 px-3 rounded-full bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#E5E1F0]">
                      <MessageCircle size={13} />
                      <span>WhatsApp</span>
                    </div>
                  )}

                  {selectedLead.email ? (
                    <a
                      href={`mailto:${selectedLead.email}`}
                      className="h-9 px-3 rounded-full bg-white hover:bg-blue-50 border border-[#E5E1F0] hover:border-blue-500 text-[#1A085C] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                    >
                      <Mail size={13} className="text-[#3B82F6] group-hover:scale-110 transition-transform" />
                      <span>Email</span>
                    </a>
                  ) : (
                    <div className="h-9 px-3 rounded-full bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#E5E1F0]">
                      <Mail size={13} />
                      <span>No Email</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. TABS BAR (Sticky at top when scrolling) */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-xs z-10 px-4 pt-2 border-b border-[#E5E1F0]">
                <div className="flex items-center justify-between text-xs">
                  {(['overview', 'projects', 'invoices', 'payments'] as const).map((tab) => {
                    const isActive = leadDrawerTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setLeadDrawerTab(tab)}
                        className={`pb-2 px-1 text-xs font-semibold capitalize transition-all cursor-pointer border-b-2 ${
                          isActive
                            ? 'border-[#5B4CF5] text-[#5B4CF5] font-bold'
                            : 'border-transparent text-[#6B7280] hover:text-[#1A085C]'
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. SCROLLABLE TAB CONTENT */}
              <div className="p-4 space-y-3.5 text-xs flex-1">
              {leadDrawerTab === 'overview' && (
                <>
                  {/* Card 1: Lead Information */}
                  <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2.5">
                    <div className="text-xs font-bold text-[#1A085C] flex items-center gap-1.5">
                      <User size={13} className="text-[#5B4CF5]" />
                      <span>Lead Information</span>
                    </div>

                    <div className="space-y-1.5 divide-y divide-[#F1EEF8]/80 text-[11px]">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#6B7280]">Company</span>
                        <span className="font-semibold text-[#1A085C] truncate max-w-[200px]">
                          {selectedLead.company || leadRelated?.client?.company || '—'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#6B7280]">Location</span>
                        <span className="font-semibold text-[#1A085C]">
                          {leadRelated?.client?.address || 'India'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#6B7280]">Lead Source</span>
                        <span className="font-semibold text-[#1A085C] capitalize">
                          {selectedLead.source ? selectedLead.source.replace(/_/g, ' ') : 'Website'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#6B7280]">Received On</span>
                        <span className="font-semibold text-[#1A085C]">
                          {formatLeadDateTime(selectedLead.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#6B7280]">Assigned To</span>
                        <span className="font-semibold text-[#1A085C]">
                          Engineering Team
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Requirements */}
                  <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2.5">
                    <div className="text-xs font-bold text-[#1A085C]">Requirements</div>

                    <div className="space-y-1.5 divide-y divide-[#F1EEF8]/80 text-[11px]">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#6B7280]">Service Needed</span>
                        <span className="font-semibold text-[#1A085C] truncate max-w-[200px]">
                          {selectedLead.serviceNeeded || 'Engineering & Design'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#6B7280]">Estimated Budget</span>
                        <span className="font-bold text-emerald-600 tabular-nums">
                          {selectedLead.budget
                            ? selectedLead.budget.startsWith('₹')
                              ? selectedLead.budget
                              : `₹${selectedLead.budget}`
                            : 'To be scoped'}
                        </span>
                      </div>

                      <div className="pt-2">
                        <span className="text-[#6B7280] block mb-1">Requirement</span>
                        <div className="text-xs text-[#374151] leading-relaxed bg-white p-2.5 rounded-lg border border-[#E5E1F0]/70">
                          {selectedLead.message || 'No specific requirements submitted.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Next Follow-up */}
                  <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2">
                    <div className="text-xs font-bold text-[#1A085C]">Next Follow-up</div>

                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-[#E5E1F0]">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#1A085C]">
                        <Calendar size={13} className="text-[#5B4CF5]" />
                        <span>
                          {formatLeadDateTime(selectedLead.nextFollowUpAt || Date.now() + 86400000)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded-full bg-[#FAF5FF] hover:bg-[#F3F0FF] text-[#5B4CF5] border border-purple-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Edit3 size={11} />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {leadDrawerTab === 'projects' && (
                <div className="space-y-3">
                  {leadRelated?.projects && leadRelated.projects.length > 0 ? (
                    leadRelated.projects.map((proj) => (
                      <div key={proj.id} className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-xs text-[#1A085C]">{proj.title}</div>
                            <div className="text-[10.5px] text-[#6B7280] mt-0.5">{proj.budget || 'Custom scope'}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] capitalize">
                            {proj.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#9CA3AF] flex items-center gap-1.5 pt-1 border-t border-[#F1EEF8]">
                          <Calendar size={10} />
                          <span>Created: {new Date(proj.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-[#FBFBFE] rounded-xl p-4 border border-[#E5E1F0] space-y-2">
                      <div className="text-xs font-bold text-[#1A085C]">Lead Project Scope</div>
                      <div className="bg-white p-3 rounded-lg border border-[#E5E1F0] space-y-1">
                        <div className="font-bold text-xs text-[#1A085C]">
                          {selectedLead.serviceNeeded || 'Modern Web Engineering'}
                        </div>
                        <div className="text-[11px] text-[#6B7280]">
                          Estimated Budget: {selectedLead.budget || '₹50,000 – ₹1,00,000'}
                        </div>
                        <div className="text-[10px] text-[#5B4CF5] font-semibold mt-1">
                          Status: Discovery &amp; Architecture Scoping
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {leadDrawerTab === 'invoices' && (
                <div className="space-y-2.5">
                  {leadRelated?.payments && leadRelated.payments.length > 0 ? (
                    leadRelated.payments.map((inv) => (
                      <div key={inv.id} className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-[#1D4ED8]">
                            {inv.invoiceNumber || `INV-${inv.id.slice(-4).toUpperCase()}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'received' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#B45309]'
                          }`}>
                            {inv.status === 'received' ? 'PAID' : 'PENDING'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-[#1A085C]">
                          <span>Amount:</span>
                          <span className="text-sm">₹{inv.amount.toLocaleString('en-IN')}</span>
                        </div>
                        {inv.razorpayPaymentLinkUrl && inv.status !== 'received' && (
                          <a
                            href={inv.razorpayPaymentLinkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10.5px] font-bold text-[#5B4CF5] hover:underline block pt-1"
                          >
                            Open Online Payment Link →
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-[#FBFBFE] rounded-xl p-4 border border-[#E5E1F0] text-center py-6 space-y-1.5">
                      <FileText size={22} className="mx-auto text-[#9CA3AF]" />
                      <div className="text-xs font-bold text-[#1A085C]">No Invoices Issued</div>
                      <div className="text-[10.5px] text-[#6B7280]">
                        Invoices are generated upon deal conversion or client kickoff.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {leadDrawerTab === 'payments' && (
                <div className="space-y-2.5">
                  {leadRelated?.payments && leadRelated.payments.filter((p) => p.status === 'received').length > 0 ? (
                    leadRelated.payments.filter((p) => p.status === 'received').map((p) => (
                      <div key={p.id} className="bg-[#FBFBFE] rounded-xl p-3 border border-[#E5E1F0] flex justify-between items-center">
                        <div>
                          <div className="text-xs font-bold text-slate-800">₹{p.amount.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] text-slate-500">Method: {p.paymentMethod || 'UPI / Online'}</div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Settled
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="bg-[#FBFBFE] rounded-xl p-4 border border-[#E5E1F0] text-center py-6 space-y-1.5">
                      <Clock size={22} className="mx-auto text-[#9CA3AF]" />
                      <div className="text-xs font-bold text-[#1A085C]">No Settled Payments</div>
                      <div className="text-[10.5px] text-[#6B7280]">
                        Receipts will be displayed here once client completes payment.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>

            {/* 5. BOTTOM ACTION FOOTER (Status Stage Changer Button) */}
            <div className="p-4 border-t border-[#E5E1F0] bg-white shrink-0">
              <div className="relative">
                <select
                  value={selectedLead.stage}
                  onChange={(e) => handleStageChange(selectedLead.id, e.target.value as LeadStage)}
                  style={{
                    background: 'linear-gradient(135deg, #5B4CF5 0%, #7C5CE8 50%, #E85AA0 100%)',
                    boxShadow: '0 4px 16px rgba(91, 76, 245, 0.35)',
                  }}
                  className="w-full h-11 px-4 pr-10 rounded-2xl text-white text-xs font-bold appearance-none cursor-pointer outline-none hover:brightness-105 active:scale-[0.99] transition-all"
                >
                  <option value="new" className="text-[#1A085C] bg-white font-semibold">Stage: New Inbound</option>
                  <option value="contacted" className="text-[#1A085C] bg-white font-semibold">Stage: Contacted</option>
                  <option value="qualified" className="text-[#1A085C] bg-white font-semibold">Stage: Qualified</option>
                  <option value="proposal_sent" className="text-[#1A085C] bg-white font-semibold">Stage: Proposal Sent</option>
                  <option value="won" className="text-[#1A085C] bg-white font-semibold">Stage: Won Deal (Convert to Client)</option>
                  <option value="lost" className="text-[#1A085C] bg-white font-semibold">Stage: Closed Lost</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1.5 text-white">
                  <ChevronDown size={16} className="stroke-[2.5]" />
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* BOTTOM DRAG GRIP BAR (4th Side Bottom Drag Handle)        */}
            {/* ========================================================= */}
            <div
              onPointerDown={handleLeadPointerDown}
              onDoubleClick={resetLeadPosition}
              style={{ touchAction: 'none' }}
              className="w-full py-2 bg-gradient-to-t from-[#F8F7FC] to-white border-t border-[#E5E1F0] flex items-center justify-center cursor-grab active:cursor-grabbing select-none shrink-0 hover:bg-[#F3F0FF] transition-colors"
              title="Drag bottom border to move card • Double-click to reset"
            >
              <div className="w-12 h-1 bg-[#D1D5DB] hover:bg-[#7C5CE8] rounded-full transition-colors" />
            </div>
          </div>
        </div>
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
