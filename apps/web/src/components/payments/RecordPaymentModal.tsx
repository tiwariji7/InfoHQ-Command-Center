import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Payment, PaymentMethod, RecordPaymentInput } from '@infohq/shared';
import { recordPaymentApi } from '../../lib/api.js';
import { X, CheckCircle2, Loader2, IndianRupee } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (payment: Payment) => void;
  payment: Payment | null;
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'bank_transfer', label: 'Bank Transfer (NEFT/RTGS/IMPS)' },
  { value: 'upi', label: 'UPI / QR Payment' },
  { value: 'stripe', label: 'Stripe / International Card' },
  { value: 'cash', label: 'Cash / Handover' },
  { value: 'other', label: 'Other Method' },
];

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  payment,
}) => {
  const { getToken } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [notes, setNotes] = useState('');
  const [paidDateStr, setPaidDateStr] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (payment) {
      setPaymentMethod(payment.paymentMethod || 'bank_transfer');
      setNotes(payment.notes || '');
      setPaidDateStr(new Date().toISOString().split('T')[0]);
      setError(null);
    }
  }, [payment, isOpen]);

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

  if (!isOpen || !payment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let paidAt = Date.now();
      if (paidDateStr) {
        const parsed = new Date(paidDateStr).getTime();
        if (!isNaN(parsed)) {
          paidAt = parsed;
        }
      }

      const payload: RecordPaymentInput = {
        paymentMethod,
        notes: notes.trim() || undefined,
        paidAt,
      };

      const res = await recordPaymentApi(getToken, payment.id, payload);
      onSuccess(res.payment);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to record payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: payment.currency || 'INR',
    maximumFractionDigits: 0,
  }).format(payment.amount);

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
              Record Payment Receipt
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Confirm receipt for {payment.title}
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 text-brand-destructive rounded-control border border-red-200">
              {error}
            </div>
          )}

          {/* Amount Callout */}
          <div className="p-3.5 rounded-control bg-brand-section border border-brand-border flex items-center justify-between">
            <div>
              <span className="text-[11px] text-brand-muted uppercase font-bold tracking-wider">
                Received Amount
              </span>
              <div className="text-xl font-bold text-brand-primary flex items-center gap-1 mt-0.5">
                <IndianRupee size={18} />
                <span>{formattedAmount.replace('₹', '')}</span>
              </div>
            </div>
            {payment.invoiceNumber && (
              <span className="text-xs font-mono font-semibold px-2 py-1 bg-white border border-brand-border rounded text-brand-heading">
                {payment.invoiceNumber}
              </span>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block font-semibold text-brand-heading mb-1">
              Payment Method <span className="text-brand-destructive">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none bg-white"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block font-semibold text-brand-heading mb-1">
              Date Received <span className="text-brand-destructive">*</span>
            </label>
            <input
              type="date"
              required
              value={paidDateStr}
              onChange={(e) => setPaidDateStr(e.target.value)}
              className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
            />
          </div>

          {/* Transaction / UTR Notes */}
          <div>
            <label className="block font-semibold text-brand-heading mb-1">
              Transaction ID / UTR / Reference
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. UTR 428938491823 / Bank Ref"
              className="w-full px-3 py-2 border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
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
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  Confirm Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
