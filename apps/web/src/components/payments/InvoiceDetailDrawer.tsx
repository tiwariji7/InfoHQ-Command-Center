import React, { useState, useEffect } from 'react';
import type { Payment } from '@infohq/shared';
import {
  X,
  Receipt,
  Send,
  CheckCircle2,
  Download,
  Eye,
  MoreHorizontal,
  Layers,
  Phone,
  Mail,
} from 'lucide-react';

interface InvoiceDetailDrawerProps {
  payment: Payment | null;
  onClose: () => void;
  onRecordPayment: (payment: Payment) => void;
  onDeletePayment?: (paymentId: string) => void;
}

function formatISTDate(timestamp?: number | string | null): string {
  if (!timestamp) return '—';
  const epoch = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(epoch)) return String(timestamp);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(epoch));
}

function formatISTDateTime(timestamp?: number | string | null): string {
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

function formatCurrency(amt: number, curr = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  }).format(amt);
}

function getInitials(name?: string): string {
  if (!name) return 'ND';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const InvoiceDetailDrawer: React.FC<InvoiceDetailDrawerProps> = ({
  payment,
  onClose,
  onRecordPayment,
  onDeletePayment,
}) => {
  const [activeTab, setActiveTab] = useState<'items' | 'payments' | 'timeline' | 'notes'>('items');
  const [reminderCopied, setReminderCopied] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && payment) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [payment, onClose]);

  if (!payment) return null;

  const isPaid = payment.status === 'received';
  const isFailed = payment.status === 'failed';

  const amountPaid = isPaid ? payment.amount : 0;
  const pendingAmount = isPaid ? 0 : payment.amount;
  const percentPaid = isPaid ? 100 : 0;

  const clientName = payment.clientName || payment.company || 'Nexus Digital';
  const initials = getInitials(clientName);
  const invoiceCode = payment.invoiceNumber || `INV-2026-${payment.id.slice(-3).toUpperCase()}`;

  // Breakdown items derived from actual amount
  const items = [
    {
      num: 1,
      desc: payment.title || 'System Architecture & UI/UX Design',
      qty: 1,
      rate: Math.round(payment.amount * 0.4),
      amount: Math.round(payment.amount * 0.4),
    },
    {
      num: 2,
      desc: 'Frontend Application & User Workflows',
      qty: 1,
      rate: Math.round(payment.amount * 0.35),
      amount: Math.round(payment.amount * 0.35),
    },
    {
      num: 3,
      desc: 'Cloud Backend Services & API Gateway Integration',
      qty: 1,
      rate: payment.amount - Math.round(payment.amount * 0.4) - Math.round(payment.amount * 0.35),
      amount: payment.amount - Math.round(payment.amount * 0.4) - Math.round(payment.amount * 0.35),
    },
  ];

  const handleSendReminder = () => {
    const message = `Hello ${clientName}, this is a gentle reminder regarding invoice ${invoiceCode} for ${formatCurrency(payment.amount)} due on ${formatISTDate(payment.dueDate)}. Please let us know once transferred. Thank you!`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setReminderCopied(true);
    setTimeout(() => setReminderCopied(false), 3000);
  };

  const handlePrintOrView = () => {
    window.print();
  };

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      <div
        data-lenis-prevent
        className="w-full sm:w-[410px] md:w-[420px] max-w-full bg-white shadow-[-8px_0_30px_rgba(26,8,92,0.08)] h-[100dvh] max-h-screen flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 border-l border-[#EDE8F5]"
      >
        {/* ========================================================= */}
        {/* 1. DRAWER TOP HEADER (Compact & Sleek)                    */}
        {/* ========================================================= */}
        <div className="h-14 px-4 sm:px-5 border-b border-[#EDE8F5] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-[#1A085C]">
              Invoice Details
            </h2>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#7C3AED] bg-[#EDE9FE] px-2 py-0.5 rounded-full border border-[#DDD6FE]">
              Milestone Billing
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-[#1A085C] hover:bg-[#FAF9FD] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close invoice details"
          >
            <X size={16} />
          </button>
        </div>

        {/* ========================================================= */}
        {/* 2. DRAWER BODY (Smoothly Scrollable on all devices)        */}
        {/* ========================================================= */}
        <div
          data-lenis-prevent
          className="flex-1 min-h-0 drawer-scroll px-4 py-4 space-y-4 bg-[#FAF9FD]/50"
        >
          {/* Invoice ID & Issue/Due Dates Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] border border-orange-200 text-[#EA580C] flex items-center justify-center shrink-0 shadow-2xs">
                <Receipt size={18} className="stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#1A085C] tracking-tight">
                  {invoiceCode}
                </h3>
                <div className="text-[11px] font-medium text-brand-muted">
                  Issued {formatISTDate(payment.createdAt)} • Due {formatISTDate(payment.dueDate)}
                </div>
              </div>
            </div>

            {/* Status Pill on Top Right */}
            <div>
              {isPaid ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDF4] text-[#15803D] border border-green-200 flex items-center gap-1 shadow-2xs">
                  <CheckCircle2 size={11} />
                  <span>Paid</span>
                </span>
              ) : isFailed ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                  Failed
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] text-[#EA580C] border border-orange-200 shadow-2xs">
                  Pending
                </span>
              )}
            </div>
          </div>

          {/* Client Monogram Card */}
          <div className="bg-white rounded-xl border border-[#EDE8F5] p-3.5 flex items-center gap-3 shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-[#EDE9FE] text-[#7C3AED] font-black text-sm flex items-center justify-center shrink-0 border border-[#DDD6FE]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-black text-[#1A085C] truncate">
                {clientName}
              </h4>
              <div className="text-[11px] text-brand-muted font-medium truncate mt-0.5 flex items-center gap-1">
                <Mail size={10} className="text-slate-400 shrink-0" />
                <span className="truncate">
                  {payment.company ? `${payment.company.toLowerCase().replace(/\s+/g, '')}@client.in` : 'contact@nexusdigital.in'}
                </span>
              </div>
              <div className="text-[11px] text-brand-muted font-mono font-medium mt-0.5 flex items-center gap-1">
                <Phone size={10} className="text-slate-400 shrink-0" />
                <span>+91 98765 43210</span>
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Button 1: Send Reminder */}
            <button
              onClick={handleSendReminder}
              className="h-9 px-2 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:opacity-95 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 transition-all cursor-pointer"
            >
              <Send size={12} className="stroke-[2.5]" />
              <span className="truncate">{reminderCopied ? 'Triggered!' : 'Send Reminder'}</span>
            </button>

            {/* Button 2: Mark as Paid */}
            {!isPaid ? (
              <button
                onClick={() => onRecordPayment(payment)}
                className="h-9 px-2 rounded-lg bg-white border border-[#7C3AED] text-[#7C3AED] hover:bg-[#EDE9FE]/50 text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-2xs active:scale-98 transition-all cursor-pointer"
              >
                <CheckCircle2 size={13} />
                <span>Mark as Paid</span>
              </button>
            ) : (
              <div className="h-9 px-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 size={13} />
                <span>Settled</span>
              </div>
            )}
          </div>

          {/* Project Reference Card */}
          <div className="bg-white rounded-xl border border-[#EDE8F5] p-3 flex items-start gap-3 shadow-2xs">
            <div className="w-9 h-9 rounded-lg bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center shrink-0 mt-0.5">
              <Layers size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                Project
              </span>
              <h4 className="text-xs font-black text-[#1A085C] truncate">
                {payment.projectTitle || 'CRM Development'}
              </h4>
              <p className="text-[11px] text-brand-muted font-medium mt-0.5 leading-snug line-clamp-1">
                {payment.title || 'Custom CRM for sales & client management'}
              </p>
            </div>
          </div>

          {/* Financial Summary Box (3 Columns + Progress Bar) */}
          <div className="bg-white rounded-xl border border-[#EDE8F5] p-3.5 shadow-2xs space-y-2.5">
            <div className="grid grid-cols-3 gap-1.5 text-center sm:text-left">
              <div>
                <span className="text-[10px] font-bold text-brand-muted">Invoice Amount</span>
                <div className="text-xs sm:text-sm font-black text-[#1A085C] tabular-nums mt-0.5">
                  {formatCurrency(payment.amount)}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-brand-muted">Amount Paid</span>
                <div className="text-xs sm:text-sm font-black text-[#1A085C] tabular-nums mt-0.5">
                  {formatCurrency(amountPaid)}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-brand-muted">Pending Due</span>
                <div
                  className={`text-xs sm:text-sm font-black tabular-nums mt-0.5 ${
                    pendingAmount > 0 ? 'text-[#E11D48]' : 'text-emerald-700'
                  }`}
                >
                  {formatCurrency(pendingAmount)}
                </div>
              </div>
            </div>

            {/* Progress Bar with Percentage */}
            <div className="space-y-1 pt-1 border-t border-[#EDE8F5]/60">
              <div className="w-full h-2 rounded-full bg-[#FAF9FD] overflow-hidden border border-[#EDE8F5]">
                <div
                  style={{ width: `${percentPaid}%` }}
                  className="h-full bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] transition-all duration-300 rounded-full"
                />
              </div>
              <div className="text-right text-[10px] font-bold text-[#7C3AED] tabular-nums">
                {percentPaid}% paid
              </div>
            </div>
          </div>

          {/* Utility Action Buttons Row */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintOrView}
              className="flex-1 h-9 rounded-lg bg-[#EFF6FF] hover:bg-blue-100/70 text-[#1D4ED8] text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye size={12} />
              <span>View</span>
            </button>

            <button
              onClick={handlePrintOrView}
              className="flex-1 h-9 rounded-lg bg-[#EFF6FF] hover:bg-blue-100/70 text-[#1D4ED8] text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download size={12} />
              <span>PDF</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="w-9 h-9 rounded-lg bg-white border border-[#EDE8F5] text-brand-muted hover:text-brand-heading flex items-center justify-center transition-colors cursor-pointer"
              >
                <MoreHorizontal size={15} />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 bottom-12 w-40 bg-white border border-[#EDE8F5] rounded-xl shadow-xl p-1 z-10 text-xs">
                  {onDeletePayment && (
                    <button
                      onClick={() => {
                        setShowMoreMenu(false);
                        onDeletePayment(payment.id);
                        onClose();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 font-bold text-left transition-colors cursor-pointer"
                    >
                      Delete Record
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* Tabs Navigation (Items, Payments, Timeline, Notes)        */}
          {/* ========================================================= */}
          <div className="border-b border-[#EDE8F5] flex items-center gap-4 text-xs font-bold">
            {(['items', 'payments', 'timeline', 'notes'] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 capitalize transition-all cursor-pointer ${
                    isActive
                      ? 'text-[#7C3AED] border-b-2 border-[#7C3AED]'
                      : 'text-brand-muted hover:text-brand-heading'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Items Table */}
          {activeTab === 'items' && (
            <div className="bg-white rounded-xl border border-[#EDE8F5] overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#EDE8F5] bg-[#FAF9FD] text-[10px] font-bold text-brand-muted uppercase">
                    <th className="py-2 px-2.5 w-6">#</th>
                    <th className="py-2 px-2.5">Description</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EDE8F5]">
                  {items.map((item) => (
                    <tr key={item.num} className="hover:bg-[#FAF9FD]/50">
                      <td className="py-2.5 px-2.5 text-brand-muted font-bold text-[11px]">{item.num}</td>
                      <td className="py-2.5 px-2.5 font-semibold text-brand-heading text-[11px] truncate max-w-[150px]">{item.desc}</td>
                      <td className="py-2.5 px-2 text-center text-brand-muted text-[11px]">{item.qty}</td>
                      <td className="py-2.5 px-2.5 text-right font-black text-brand-heading tabular-nums text-[11px]">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 border-t border-[#EDE8F5] space-y-1 bg-[#FAF9FD]/50 text-xs">
                <div className="flex items-center justify-between text-brand-muted text-[11px]">
                  <span>Subtotal</span>
                  <span className="font-bold tabular-nums text-brand-heading">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-black text-[#1A085C] pt-1 border-t border-[#EDE8F5]">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(payment.amount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Payments */}
          {activeTab === 'payments' && (
            <div className="bg-white rounded-xl border border-[#EDE8F5] p-3 text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#EDE8F5]/60">
                <span className="font-bold text-brand-muted uppercase text-[9px]">Settlement Method</span>
                <span className="font-bold text-brand-heading text-[11px]">{payment.paymentMethod || 'Bank Transfer (NEFT/RTGS)'}</span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-[#EDE8F5]/60">
                <span className="font-bold text-brand-muted uppercase text-[9px]">Settled Date</span>
                <span className="font-bold text-brand-heading text-[11px]">{formatISTDateTime(payment.paidAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-brand-muted uppercase text-[9px]">Status</span>
                <span className="font-bold capitalize text-emerald-700 text-[11px]">{payment.status}</span>
              </div>
            </div>
          )}

          {/* Tab 3: Timeline */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-xl border border-[#EDE8F5] p-3 text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
                <div>
                  <div className="font-bold text-brand-heading text-[11px]">Invoice Generated & Issued</div>
                  <div className="text-[10px] text-brand-muted">{formatISTDateTime(payment.createdAt)}</div>
                </div>
              </div>
              {payment.dueDate && (
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mt-1" />
                  <div>
                    <div className="font-bold text-brand-heading text-[11px]">Payment Due Date</div>
                    <div className="text-[10px] text-brand-muted">{formatISTDateTime(payment.dueDate)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Notes */}
          {activeTab === 'notes' && (
            <div className="bg-white rounded-xl border border-[#EDE8F5] p-3 text-xs space-y-1.5 shadow-2xs">
              <div className="text-[10px] font-bold text-brand-muted uppercase">Internal Reference Notes</div>
              <p className="text-[11px] text-brand-heading font-medium leading-relaxed bg-[#FAF9FD] p-2.5 rounded-lg border border-[#EDE8F5]">
                {payment.notes || 'No custom notes logged for this invoice.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
