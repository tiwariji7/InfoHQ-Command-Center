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
  SlidersHorizontal,
} from 'lucide-react';

interface StageColumnConfig {
  id: LeadStage;
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  dotColor: string;
  gradient: string;
}

const STAGES: StageColumnConfig[] = [
  {
    id: 'new',
    label: '1. Inbound Leads',
    badgeBg: 'bg-[#FAF5FF]',
    badgeBorder: 'border-purple-200',
    badgeText: 'text-[#6B21A8]',
    dotColor: 'bg-[#9333EA]',
    gradient: 'from-[#7C3AED] to-[#8B5CF6]',
  },
  {
    id: 'contacted',
    label: '2. Contacted & Discovery',
    badgeBg: 'bg-[#EFF6FF]',
    badgeBorder: 'border-blue-200',
    badgeText: 'text-[#1D4ED8]',
    dotColor: 'bg-[#2563EB]',
    gradient: 'from-[#2563EB] to-[#3B82F6]',
  },
  {
    id: 'proposal_sent',
    label: '3. Proposal & Negotiation',
    badgeBg: 'bg-[#FFF7ED]',
    badgeBorder: 'border-orange-200',
    badgeText: 'text-[#C2410C]',
    dotColor: 'bg-[#EA580C]',
    gradient: 'from-[#EA580C] to-[#F97316]',
  },
  {
    id: 'won',
    label: '4. Closed Won',
    badgeBg: 'bg-[#F0FDF4]',
    badgeBorder: 'border-green-200',
    badgeText: 'text-[#15803D]',
    dotColor: 'bg-[#16A34A]',
    gradient: 'from-[#059669] to-[#10B981]',
  },
  {
    id: 'lost',
    label: '5. Disqualified / Lost',
    badgeBg: 'bg-slate-50',
    badgeBorder: 'border-slate-200',
    badgeText: 'text-slate-600',
    dotColor: 'bg-slate-400',
    gradient: 'from-slate-400 to-slate-500',
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

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lostModalLead, setLostModalLead] = useState<Lead | null>(null);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

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
        const res = await fetchLeads(getToken, { page: 1, pageSize: 60 });
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

  // Filtered leads
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

  // Group leads by stage
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

  // Aggregate metrics
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

  // Perform optimistic stage update
  async function performStageUpdate(leadId: string, newStage: LeadStage, lostReason?: string) {
    const originalLeads = [...leads];
    const targetLead = leads.find((l) => l.id === leadId);
    if (!targetLead || targetLead.stage === newStage) return;

    // Optimistic UI update
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

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 0. HEADER & ACTIONS                                       */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE]">
              <Flame size={12} className="text-[#7C3AED]" />
              Revenue Pipeline
            </span>
            <span className="text-xs text-brand-muted hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-brand-muted hidden sm:inline">
              5-Stage Opportunity Funnel
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A085C] mt-1">
            Sales &{' '}
            <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">
              Opportunity Velocity
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Quick Search in board */}
          <div className="relative">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search deals..."
              className="h-10 pl-8 pr-3 rounded-xl border border-[#EDE8F5] bg-white text-xs font-semibold text-brand-heading placeholder:text-brand-muted outline-none focus:border-[#7C3AED] w-40 sm:w-52 transition-all shadow-2xs"
            />
            <SlidersHorizontal
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none"
            />
          </div>

          <button
            onClick={() => loadPipelineLeads(true)}
            disabled={isRefreshing || isLoading}
            className="p-2.5 rounded-xl bg-white border border-[#EDE8F5] text-brand-muted hover:text-[#7C3AED] shadow-2xs transition-all cursor-pointer"
            title="Refresh Pipeline"
          >
            <RefreshCw
              size={15}
              className={isRefreshing ? 'animate-spin text-[#7C3AED]' : ''}
            />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-xs sm:text-sm font-bold shadow-[0_4px_16px_rgba(124,58,237,0.25)] hover:shadow-[0_8px_24px_rgba(124,58,237,0.35)] transition-all cursor-pointer"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>Create Opportunity</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. BESPOKE PIPELINE CONVERSION FUNNEL (Unique to this page) */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#EDE8F5] p-5 shadow-[0_4px_24px_rgba(124,58,237,0.04)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-[#EDE8F5] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center font-bold shadow-2xs">
              ₹
            </div>
            <div>
              <div className="text-xs font-bold text-brand-muted uppercase tracking-wider">
                Live Active Pipeline
              </div>
              <div className="text-2xl sm:text-3xl font-black tabular-nums bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#5B4CF5] bg-clip-text text-transparent">
                {formatInr(activePipelineValue)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <div>
              <div className="text-[11px] font-bold text-brand-muted uppercase">Closed Revenue</div>
              <div className="text-lg font-black text-emerald-700 tabular-nums">
                {formatInr(wonPipelineValue)}
              </div>
            </div>
            <div className="h-8 w-px bg-[#EDE8F5]" />
            <div>
              <div className="text-[11px] font-bold text-brand-muted uppercase">Funnel Win Rate</div>
              <div className="text-lg font-black text-[#7C3AED] tabular-nums">
                {winRate}%
              </div>
            </div>
            <div className="h-8 w-px bg-[#EDE8F5]" />
            <div>
              <div className="text-[11px] font-bold text-brand-muted uppercase">Total In Flight</div>
              <div className="text-lg font-black text-brand-heading tabular-nums">
                {groupedLeads.new.length + groupedLeads.contacted.length + groupedLeads.proposal_sent.length} deals
              </div>
            </div>
          </div>
        </div>

        {/* Connected Funnel Chevron Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {STAGES.map((s) => {
            const list = groupedLeads[s.id] || [];
            const sumValue = list.reduce((acc, l) => acc + parseNumericBudget(l.budget), 0);

            return (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-[#FAF9FD] border border-[#EDE8F5] hover:border-[#7C3AED]/40 transition-colors flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${s.dotColor}`} />
                    <span className="text-xs font-bold text-brand-heading truncate">
                      {s.label.split('. ')[1] || s.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold bg-white border border-[#EDE8F5] px-1.5 py-0.2 rounded-full">
                    {list.length}
                  </span>
                </div>
                <div className="mt-2 text-sm font-black text-brand-heading tabular-nums">
                  {sumValue > 0 ? formatInr(sumValue) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-brand-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
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
      <div className="overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-4 min-w-[1300px]">
          {STAGES.map((col) => {
            const stageLeads = groupedLeads[col.id] || [];
            const stageTotalValue = stageLeads.reduce(
              (sum, l) => sum + parseNumericBudget(l.budget),
              0
            );

            return (
              <div
                key={col.id}
                className="w-[285px] shrink-0 flex flex-col rounded-2xl bg-[#FAF9FD] border border-[#EDE8F5] p-3.5 shadow-2xs"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#EDE8F5] mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                    <h3 className="text-xs font-bold text-brand-heading">
                      {col.label}
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${col.badgeBg} ${col.badgeBorder} ${col.badgeText}`}
                  >
                    {stageLeads.length}
                  </span>
                </div>

                {stageTotalValue > 0 && (
                  <div className="mb-2.5 px-2.5 py-1 rounded-lg bg-white border border-[#EDE8F5] flex items-center justify-between text-[11px]">
                    <span className="text-brand-muted font-medium">Stage Volume</span>
                    <span className="font-bold text-brand-heading tabular-nums">
                      {formatInr(stageTotalValue)}
                    </span>
                  </div>
                )}

                {/* Cards Container */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-360px)] min-h-[320px] pr-1">
                  {isLoading ? (
                    <div className="p-8 text-center text-xs text-brand-muted font-medium">
                      Loading opportunities...
                    </div>
                  ) : stageLeads.length === 0 ? (
                    <div className="h-36 border border-dashed border-[#EDE8F5] rounded-xl flex flex-col items-center justify-center p-4 text-center bg-white/40">
                      <p className="text-xs text-brand-muted font-semibold">
                        No active deals
                      </p>
                      <span className="text-[10px] text-brand-muted/70 mt-0.5">
                        In {col.label}
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
                          className="bg-white rounded-xl p-3.5 border border-[#EDE8F5] shadow-2xs hover:shadow-md hover:border-[#7C3AED]/40 transition-all space-y-3 group"
                        >
                          {/* Deal Header: Avatar Monogram + Velocity Tag */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-brand-heading leading-tight truncate group-hover:text-[#7C3AED] transition-colors">
                                  {lead.name}
                                </h4>
                                {lead.company ? (
                                  <div className="text-[10px] text-brand-muted font-medium flex items-center gap-1 mt-0.5 truncate">
                                    <Building2 size={10} />
                                    <span>{lead.company}</span>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-brand-muted">Direct Prospect</div>
                                )}
                              </div>
                            </div>

                            {/* Velocity tag */}
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-0.5 ${
                                isFresh
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isStale
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-50 text-slate-600 border border-slate-200'
                              }`}
                            >
                              <Clock size={9} />
                              {daysInStage}d
                            </span>
                          </div>

                          {/* Deal Value & Scope Box */}
                          <div className="bg-[#FAF9FD] p-2.5 rounded-lg border border-[#EDE8F5] flex items-center justify-between">
                            <div className="text-[11px] font-semibold text-brand-heading truncate max-w-[130px]">
                              {lead.serviceNeeded || 'General Inquiry'}
                            </div>
                            <div className="text-xs font-black text-emerald-700 tabular-nums">
                              {lead.budget ? `₹${lead.budget}` : '—'}
                            </div>
                          </div>

                          {/* Lost Reason if in lost stage */}
                          {lead.stage === 'lost' && lead.lostReason && (
                            <div className="text-[10px] bg-red-50 text-red-700 p-2 rounded-lg border border-red-100">
                              <span className="font-bold">Lost Reason:</span> {lead.lostReason}
                            </div>
                          )}

                          {/* Action Footer: 1-Click Advance Buttons & Channels */}
                          <div className="pt-2 border-t border-[#EDE8F5] flex items-center justify-between">
                            {/* Communication channels */}
                            <div className="flex items-center gap-1">
                              {lead.phone && (
                                <>
                                  <a
                                    href={`tel:${lead.phone}`}
                                    title="Call Prospect"
                                    className="p-1 rounded-md text-brand-muted hover:text-[#7C3AED] hover:bg-[#EDE9FE] transition-colors"
                                  >
                                    <Phone size={12} />
                                  </a>
                                  <a
                                    href={`https://wa.me/${whatsappDigits}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="WhatsApp Chat"
                                    className="p-1 rounded-md text-brand-muted hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                  >
                                    <MessageCircle size={12} />
                                  </a>
                                </>
                              )}
                              {lead.email && (
                                <a
                                  href={`mailto:${lead.email}`}
                                  title="Send Email"
                                  className="p-1 rounded-md text-brand-muted hover:text-[#7C3AED] hover:bg-[#EDE9FE] transition-colors"
                                >
                                  <Mail size={12} />
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
                                  className="p-1 rounded-md bg-[#FAF9FD] border border-[#EDE8F5] text-brand-muted hover:text-brand-heading hover:bg-white transition-colors"
                                >
                                  <ChevronLeft size={12} />
                                </button>
                              )}

                              {col.id !== 'won' && col.id !== 'lost' && (
                                <>
                                  <button
                                    onClick={() => setLostModalLead(lead)}
                                    disabled={isUpdatingStage}
                                    title="Mark as Lost"
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  >
                                    <XCircle size={12} />
                                  </button>
                                  <button
                                    onClick={() => advanceStage(lead)}
                                    disabled={isUpdatingStage}
                                    title="Advance to Next Stage"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#EDE9FE] text-[#7C3AED] hover:bg-[#DDD6FE] text-[10px] font-bold transition-all shadow-2xs"
                                  >
                                    <span>Advance</span>
                                    <ArrowRight size={10} />
                                  </button>
                                </>
                              )}

                              {col.id === 'won' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <CheckCircle2 size={11} />
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
