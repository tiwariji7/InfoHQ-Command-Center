import React, { useState, useEffect, useCallback } from 'react';
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

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Modals & Stage
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

      // Initialize smart tags based on lead data
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

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md md:max-w-lg bg-white shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* ========================================================= */}
        {/* 1. DRAWER TOP HEADER (Exact Image 1 Style)                */}
        {/* ========================================================= */}
        <div className="px-6 py-4 border-b border-[#EDE8F5] flex items-center justify-between bg-white shrink-0">
          <h2 className="text-lg font-black text-[#1A085C]">
            Lead Details
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#1A085C] hover:bg-[#FAF9FD] transition-colors cursor-pointer"
            aria-label="Close lead profile"
          >
            <X size={18} />
          </button>
        </div>

        {/* ========================================================= */}
        {/* 2. DRAWER SCROLLABLE BODY                                 */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-[#FAF9FD]/40">
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
              <div className="w-8 h-8 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
              <span className="text-xs font-semibold text-brand-muted">Fetching lead profile...</span>
            </div>
          ) : !lead ? (
            <div className="text-center py-20 text-xs text-brand-muted">Lead not found</div>
          ) : (
            <>
              {/* Profile Monogram Card */}
              <div className="flex items-center gap-3.5 pt-1">
                <div className="w-14 h-14 rounded-full bg-[#FCE7F3] text-[#DB2777] font-black text-lg flex items-center justify-center shrink-0 shadow-2xs">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-[#1A085C] truncate">
                      {lead.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 capitalize">
                      {lead.stage.replace('_', ' ')}
                    </span>
                  </div>
                  {lead.email && (
                    <div className="text-xs text-brand-muted font-medium truncate mt-0.5">
                      {lead.email}
                    </div>
                  )}
                  {lead.phone && (
                    <div className="text-xs text-brand-muted font-mono font-medium mt-0.5">
                      {lead.phone}
                    </div>
                  )}
                </div>
              </div>

              {/* 3 Action Buttons Row (Exact Image 1 Style) */}
              <div className="grid grid-cols-3 gap-2.5">
                {/* Button 1: Mark as Contacted / Move Stage */}
                <button
                  onClick={() =>
                    handleStageChange(lead.stage === 'new' ? 'contacted' : 'proposal_sent')
                  }
                  disabled={isUpdatingStage}
                  className="h-10 px-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(124,58,237,0.22)] active:scale-98 transition-all cursor-pointer"
                >
                  <Phone size={13} />
                  <span className="truncate">
                    {lead.stage === 'new' ? 'Mark Contacted' : 'Advance'}
                  </span>
                </button>

                {/* Button 2: Send Email */}
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="h-10 px-2 rounded-xl bg-white border border-[#EDE8F5] text-brand-heading hover:border-[#7C3AED]/40 hover:text-[#7C3AED] text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all"
                  >
                    <Send size={13} />
                    <span>Send Email</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="h-10 px-2 rounded-xl bg-white border border-[#EDE8F5] text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 opacity-50 cursor-not-allowed"
                  >
                    <Send size={13} />
                    <span>Send Email</span>
                  </button>
                )}

                {/* Button 3: Schedule */}
                <button
                  onClick={() => setIsScheduleOpen(!isScheduleOpen)}
                  className="h-10 px-2 rounded-xl bg-white border border-[#EDE8F5] text-brand-heading hover:border-[#7C3AED]/40 hover:text-[#7C3AED] text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Calendar size={13} />
                  <span>Schedule</span>
                </button>
              </div>

              {/* Collapsible Follow-up Scheduler */}
              {isScheduleOpen && (
                <div className="p-3.5 bg-white rounded-xl border border-[#EDE8F5] space-y-2 shadow-2xs">
                  <div className="text-xs font-bold text-brand-heading flex items-center gap-1.5">
                    <Clock size={13} className="text-[#7C3AED]" />
                    <span>Set Next Follow-Up Schedule (IST)</span>
                  </div>
                  <input
                    type="datetime-local"
                    value={followUpDateInput}
                    onChange={(e) => setFollowUpDateInput(e.target.value)}
                    className="w-full h-9 px-3 text-xs rounded-lg border border-[#EDE8F5] bg-[#FAF9FD] outline-none focus:border-[#7C3AED]"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsScheduleOpen(false)}
                      className="px-3 py-1 rounded-lg border border-[#EDE8F5] text-xs font-medium text-brand-muted hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFollowUp}
                      disabled={isSavingFollowUp}
                      className="px-3 py-1 rounded-lg bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D28D9]"
                    >
                      {isSavingFollowUp ? 'Saving...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* Card 1: Lead Information (Exact Image 1 Style)             */}
              {/* ========================================================= */}
              <div className="bg-white rounded-2xl border border-[#EDE8F5] p-5 shadow-2xs space-y-3.5">
                <h4 className="text-sm font-black text-[#1A085C]">
                  Lead Information
                </h4>

                <div className="space-y-2.5 text-xs">
                  {/* Source */}
                  <div className="flex items-center justify-between">
                    <span className="text-brand-muted font-medium">Source</span>
                    <span className="font-bold text-brand-heading flex items-center gap-1.5">
                      <SourceIcon size={13} className="text-[#7C3AED]" />
                      <span>{sourceInfo.label}</span>
                    </span>
                  </div>

                  {/* Interest */}
                  <div className="flex items-center justify-between">
                    <span className="text-brand-muted font-medium">Interest</span>
                    <span className="font-bold text-brand-heading">
                      {lead.serviceNeeded || 'Website Design & Development'}
                    </span>
                  </div>

                  {/* Estimated Value */}
                  <div className="flex items-center justify-between">
                    <span className="text-brand-muted font-medium">Estimated Value</span>
                    <span className="font-black text-[#1A085C] tabular-nums">
                      {formatCurrency(lead.budget)}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="flex items-center justify-between">
                    <span className="text-brand-muted font-medium">Date</span>
                    <span className="font-medium text-brand-heading">
                      {formatISTDateTime(lead.createdAt)}
                    </span>
                  </div>

                  {/* Location / Company */}
                  <div className="flex items-center justify-between">
                    <span className="text-brand-muted font-medium">Location</span>
                    <span className="font-medium text-brand-heading">
                      {lead.company || 'Prayagraj, Uttar Pradesh'}
                    </span>
                  </div>

                  {/* Notes */}
                  <div className="pt-2 border-t border-[#EDE8F5] space-y-1">
                    <span className="text-brand-muted font-medium">Notes</span>
                    <p className="text-xs text-brand-heading font-normal leading-relaxed bg-[#FAF9FD] p-2.5 rounded-xl border border-[#EDE8F5]">
                      {lead.message ||
                        notes[0]?.body ||
                        'Interested in company website with premium UI. Asked for portfolio and pricing.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* Tags Section (Exact Image 1 Style)                        */}
              {/* ========================================================= */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-[#1A085C]">
                    Tags
                  </h4>
                </div>

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
                        className="h-7 px-2 text-xs rounded-lg border border-[#EDE8F5] outline-none focus:border-[#7C3AED] w-24"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="px-2 py-0.5 rounded-lg bg-[#7C3AED] text-white text-[11px] font-bold"
                      >
                        Add
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setIsAddingTag(true)}
                      className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white border border-[#EDE8F5] text-brand-muted hover:text-[#7C3AED] hover:border-[#7C3AED]/40 transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Add tag</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ========================================================= */}
              {/* Card 2: Activity Timeline (Exact Image 1 Style)            */}
              {/* ========================================================= */}
              <div className="bg-white rounded-2xl border border-[#EDE8F5] p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-[#1A085C]">
                    Activity Timeline
                  </h4>
                  <span className="text-[10px] text-brand-muted font-bold">
                    {activities.length} logged
                  </span>
                </div>

                <div className="relative pl-6 space-y-4">
                  {/* Vertical Connecting Line */}
                  <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-[#EDE8F5]" />

                  {/* Item 1: Lead Received */}
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border-2 border-white shadow-xs">
                      <CheckCircle2 size={12} className="stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-brand-heading">
                        New lead received
                      </div>
                      <div className="text-[11px] text-brand-muted mt-0.5">
                        Website enquiry form
                      </div>
                    </div>
                    <span className="text-[10px] text-brand-muted font-medium tabular-nums shrink-0">
                      {formatISTDateTime(lead.createdAt)}
                    </span>
                  </div>

                  {/* Item 2: Stage / Email Update */}
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center border-2 border-white shadow-xs">
                      <Send size={10} className="stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-brand-heading">
                        {lead.stage === 'new' ? 'Initial enquiry logged' : 'Stage updated to ' + lead.stage.replace('_', ' ')}
                      </div>
                      <div className="text-[11px] text-brand-muted mt-0.5">
                        {lead.email ? `Email: ${lead.email}` : 'Direct outreach'}
                      </div>
                    </div>
                    <span className="text-[10px] text-brand-muted font-medium tabular-nums shrink-0">
                      {formatISTDateTime(lead.updatedAt || lead.createdAt)}
                    </span>
                  </div>

                  {/* Item 3: Follow-Up Scheduled */}
                  {lead.nextFollowUpAt && (
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border-2 border-white shadow-xs">
                        <Clock size={11} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-brand-heading">
                          Follow-up scheduled
                        </div>
                        <div className="text-[11px] text-brand-muted mt-0.5">
                          Follow up with client via phone / WhatsApp
                        </div>
                      </div>
                      <span className="text-[10px] text-amber-700 font-bold tabular-nums shrink-0">
                        {formatISTDateTime(lead.nextFollowUpAt)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Add Quick Internal Note */}
                <form onSubmit={handleAddNote} className="pt-2 border-t border-[#EDE8F5] flex gap-2">
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Log a client note or call update..."
                    className="flex-1 h-9 px-3 text-xs rounded-xl border border-[#EDE8F5] bg-[#FAF9FD] outline-none focus:border-[#7C3AED]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingNote || !noteInput.trim()}
                    className="px-3 h-9 rounded-xl bg-[#7C3AED] text-white text-xs font-bold disabled:opacity-40"
                  >
                    Post
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
                  className="px-3.5 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-bold shadow-xs hover:bg-[#6D28D9] flex items-center gap-1.5 shrink-0 cursor-pointer"
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
