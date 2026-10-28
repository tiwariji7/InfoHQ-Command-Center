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
      return { icon: Globe, label: 'Website Contact' };
    case 'whatsapp_click':
      return { icon: MessageCircle, label: 'WhatsApp Click' };
    case 'linkedin':
      return { icon: Share2, label: 'LinkedIn' };
    case 'referral':
      return { icon: ExternalLink, label: 'Referral' };
    case 'phone_call':
      return { icon: Phone, label: 'Phone Call' };
    default:
      return { icon: Globe, label: source || 'Direct Inquiry' };
  }
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  leadId,
  onClose,
  onLeadUpdated,
}) => {
  const { getToken } = useAuth();

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
    loadData();
  }, [loadData]);

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
  const sourceInfo = getSourceIcon(lead?.source);
  const SourceIcon = sourceInfo.icon;

  // Real timeline events compilation
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
      let subtitle = `Logged by Admin (${act.actorClerkUserId.slice(0, 8)}...)`;

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

    // Sort descending by timestamp (newest first)
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [lead, activities, sourceInfo.label]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-lg md:max-w-xl lg:max-w-xl bg-white shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 sm:rounded-l-3xl border-l border-[#EDE8F5]">
        {/* ========================================================= */}
        {/* 1. DRAWER TOP HEADER (Mobile / Tablet / Desktop)          */}
        {/* ========================================================= */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#EDE8F5] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-black text-[#1A085C]">
              Lead Details
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Audit Active
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-[#1A085C] hover:bg-[#FAF9FD] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close lead profile"
          >
            <X size={18} />
          </button>
        </div>

        {/* ========================================================= */}
        {/* 2. DRAWER BODY                                            */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 bg-[#FAF9FD]/50 overscroll-contain">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-brand-destructive flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="font-bold hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <div className="w-9 h-9 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
              <span className="text-xs font-bold text-brand-muted">Fetching live lead intelligence...</span>
            </div>
          ) : !lead ? (
            <div className="text-center py-20 text-xs text-brand-muted">Lead not found</div>
          ) : (
            <>
              {/* Profile Monogram Card */}
              <div className="bg-white rounded-2xl border border-[#EDE8F5] p-4 sm:p-5 shadow-[0_4px_20px_rgba(124,58,237,0.04)] flex items-center gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#EDE9FE] to-[#FCE7F3] text-[#7C3AED] font-black text-xl flex items-center justify-center shrink-0 shadow-2xs border border-[#DDD6FE]">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-black text-[#1A085C] truncate">
                      {lead.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 capitalize">
                      {lead.stage.replace('_', ' ')}
                    </span>
                  </div>
                  {lead.email && (
                    <div className="text-xs text-brand-muted font-medium truncate mt-1 flex items-center gap-1.5">
                      <User size={11} className="shrink-0 text-slate-400" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="text-xs text-brand-muted font-mono font-semibold mt-0.5 flex items-center gap-1.5">
                      <Phone size={11} className="shrink-0 text-slate-400" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3 Action Buttons Row (Responsive Min-touch targets) */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {/* Button 1: Mark as Contacted / Advance */}
                <button
                  onClick={() =>
                    handleStageChange(lead.stage === 'new' ? 'contacted' : 'proposal_sent')
                  }
                  disabled={isUpdatingStage}
                  className="h-11 sm:h-12 px-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(124,58,237,0.22)] active:scale-98 transition-all cursor-pointer"
                >
                  <Phone size={14} className="shrink-0" />
                  <span className="truncate">
                    {lead.stage === 'new' ? 'Contacted' : 'Advance'}
                  </span>
                </button>

                {/* Button 2: Send Email */}
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="h-11 sm:h-12 px-2 rounded-xl bg-white border border-[#EDE8F5] text-brand-heading hover:border-[#7C3AED]/40 hover:text-[#7C3AED] text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-98"
                  >
                    <Send size={14} className="shrink-0" />
                    <span>Send Email</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="h-11 sm:h-12 px-2 rounded-xl bg-white border border-[#EDE8F5] text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 opacity-50 cursor-not-allowed"
                  >
                    <Send size={14} className="shrink-0" />
                    <span>Send Email</span>
                  </button>
                )}

                {/* Button 3: Schedule */}
                <button
                  onClick={() => setIsScheduleOpen(!isScheduleOpen)}
                  className="h-11 sm:h-12 px-2 rounded-xl bg-white border border-[#EDE8F5] text-brand-heading hover:border-[#7C3AED]/40 hover:text-[#7C3AED] text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-98 cursor-pointer"
                >
                  <Calendar size={14} className="shrink-0" />
                  <span>Schedule</span>
                </button>
              </div>

              {/* Collapsible Follow-up Scheduler */}
              {isScheduleOpen && (
                <div className="p-4 bg-white rounded-2xl border border-[#EDE8F5] space-y-2.5 shadow-md animate-in fade-in duration-150">
                  <div className="text-xs font-bold text-brand-heading flex items-center gap-1.5">
                    <Clock size={13} className="text-[#7C3AED]" />
                    <span>Set Follow-Up Reminder (Asia/Kolkata IST)</span>
                  </div>
                  <input
                    type="datetime-local"
                    value={followUpDateInput}
                    onChange={(e) => setFollowUpDateInput(e.target.value)}
                    className="w-full h-10 px-3 text-xs font-medium rounded-xl border border-[#EDE8F5] bg-[#FAF9FD] outline-none focus:border-[#7C3AED]"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsScheduleOpen(false)}
                      className="px-3.5 py-1.5 rounded-lg border border-[#EDE8F5] text-xs font-bold text-brand-muted hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFollowUp}
                      disabled={isSavingFollowUp}
                      className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-xs font-bold cursor-pointer"
                    >
                      {isSavingFollowUp ? 'Saving...' : 'Set Reminder'}
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* Card 1: Lead Information (Clean 2-Column Specs)            */}
              {/* ========================================================= */}
              <div className="bg-white rounded-2xl border border-[#EDE8F5] p-5 shadow-[0_4px_20px_rgba(124,58,237,0.04)] space-y-3.5">
                <h4 className="text-sm font-black text-[#1A085C]">
                  Lead Information
                </h4>

                <div className="space-y-3 text-xs">
                  {/* Source */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#EDE8F5]/60">
                    <span className="text-brand-muted font-medium">Source</span>
                    <span className="font-bold text-brand-heading flex items-center gap-1.5">
                      <SourceIcon size={13} className="text-[#7C3AED]" />
                      <span>{sourceInfo.label}</span>
                    </span>
                  </div>

                  {/* Interest */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#EDE8F5]/60">
                    <span className="text-brand-muted font-medium">Interest</span>
                    <span className="font-bold text-brand-heading">
                      {lead.serviceNeeded || 'Website Design & Development'}
                    </span>
                  </div>

                  {/* Estimated Value */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#EDE8F5]/60">
                    <span className="text-brand-muted font-medium">Estimated Value</span>
                    <span className="font-black text-[#1A085C] tabular-nums text-sm">
                      {formatCurrency(lead.budget)}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#EDE8F5]/60">
                    <span className="text-brand-muted font-medium">Inquiry Date</span>
                    <span className="font-semibold text-brand-heading tabular-nums">
                      {formatISTDateTime(lead.createdAt)}
                    </span>
                  </div>

                  {/* Location / Company */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#EDE8F5]/60">
                    <span className="text-brand-muted font-medium">Location / Account</span>
                    <span className="font-semibold text-brand-heading">
                      {lead.company || 'Prayagraj, Uttar Pradesh'}
                    </span>
                  </div>

                  {/* Notes */}
                  <div className="pt-1 space-y-1">
                    <span className="text-brand-muted font-medium">Requirement Brief</span>
                    <div className="text-xs text-brand-heading leading-relaxed bg-[#FAF9FD] p-3 rounded-xl border border-[#EDE8F5]">
                      {lead.message ||
                        notes[0]?.body ||
                        'Interested in company website with premium UI. Asked for portfolio and pricing.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* Tags Section                                              */}
              {/* ========================================================= */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-[#1A085C]">
                  Tags
                </h4>

                <div className="flex items-center gap-2 flex-wrap">
                  {tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-xl text-xs font-semibold bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE]"
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
                        placeholder="Tag name..."
                        className="h-8 px-2.5 text-xs rounded-lg border border-[#EDE8F5] outline-none focus:border-[#7C3AED] w-28"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 rounded-lg bg-[#7C3AED] text-white text-xs font-bold"
                      >
                        Add
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsAddingTag(true)}
                      className="px-3 py-1 rounded-xl text-xs font-semibold bg-white border border-[#EDE8F5] text-brand-muted hover:text-[#7C3AED] hover:border-[#7C3AED]/40 transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Add tag</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ========================================================= */}
              {/* Card 2: REAL LIVE TRACKING AUDIT STREAM                   */}
              {/* ========================================================= */}
              <div className="bg-white rounded-2xl border border-[#EDE8F5] p-5 shadow-[0_4px_20px_rgba(124,58,237,0.04)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-[#1A085C]">
                      Activity Timeline
                    </h4>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className="text-[10px] font-bold text-brand-muted bg-[#FAF9FD] px-2 py-0.5 rounded-full border border-[#EDE8F5]">
                    {sortedAuditTimeline.length} real events
                  </span>
                </div>

                {/* Vertical Stream */}
                <div className="relative pl-6 space-y-5">
                  {/* Connected Track Line */}
                  <div className="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 bg-[#EDE8F5]" />

                  {sortedAuditTimeline.map((item) => {
                    const isUpcoming = item.type === 'upcoming';
                    const isCreated = item.type === 'created';
                    const isStage = item.type === 'stage';
                    const isNote = item.type === 'note';

                    return (
                      <div key={item.id} className="relative flex items-start justify-between gap-3 group">
                        {/* Dot / Icon Node */}
                        <div
                          className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs ${
                            isUpcoming
                              ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400/40'
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
                            <Clock size={11} className="stroke-[2.5]" />
                          ) : isCreated ? (
                            <CheckCircle2 size={11} className="stroke-[2.5]" />
                          ) : isStage ? (
                            <Activity size={10} className="stroke-[2.5]" />
                          ) : isNote ? (
                            <FileText size={10} className="stroke-[2.5]" />
                          ) : (
                            <Clock size={10} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-brand-heading">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-brand-muted mt-0.5 leading-snug">
                            {item.subtitle}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-bold text-[#1A085C] tabular-nums">
                            {getRelativeTime(item.timestamp)}
                          </div>
                          <div className="text-[9px] text-brand-muted tabular-nums">
                            {formatISTDateTime(item.timestamp).split(',')[1]}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Real-time Post Note Form */}
                <form onSubmit={handleAddNote} className="pt-3 border-t border-[#EDE8F5] flex gap-2">
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Log real-time update or call note..."
                    className="flex-1 h-10 px-3.5 text-xs rounded-xl border border-[#EDE8F5] bg-[#FAF9FD] outline-none focus:bg-white focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingNote || !noteInput.trim()}
                    className="px-4 h-10 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-xs font-bold shadow-xs hover:opacity-95 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    Post Note
                  </button>
                </form>
              </div>

              {/* Convert to Project Footer CTA */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#EDE9FE] to-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black text-[#1A085C]">
                    Ready to execute client delivery?
                  </div>
                  <div className="text-[11px] text-brand-muted font-medium">
                    Convert won deal into a formal engineering project
                  </div>
                </div>
                <button
                  onClick={() => setIsConvertModalOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#7C3AED] text-white text-xs font-bold shadow-xs hover:bg-[#6D28D9] flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Briefcase size={13} />
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
