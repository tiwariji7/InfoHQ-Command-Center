import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { CreateProjectInput, Project, Lead } from '@infohq/shared';
import { createProjectApi } from '../../lib/api.js';
import { X, Plus, Loader2 } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
  initialLead?: Lead | null;
}

const SERVICE_OPTIONS = [
  'AI / Automation',
  'AI Solution',
  'Custom Software',
  'Cloud / DevOps & Infrastructure',
  'Cloud & DevOps',
  'Business Process / CRM',
  'SaaS Development',
  'Monthly Retainer',
  'Website / Web App',
  'Mobile App Development',
];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialLead,
}) => {
  const { getToken } = useAuth();

  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [company, setCompany] = useState('');
  const [serviceType, setServiceType] = useState('AI / Automation');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState<Project['status']>('planning');
  const [targetDateStr, setTargetDateStr] = useState('');
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pre-fill from initialLead if provided
  useEffect(() => {
    if (initialLead) {
      setTitle(`${initialLead.name} - ${initialLead.serviceNeeded || 'Consultation Project'}`);
      setClientName(initialLead.name);
      setClientEmail(initialLead.email || '');
      setClientPhone(initialLead.phone || '');
      setCompany(initialLead.company || '');
      setServiceType(initialLead.serviceNeeded || 'AI / Automation');
      setBudget(initialLead.budget || '');
      setDescription(initialLead.message || '');
      setStatus('in_progress');
    } else {
      setTitle('');
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setCompany('');
      setServiceType('AI / Automation');
      setBudget('');
      setStatus('planning');
      setTargetDateStr('');
      setDescription('');
    }
    setFormError(null);
  }, [initialLead, isOpen]);

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError('Project title is required.');
      return;
    }
    if (!clientName.trim()) {
      setFormError('Client name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      let targetDate: number | null = null;
      if (targetDateStr) {
        const parsed = new Date(targetDateStr).getTime();
        if (!isNaN(parsed)) {
          targetDate = parsed;
        }
      }

      const payload: CreateProjectInput = {
        leadId: initialLead?.id || undefined,
        title: title.trim(),
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        company: company.trim() || undefined,
        serviceType: serviceType.trim(),
        budget: budget.trim() || undefined,
        status,
        startDate: Date.now(),
        targetDate: targetDate || undefined,
        description: description.trim() || undefined,
      };

      const res = await createProjectApi(getToken, payload);
      onSuccess(res.project);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to create project:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-card shadow-modal max-w-xl w-full border border-brand-border my-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-base font-bold text-brand-heading">
              {initialLead ? 'Convert Lead to Active Project' : 'Create New Project'}
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              {initialLead
                ? `Converting won lead for ${initialLead.name}`
                : 'Define project scope, client details, and deliverables'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-brand-muted hover:text-brand-heading rounded hover:bg-brand-section transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-red-50 text-brand-destructive rounded-control border border-red-200">
              {formError}
            </div>
          )}

          {/* Project Title */}
          <div>
            <label className="block font-semibold text-brand-heading mb-1">
              Project Title <span className="text-brand-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AI Automation Engine / Custom CRM"
              className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
            />
          </div>

          {/* Client Name & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Client Name <span className="text-brand-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client full name"
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Company / Organization
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name (optional)"
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Client Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@company.com"
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Phone / WhatsApp
              </label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Service Type & Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Service Type <span className="text-brand-destructive">*</span>
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none bg-white"
              >
                {SERVICE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Agreed Budget
              </label>
              <input
                type="text"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. ₹1,50,000 / $2,000"
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Status & Target Delivery Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Project['status'])}
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none bg-white capitalize"
              >
                <option value="planning">Planning</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Target Delivery Date
              </label>
              <input
                type="date"
                value={targetDateStr}
                onChange={(e) => setTargetDateStr(e.target.value)}
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Scope / Description */}
          <div>
            <label className="block font-semibold text-brand-heading mb-1">
              Project Scope & Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key deliverables, client requirements, milestones..."
              className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-brand-border shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-brand-border rounded-control font-semibold text-brand-body hover:bg-brand-section transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="hq-btn-primary flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating Project...
                </>
              ) : (
                <>
                  <Plus size={14} />
                  Create Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
