import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Lead, LeadStage } from '@infohq/shared';
import { fetchLeads, updateLeadStageApi } from '../../lib/api.js';
import { AddLeadModal } from '../leads/AddLeadModal.js';
import { LostReasonModal } from './LostReasonModal.js';
import {
  Plus,
  RefreshCw,
  Phone,
  MessageCircle,
  Mail,
  Clock,
  AlertCircle,
  Building2,
  ChevronLeft,
  CheckCircle2,
  Flame,
  ArrowRight,
  XCircle,
  Search,
  Trophy,
  TrendingUp,
  Target,
  KanbanSquare,
  BarChart3,
  GripVertical,
} from 'lucide-react';

interface StageColumnConfig {
  id: LeadStage;
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  dotColor: string;
}

const STAGES: StageColumnConfig[] = [
  {
    id: 'new',
    label: '1. Inbound Leads',
    badgeBg: 'bg-[#FAF5FF]',
    badgeBorder: 'border-purple-200',
    badgeText: 'text-[#5B4CF5]',
    dotColor: 'bg-[#5B4CF5]',
  },
  {
    id: 'contacted',
    label: '2. Contacted & Discovery',
    badgeBg: 'bg-[#EFF6FF]',
    badgeBorder: 'border-blue-200',
    badgeText: 'text-[#1D4ED8]',
    dotColor: 'bg-[#3B82F6]',
  },
  {
    id: 'proposal_sent',
    label: '3. Proposal & Negotiation',
    badgeBg: 'bg-[#FFF7ED]',
    badgeBorder: 'border-orange-200',
    badgeText: 'text-[#C2410C]',
    dotColor: 'bg-[#F97316]',
  },
  {
    id: 'won',
    label: '4. Closed Won',
    badgeBg: 'bg-[#F0FDF4]',
    badgeBorder: 'border-green-200',
    badgeText: 'text-[#15803D]',
    dotColor: 'bg-[#10B981]',
  },
  {
    id: 'lost',
    label: '5. Disqualified / Lost',
    badgeBg: 'bg-[#F8F8FF]',
    badgeBorder: 'border-[#EAE6F7]',
    badgeText: 'text-[#6B7280]',
    dotColor: 'bg-[#9CA3AF]',
  },
];

