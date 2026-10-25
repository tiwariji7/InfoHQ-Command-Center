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
  TrendingUp,
  AlertCircle,
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
    label: 'New',
    badgeBg: 'bg-purple-50',
    badgeBorder: 'border-purple-200',
    badgeText: 'text-purple-700',
    dotColor: 'bg-purple-500',
  },
  {
    id: 'contacted',
    label: 'Contacted',
    badgeBg: 'bg-blue-50',
    badgeBorder: 'border-blue-200',
    badgeText: 'text-blue-700',
    dotColor: 'bg-blue-500',
  },
  {
    id: 'proposal_sent',
    label: 'Proposal Sent',
    badgeBg: 'bg-orange-50',
    badgeBorder: 'border-orange-200',
    badgeText: 'text-orange-700',
    dotColor: 'bg-orange-500',
  },
  {
    id: 'won',
    label: 'Won',
    badgeBg: 'bg-green-50',
    badgeBorder: 'border-green-200',
    badgeText: 'text-green-700',
    dotColor: 'bg-green-500',
  },
  {
    id: 'lost',
    label: 'Lost',
    badgeBg: 'bg-neutral-100',
    badgeBorder: 'border-neutral-200',
    badgeText: 'text-neutral-600',
    dotColor: 'bg-neutral-400',
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

export const PipelineView: React.FC = () => {
  const { getToken } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lostModalLead, setLostModalLead] = useState<Lead | null>(null);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  const loadPipelineLeads = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        // Fetch up to 50 active leads for the pipeline
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

  // Group leads by stage
  const groupedLeads = useMemo(() => {
    const map: Record<LeadStage, Lead[]> = {
      new: [],
      contacted: [],
      proposal_sent: [],
      won: [],
      lost: [],
    };
    for (const lead of leads) {
      if (map[lead.stage]) {
        map[lead.stage].push(lead);
      } else {
        map.new.push(lead);
      }
    }
    return map;
  }, [leads]);

  // Pipeline metrics
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

  // Execute stage update with optimistic rollback
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
              lostReason: newStage === 'lost' ? (lostReason || null) : null,
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
      // Rollback on failure
      setLeads(originalLeads);
      const msg = err instanceof Error ? err.message : 'Stage update failed';
      setErrorMessage(`Failed to move lead to ${newStage}: ${msg}`);
    } finally {
      setIsUpdatingStage(false);
    }
  }

  function handleStageSelect(lead: Lead, targetStage: LeadStage) {
    if (lead.stage === targetStage) return;
    if (targetStage === 'lost') {
      // Prompt for lost reason
      setLostModalLead(lead);
    } else {
      performStageUpdate(lead.id, targetStage);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-heading">
            Sales Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
            5-stage opportunity funnel with optimistic state updates and activity logging.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => loadPipelineLeads(true)}
            disabled={isRefreshing || isLoading}
            className="hq-btn-secondary text-xs h-10 px-3"
            title="Refresh Pipeline"
          >
            <RefreshCw
              size={15}
              className={isRefreshing ? 'animate-spin text-brand-primary' : ''}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="hq-btn-primary text-xs h-10"
          >
            <Plus size={16} />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="hq-card bg-white border-brand-border p-4 sm:p-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-brand-muted font-medium">
              Active Pipeline Value
            </div>
            <div className="text-xl sm:text-2xl font-bold text-brand-heading mt-1 tabular-nums">
              {formatInr(activePipelineValue)}
            </div>
            <div className="text-[11px] text-brand-muted mt-0.5">
              Across New, Contacted & Proposal stages
            </div>
          </div>
          <div className="w-10 h-10 rounded-control bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="hq-card bg-white border-brand-border p-4 sm:p-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-brand-muted font-medium">
              Closed Won Revenue
            </div>
            <div className="text-xl sm:text-2xl font-bold text-green-700 mt-1 tabular-nums">
              {formatInr(wonPipelineValue)}
            </div>
            <div className="text-[11px] text-brand-muted mt-0.5">
              {groupedLeads.won.length} converted opportunities
            </div>
          </div>
          <div className="w-10 h-10 rounded-control bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
        </div>

        <div className="hq-card bg-white border-brand-border p-4 sm:p-5 flex items-center justify-between">
          <div>
            <div className="text-xs text-brand-muted font-medium">
              Total Opportunities
            </div>
            <div className="text-xl sm:text-2xl font-bold text-brand-heading mt-1 tabular-nums">
              {leads.length}
            </div>
            <div className="text-[11px] text-brand-muted mt-0.5">
              Active inquiries in Command Center
            </div>
          </div>
          <div className="w-10 h-10 rounded-control bg-brand-subtle text-brand-primary flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="p-3.5 rounded-control bg-brand-errorBg border border-red-200 text-xs text-brand-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pipeline Board Container (Horizontal Scroll for mobile/tablet) */}
      <div className="overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-4 min-w-[1280px]">
          {STAGES.map((col) => {
            const stageLeads = groupedLeads[col.id] || [];
            const stageTotalValue = stageLeads.reduce(
              (sum, l) => sum + parseNumericBudget(l.budget),
              0
            );

            return (
              <div
                key={col.id}
                className="w-[280px] lg:w-[300px] shrink-0 flex flex-col rounded-card bg-[#F9F8FD] border border-brand-border/80 p-3"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-brand-border/60 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                    <h3 className="text-sm font-bold text-brand-heading">
                      {col.label}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-chip text-[11px] font-semibold border ${col.badgeBg} ${col.badgeBorder} ${col.badgeText}`}
                    >
                      {stageLeads.length}
                    </span>
                  </div>

                  {stageTotalValue > 0 && (
                    <span className="text-[11px] font-medium text-brand-muted tabular-nums">
                      {formatInr(stageTotalValue)}
                    </span>
                  )}
                </div>

                {/* Cards Container */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px]">
                  {isLoading ? (
                    <div className="p-6 text-center text-xs text-brand-muted">
                      Loading cards...
                    </div>
                  ) : stageLeads.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-brand-border/60 rounded-control flex flex-col items-center justify-center p-4 text-center">
                      <p className="text-xs text-brand-lightGray font-medium">
                        No leads in this stage
                      </p>
                    </div>
                  ) : (
                    stageLeads.map((lead) => {
                      const daysInStage = calculateDaysInStage(lead);
                      return (
                        <div
                          key={lead.id}
                          className="bg-white rounded-control p-3.5 border border-brand-border shadow-sm hover:shadow-md transition-shadow space-y-2.5"
                        >
                          {/* Card Header: Client & Days */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-brand-heading leading-tight">
                                {lead.name}
                              </h4>
                              {lead.company && (
                                <div className="text-[11px] text-brand-muted font-medium mt-0.5">
                                  {lead.company}
                                </div>
                              )}
                            </div>
                            <span
                              className="text-[10px] text-brand-muted font-medium shrink-0 flex items-center gap-1"
                              title={`Updated ${daysInStage} day(s) ago`}
                            >
                              <Clock size={11} />
                              {daysInStage}d
                            </span>
                          </div>

                          {/* Service & Budget Row */}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-brand-border/40">
                            <span className="text-brand-heading font-medium text-[11px] truncate max-w-[140px]">
                              {lead.serviceNeeded || 'General Inquiry'}
                            </span>
                            {lead.budget ? (
                              <span className="font-semibold text-brand-heading tabular-nums text-[11px]">
                                ₹{lead.budget}
                              </span>
                            ) : (
                              <span className="text-brand-lightGray text-[10px] italic">
                                No budget
                              </span>
                            )}
                          </div>

                          {/* Lost Reason if in lost stage */}
                          {lead.stage === 'lost' && lead.lostReason && (
                            <div className="text-[10px] bg-red-50 text-red-700 p-1.5 rounded border border-red-100 leading-tight">
                              Reason: {lead.lostReason}
                            </div>
                          )}

                          {/* Quick Contact & Move Selector */}
                          <div className="flex items-center justify-between pt-2 border-t border-brand-border/50">
                            {/* Contact icons */}
                            <div className="flex items-center gap-1 text-brand-muted">
                              {lead.phone && (
                                <>
                                  <a
                                    href={`tel:${lead.phone}`}
                                    title="Call"
                                    className="p-1 rounded text-brand-muted hover:text-brand-primary hover:bg-brand-subtle transition-colors"
                                  >
                                    <Phone size={13} />
                                  </a>
                                  <a
                                    href={`https://wa.me/${getWhatsAppDigits(lead.phone)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="WhatsApp"
                                    className="p-1 rounded text-brand-muted hover:text-green-600 hover:bg-green-50 transition-colors"
                                  >
                                    <MessageCircle size={13} />
                                  </a>
                                </>
                              )}
                              {lead.email && (
                                <a
                                  href={`mailto:${lead.email}`}
                                  title="Email"
                                  className="p-1 rounded text-brand-muted hover:text-brand-primary hover:bg-brand-subtle transition-colors"
                                >
                                  <Mail size={13} />
                                </a>
                              )}
                            </div>

                            {/* Move Stage Selector */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-brand-muted">
                                Move:
                              </span>
                              <select
                                value={lead.stage}
                                onChange={(e) =>
                                  handleStageSelect(
                                    lead,
                                    e.target.value as LeadStage
                                  )
                                }
                                disabled={isUpdatingStage}
                                className="h-7 text-[10px] px-1.5 rounded border border-brand-border bg-white text-brand-heading font-medium focus:border-brand-primary focus:ring-0 cursor-pointer"
                              >
                                {STAGES.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
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
