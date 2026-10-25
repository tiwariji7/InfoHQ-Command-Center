import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { CreateLeadInput, Lead, DuplicateCheckResult, LeadSource } from '@infohq/shared';
import { createLeadApi, checkDuplicateLead, ApiRequestError } from '../../lib/api.js';
import { X, AlertTriangle, Plus, Loader2 } from 'lucide-react';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
}

const SOURCE_OPTIONS: Array<{ value: LeadSource; label: string }> = [
  { value: 'phone_call', label: 'Phone Call (Manual)' },
  { value: 'whatsapp_click', label: 'WhatsApp Click' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'referral', label: 'Referral' },
  { value: 'website_contact', label: 'Website Contact' },
  { value: 'other', label: 'Other / Manual' },
];

export const AddLeadModal: React.FC<AddLeadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { getToken } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [serviceNeeded, setServiceNeeded] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [preferredContact, setPreferredContact] = useState('');
  const [source, setSource] = useState<LeadSource>('phone_call');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckResult['matches'] | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced duplicate check
  useEffect(() => {
    if (!isOpen || (!phone.trim() && !email.trim())) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await checkDuplicateLead(getToken, {
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        if (res.hasDuplicate) {
          setDuplicateWarning(res.matches);
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // Silently skip duplicate check on network error
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [phone, email, isOpen, getToken]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Client name is required.');
      return;
    }

    if (!email.trim() && !phone.trim()) {
      setFormError('At least one of Email or Phone is required.');
      return;
    }

    setIsSubmitting(true);

    const payload: CreateLeadInput = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      serviceNeeded: serviceNeeded.trim() || undefined,
      budget: budget.trim() || undefined,
      timeline: timeline.trim() || undefined,
      preferredContact: preferredContact.trim() || undefined,
      source,
      stage: 'new',
      message: message.trim() || undefined,
      confirmDuplicate,
    };

    try {
      const response = await createLeadApi(getToken, payload);
      onSuccess(response.data);
      // Reset form
      setName('');
      setPhone('');
      setEmail('');
      setCompany('');
      setServiceNeeded('');
      setBudget('');
      setTimeline('');
      setPreferredContact('');
      setMessage('');
      setDuplicateWarning(null);
      setConfirmDuplicate(false);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        if (err.status === 409 && err.data.matches) {
          setDuplicateWarning(err.data.matches);
          setConfirmDuplicate(true);
          setFormError('A lead with this contact details already exists. Check the warning above and click "Create Anyway" if this is a separate inquiry.');
        } else {
          setFormError(err.data.message || 'Failed to create lead.');
        }
      } else {
        setFormError('An unexpected error occurred while saving.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-heading/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white rounded-card w-full max-w-lg border border-brand-border shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 id="modal-title" className="text-lg font-semibold text-brand-heading">
            Add New Lead
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-chip text-brand-muted hover:text-brand-heading hover:bg-brand-section transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {formError && (
            <div className="p-3 rounded-control bg-brand-errorBg border border-red-200 text-xs text-brand-destructive">
              {formError}
            </div>
          )}

          {duplicateWarning && duplicateWarning.length > 0 && (
            <div className="p-3 rounded-control bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-amber-800">
                <AlertTriangle size={14} />
                <span>Possible Duplicate Detected</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Existing lead match: <strong>{duplicateWarning[0].name}</strong> (Stage: {duplicateWarning[0].stage})
                {duplicateWarning[0].phone && ` • Phone: ${duplicateWarning[0].phone}`}
                {duplicateWarning[0].email && ` • Email: ${duplicateWarning[0].email}`}
              </p>
              <label className="flex items-center gap-2 pt-1 font-medium cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={confirmDuplicate}
                  onChange={(e) => setConfirmDuplicate(e.target.checked)}
                  className="rounded border-amber-300 text-brand-primary focus:ring-brand-primary"
                />
                Confirm this is a distinct inquiry from this contact
              </label>
            </div>
          )}

          {/* Name & Company Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-heading mb-1">
                Client / Prospect Name <span className="text-brand-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full h-11 px-3.5 rounded-control border border-brand-border text-sm text-brand-heading placeholder:text-brand-lightGray focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-heading mb-1">
                Company / Organization
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Studio"
                className="w-full h-11 px-3.5 rounded-control border border-brand-border text-sm text-brand-heading placeholder:text-brand-lightGray focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
              />
            </div>
          </div>

          {/* Phone & Email Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-heading mb-1">
                Phone / WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full h-11 px-3.5 rounded-control border border-brand-border text-sm text-brand-heading placeholder:text-brand-lightGray focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-heading mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full h-11 px-3.5 rounded-control border border-brand-border text-sm text-brand-heading placeholder:text-brand-lightGray focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
              />
            </div>
          </div>
          <p className="text-[11px] text-brand-muted">
            Provide at least one contact channel (phone or email).
          </p>

          {/* Service Needed & Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-heading mb-1">
                Service Needed
              </label>
              <input
                type="text"
                value={serviceNeeded}
                onChange={(e) => setServiceNeeded(e.target.value)}
                placeholder="e.g. Website Development"
                className="w-full h-11 px-3.5 rounded-control border border-brand-border text-sm text-brand-heading placeholder:text-brand-lightGray focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-heading mb-1">
                Budget (INR)
              </label>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. ₹50,000"
                className="w-full h-11 px-3.5 rounded-control border border-brand-border text-sm text-brand-heading placeholder:text-brand-lightGray focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
              />
            </div>
          </div>

          {/* Timeline & Preferred Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-heading mb-1">
                Expected Timeline
              </label>
              <input
                type="text"
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                placeholder="e.g. 2-4 weeks, Immediate"
                className="w-full h-11 px-3.5 rounded-control border border-brand-border text-sm text-brand-heading placeholder:text-brand-lightGray focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-heading mb-1">
                Preferred Contact
              </label>
              <select
                value={preferredContact}
                onChange={(e) => setPreferredContact(e.target.value)}
                className="w-full h-11 px-3 rounded-control border border-brand-border text-sm text-brand-heading bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
              >
                <option value="">Any / Not specified</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Phone Call">Phone Call</option>
                <option value="Email">Email</option>
              </select>
            </div>
          </div>

          {/* Source Tag */}
          <div>
            <label className="block text-xs font-semibold text-brand-heading mb-1">
              Lead Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as LeadSource)}
              className="w-full h-11 px-3 rounded-control border border-brand-border text-sm text-brand-heading bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Message / Notes */}
          <div>
            <label className="block text-xs font-semibold text-brand-heading mb-1">
              Initial Requirements / Notes
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Key notes from conversation or inquiry..."
              className="w-full p-3 rounded-control border border-brand-border text-sm text-brand-heading placeholder:text-brand-lightGray focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors resize-none"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="hq-btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="hq-btn-primary text-sm min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  {confirmDuplicate ? 'Create Anyway' : 'Save Lead'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
