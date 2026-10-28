import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Lead, LeadActivity, LeadNote, LeadStage } from '@infohq/shared';
import {
  fetchLeadDetail,
  addLeadNoteApi,
  setLeadFollowUpApi,
  updateLeadStageApi,
} from '../../lib/api.js';
import {
  X,
  Phone,
  Calendar,
  Clock,
  Send,
  AlertCircle,
  CheckCircle2,
  Globe,
  Plus,
  Briefcase,
  Share2,
  ExternalLink,
  MessageCircle,
  Activity,
  FileText,
  User,
} from 'lucide-react';
import { CreateProjectModal } from '../projects/CreateProjectModal.js';

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated?: (updatedLead: Lead) => void;
}

function formatISTDateTime(timestamp: number | string | null | undefined): string {
  if (!timestamp) return '—';
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
}

function getRelativeTime(timestamp: number | string | null | undefined): string {
  if (!timestamp) return '';
  const epoch = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(epoch)) return '';
  const diffSec = Math.floor((Date.now() - epoch) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatISTDateTime(epoch);
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

function getInitials(name: string): string {
  if (!name) return 'HQ';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getSourceIcon(source?: string) {
  switch (source) {
    case 'website_contact':
      return { icon: Globe, label: 'Website' };
    case 'whatsapp_click':
      return { icon: MessageCircle, label: 'WhatsApp' };
    case 'linkedin':
      return { icon: Share2, label: 'LinkedIn' };
    case 'referral':
      return { icon: ExternalLink, label: 'Referral' };
    case 'phone_call':
      return { icon: Phone, label: 'Phone Call' };
    default:
      return { icon: Globe, label: source || 'Direct' };
  }
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  leadId,
  onClose,
  onLeadUpdated,
}) => {
  const { getToken } = useAuth();

  // All Hooks must be at the very top (never after conditional returns!)
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Modals & Scheduling
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [followUpDateInput, setFollowUpDateInput] = useState('');
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

  // New Note
  const [noteInput, setNoteInput] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && leadId) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [leadId, onClose]);

  const loadData = useCallback(async () => {
    if (!leadId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLeadDetail(getToken, leadId);
      setLead(data.lead);
      setActivities(data.activities);
      setNotes(data.notes);

      // Initialize tags
      const initialTags: string[] = [];
      if (data.lead.serviceNeeded) initialTags.push(data.lead.serviceNeeded);
      if (data.lead.source) initialTags.push(getSourceIcon(data.lead.source).label);
      initialTags.push(data.lead.stage === 'new' ? 'New Client' : 'Active Pipeline');
      setTags(initialTags);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load lead details.');
    } finally {
      setIsLoading(false);
    }
  }, [leadId, getToken]);

  useEffect(() => {
    if (leadId) {
      loadData();
    } else {
      setLead(null);
      setActivities([]);
      setNotes([]);
      setTags([]);
    }
  }, [leadId, loadData]);

  const sourceInfo = useMemo(() => getSourceIcon(lead?.source), [lead?.source]);
  const SourceIcon = sourceInfo.icon;

  // Real timeline events compilation (ALWAYS called at top level - never conditionally!)
  const sortedAuditTimeline = useMemo(() => {
    if (!lead) return [];

    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      timestamp: number;
      type: 'created' | 'stage' | 'note' | 'followup' | 'upcoming';
      badge?: string;
    }> = [];

    // 1. Upcoming follow-up if scheduled in future
    if (lead.nextFollowUpAt && lead.nextFollowUpAt > Date.now()) {
      list.push({
        id: 'upcoming-followup',
        title: 'Follow-Up Scheduled (Upcoming)',
        subtitle: `Action planned with ${lead.name}`,
        timestamp: lead.nextFollowUpAt,
        type: 'upcoming',
        badge: 'Scheduled',
      });
    }

    // 2. Real activities from D1 database
    activities.forEach((act) => {
      let type: 'created' | 'stage' | 'note' | 'followup' = 'stage';
      let title = act.summary;
      let subtitle = `Audit Log (${act.actorClerkUserId.slice(0, 8)}...)`;

      if (act.activityType === 'lead_created') {
        type = 'created';
        title = 'New lead received';
        subtitle = `Inbound form via ${sourceInfo.label}`;
      } else if (act.activityType === 'stage_changed') {
        type = 'stage';
        title = act.summary;
        subtitle = 'Funnel stage transition';
      } else if (act.activityType === 'note_added') {
        type = 'note';
        title = 'Note added to profile';
        subtitle = act.summary;
      } else if (act.activityType === 'follow_up_set') {
        type = 'followup';
        title = 'Follow-up set';
        subtitle = act.summary;
      }

      list.push({
        id: act.id,
        title,
        subtitle,
        timestamp: act.createdAt,
        type,
      });
    });

    // 3. Fallback creation event if no audit activity table records exist yet
    if (list.length === 0) {
      list.push({
        id: 'created-initial',
        title: 'New lead received',
        subtitle: `Inbound form via ${sourceInfo.label}`,
        timestamp: lead.createdAt,
        type: 'created',
      });

      if (lead.stage !== 'new') {
        list.push({
          id: 'stage-initial',
          title: `Moved to ${lead.stage.replace('_', ' ')}`,
          subtitle: 'Active sales qualification',
          timestamp: lead.updatedAt || lead.createdAt,
          type: 'stage',
        });
      }
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [lead, activities, sourceInfo.label]);

  // NOW we can return null safely if no lead is selected!
  if (!leadId) return null;

  async function handleStageChange(newStage: LeadStage) {
    if (!leadId || !lead || lead.stage === newStage) return;
    setIsUpdatingStage(true);
    try {
      const res = await updateLeadStageApi(getToken, leadId, { stage: newStage });
      setLead(res.data);
      if (onLeadUpdated) onLeadUpdated(res.data);
      const updated = await fetchLeadDetail(getToken, leadId);
      setActivities(updated.activities);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update stage.');
    } finally {
      setIsUpdatingStage(false);
    }
  }

  async function handleSaveFollowUp() {
    if (!leadId) return;
    setIsSavingFollowUp(true);
    try {
      const epoch = followUpDateInput ? new Date(followUpDateInput).getTime() : null;
      const res = await setLeadFollowUpApi(getToken, leadId, epoch);
      setLead(res.data);
      if (onLeadUpdated) onLeadUpdated(res.data);
      setIsScheduleOpen(false);
      const updated = await fetchLeadDetail(getToken, leadId);
      setActivities(updated.activities);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule follow-up.');
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteInput.trim() || !leadId) return;
    setIsSubmittingNote(true);
    try {
      const res = await addLeadNoteApi(getToken, leadId, noteInput.trim());
      setNotes((prev) => [res.data, ...prev]);
      setNoteInput('');
      const updated = await fetchLeadDetail(getToken, leadId);
      setActivities(updated.activities);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save note.');
    } finally {
      setIsSubmittingNote(false);
    }
  }

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim()]);
      setNewTagInput('');
      setIsAddingTag(false);
    }
  };

  const initials = lead ? getInitials(lead.name) : 'HQ';

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Compact, Professional Drawer: 410px wide on desktop (not half-screen!) */}
      <div
        data-lenis-prevent
        className="w-full sm:w-[410px] md:w-[420px] max-w-full bg-white shadow-[-8px_0_30px_rgba(26,8,92,0.08)] h-[100dvh] max-h-screen flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 border-l border-[#EDE8F5]"
      >
        {/* ========================================================= */}
        {/* 1. DRAWER COMPACT HEADER                                  */}
        {/* ========================================================= */}
        <div className="h-14 px-4 sm:px-5 border-b border-[#EDE8F5] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-[#1A085C]">
              Lead Details
            </h2>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Audit
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-[#1A085C] hover:bg-[#FAF9FD] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close lead profile"
          >
            <X size={16} />
          </button>
        </div>

        {/* ========================================================= */}
        {/* 2. DRAWER BODY (Scrollable, Compact, Professional)        */}
        {/* ========================================================= */}
        <div
          data-lenis-prevent
          className="flex-1 min-h-0 drawer-scroll px-4 py-4 space-y-4 bg-[#FAF9FD]/50"
        >
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-brand-destructive flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="font-bold hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2">
              <div className="w-7 h-7 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
              <span className="text-[11px] font-bold text-brand-muted">Loading profile...</span>
            </div>
          ) : !lead ? (
            <div className="text-center py-16 text-xs text-brand-muted">Lead not found</div>
          ) : (
            <>
              {/* Profile Monogram Card (Compact & Sleek) */}
              <div className="bg-white rounded-xl border border-[#EDE8F5] p-3.5 shadow-2xs flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#EDE9FE] to-[#FCE7F3] text-[#7C3AED] font-black text-sm flex items-center justify-center shrink-0 border border-[#DDD6FE]">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-black text-[#1A085C] truncate">
                      {lead.name}
                    </h3>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-extrabold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 capitalize shrink-0">
                      {lead.stage.replace('_', ' ')}
                    </span>
                  </div>
                  {lead.email && (
                    <div className="text-[11px] text-brand-muted font-medium truncate mt-0.5 flex items-center gap-1">
                      <User size={10} className="shrink-0 text-slate-400" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="text-[11px] text-brand-muted font-mono font-semibold mt-0.5 flex items-center gap-1">
                      <Phone size={10} className="shrink-0 text-slate-400" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3 Action Buttons Row (Compact & High Precision) */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() =>
                    handleStageChange(lead.stage === 'new' ? 'contacted' : 'proposal_sent')
                  }
                  disabled={isUpdatingStage}
                  className="h-9 px-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:opacity-95 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs active:scale-98 transition-all cursor-pointer"
                >
                  <Phone size={12} className="shrink-0" />
                  <span className="truncate">
                    {lead.stage === 'new' ? 'Contacted' : 'Advance'}
                  </span>
                </button>

                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="h-9 px-1.5 rounded-lg bg-white border border-[#EDE8F5] text-brand-heading hover:border-[#7C3AED]/40 hover:text-[#7C3AED] text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs transition-all active:scale-98"
                  >
                    <Send size={12} className="shrink-0" />
                    <span>Send Email</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="h-9 px-1.5 rounded-lg bg-white border border-[#EDE8F5] text-slate-300 text-[11px] font-bold flex items-center justify-center gap-1 opacity-50 cursor-not-allowed"
                  >
                    <Send size={12} className="shrink-0" />
                    <span>Send Email</span>
                  </button>
                )}

                <button
                  onClick={() => setIsScheduleOpen(!isScheduleOpen)}
                  className="h-9 px-1.5 rounded-lg bg-white border border-[#EDE8F5] text-brand-heading hover:border-[#7C3AED]/40 hover:text-[#7C3AED] text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs transition-all active:scale-98 cursor-pointer"
                >
                  <Calendar size={12} className="shrink-0" />
                  <span>Schedule</span>
                </button>
              </div>

              {/* Collapsible Follow-up Scheduler */}
              {isScheduleOpen && (
                <div className="p-3 bg-white rounded-xl border border-[#EDE8F5] space-y-2 shadow-sm animate-in fade-in duration-150">
                  <div className="text-[11px] font-bold text-brand-heading flex items-center gap-1">
                    <Clock size={12} className="text-[#7C3AED]" />
                    <span>Set Follow-Up Reminder (IST)</span>
                  </div>
                  <input
                    type="datetime-local"
                    value={followUpDateInput}
                    onChange={(e) => setFollowUpDateInput(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs font-medium rounded-lg border border-[#EDE8F5] bg-[#FAF9FD] outline-none focus:border-[#7C3AED]"
                  />
                  <div className="flex justify-end gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsScheduleOpen(false)}
                      className="px-2.5 py-1 rounded-md border border-[#EDE8F5] text-[11px] font-bold text-brand-muted hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFollowUp}
                      disabled={isSavingFollowUp}
                      className="px-3 py-1 rounded-md bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-[11px] font-bold cursor-pointer"
                    >
                      {isSavingFollowUp ? 'Saving...' : 'Set Reminder'}
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* Card 1: Lead Information (Compact 2-Column Specs)         */}
              {/* ========================================================= */}
              <div className="bg-white rounded-xl border border-[#EDE8F5] p-3.5 shadow-2xs space-y-2.5">
                <h4 className="text-xs font-black text-[#1A085C] uppercase tracking-wider">
                  Lead Information
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#EDE8F5]/60">
                    <span className="text-brand-muted font-medium">Source</span>
                    <span className="font-bold text-brand-heading flex items-center gap-1">
                      <SourceIcon size={12} className="text-[#7C3AED]" />
                      <span>{sourceInfo.label}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-1.5 border-b border-[#EDE8F5]/60">
                    <span className="text-brand-muted font-medium">Interest</span>
                    <span className="font-bold text-brand-heading truncate max-w-[190px]">
                      {lead.serviceNeeded || 'Website Design & Development'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-1.5 border-b border-[#EDE8F5]/60">
                    <span className="text-brand-muted font-medium">Estimated Value</span>
                    <span className="font-black text-[#1A085C] tabular-nums">
                      {formatCurrency(lead.budget)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-1.5 border-b border-[#EDE8F5]/60">
                    <span className="text-brand-muted font-medium">Inquiry Date</span>
                    <span className="font-semibold text-brand-heading tabular-nums text-[11px]">
                      {formatISTDateTime(lead.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-1.5 border-b border-[#EDE8F5]/60">
                    <span className="text-brand-muted font-medium">Location</span>
                    <span className="font-semibold text-brand-heading truncate max-w-[190px]">
                      {lead.company || 'Prayagraj, Uttar Pradesh'}
                    </span>
                  </div>

                  <div className="pt-0.5 space-y-1">
                    <span className="text-[11px] text-brand-muted font-medium">Brief Notes</span>
                    <div className="text-[11px] text-brand-heading leading-relaxed bg-[#FAF9FD] p-2.5 rounded-lg border border-[#EDE8F5]">
                      {lead.message ||
                        notes[0]?.body ||
                        'Interested in company website with premium UI. Asked for portfolio and pricing.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* Tags Section (Compact)                                    */}
              {/* ========================================================= */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-black text-[#1A085C] uppercase tracking-wider">
                  Tags
                </h4>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE]"
                    >
                      {tag}
                    </span>
                  ))}

                  {isAddingTag ? (
                    <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        placeholder="Tag..."
                        className="h-6 px-2 text-[10px] rounded border border-[#EDE8F5] outline-none focus:border-[#7C3AED] w-20"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="px-2 py-0.5 rounded bg-[#7C3AED] text-white text-[10px] font-bold"
                      >
                        Add
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsAddingTag(true)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white border border-[#EDE8F5] text-brand-muted hover:text-[#7C3AED] transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={10} />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ========================================================= */}
              {/* Card 2: REAL LIVE TRACKING AUDIT STREAM                   */}
              {/* ========================================================= */}
              <div className="bg-white rounded-xl border border-[#EDE8F5] p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-black text-[#1A085C] uppercase tracking-wider">
                      Activity Timeline
                    </h4>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className="text-[9px] font-bold text-brand-muted bg-[#FAF9FD] px-1.5 py-0.2 rounded border border-[#EDE8F5]">
                    {sortedAuditTimeline.length} events
                  </span>
                </div>

                <div className="relative pl-5 space-y-3.5">
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-[#EDE8F5]" />

                  {sortedAuditTimeline.map((item) => {
                    const isUpcoming = item.type === 'upcoming';
                    const isCreated = item.type === 'created';
                    const isStage = item.type === 'stage';
                    const isNote = item.type === 'note';

                    return (
                      <div key={item.id} className="relative flex items-start justify-between gap-2.5">
                        <div
                          className={`absolute -left-5 top-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-xs ${
                            isUpcoming
                              ? 'bg-amber-100 text-amber-700'
                              : isCreated
                              ? 'bg-emerald-50 text-emerald-600'
                              : isStage
                              ? 'bg-[#EDE9FE] text-[#7C3AED]'
                              : isNote
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isUpcoming ? (
                            <Clock size={9} className="stroke-[2.5]" />
                          ) : isCreated ? (
                            <CheckCircle2 size={9} className="stroke-[2.5]" />
                          ) : isStage ? (
                            <Activity size={8} className="stroke-[2.5]" />
                          ) : isNote ? (
                            <FileText size={8} className="stroke-[2.5]" />
                          ) : (
                            <Clock size={8} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[11px] font-bold text-brand-heading">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className="text-[8px] font-extrabold px-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-brand-muted leading-tight">
                            {item.subtitle}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[9px] font-bold text-[#1A085C] tabular-nums">
                            {getRelativeTime(item.timestamp)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Real-time Post Note Form */}
                <form onSubmit={handleAddNote} className="pt-2 border-t border-[#EDE8F5] flex gap-1.5">
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Log update or call note..."
                    className="flex-1 h-8 px-2.5 text-xs rounded-lg border border-[#EDE8F5] bg-[#FAF9FD] outline-none focus:bg-white focus:border-[#7C3AED] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingNote || !noteInput.trim()}
                    className="px-2.5 h-8 rounded-lg bg-[#7C3AED] text-white text-[11px] font-bold hover:bg-[#6D28D9] disabled:opacity-40 transition-all cursor-pointer"
                  >
                    Post
                  </button>
                </form>
              </div>

              {/* Convert to Project Footer CTA */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-[#EDE9FE] to-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-black text-[#1A085C]">
                    Ready to execute delivery?
                  </div>
                  <div className="text-[10px] text-brand-muted">
                    Convert won deal into client project
                  </div>
                </div>
                <button
                  onClick={() => setIsConvertModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D28D9] flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Briefcase size={12} />
                  <span>Convert</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Convert Project Modal */}
      {isConvertModalOpen && lead && (
        <CreateProjectModal
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          initialLead={lead}
          onSuccess={() => {
            setIsConvertModalOpen(false);
            handleStageChange('won');
          }}
        />
      )}
    </div>
  );
};
