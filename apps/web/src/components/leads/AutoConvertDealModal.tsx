import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Lead, Payment } from '@infohq/shared';
import { autoConvertWonLeadApi } from '../../lib/api.js';
import {
  X,
  Trophy,
  Loader2,
  CheckCircle2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface AutoConvertDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  onSuccess: (payment: Payment) => void;
}

export const AutoConvertWonDealModal: React.FC<AutoConvertDealModalProps> = ({
  isOpen,
  onClose,
  lead,
  onSuccess,
}) => {
  const { getToken } = useAuth();

  // Extract initial numeric budget from lead.budget string (e.g. "₹50,000" -> 50000)
  const initialBudgetNum = (() => {
    if (!lead.budget) return 50000;
    const digits = lead.budget.replace(/[^\d]/g, '');
    const val = parseInt(digits, 10);
    return isNaN(val) || val <= 0 ? 50000 : val;
  })();

  const [totalBudget, setTotalBudget] = useState<number>(initialBudgetNum);
  const [advancePercent, setAdvancePercent] = useState<number>(40);
  const [customAdvance, setCustomAdvance] = useState<number>(
    Math.round((initialBudgetNum * 40) / 100)
  );
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const deadlineDays = 30;
  const [sendEmail, setSendEmail] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    paymentLinkUrl?: string;
    payment: Payment;
  } | null>(null);

  if (!isOpen) return null;

  const currentAdvanceAmount = customAdvance > 0 ? customAdvance : Math.max(1, Math.round((totalBudget * advancePercent) / 100));

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  const handleTotalBudgetChange = (val: number) => {
    setTotalBudget(val);
    if (!isCustomMode) {
      setCustomAdvance(Math.max(1, Math.round((val * advancePercent) / 100)));
    }
  };

  const handlePercentSelect = (pct: number) => {
    setAdvancePercent(pct);
    setIsCustomMode(false);
    setCustomAdvance(Math.max(1, Math.round((totalBudget * pct) / 100)));
  };

  const handleCustomPercentChange = (pct: number) => {
    setAdvancePercent(pct);
    setIsCustomMode(true);
    setCustomAdvance(Math.max(1, Math.round((totalBudget * pct) / 100)));
  };

  const handleCustomAmountChange = (amt: number) => {
    setCustomAdvance(amt);
    setIsCustomMode(true);
    if (totalBudget > 0) {
      setAdvancePercent(Math.round((amt / totalBudget) * 100));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await autoConvertWonLeadApi(getToken, lead.id, {
        totalBudget,
        advancePercentage: advancePercent,
        customAdvanceAmount: currentAdvanceAmount,
        deadlineDays,
        sendEmail,
      });

      setSuccessResult({
        paymentLinkUrl: res.paymentLinkUrl,
        payment: res.payment,
      });
      onSuccess(res.payment);
    } catch (err: unknown) {
      console.error('Failed to convert won deal:', err);
      setError(err instanceof Error ? err.message : 'Failed to convert deal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#EDE8F5] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-16 px-6 border-b border-[#EDE8F5] flex items-center justify-between bg-gradient-to-r from-white to-[#FAF9FD]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
              <Trophy size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#1A085C]">
                Win Deal & Generate Advance Invoice
              </h2>
              <p className="text-[11px] text-brand-muted">
                Convert {lead.name} into an active client project with live Razorpay link.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-[#1A085C] hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {successResult ? (
          <div className="p-6 space-y-4 text-center animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-base font-black text-[#1A085C]">
                Deal Converted & Invoice Generated!
              </h3>
              <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
                Advance invoice ({formatCurrency(currentAdvanceAmount)}) created. Telegram notification dispatched.
              </p>
            </div>

            {successResult.paymentLinkUrl && (
              <div className="p-3.5 rounded-xl bg-[#FAF9FD] border border-[#EDE8F5] text-left space-y-2">
                <span className="text-[10px] font-black uppercase text-brand-muted">
                  Live Razorpay Payment Link
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-[#7C3AED] truncate">
                    {successResult.paymentLinkUrl}
                  </span>
                  <a
                    href={successResult.paymentLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded bg-[#7C3AED] text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0 hover:bg-[#6D28D9]"
                  >
                    <span>Open</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full h-10 rounded-xl bg-[#7C3AED] text-white text-xs font-bold hover:bg-[#6D28D9] transition-all cursor-pointer shadow-md shadow-[#7C3AED]/20"
            >
              Done & Return to CRM
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Total Contract Value Input (NO MIN LOCK) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#1A085C] flex items-center justify-between">
                <span>Total Project Contract Value (INR)</span>
                <span className="text-[10px] text-brand-muted font-normal">No minimum lock</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={totalBudget}
                  onChange={(e) => handleTotalBudgetChange(Number(e.target.value))}
                  required
                  className="w-full h-10 pl-7 pr-3 text-xs font-bold rounded-xl border border-[#EDE8F5] bg-[#FAF9FD] outline-none focus:bg-white focus:border-[#7C3AED] transition-all tabular-nums"
                />
              </div>
            </div>

            {/* Advance Percentage Selector & Direct Custom Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#1A085C] flex items-center justify-between">
                <span>Advance Milestone Option</span>
                <span className="text-[10px] text-brand-muted font-normal">Choose preset or enter custom</span>
              </label>

              {/* Preset Buttons */}
              <div className="grid grid-cols-5 gap-1.5">
                {[20, 30, 40, 50, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handlePercentSelect(pct)}
                    className={`h-8 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      advancePercent === pct && !isCustomMode
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-2xs'
                        : 'bg-white border-[#EDE8F5] text-brand-muted hover:border-slate-300'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Linked Custom Percent & Amount Fields */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-brand-muted block mb-1">
                    Advance Percentage (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="any"
                    value={advancePercent}
                    onChange={(e) => handleCustomPercentChange(Number(e.target.value))}
                    className="w-full h-9 px-3 text-xs font-bold rounded-xl border border-[#EDE8F5] bg-[#FAF9FD] outline-none focus:bg-white focus:border-[#7C3AED] transition-all tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-muted block mb-1">
                    Advance Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={customAdvance}
                    onChange={(e) => handleCustomAmountChange(Number(e.target.value))}
                    className="w-full h-9 px-3 text-xs font-bold rounded-xl border border-[#EDE8F5] bg-[#FAF9FD] outline-none focus:bg-white focus:border-[#7C3AED] transition-all tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Calculated Advance Highlight Card */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#EDE9FE] to-[#F5F3FF] border border-[#DDD6FE] space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#1A085C]">
                <span>Calculated Advance Invoice</span>
                <span className="text-base font-black text-[#7C3AED] tabular-nums">
                  {formatCurrency(currentAdvanceAmount)}
                </span>
              </div>
              <p className="text-[11px] text-brand-muted leading-relaxed">
                Initial milestone fee ({advancePercent}% of {formatCurrency(totalBudget)}). Live Razorpay link will be created for this exact amount.
              </p>
            </div>

            {/* Automation Options Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-[#EDE8F5]">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-[#1A085C]">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="mt-0.5 rounded text-[#7C3AED] focus:ring-[#7C3AED]"
                />
                <span>
                  <strong>Send Official Invoice Email via Resend</strong> to {lead.email || 'client'}
                </span>
              </label>

              <div className="flex items-start gap-2.5 text-xs font-medium text-slate-500 pl-6">
                <span>
                  ✓ Auto-dispatches <strong>Telegram Notification</strong> to InfoHQ Command Centre channel with direct payment link.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#EDE8F5]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 h-10 rounded-xl border border-[#EDE8F5] text-xs font-bold text-brand-muted hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 h-10 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:opacity-95 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-[#7C3AED]/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Win Deal & Create Invoice ({formatCurrency(currentAdvanceAmount)})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
