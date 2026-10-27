import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { CreatePaymentInput, Payment, Project } from '@infohq/shared';
import { createPaymentApi, fetchProjects } from '../../lib/api.js';
import { X, Plus, Loader2 } from 'lucide-react';

interface CreatePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (payment: Payment) => void;
  preSelectedProjectId?: string;
  preSelectedProjectTitle?: string;
}

export const CreatePaymentModal: React.FC<CreatePaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preSelectedProjectId,
  preSelectedProjectTitle,
}) => {
  const { getToken } = useAuth();

  const [projectId, setProjectId] = useState(preSelectedProjectId || '');
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dueDateStr, setDueDateStr] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects if not pre-selected
  useEffect(() => {
    if (preSelectedProjectId) {
      setProjectId(preSelectedProjectId);
    } else if (isOpen) {
      fetchProjects(getToken)
        .then((res) => {
          setProjectsList(res.projects);
          if (res.projects.length > 0 && !projectId) {
            setProjectId(res.projects[0].id);
          }
        })
        .catch((err) => console.error('Failed to load projects list:', err));
    }
  }, [isOpen, preSelectedProjectId, getToken]);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setAmount('');
      setInvoiceNumber('');
      setDueDateStr('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  // Handle Escape key
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
    setError(null);

    if (!projectId) {
      setError('Please select a project.');
      return;
    }
    if (!title.trim()) {
      setError('Milestone title is required.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      let dueDate: number | null = null;
      if (dueDateStr) {
        const parsed = new Date(dueDateStr).getTime();
        if (!isNaN(parsed)) {
          dueDate = parsed;
        }
      }

      const payload: CreatePaymentInput = {
        projectId,
        title: title.trim(),
        amount: numAmount,
        currency,
        invoiceNumber: invoiceNumber.trim() || undefined,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await createPaymentApi(getToken, payload);
      onSuccess(res.payment);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to create payment milestone:', err);
      setError(err instanceof Error ? err.message : 'Failed to create payment.');
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
      <div className="bg-white rounded-card shadow-modal max-w-md w-full border border-brand-border my-6 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between bg-white shrink-0">
          <div>
            <h2 className="text-base font-bold text-brand-heading">
              Create Payment Milestone
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              {preSelectedProjectTitle
                ? `Add milestone for ${preSelectedProjectTitle}`
                : 'Add a new client milestone invoice'}
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 text-brand-destructive rounded-control border border-red-200">
              {error}
            </div>
          )}

          {/* Project Selection (if not preselected) */}
          {!preSelectedProjectId && (
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Project <span className="text-brand-destructive">*</span>
              </label>
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none bg-white"
              >
                <option value="">Select Project</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.clientName})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Milestone Title */}
          <div>
            <label className="block font-semibold text-brand-heading mb-1">
              Milestone / Invoice Title <span className="text-brand-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 50% Advance Token / Milestone 1 Delivery"
              className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
            />
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block font-semibold text-brand-heading mb-1">
                Amount <span className="text-brand-destructive">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="75000"
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none font-semibold text-brand-heading"
              />
            </div>
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none bg-white font-semibold"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          {/* Invoice Number & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-2026-001"
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-brand-heading mb-1">
                Payment Due Date
              </label>
              <input
                type="date"
                value={dueDateStr}
                onChange={(e) => setDueDateStr(e.target.value)}
                className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-brand-heading mb-1">
              Internal Notes / Terms
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Due before staging deployment..."
              className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-brand-border">
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
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={14} />
                  Add Milestone
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