function parseNumericBudget(budgetStr?: string | null): number {
  if (!budgetStr) return 0;
  const digitsOnly = budgetStr.replace(/[^\d]/g, '');
  const parsed = parseInt(digitsOnly, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function calculateDaysInStage(lead: Lead): number {
  const ts = lead.updatedAt || lead.createdAt;
  const diffMs = Date.now() - ts;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getWhatsAppDigits(phone: string): string {
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

export const PipelineView: React.FC = () => {
  const { getToken } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dynamic hover for top metric cards
  const [hoveredMetricIndex, setHoveredMetricIndex] = useState<number | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lostModalLead, setLostModalLead] = useState<Lead | null>(null);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  // Drag-and-Drop Kanban State
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);

  // Filter
  const [searchFilter, setSearchFilter] = useState('');

  const loadPipelineLeads = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const res = await fetchLeads(getToken, { page: 1, pageSize: 50 });
        setLeads(res.data);
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to load pipeline leads.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    loadPipelineLeads();
  }, [loadPipelineLeads]);

  const filteredLeads = useMemo(() => {
    if (!searchFilter.trim()) return leads;
    const term = searchFilter.toLowerCase();
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        (l.company && l.company.toLowerCase().includes(term)) ||
        (l.serviceNeeded && l.serviceNeeded.toLowerCase().includes(term))
    );
  }, [leads, searchFilter]);

  const groupedLeads = useMemo(() => {
    const map: Record<LeadStage, Lead[]> = {
      new: [],
      contacted: [],
      proposal_sent: [],
      won: [],
      lost: [],
    };
    for (const lead of filteredLeads) {
      if (map[lead.stage]) {
        map[lead.stage].push(lead);
      } else {
        map.new.push(lead);
      }
    }
    return map;
  }, [filteredLeads]);

  const activePipelineValue = useMemo(() => {
    let total = 0;
    for (const lead of leads) {
      if (
        lead.stage === 'new' ||
        lead.stage === 'contacted' ||
        lead.stage === 'proposal_sent'
      ) {
        total += parseNumericBudget(lead.budget);
      }
    }
    return total;
  }, [leads]);

  const wonPipelineValue = useMemo(() => {
    let total = 0;
    for (const lead of leads) {
      if (lead.stage === 'won') {
        total += parseNumericBudget(lead.budget);
      }
    }
    return total;
  }, [leads]);

  const winRate = useMemo(() => {
    const totalDecided = groupedLeads.won.length + groupedLeads.lost.length;
    if (totalDecided === 0) return 0;
    return Math.round((groupedLeads.won.length / totalDecided) * 100);
  }, [groupedLeads]);

  const activeDealsCount = useMemo(() => {
    return groupedLeads.new.length + groupedLeads.contacted.length + groupedLeads.proposal_sent.length;
  }, [groupedLeads]);

  async function performStageUpdate(leadId: string, newStage: LeadStage, lostReason?: string) {
    const originalLeads = [...leads];
    const targetLead = leads.find((l) => l.id === leadId);
    if (!targetLead || targetLead.stage === newStage) return;

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              stage: newStage,
              lostReason: newStage === 'lost' ? lostReason || null : null,
              updatedAt: Date.now(),
            }
          : l
      )
    );

    try {
      setIsUpdatingStage(true);
      await updateLeadStageApi(getToken, leadId, {
        stage: newStage,
        lostReason: newStage === 'lost' ? lostReason : undefined,
      });
    } catch (err: unknown) {
      setLeads(originalLeads);
      const msg = err instanceof Error ? err.message : 'Stage update failed';
      setErrorMessage(`Failed to move opportunity: ${msg}`);
    } finally {
      setIsUpdatingStage(false);
    }
  }

  function advanceStage(lead: Lead) {
    if (lead.stage === 'new') performStageUpdate(lead.id, 'contacted');
    else if (lead.stage === 'contacted') performStageUpdate(lead.id, 'proposal_sent');
    else if (lead.stage === 'proposal_sent') performStageUpdate(lead.id, 'won');
  }

  function regressStage(lead: Lead) {
    if (lead.stage === 'won') performStageUpdate(lead.id, 'proposal_sent');
    else if (lead.stage === 'proposal_sent') performStageUpdate(lead.id, 'contacted');
    else if (lead.stage === 'contacted') performStageUpdate(lead.id, 'new');
  }

  // Drag-and-Drop Handlers
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedLeadId(leadId);
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (stage: LeadStage) => {
    setDragOverStage(stage);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    setDragOverStage(null);
    setDraggedLeadId(null);

    if (!leadId) return;
    const targetLead = leads.find((l) => l.id === leadId);
    if (!targetLead || targetLead.stage === targetStage) return;

    if (targetStage === 'lost') {
      setLostModalLead(targetLead);
    } else {
      performStageUpdate(leadId, targetStage);
    }
  };

  const pipelineMetricCards = [
    {
      id: 0,
      title: 'Live Active Pipeline',
      value: formatInr(activePipelineValue),
      subtext: `↑ ${activeDealsCount} deals in flight`,
      icon: Flame,
      iconBg: 'bg-[#FFF0F7]',
      iconColor: 'text-[#E85AA0]',
    },
    {
      id: 1,
      title: 'Closed Won Revenue',
      value: formatInr(wonPipelineValue),
      subtext: `${groupedLeads.won.length} converted deals`,
      icon: Trophy,
      iconBg: 'bg-[#F0FDF4]',
      iconColor: 'text-[#15803D]',
    },
    {
      id: 2,
      title: 'Funnel Win Rate',
      value: `${winRate}%`,
      subtext: 'High Conversion Velocity',
      icon: Target,
      iconBg: 'bg-[#F3F0FF]',
      iconColor: 'text-[#5B4CF5]',
    },
    {
      id: 3,
      title: 'Total In Funnel',
      value: leads.length.toString(),
      subtext: `${groupedLeads.won.length} Won • ${groupedLeads.lost.length} Lost`,
      icon: TrendingUp,
      iconBg: 'bg-[#EFF6FF]',
      iconColor: 'text-[#1D4ED8]',
    },
  ];

  return (
    <div className="relative space-y-4 sm:space-y-5">
      {/* Ambient Glassmorphic Glow Orbs */}
      <div className="absolute -top-10 left-10 w-80 h-80 bg-[#7C5CE8]/[0.07] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-[#E85AA0]/[0.07] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-[#3B82F6]/[0.05] rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ========================================================= */}
      {/* 0. HEADER & ACTIONS                                       */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shadow-2xs">
            <KanbanSquare size={16} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A085C]">
              Sales &amp;{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Opportunity Velocity
              </span>
            </h1>
            <p className="text-xs text-[#6B7280] font-medium mt-0.5">
              5-stage active revenue pipeline &amp; conversion funnel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Quick Search */}
          <div className="relative">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search deals..."
              className="h-8.5 pl-8 pr-3 rounded-full border border-[#E5E1F0] bg-white text-xs font-semibold text-[#1A085C] placeholder:text-[#9CA3AF] outline-none focus:border-[#5B4CF5] w-36 sm:w-48 transition-all shadow-2xs"
            />
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadPipelineLeads(true)}
            disabled={isRefreshing || isLoading}
            className="h-8.5 px-3 rounded-full bg-white hover:bg-[#F3F0FF] border border-[#E5E1F0] hover:border-[#5B4CF5]/40 text-[#5B4CF5] text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Pipeline"
          >
            <RefreshCw
              size={11}
              className={isRefreshing ? 'animate-spin text-[#5B4CF5]' : 'text-[#5B4CF5]'}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Create CTA Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #5B4CF5 0%, #7C5CE8 50%, #E85AA0 100%)',
              boxShadow: '0 8px 24px -2px rgba(91, 76, 245, 0.42), 0 2px 8px rgba(232, 90, 160, 0.28)',
              color: '#FFFFFF',
            }}
            className="h-10 sm:h-11 px-5 sm:px-6 rounded-full text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 cursor-pointer shadow-lg shrink-0"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Plus size={14} className="stroke-[3] text-white" />
            </div>
            <span>Create Opportunity</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. TOP SUMMARY METRIC CARDS WITH DYNAMIC HOVER            */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {pipelineMetricCards.map((card, idx) => {
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
      {/* 1.1 PIPELINE VELOCITY & STAGE CONVERSION GRAPH DECK       */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#E5E1F0] p-4 shadow-[0_4px_20px_rgba(26,8,92,0.06)] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center">
            <BarChart3 size={13} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1A085C]">Conversion Funnel &amp; Velocity</h3>
            <p className="text-[10px] text-[#6B7280]">Stage-by-stage opportunity conversion progression</p>
          </div>
        </div>

        {/* 5-Stage Step Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full md:w-auto">
          {STAGES.map((s) => {
            const list = groupedLeads[s.id] || [];
            const sumVal = list.reduce((acc, l) => acc + parseNumericBudget(l.budget), 0);
            return (
              <div
                key={s.id}
                className="bg-[#F8F8FF]/80 p-2 rounded-xl border border-[#EAE6F7]/70 flex flex-col justify-between text-left"
              >
                <div className="flex items-center justify-between gap-1 text-[9.5px] font-semibold text-[#6B7280]">
                  <span className="truncate">{s.label.split('. ')[1]}</span>
                  <span className="font-bold text-[#1A085C] bg-white px-1.5 py-0.2 rounded-full border border-[#EAE6F7]">
                    {list.length}
                  </span>
                </div>
                <div className="text-xs font-black text-[#1A085C] mt-1 tabular-nums">
                  {sumVal > 0 ? formatInr(sumVal) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-rose-600 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. PIPELINE BOARD LANES WITH DEAL VELOCITY CARDS          */}
      {/* ========================================================= */}
      <div className="overflow-x-auto pb-4 -mx-2 px-2 sm:mx-0 sm:px-0">
        <div className="flex gap-3.5 min-w-[1260px]">
          {STAGES.map((col) => {
            const stageLeads = groupedLeads[col.id] || [];
            const stageTotalValue = stageLeads.reduce(
              (sum, l) => sum + parseNumericBudget(l.budget),
              0
            );

            return (
              <div
                key={col.id}
                className="w-[265px] shrink-0 flex flex-col rounded-2xl bg-white/85 backdrop-blur-md border border-white/80 p-3 shadow-[0_4px_20px_rgba(26,8,92,0.03)]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-[#EAE6F7]/80 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <h3 className="text-xs font-bold text-[#1A085C]">
                      {col.label.split('. ')[1] || col.label}
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${col.badgeBg} ${col.badgeBorder} ${col.badgeText} shadow-2xs`}
                  >
                    {stageLeads.length}
                  </span>
                </div>

                {stageTotalValue > 0 && (
                  <div className="mb-2 px-2.5 py-1 rounded-lg bg-[#F8F8FF]/80 border border-[#EAE6F7]/70 flex items-center justify-between text-[10.5px]">
                    <span className="text-[#6B7280] font-medium">Stage Volume</span>
                    <span className="font-bold text-[#1A085C] tabular-nums">
                      {formatInr(stageTotalValue)}
                    </span>
                  </div>
                )}

                {/* Cards Container */}
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-340px)] min-h-[300px] pr-0.5">
                  {isLoading ? (
                    <div className="p-8 text-center text-xs text-[#6B7280] font-medium">
                      Loading opportunities...
                    </div>
                  ) : stageLeads.length === 0 ? (
                    <div className="h-32 border border-dashed border-[#EAE6F7] rounded-xl flex flex-col items-center justify-center p-4 text-center bg-white/40">
                      <p className="text-xs text-[#6B7280] font-semibold">
                        No active deals
                      </p>
                      <span className="text-[10px] text-[#9CA3AF] mt-0.5">
                        In {col.label.split('. ')[1] || col.label}
                      </span>
                    </div>
                  ) : (
                    stageLeads.map((lead) => {
                      const daysInStage = calculateDaysInStage(lead);
                      const initials = getInitials(lead.name);
                      const whatsappDigits = getWhatsAppDigits(lead.phone || '');

                      const isStale = daysInStage > 10;
                      const isFresh = daysInStage <= 2;

                      return (
                        <div
                          key={lead.id}
                          className="bg-white rounded-xl p-3 border border-[#EAE6F7] shadow-[0_2px_10px_rgba(26,8,92,0.02)] hover:border-[#5B4CF5]/50 hover:shadow-[0_8px_24px_rgba(91,76,245,0.08)] transition-all space-y-2.5 group"
                        >
                          {/* Deal Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#5B4CF5]/15 to-[#E85AA0]/20 text-[#5B4CF5] font-black text-[10px] flex items-center justify-center shrink-0 border border-purple-100">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-[#1A085C] leading-tight truncate group-hover:text-[#5B4CF5] transition-colors">
                                  {lead.name}
                                </h4>
                                {lead.company ? (
                                  <div className="text-[9.5px] text-[#6B7280] font-medium flex items-center gap-1 mt-0.5 truncate">
                                    <Building2 size={9} />
                                    <span>{lead.company}</span>
                                  </div>
                                ) : (
                                  <div className="text-[9.5px] text-[#9CA3AF]">Direct Prospect</div>
                                )}
                              </div>
                            </div>

                            {/* Velocity tag */}
                            <span
                              className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-0.5 ${
                                isFresh
                                  ? 'bg-[#F0FDF4] text-[#15803D] border border-green-200'
                                  : isStale
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-[#F8F8FF] text-[#6B7280] border border-[#EAE6F7]'
                              }`}
                            >
                              <Clock size={8} />
                              {daysInStage}d
                            </span>
                          </div>

                          {/* Deal Value & Scope Box */}
                          <div className="bg-[#F8F8FF]/80 p-2 rounded-lg border border-[#EAE6F7]/80 flex items-center justify-between">
                            <div className="text-[10px] font-semibold text-[#4B5563] truncate max-w-[120px]">
                              {lead.serviceNeeded || 'General Inquiry'}
                            </div>
                            <div className="text-xs font-black text-[#10B981] tabular-nums">
                              {lead.budget ? `₹${lead.budget}` : '—'}
                            </div>
                          </div>

                          {/* Lost Reason */}
                          {lead.stage === 'lost' && lead.lostReason && (
                            <div className="text-[9.5px] bg-red-50 text-red-700 p-1.5 rounded-lg border border-red-100">
                              <span className="font-bold">Lost Reason:</span> {lead.lostReason}
                            </div>
                          )}

                          {/* Action Footer */}
                          <div className="pt-1.5 border-t border-[#EAE6F7] flex items-center justify-between">
                            {/* Channels */}
                            <div className="flex items-center gap-1">
                              {lead.phone && (
                                <>
                                  <a
                                    href={`tel:${lead.phone}`}
                                    title="Call Prospect"
                                    className="p-1 rounded-md text-[#6B7280] hover:text-[#5B4CF5] hover:bg-[#F3F0FF] transition-colors"
                                  >
                                    <Phone size={11} />
                                  </a>
                                  <a
                                    href={`https://wa.me/${whatsappDigits}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="WhatsApp Chat"
                                    className="p-1 rounded-md text-[#6B7280] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                  >
                                    <MessageCircle size={11} />
                                  </a>
                                </>
                              )}
                              {lead.email && (
                                <a
                                  href={`mailto:${lead.email}`}
                                  title="Send Email"
                                  className="p-1 rounded-md text-[#6B7280] hover:text-[#5B4CF5] hover:bg-[#F3F0FF] transition-colors"
                                >
                                  <Mail size={11} />
                                </a>
                              )}
                            </div>

                            {/* 1-Click Stage Steppers */}
                            <div className="flex items-center gap-1">
                              {col.id !== 'new' && col.id !== 'lost' && (
                                <button
                                  onClick={() => regressStage(lead)}
                                  disabled={isUpdatingStage}
                                  title="Move to Previous Stage"
                                  className="p-1 rounded-md bg-[#F8F8FF] border border-[#EAE6F7] text-[#6B7280] hover:text-[#1A085C] hover:bg-white transition-colors cursor-pointer"
                                >
                                  <ChevronLeft size={11} />
                                </button>
                              )}

                              {col.id !== 'won' && col.id !== 'lost' && (
                                <>
                                  <button
                                    onClick={() => setLostModalLead(lead)}
                                    disabled={isUpdatingStage}
                                    title="Mark as Lost"
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  >
                                    <XCircle size={11} />
                                  </button>
                                  <button
                                    onClick={() => advanceStage(lead)}
                                    disabled={isUpdatingStage}
                                    title="Advance to Next Stage"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3F0FF] text-[#5B4CF5] hover:bg-[#E5DEFF] text-[9.5px] font-bold transition-all border border-purple-100 cursor-pointer shadow-2xs"
                                  >
                                    <span>Advance</span>
                                    <ArrowRight size={9} />
                                  </button>
                                </>
                              )}

                              {col.id === 'won' && (
                                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-[#15803D] bg-[#F0FDF4] px-2 py-0.5 rounded-md border border-green-200">
                                  <CheckCircle2 size={10} />
                                  Won
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Lead Modal */}
      {isAddModalOpen && (
        <AddLeadModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={(newLead) => {
            setLeads((prev) => [newLead, ...prev]);
            setIsAddModalOpen(false);
          }}
        />
      )}

      {/* Lost Reason Modal */}
      {lostModalLead && (
        <LostReasonModal
          isOpen={Boolean(lostModalLead)}
          leadName={lostModalLead.name}
          onClose={() => setLostModalLead(null)}
          onConfirm={(reason) => {
            const id = lostModalLead.id;
            setLostModalLead(null);
            performStageUpdate(id, 'lost', reason);
          }}
          isSubmitting={isUpdatingStage}
        />
      )}
    </div>
  );
};
