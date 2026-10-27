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
  MessageCircle,
  Mail,
  Calendar,
  Clock,
  Send,
  Loader2,
  AlertCircle,
  FileText,
  History,
  CheckCircle2,
  Briefcase,
} from 'lucide-react';
import { CreateProjectModal } from '../projects/CreateProjectModal.js';

interface LeadDetailDrawerProps {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated?: (updatedLead: Lead) => void;
}

const STAGE_LABELS: Record<LeadStage, { label: string; badge: string }> = {
  new: { label: 'New', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  contacted: { label: 'Contacted', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  proposal_sent: { label: 'Proposal Sent', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  won: { label: 'Won', badge: 'bg-green-50 text-green-700 border-green-200' },
  lost: { label: 'Lost', badge: 'bg-neutral-100 text-neutral-600 border-neutral-200' },
};

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(timestamp));
}

function getWhatsAppDigits(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `91${cleaned}`;
  return cleaned;
}

function getFollowUpStatus(nextFollowUpAt?: number | null): {
  text: string;
  badgeClass: string;
} | null {
  if (!nextFollowUpAt) return null;
  const now = Date.now();
  const diffDays = Math.floor((nextFollowUpAt - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: 'Overdue', badgeClass: 'bg-red-50 text-brand-destructive border-red-200' };
  }
  if (diffDays === 0) {
    return { text: 'Due Today', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  return { text: `In ${diffDays}d`, badgeClass: 'bg-brand-subtle text-brand-primary border-brand-border' };
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

  // Tab: 'notes' | 'activity'
  const [activeTab, setActiveTab] = useState<'notes' | 'activity'>('notes');

  // New Note state
  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Follow-up state
  const [isEditingFollowUp, setIsEditingFollowUp] = useState(false);
  const [followUpDateInput, setFollowUpDateInput] = useState('');
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);

  // Stage change state
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

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

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim() || !leadId) return;

    setIsSubmittingNote(true);
    try {
      const res = await addLeadNoteApi(getToken, leadId, noteText.trim());
      setNotes((prev) => [res.data, ...prev]);
      setNoteText('');
      // Reload activities to show note audit
      const updated = await fetchLeadDetail(getToken, leadId);
      setActivities(updated.activities);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save note.');
    } finally {
      setIsSubmittingNote(false);
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
      setIsEditingFollowUp(false);
      // Reload activities
      const updated = await fetchLeadDetail(getToken, leadId);
      setActivities(updated.activities);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save follow-up.');
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  async function handleClearFollowUp() {
    if (!leadId) return;
    setIsSavingFollowUp(true);
    try {
      const res = await setLeadFollowUpApi(getToken, leadId, null);
      setLead(res.data);
      if (onLeadUpdated) onLeadUpdated(res.data);
      setFollowUpDateInput('');
      setIsEditingFollowUp(false);
      // Reload activities
      const updated = await fetchLeadDetail(getToken, leadId);
      setActivities(updated.activities);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to clear follow-up.');
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  async function handleStageChange(newStage: LeadStage) {
    if (!leadId || !lead || lead.stage === newStage) return;
    setIsUpdatingStage(true);
    try {
      const res = await updateLeadStageApi(getToken, leadId, { stage: newStage });
      setLead(res.data);
      if (onLeadUpdated) onLeadUpdated(res.data);
      // Reload activities
      const updated = await fetchLeadDetail(getToken, leadId);
      setActivities(updated.activities);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update stage.');
    } finally {
      setIsUpdatingStage(false);
    }
  }

  const followUpStatus = getFollowUpStatus(lead?.nextFollowUpAt);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-brand-heading/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-lead-name"
    >
      <div className="w-full sm:max-w-xl md:max-w-2xl bg-white shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 border-b border-brand-border flex items-start justify-between gap-4 bg-brand-page/50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="drawer-lead-name"
                className="text-lg sm:text-xl font-bold text-brand-heading truncate"
              >
                {lead?.name || 'Loading lead details...'}
              </h2>
              {lead && (
                <span
                  className={`px-2.5 py-0.5 rounded-chip text-[11px] font-semibold border capitalize ${
                    STAGE_LABELS[lead.stage]?.badge || 'bg-brand-section'
                  }`}
                >
                  {lead.stage.replace('_', ' ')}
                </span>
              )}
            </div>

            {lead?.company && (
              <p className="text-xs text-brand-muted font-medium mt-0.5 truncate">
                {lead.company}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-control text-brand-muted hover:text-brand-heading hover:bg-brand-section transition-colors shrink-0"
            aria-label="Close details"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-control bg-brand-errorBg border border-red-200 text-xs text-brand-destructive flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-xs font-semibold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={24} className="animate-spin text-brand-primary" />
              <span className="text-xs text-brand-muted">Fetching lead profile...</span>
            </div>
          ) : !lead ? (
            <div className="text-center py-12 text-sm text-brand-muted">
              Lead not found.
            </div>
          ) : (
            <>
              {/* Quick Communication Actions */}
              <div className="grid grid-cols-3 gap-2.5">
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex flex-col items-center justify-center p-3 rounded-control border border-brand-border bg-brand-section hover:bg-brand-subtle hover:border-brand-primary/40 transition-colors text-center group"
                  >
                    <Phone size={18} className="text-brand-primary mb-1 group-hover:scale-105 transition-transform" />
                    <span className="text-xs font-semibold text-brand-heading">Call</span>
                    <span className="text-[10px] text-brand-muted truncate max-w-full font-mono mt-0.5">
                      {lead.phone}
                    </span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 rounded-control border border-brand-border bg-brand-section/50 text-center opacity-50 cursor-not-allowed">
                    <Phone size={18} className="text-brand-lightGray mb-1" />
                    <span className="text-xs font-semibold text-brand-lightGray">Call</span>
                    <span className="text-[10px] text-brand-lightGray">No phone</span>
                  </div>
                )}

                {lead.phone ? (
                  <a
                    href={`https://wa.me/${getWhatsAppDigits(lead.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center p-3 rounded-control border border-green-200 bg-green-50/50 hover:bg-green-100/60 hover:border-green-300 transition-colors text-center group"
                  >
                    <MessageCircle size={18} className="text-green-600 mb-1 group-hover:scale-105 transition-transform" />
                    <span className="text-xs font-semibold text-green-800">WhatsApp</span>
                    <span className="text-[10px] text-green-700 truncate max-w-full mt-0.5">
                      Chat direct
                    </span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 rounded-control border border-brand-border bg-brand-section/50 text-center opacity-50 cursor-not-allowed">
                    <MessageCircle size={18} className="text-brand-lightGray mb-1" />
                    <span className="text-xs font-semibold text-brand-lightGray">WhatsApp</span>
                    <span className="text-[10px] text-brand-lightGray">No phone</span>
                  </div>
                )}

                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="flex flex-col items-center justify-center p-3 rounded-control border border-brand-border bg-brand-section hover:bg-brand-subtle hover:border-brand-primary/40 transition-colors text-center group"
                  >
                    <Mail size={18} className="text-brand-primary mb-1 group-hover:scale-105 transition-transform" />
                    <span className="text-xs font-semibold text-brand-heading">Email</span>
                    <span className="text-[10px] text-brand-muted truncate max-w-full mt-0.5">
                      {lead.email}
                    </span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 rounded-control border border-brand-border bg-brand-section/50 text-center opacity-50 cursor-not-allowed">
                    <Mail size={18} className="text-brand-lightGray mb-1" />
                    <span className="text-xs font-semibold text-brand-lightGray">Email</span>
                    <span className="text-[10px] text-brand-lightGray">No email</span>
                  </div>
                )}
              </div>

              {/* Stage Selector Bar */}
              <div className="p-3.5 rounded-control border border-brand-border bg-brand-page/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-xs font-semibold text-brand-heading">
                  Move Pipeline Stage
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['new', 'contacted', 'proposal_sent', 'won', 'lost'] as LeadStage[]).map(
                    (stageKey) => (
                      <button
                        key={stageKey}
                        onClick={() => handleStageChange(stageKey)}
                        disabled={isUpdatingStage || lead.stage === stageKey}
                        className={`px-2.5 py-1 rounded-chip text-xs font-medium transition-colors border ${
                          lead.stage === stageKey
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-white text-brand-body border-brand-border hover:bg-brand-section'
                        }`}
                      >
                        {stageKey.replace('_', ' ')}
                      </button>
                    )
                  )}
                </div>
                <div className="w-full flex items-center justify-between pt-2.5 mt-1 border-t border-brand-border">
                  <span className="text-[11px] text-brand-muted">
                    Ready to execute client delivery?
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsConvertModalOpen(true)}
                    className="hq-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                  >
                    <Briefcase size={14} />
                    <span>Convert to Project</span>
                  </button>
                </div>
              </div>

              {/* Next Follow-Up Reminder Widget */}
              <div className="p-4 rounded-control border border-brand-border bg-white shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-subtle text-brand-primary flex items-center justify-center">
                      <Calendar size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-brand-heading">
                        Next Follow-Up
                      </div>
                      <div className="text-[11px] text-brand-muted">
                        Asia/Kolkata (IST) schedule
                      </div>
                    </div>
                  </div>

                  {followUpStatus && (
                    <span
                      className={`px-2 py-0.5 rounded-chip text-[11px] font-semibold border ${followUpStatus.badgeClass}`}
                    >
                      {followUpStatus.text}
                    </span>
                  )}
                </div>

                {isEditingFollowUp ? (
                  <div className="space-y-2 pt-2 border-t border-brand-border">
                    <input
                      type="datetime-local"
                      value={followUpDateInput}
                      onChange={(e) => setFollowUpDateInput(e.target.value)}
                      className="w-full h-9 px-3 text-xs rounded-control border border-brand-border focus:border-brand-primary"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingFollowUp(false)}
                        className="px-3 py-1 rounded-control border border-brand-border text-xs text-brand-muted hover:bg-brand-section"
                      >
                        Cancel
                      </button>
                      {lead.nextFollowUpAt && (
                        <button
                          type="button"
                          onClick={handleClearFollowUp}
                          disabled={isSavingFollowUp}
                          className="px-3 py-1 rounded-control bg-red-50 text-brand-destructive hover:bg-red-100 text-xs font-medium"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveFollowUp}
                        disabled={isSavingFollowUp}
                        className="hq-btn-primary text-xs py-1 px-3"
                      >
                        {isSavingFollowUp ? 'Saving...' : 'Save Follow-Up'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-brand-heading font-medium">
                      {lead.nextFollowUpAt
                        ? formatDate(lead.nextFollowUpAt)
                        : 'No follow-up scheduled'}
                    </span>
                    <button
                      onClick={() => {
                        if (lead.nextFollowUpAt) {
                          const dateObj = new Date(lead.nextFollowUpAt);
                          const localIso = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
                            .toISOString()
                            .slice(0, 16);
                          setFollowUpDateInput(localIso);
                        } else {
                          setFollowUpDateInput('');
                        }
                        setIsEditingFollowUp(true);
                      }}
                      className="text-xs text-brand-primary font-semibold hover:underline"
                    >
                      {lead.nextFollowUpAt ? 'Change' : '+ Set Date'}
                    </button>
                  </div>
                )}
              </div>

              {/* Requirement & Opportunity Specifications */}
              <div className="p-4 rounded-control border border-brand-border bg-white shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                  Lead Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-brand-muted">Service Needed</span>
                    <div className="font-semibold text-brand-heading mt-0.5">
                      {lead.serviceNeeded || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-brand-muted">Budget (INR)</span>
                    <div className="font-semibold text-brand-heading mt-0.5 tabular-nums">
                      {lead.budget ? `₹${lead.budget}` : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-brand-muted">Expected Timeline</span>
                    <div className="font-semibold text-brand-heading mt-0.5">
                      {lead.timeline || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-brand-muted">Preferred Contact</span>
                    <div className="font-semibold text-brand-heading mt-0.5">
                      {lead.preferredContact || '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-brand-muted">Lead Source</span>
                    <div className="font-semibold text-brand-heading mt-0.5 capitalize">
                      {lead.source.replace('_', ' ')}
                    </div>
                  </div>
                  <div>
                    <span className="text-brand-muted">Inquiry Date</span>
                    <div className="font-semibold text-brand-heading mt-0.5">
                      {formatDate(lead.createdAt)}
                    </div>
                  </div>
                </div>

                {lead.message && (
                  <div className="pt-2 border-t border-brand-border">
                    <span className="text-brand-muted text-xs">Inquiry Message / Notes</span>
                    <p className="mt-1 p-2.5 rounded-control bg-brand-page text-xs text-brand-body leading-relaxed whitespace-pre-wrap border border-brand-border/60">
                      {lead.message}
                    </p>
                  </div>
                )}

                {lead.stage === 'lost' && lead.lostReason && (
                  <div className="p-2.5 rounded-control bg-red-50 text-red-700 text-xs border border-red-200">
                    <strong>Loss Reason:</strong> {lead.lostReason}
                  </div>
                )}
              </div>

              {/* Tabs: Notes & Activity Timeline */}
              <div className="space-y-3">
                <div className="flex border-b border-brand-border">
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold transition-colors border-b-2 ${
                      activeTab === 'notes'
                        ? 'border-brand-primary text-brand-primary'
                        : 'border-transparent text-brand-muted hover:text-brand-heading'
                    }`}
                  >
                    <FileText size={14} />
                    <span>Internal Notes ({notes.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold transition-colors border-b-2 ${
                      activeTab === 'activity'
                        ? 'border-brand-primary text-brand-primary'
                        : 'border-transparent text-brand-muted hover:text-brand-heading'
                    }`}
                  >
                    <History size={14} />
                    <span>Activity History ({activities.length})</span>
                  </button>
                </div>

                {activeTab === 'notes' ? (
                  <div className="space-y-4">
                    {/* Add Note Form */}
                    <form onSubmit={handleAddNote} className="space-y-2">
                      <textarea
                        rows={3}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Type call notes, meeting takeaways, or follow-up details..."
                        className="w-full p-3 rounded-control border border-brand-border text-xs text-brand-heading placeholder:text-brand-lightGray focus:border-brand-primary focus:ring-1 focus:ring-brand-primary resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmittingNote || !noteText.trim()}
                          className="hq-btn-primary text-xs py-1.5 px-3.5 disabled:opacity-50"
                        >
                          {isSubmittingNote ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Send size={14} />
                          )}
                          <span>Save Note</span>
                        </button>
                      </div>
                    </form>

                    {/* Notes List */}
                    <div className="space-y-2.5">
                      {notes.length === 0 ? (
                        <div className="text-center py-6 text-xs text-brand-lightGray italic">
                          No internal notes added yet.
                        </div>
                      ) : (
                        notes.map((note) => (
                          <div
                            key={note.id}
                            className="p-3 rounded-control border border-brand-border bg-white shadow-xs space-y-1"
                          >
                            <p className="text-xs text-brand-heading leading-relaxed whitespace-pre-wrap">
                              {note.body}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-brand-muted pt-1 border-t border-brand-border/40">
                              <span>Superadmin Note</span>
                              <span>{formatDate(note.createdAt)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  /* Activity Timeline */
                  <div className="space-y-3">
                    {activities.length === 0 ? (
                      <div className="text-center py-6 text-xs text-brand-lightGray italic">
                        No activity recorded yet.
                      </div>
                    ) : (
                      activities.map((act) => (
                        <div key={act.id} className="flex items-start gap-3 text-xs">
                          <div className="w-6 h-6 rounded-full bg-brand-subtle text-brand-primary flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-brand-heading font-medium">
                              {act.summary}
                            </div>
                            <div className="text-[10px] text-brand-muted flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              <span>{formatDate(act.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {lead && (
        <CreateProjectModal
          isOpen={isConvertModalOpen}
          onClose={() => setIsConvertModalOpen(false)}
          initialLead={lead}
          onSuccess={() => {
            loadData();
            onLeadUpdated?.(lead);
            setIsConvertModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
