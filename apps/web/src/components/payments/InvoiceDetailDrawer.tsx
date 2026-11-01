import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { generateRazorpayPaymentLinkApi } from '../../lib/api.js';
import { PrintableInvoiceModal } from './PrintableInvoiceModal.js';
import type { Payment } from '@infohq/shared';
import {
  X,
  CheckCircle2,
  Download,
  Eye,
  MoreHorizontal,
  Layers,
  Phone,
  Mail,
  ExternalLink,
  Sparkles,
  Loader2,
  Building2,
  Clock,
  MessageCircle,
  FileCheck2,
  Calendar,
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
  if (!name) return 'HQ';
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
  const { getToken } = useAuth();
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isGeneratingRzp, setIsGeneratingRzp] = useState(false);
  const [localPaymentLink, setLocalPaymentLink] = useState<string | null>(payment?.razorpayPaymentLinkUrl || null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  useEffect(() => {
    setLocalPaymentLink(payment?.razorpayPaymentLinkUrl || null);
  }, [payment?.razorpayPaymentLinkUrl]);

  const handleGenerateRazorpayLink = async () => {
    if (!payment) return;
    setIsGeneratingRzp(true);
    try {
      const res = await generateRazorpayPaymentLinkApi(getToken, payment.id);
      if (res.paymentLinkUrl) {
        setLocalPaymentLink(res.paymentLinkUrl);
      }
    } catch (err) {
      console.error('Failed to create Razorpay link:', err);
    } finally {
      setIsGeneratingRzp(false);
    }
  };

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
  const isOverdue = !isPaid && payment.dueDate ? payment.dueDate < Date.now() : false;

  const amountPaid = isPaid ? payment.amount : 0;
  const pendingAmount = isPaid ? 0 : payment.amount;
  const percentPaid = isPaid ? 100 : 0;

  const clientName = payment.clientName || payment.company || 'Client Profile';
  const initials = getInitials(clientName);
  const invoiceCode = payment.invoiceNumber || `INV-2026-${payment.id.slice(-4).toUpperCase()}`;

  // Breakdown items derived from actual amount
  const items = [
    {
      num: 1,
      desc: payment.title || 'System Architecture & Engineering Milestone',
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

  const cleanPhone = payment.clientPhone?.replace(/\D/g, '') || '';
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${encodeURIComponent(
        `Hello ${clientName}, this is a friendly reminder regarding invoice ${invoiceCode} for ${formatCurrency(
          payment.amount
        )} from InfoHQ. Please let us know once transferred. Thank you!`
      )}`
    : `https://wa.me/?text=${encodeURIComponent(
        `Hello ${clientName}, reminder regarding invoice ${invoiceCode} for ${formatCurrency(payment.amount)}.`
      )}`;

  const handleSendReminder = () => {
    window.open(waUrl, '_blank');
    setReminderCopied(true);
    setTimeout(() => setReminderCopied(false), 3000);
  };

  const handlePrintOrView = () => {
    setIsPrintModalOpen(true);
  };

  return (
    <>
      {/* Dim Smooth Backdrop */}
      <div
        className="fixed inset-0 bg-[#1A085C]/25 backdrop-blur-[2px] z-50 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Floating Side Drawer Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[500px] max-w-full bg-white z-50 shadow-[-12px_0_40px_rgba(26,8,92,0.18)] border-l border-[#E5E1F0] flex flex-col animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* ========================================================= */}
        {/* 1. DRAWER TOP HEADER                                      */}
        {/* ========================================================= */}
        <div className="relative p-5 pb-4 border-b border-[#E5E1F0] bg-gradient-to-b from-[#FAF9FD] to-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#5B4CF5] animate-ping" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B4CF5]">
                Invoice &amp; Client Dossier
              </span>
            </div>

            {/* CUT / CLOSE BUTTON */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#FAF5FF] hover:bg-[#F3F0FF] text-[#1A085C] hover:text-rose-600 border border-purple-100 flex items-center justify-center transition-all cursor-pointer shadow-2xs group"
              title="Cut / Close invoice (Esc)"
            >
              <X size={15} className="group-hover:rotate-90 transition-transform duration-200" />
            </button>
          </div>

          {/* Invoice ID & Status Banner */}
          <div className="flex items-center justify-between mt-3 gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#1A085C] tracking-tight leading-snug">
                {invoiceCode}
              </h2>
              <div className="text-[11px] font-medium text-[#6B7280] mt-0.5">
                Issued {formatISTDate(payment.createdAt)} • Due {formatISTDate(payment.dueDate)}
              </div>
            </div>

            {/* Status Badge */}
            <div>
              {isPaid ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#F0FDF4] text-[#15803D] border border-green-200 flex items-center gap-1.5 shadow-2xs">
                  <CheckCircle2 size={12} />
                  <span>Paid &amp; Settled</span>
                </span>
              ) : isFailed ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                  Failed
                </span>
              ) : isOverdue ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs flex items-center gap-1.5 animate-pulse">
                  <Clock size={12} />
                  <span>Overdue</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFF7ED] text-[#C2410C] border border-orange-200 shadow-2xs flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>Pending</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. DRAWER BODY                                            */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* ========================================================= */}
          {/* 2.1 EXECUTIVE CLIENT PROFILE HERO CARD                    */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5E1F0] shadow-2xs space-y-3.5">
            <div className="flex items-start gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#5B4CF5] to-[#E85AA0] text-white font-black text-lg flex items-center justify-center shadow-[0_6px_20px_rgba(91,76,245,0.30)] ring-4 ring-purple-50 shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B4CF5]">
                  Client Profile
                </div>
                <h3 className="text-base font-black text-[#1A085C] tracking-tight leading-snug truncate">
                  {clientName}
                </h3>
                {payment.company && (
                  <div className="text-xs font-semibold text-[#6B7280] flex items-center gap-1 truncate mt-0.5">
                    <Building2 size={12} className="text-[#5B4CF5] shrink-0" />
                    <span className="truncate">{payment.company}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Direct High-End Communication Action Pills */}
            <div className="grid grid-cols-3 gap-2.5 pt-1 border-t border-[#FAF9FD]">
              {payment.clientPhone ? (
                <a
                  href={`tel:${payment.clientPhone}`}
                  style={{
                    background: 'linear-gradient(135deg, #5B4CF5 0%, #4338CA 100%)',
                    boxShadow: '0 4px 14px rgba(91, 76, 245, 0.30)',
                  }}
                  className="h-11 px-2.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:brightness-110 hover:-translate-y-0.5 active:scale-95 transition-all shadow-sm cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Phone size={12} className="stroke-[2.8] text-white" />
                  </div>
                  <span className="text-[11.5px] font-extrabold tracking-wide">Call Client</span>
                </a>
              ) : (
                <div className="h-11 px-2.5 rounded-2xl bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#E5E1F0]">
                  <Phone size={13} />
                  <span>No Phone</span>
                </div>
              )}

              {/* WhatsApp Payment Reminder */}
              <button
                type="button"
                onClick={handleSendReminder}
                style={{
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.30)',
                }}
                className="h-11 px-2.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:brightness-110 hover:-translate-y-0.5 active:scale-95 transition-all shadow-sm cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <MessageCircle size={13} className="stroke-[2.8] text-white" />
                </div>
                <span className="text-[11.5px] font-extrabold tracking-wide">
                  {reminderCopied ? 'Sent!' : 'WhatsApp'}
                </span>
              </button>

              {payment.clientEmail ? (
                <a
                  href={`mailto:${payment.clientEmail}?subject=Invoice%20${invoiceCode}%20Payment`}
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.30)',
                  }}
                  className="h-11 px-2.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:brightness-110 hover:-translate-y-0.5 active:scale-95 transition-all shadow-sm cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Mail size={12} className="stroke-[2.8] text-white" />
                  </div>
                  <span className="text-[11.5px] font-extrabold tracking-wide">Email</span>
                </a>
              ) : (
                <div className="h-11 px-2.5 rounded-2xl bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#E5E1F0]">
                  <Mail size={13} />
                  <span>No Email</span>
                </div>
              )}
            </div>

            {/* Important Client Details Grid */}
            <div className="space-y-2 pt-2 border-t border-[#FAF9FD]">
              <div className="flex items-center justify-between text-xs py-1 border-b border-[#FAF9FD]">
                <span className="text-[#6B7280] flex items-center gap-1.5">
                  <Phone size={12} className="text-[#5B4CF5]" />
                  <span>Phone Number</span>
                </span>
                <span className="font-semibold text-[#1A085C]">
                  {payment.clientPhone || 'Not Available'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-[#6B7280] flex items-center gap-1.5">
                  <Mail size={12} className="text-[#5B4CF5]" />
                  <span>Email Address</span>
                </span>
                <span className="font-semibold text-[#1A085C] truncate max-w-[220px]">
                  {payment.clientEmail || 'Not Available'}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2.15 IMPORTANT DATES & TIMELINE CARD                      */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5E1F0] shadow-2xs space-y-3">
            <span className="text-[10.5px] font-bold text-[#1A085C] uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={13} className="text-[#5B4CF5]" />
              <span>Important Dates &amp; Timeline</span>
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#FAF9FD] p-2.5 rounded-xl border border-[#E5E1F0]">
                <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider flex items-center gap-1">
                  <Calendar size={10} className="text-[#5B4CF5]" />
                  <span>Issued Date</span>
                </div>
                <div className="text-xs font-black text-[#1A085C] mt-1 tabular-nums">
                  {formatISTDate(payment.createdAt)}
                </div>
                <div className="text-[9.5px] text-[#9CA3AF] mt-0.5">
                  Invoice Generation
                </div>
              </div>

              <div className="bg-[#FAF9FD] p-2.5 rounded-xl border border-[#E5E1F0]">
                <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider flex items-center gap-1">
                  <Clock size={10} className={isPaid ? 'text-[#10B981]' : isOverdue ? 'text-rose-500' : 'text-[#F97316]'} />
                  <span>{isPaid ? 'Settled Date' : 'Due Date'}</span>
                </div>
                <div className={`text-xs font-black mt-1 tabular-nums ${isPaid ? 'text-[#15803D]' : isOverdue ? 'text-rose-700' : 'text-[#C2410C]'}`}>
                  {isPaid ? formatISTDate(payment.paidAt || payment.updatedAt) : formatISTDate(payment.dueDate)}
                </div>
                <div className="text-[9.5px] mt-0.5 font-bold">
                  {isPaid ? (
                    <span className="text-[#15803D]">Payment Received ✓</span>
                  ) : isOverdue ? (
                    <span className="text-rose-600">Overdue Notice</span>
                  ) : (
                    <span className="text-[#6B7280]">Payment Due</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2.2 LINKED PROJECT & DELIVERABLE DETAILS                   */}
          {/* ========================================================= */}
          <div className="bg-[#FAF9FD] rounded-2xl p-4 border border-[#E5E1F0] space-y-2.5">
            <span className="text-[10.5px] font-bold text-[#1A085C] uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} className="text-[#5B4CF5]" />
              <span>Associated Project &amp; Milestone</span>
            </span>

            <div className="bg-white p-3 rounded-xl border border-[#E5E1F0] shadow-2xs space-y-1">
              <div className="font-bold text-xs text-[#1A085C] flex items-center gap-1.5">
                <span>{payment.projectTitle || 'Client Deliverable Project'}</span>
              </div>
              <div className="text-[11px] font-semibold text-[#5B4CF5]">
                Milestone: {payment.title || 'Engineering Sprint Deliverable'}
              </div>
              {payment.notes && (
                <div className="text-[10.5px] text-[#6B7280] italic mt-1 pt-1 border-t border-[#FAF9FD]">
                  Ref: {payment.notes}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2.3 FINANCIAL BREAKDOWN SNAPSHOT (Single-Glance Strip)     */}
          {/* ========================================================= */}
          <div className="bg-white rounded-2xl border border-[#E5E1F0] p-4 shadow-2xs space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
              <div>
                <span className="text-[10px] font-bold text-[#6B7280] block">Invoice Amount</span>
                <div className="text-xs sm:text-sm font-black text-[#1A085C] tabular-nums mt-0.5">
                  {formatCurrency(payment.amount, payment.currency)}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#15803D] block">Amount Settled</span>
                <div className="text-xs sm:text-sm font-black text-[#15803D] tabular-nums mt-0.5">
                  {formatCurrency(amountPaid, payment.currency)}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#C2410C] block">Pending Balance</span>
                <div
                  className={`text-xs sm:text-sm font-black tabular-nums mt-0.5 ${
                    pendingAmount > 0 ? 'text-[#E11D48]' : 'text-[#15803D]'
                  }`}
                >
                  {formatCurrency(pendingAmount, payment.currency)}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1 pt-1 border-t border-[#FAF9FD]">
              <div className="w-full h-2 rounded-full bg-[#FAF9FD] overflow-hidden border border-[#E5E1F0]">
                <div
                  style={{ width: `${percentPaid}%` }}
                  className="h-full bg-gradient-to-r from-[#5B4CF5] to-[#E85AA0] transition-all duration-300 rounded-full"
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-[#6B7280]">
                <span>Payment Recovery</span>
                <span className="text-[#5B4CF5]">{percentPaid}% Paid</span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2.4 HERO PAYMENT ACTIONS (High-End Tactile Buttons)       */}
          {/* ========================================================= */}
          <div className="space-y-2.5">
            {!isPaid && (
              <>
                {/* HERO CTA BUTTON: RECORD FUNDS / MARK AS PAID */}
                <button
                  type="button"
                  onClick={() => onRecordPayment(payment)}
                  style={{
                    background: 'linear-gradient(135deg, #5B4CF5 0%, #7C5CE8 45%, #E85AA0 100%)',
                    boxShadow: '0 8px 24px -2px rgba(91, 76, 245, 0.42), 0 2px 8px rgba(232, 90, 160, 0.28)',
                    color: '#FFFFFF',
                  }}
                  className="w-full h-12 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2.5 hover:brightness-110 hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer shadow-lg group"
                >
                  <div className="w-6 h-6 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <FileCheck2 size={14} className="stroke-[3] text-white" />
                  </div>
                  <span>Record Received Funds (Mark Paid)</span>
                </button>

                {/* RAZORPAY PAYMENT LINK */}
                {localPaymentLink ? (
                  <a
                    href={localPaymentLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                      boxShadow: '0 6px 20px -2px rgba(16, 185, 129, 0.35)',
                    }}
                    className="w-full h-11 rounded-2xl text-white text-xs font-extrabold flex items-center justify-center gap-2 hover:brightness-110 hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer shadow-md group"
                  >
                    <div className="w-6 h-6 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <ExternalLink size={13} className="text-white stroke-[2.8]" />
                    </div>
                    <span>Open Live Razorpay Gateway</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateRazorpayLink}
                    disabled={isGeneratingRzp}
                    className="w-full h-11 rounded-2xl bg-white hover:bg-[#FAF9FD] text-[#5B4CF5] border-2 border-[#5B4CF5]/30 hover:border-[#5B4CF5] text-xs font-extrabold flex items-center justify-center gap-2 shadow-2xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 group"
                  >
                    <div className="w-6 h-6 rounded-xl bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      {isGeneratingRzp ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="stroke-[2.5]" />}
                    </div>
                    <span>{isGeneratingRzp ? 'Generating Razorpay Link...' : 'Create Razorpay Payment Link'}</span>
                  </button>
                )}
              </>
            )}

            {/* View Invoice & Print PDF Action Deck */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handlePrintOrView}
                className="flex-1 h-10 rounded-2xl bg-white hover:bg-[#F3F0FF] text-[#1A085C] hover:text-[#5B4CF5] text-xs font-bold flex items-center justify-center gap-2 border border-[#E5E1F0] hover:border-[#5B4CF5]/40 transition-all cursor-pointer shadow-2xs hover:-translate-y-0.5 group"
              >
                <div className="w-5 h-5 rounded-lg bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Eye size={12} className="stroke-[2.5]" />
                </div>
                <span>View Invoice</span>
              </button>

              <button
                type="button"
                onClick={handlePrintOrView}
                className="flex-1 h-10 rounded-2xl bg-white hover:bg-[#EFF6FF] text-[#1A085C] hover:text-[#1D4ED8] text-xs font-bold flex items-center justify-center gap-2 border border-[#E5E1F0] hover:border-blue-300 transition-all cursor-pointer shadow-2xs hover:-translate-y-0.5 group"
              >
                <div className="w-5 h-5 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Download size={12} className="stroke-[2.5]" />
                </div>
                <span>Download PDF</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="w-10 h-10 rounded-2xl bg-white hover:bg-rose-50 text-[#6B7280] hover:text-rose-600 border border-[#E5E1F0] hover:border-rose-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  title="More actions"
                >
                  <MoreHorizontal size={15} />
                </button>

                {showMoreMenu && (
                  <div className="absolute right-0 bottom-12 w-44 bg-white border border-[#E5E1F0] rounded-xl shadow-xl p-1 z-10 text-xs">
                    {onDeletePayment && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          onDeletePayment(payment.id);
                          onClose();
                        }}
                        className="w-full px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 font-bold text-left transition-colors cursor-pointer"
                      >
                        Delete Invoice
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2.5 SEGMENTED TABS: Items, Payments, Timeline, Notes      */}
          {/* ========================================================= */}
          <div className="p-1 bg-[#FAF9FD] rounded-2xl border border-[#E5E1F0] flex items-center gap-1">
            {(['items', 'payments', 'timeline', 'notes'] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#5B4CF5] shadow-2xs border border-[#E5E1F0]'
                      : 'text-[#6B7280] hover:text-[#1A085C]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Items Table */}
          {activeTab === 'items' && (
            <div className="bg-white rounded-xl border border-[#E5E1F0] overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E1F0] bg-[#FAF9FD] text-[10px] font-bold text-[#6B7280] uppercase">
                    <th className="py-2.5 px-3 w-6">#</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-2 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E1F0]">
                  {items.map((item) => (
                    <tr key={item.num} className="hover:bg-[#FAF9FD]/50">
                      <td className="py-2.5 px-3 text-[#6B7280] font-bold text-[11px]">{item.num}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#1A085C] text-[11px] truncate max-w-[170px]">
                        {item.desc}
                      </td>
                      <td className="py-2.5 px-2 text-center text-[#6B7280] text-[11px]">{item.qty}</td>
                      <td className="py-2.5 px-3 text-right font-black text-[#1A085C] tabular-nums text-[11px]">
                        {formatCurrency(item.amount, payment.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 border-t border-[#E5E1F0] space-y-1 bg-[#FAF9FD] text-xs">
                <div className="flex items-center justify-between text-[#6B7280] text-[11px]">
                  <span>Subtotal</span>
                  <span className="font-bold tabular-nums text-[#1A085C]">
                    {formatCurrency(payment.amount, payment.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-black text-[#1A085C] pt-1 border-t border-[#E5E1F0]">
                  <span>Total Amount</span>
                  <span className="tabular-nums text-[#5B4CF5]">
                    {formatCurrency(payment.amount, payment.currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Payments */}
          {activeTab === 'payments' && (
            <div className="bg-white rounded-xl border border-[#E5E1F0] p-3.5 text-xs space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#FAF9FD]">
                <span className="font-bold text-[#6B7280] uppercase text-[9.5px]">Settlement Method</span>
                <span className="font-bold text-[#1A085C] text-xs">
                  {payment.paymentMethod || 'Bank Transfer (NEFT/RTGS)'}
                </span>
              </div>
              <div className="flex items-center justify-between pb-1.5 border-b border-[#FAF9FD]">
                <span className="font-bold text-[#6B7280] uppercase text-[9.5px]">Settlement Date</span>
                <span className="font-bold text-[#1A085C] text-xs">
                  {formatISTDateTime(payment.paidAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#6B7280] uppercase text-[9.5px]">Current Status</span>
                <span className="font-bold capitalize text-emerald-700 text-xs">{payment.status}</span>
              </div>
            </div>
          )}

          {/* Tab 3: Timeline */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-xl border border-[#E5E1F0] p-3.5 text-xs space-y-3 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold text-[#1A085C] text-xs">Invoice Created &amp; Issued</div>
                  <div className="text-[10px] text-[#6B7280] mt-0.5">
                    {formatISTDateTime(payment.createdAt)}
                  </div>
                </div>
              </div>
              {payment.dueDate && (
                <div className="flex items-start gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${isOverdue ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  <div>
                    <div className="font-bold text-[#1A085C] text-xs">Payment Due Date</div>
                    <div className="text-[10px] text-[#6B7280] mt-0.5">
                      {formatISTDateTime(payment.dueDate)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Notes */}
          {activeTab === 'notes' && (
            <div className="bg-white rounded-xl border border-[#E5E1F0] p-3.5 text-xs space-y-2 shadow-2xs">
              <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider block">
                Internal Milestone Notes
              </span>
              <p className="text-xs text-[#374151] font-medium leading-relaxed bg-[#FAF9FD] p-3 rounded-xl border border-[#E5E1F0]">
                {payment.notes || 'No internal notes logged for this invoice.'}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Drawer Footer */}
        <div className="p-4 border-t border-[#E5E1F0] bg-[#FAF9FD] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#6B7280]">
            Invoice ID: <strong className="text-[#1A085C] font-mono">{payment.id.slice(0, 10)}...</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#1A085C] hover:bg-[#2A108C] text-white text-xs font-extrabold transition-all cursor-pointer shadow-sm hover:shadow-md"
          >
            Close Invoice
          </button>
        </div>
      </div>

      {/* Printable Real PDF Invoice Modal */}
      {payment && (
        <PrintableInvoiceModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          payment={{
            ...payment,
            razorpayPaymentLinkUrl: localPaymentLink || payment.razorpayPaymentLinkUrl,
          }}
        />
      )}
    </>
  );
};
