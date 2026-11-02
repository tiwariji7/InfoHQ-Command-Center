import React, { useRef, useState } from 'react';
import type { Payment } from '@infohq/shared';
import {
  X,
  Printer,
  Download,
  Eye,
  ExternalLink,
  Loader2,
  GripHorizontal,
} from 'lucide-react';
import { useDraggable } from '../../lib/useDraggable';

interface PrintableInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment;
}

// Dynamic script loader for html2pdf.js via CDN
const loadHtml2Pdf = async (): Promise<any> => {
  if (typeof window !== 'undefined' && (window as any).html2pdf) {
    return (window as any).html2pdf;
  }
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('html2pdf-cdn');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).html2pdf));
      return;
    }
    const script = document.createElement('script');
    script.id = 'html2pdf-cdn';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve((window as any).html2pdf);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

export const PrintableInvoiceModal: React.FC<PrintableInvoiceModalProps> = ({
  isOpen,
  onClose,
  payment,
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Draggable window state matching Client Profile & Create Payment modals
  const { cardRef, position, handlePointerDown, resetPosition } = useDraggable('printable_invoice_modal');

  if (!isOpen) return null;

  // Payment Status resolution
  const statusLower = (payment.status || '').toLowerCase();
  const isPaid = statusLower === 'received' || statusLower === 'paid' || statusLower === 'completed';
  const isRefunded = statusLower === 'refunded';
  const isFailed = statusLower === 'failed';
  const isUnpaid = !isPaid && !isRefunded && !isFailed;

  const invoiceCode = payment.invoiceNumber || `INV-2026-${payment.id.slice(-4).toUpperCase()}`;
  const clientId = payment.clientId || `CLT-2026-${payment.id.slice(-4).toUpperCase()}`;

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  const formatISTDate = (timestamp?: number | null) => {
    if (!timestamp) return 'On Delivery';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp));
  };

  const clientName = payment.clientName || 'Valued Client';
  const clientEmail = payment.clientEmail || '—';
  const clientPhone = payment.clientPhone || '—';

  // Format real payment method from Razorpay
  const formatPaymentMethod = (method?: string | null): string => {
    if (!method) return 'UPI / Online';
    const m = method.toLowerCase();
    if (m.includes('upi')) return 'UPI / Online';
    if (m.includes('card')) return 'Credit / Debit Card';
    if (m.includes('netbanking')) return 'NetBanking';
    if (m.includes('wallet')) return 'Digital Wallet';
    return method;
  };

  const paymentMode = isPaid
    ? formatPaymentMethod(payment.paymentMethod)
    : 'Online Checkout / UPI';

  // Real Razorpay Transaction Ref ID
  const transactionRef = payment.razorpayPaymentId
    ? payment.razorpayPaymentId
    : isPaid
    ? (payment.id.startsWith('pay_') ? payment.id : `pay_${payment.id.replace(/[^a-zA-Z0-9]/g, '').slice(-14)}`)
    : 'Pending Online Checkout';

  // Parse custom items or derive from payment
  let items: Array<{ num: number; desc: string; qty: number; rate: number; amount: number }> = [];
  if (payment.itemsJson) {
    try {
      items = JSON.parse(payment.itemsJson);
    } catch {
      // fallback
    }
  }

  if (items.length === 0) {
    items = [
      {
        num: 1,
        desc: payment.title || 'Advance Milestone: Engineering & Design Initiation & Architecture',
        qty: 1,
        rate: payment.amount,
        amount: payment.amount,
      },
    ];
  }

  // Derive payment category
  const titleLower = (payment.title || '').toLowerCase();
  const notesLower = (payment.notes || '').toLowerCase();
  const isAdvance = titleLower.includes('advance') || notesLower.includes('advance');
  const isPart = titleLower.includes('part') || notesLower.includes('part');
  const isFinal = titleLower.includes('final') || notesLower.includes('final');
  const pctMatch = (payment.title || '').match(/(\d+)%/);
  const advancePercent = pctMatch ? parseInt(pctMatch[1], 10) : (isAdvance ? 40 : 100);

  // Dynamic Payment Terms & Notes based on custom description + payment category
  const getTermsAndNotes = (): string[] => {
    const list: string[] = [];
    const projectName = payment.projectTitle || payment.title || 'Engineering & Software Architecture';

    // 1. If user provided a specific description in Create Payment Link, show it upfront!
    if (payment.notes && payment.notes.trim().length > 0) {
      list.push(payment.notes.trim());
    }

    // 2. Intelligent Contextual Milestone Bullet Templates
    if (isAdvance && advancePercent < 100) {
      const estimatedTotal = Math.round(payment.amount / (advancePercent / 100));
      const remainingBalance = Math.max(0, estimatedTotal - payment.amount);

      list.push(
        `This invoice covers the ${advancePercent}% advance milestone payment of ${formatCurrency(payment.amount)} for project "${projectName}".`
      );
      if (remainingBalance > 0) {
        list.push(
          `Remaining balance of ${formatCurrency(remainingBalance)} (${100 - advancePercent}%) will be payable upon final milestone approval and production deployment.`
        );
      }
    } else if (isPart) {
      list.push(
        `This invoice covers an interim part payment towards active development milestones for "${projectName}".`
      );
      list.push(
        `Deliverables are updated continuously on staging environments for ongoing review and validation.`
      );
    } else if (isFinal) {
      list.push(
        `This invoice represents the final payment settlement for project "${projectName}".`
      );
      list.push(
        `Upon settlement, full source code handover, production infrastructure keys, and warranty support are activated.`
      );
    } else {
      list.push(
        `This invoice confirms full 100% payment settlement of ${formatCurrency(payment.amount)} for "${projectName}". All engineering services are fully settled.`
      );
    }

    // 3. Payment Mode & Settlement State
    if (isPaid) {
      list.push(
        `Payment verified and received successfully via ${paymentMode} (Transaction Ref: ${transactionRef}).`
      );
    } else if (isRefunded) {
      list.push(
        `This invoice has been refunded back to original source account. Reference: ${transactionRef}.`
      );
    } else if (isFailed) {
      list.push(
        `Payment transaction could not be completed. Please retry or regenerate payment link.`
      );
    } else {
      list.push(
        `Payment is due upon receipt and can be fulfilled instantly via UPI, Credit/Debit Cards, or NetBanking.`
      );
    }

    list.push(
      'The milestone fee is non-refundable and will be adjusted against the total contracted engineering scope.'
    );

    return list;
  };

  const termsAndNotes = getTermsAndNotes();

  // Clean Download PDF using original authentic single-page structure
  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    try {
      const html2pdf = await loadHtml2Pdf();
      const element = document.getElementById('invoice-container') || invoiceRef.current;
      if (!element) {
        window.print();
        return;
      }

      const opt = {
        margin: [8, 8, 8, 8],
        filename: `${invoiceCode}_${clientName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#FFFFFF',
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.warn('[html2pdf fallback to native print]:', err);
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  // Clean print handler
  const handlePrintOnly = () => {
    window.print();
  };

  const paidAmount = isPaid ? payment.amount : 0;
  const balanceDue = isPaid ? 0 : payment.amount;

  return (
    <div
      data-lenis-prevent="true"
      className="printable-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Print-specific style ensuring 100% clean rendering and no blank pages */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          html, body {
            background: #FFFFFF !important;
            color: #1A085C !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          body > *:not(.printable-modal-overlay) {
            display: none !important;
          }
          .printable-modal-overlay {
            position: static !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #FFFFFF !important;
            overflow: visible !important;
            backdrop-filter: none !important;
          }
          .popup-card {
            position: static !important;
            transform: none !important;
            max-width: 100% !important;
            max-height: none !important;
            height: auto !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            background: #FFFFFF !important;
          }
          .print-hidden-control {
            display: none !important;
          }
          #invoice-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 6mm 4mm !important;
            box-shadow: none !important;
            border: none !important;
            background: #FFFFFF !important;
            overflow: visible !important;
          }
        }
      `}</style>

      {/* Moveable Modal Container matching other CRM cards */}
      <div
        ref={cardRef}
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        className="popup-card relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================= */}
        {/* 4-SIDE DRAG GRIPS (Left & Right Edge Drag Strips)         */}
        {/* ========================================================= */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          className="print-hidden-control absolute left-0 top-12 bottom-4 w-3.5 z-30 cursor-grab active:cursor-grabbing hover:bg-purple-500/10 transition-colors"
          style={{ touchAction: 'none' }}
          title="Drag left border to move card"
        />
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          className="print-hidden-control absolute right-0 top-12 bottom-4 w-3.5 z-30 cursor-grab active:cursor-grabbing hover:bg-purple-500/10 transition-colors"
          style={{ touchAction: 'none' }}
          title="Drag right border to move card"
        />

        {/* ========================================================= */}
        {/* TOP TITLE & CONTROL BAR (Hidden on print)                 */}
        {/* ========================================================= */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          style={{ touchAction: 'none' }}
          className="print-hidden-control h-13 px-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-[#F8F7FF] shrink-0 z-20 cursor-grab active:cursor-grabbing select-none"
          title="Click and drag from header or edges to move • Double-click to reset position"
        >
          {/* Left: Document Info */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-black text-[#1A085C] uppercase tracking-wider">
              Official Invoice
            </span>
            <span className="text-xs font-mono font-bold text-[#5B4CF5]">
              {invoiceCode}
            </span>
          </div>

          {/* Center: Draggable grip indicator */}
          <div
            className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F3F0FF] text-[#7C5CE8] text-[11px] font-semibold"
            title="Drag from 4 sides or header to move"
          >
            <GripHorizontal size={14} />
            <span>Move</span>
          </div>

          {/* Right: Icon-only Action Controls */}
          <div className="flex items-center gap-2" data-no-drag="true">
            {payment.razorpayPaymentLinkUrl && !isPaid && (
              <a
                href={payment.razorpayPaymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="h-8 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs mr-1"
                title="Open Online Payment Link"
              >
                <span>Pay Online</span>
                <ExternalLink size={12} />
              </a>
            )}

            {/* 1. Eye Icon: Official View Indicator */}
            <div
              className="w-8 h-8 rounded-full bg-[#F3F0FF] text-[#5B4CF5] border border-purple-200 flex items-center justify-center shadow-2xs"
              title="Official Verified Invoice View"
            >
              <Eye size={15} />
            </div>

            {/* 2. Download Icon: High Quality PDF Export */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              style={{
                background: 'linear-gradient(135deg, #5B4CF5 0%, #7C5CE8 100%)',
                boxShadow: '0 2px 10px rgba(91, 76, 245, 0.35)',
              }}
              className="w-8 h-8 rounded-full text-white flex items-center justify-center transition-all hover:brightness-110 cursor-pointer disabled:opacity-60 shadow-2xs"
              title="Download Clean Invoice PDF"
            >
              {isGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
            </button>

            {/* 3. Print Icon: Native Clean Print */}
            <button
              onClick={handlePrintOnly}
              className="w-8 h-8 rounded-full bg-white border border-[#E5E1F0] text-[#1A085C] hover:bg-slate-50 hover:text-[#5B4CF5] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              title="Print Invoice"
            >
              <Printer size={14} className="text-[#5B4CF5]" />
            </button>

            {/* 4. Close Icon */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-[#6B7280] hover:text-[#1A085C] hover:bg-purple-100/60 flex items-center justify-center transition-colors cursor-pointer ml-1"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Printable Invoice Sheet Container: id="invoice-container" */}
        {/* Exactly preserves the original authentic layout & margins */}
        {/* ========================================================= */}
        <div
          ref={invoiceRef}
          id="invoice-container"
          style={{ backgroundColor: '#FFFFFF' }}
          className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-10 bg-white font-sans text-slate-900 space-y-6"
        >
          {/* ========================================================= */}
          {/* 1. BRAND HEADER: Info (#1A085C), HQ (#5B4CF5)             */}
          {/* ========================================================= */}
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl sm:text-[26px] font-black tracking-tight leading-none">
                <span className="text-[#1A085C]">Info</span>
                <span className="text-[#5B4CF5]">HQ</span>{' '}
                <span className="text-[#1A085C]">Pvt Ltd</span>
              </h1>
              <p className="text-[11px] sm:text-xs font-semibold text-[#4B5563] mt-1 tracking-tight">
                Engineering Studio for AI, SaaS &amp; Digital Systems
              </p>
            </div>

            {/* Brand Purple Gradient Accent Bar */}
            <div
              className="w-full h-[2.5px] rounded-full"
              style={{
                background: 'linear-gradient(90deg, #5B4CF5 0%, #7C5CE8 50%, #E85AA0 100%)',
              }}
            />
          </div>

          {/* ========================================================= */}
          {/* 2. INVOICE TITLE & INVOICE NUMBER (NO PILL BOX)           */}
          {/* ========================================================= */}
          <div className="space-y-1.5 pt-1">
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A085C] tracking-tight uppercase">
              INVOICE
            </h2>

            {/* Clean plain typography - no pill background */}
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#6B7280]">
              <span>Invoice No.</span>
              <span
                style={{ color: '#5B4CF5' }}
                className="font-extrabold font-mono text-sm sm:text-base tracking-wide"
              >
                {invoiceCode}
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. TWO-COLUMN METADATA SECTION                            */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
            {/* Left Column: Bill To */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-[#6B7280] tracking-wide block uppercase">
                Bill To
              </span>
              <h3 className="text-base sm:text-lg font-black text-[#1A085C] tracking-tight leading-snug">
                {clientName}
              </h3>
              {clientEmail !== '—' && (
                <div className="text-xs font-medium text-[#374151]">{clientEmail}</div>
              )}
              {clientPhone !== '—' && (
                <div className="text-xs font-medium text-[#374151]">{clientPhone}</div>
              )}

              {/* Clean Account ID text without pill background */}
              <div className="pt-1.5 text-xs">
                <span className="text-[#6B7280] font-semibold mr-1.5">Account ID:</span>
                <span className="font-mono font-bold text-[#1A085C]">{clientId}</span>
              </div>
            </div>

            {/* Right Column: Key-Value Meta Aligned with Colon */}
            <div className="text-xs font-medium space-y-1.5 sm:pl-4">
              <div className="grid grid-cols-[110px_12px_1fr] items-center">
                <span className="text-[#6B7280] font-semibold">Client ID</span>
                <span className="text-[#9CA3AF] font-bold">:</span>
                <span className="font-mono font-bold text-[#1A085C]">{clientId}</span>
              </div>

              <div className="grid grid-cols-[110px_12px_1fr] items-center">
                <span className="text-[#6B7280] font-semibold">Issue Date</span>
                <span className="text-[#9CA3AF] font-bold">:</span>
                <span className="font-bold text-[#1A085C]">{formatISTDate(payment.createdAt)}</span>
              </div>

              <div className="grid grid-cols-[110px_12px_1fr] items-center">
                <span className="text-[#6B7280] font-semibold">Payment Date</span>
                <span className="text-[#9CA3AF] font-bold">:</span>
                <span className="font-bold text-[#1A085C]">
                  {isPaid ? formatISTDate(payment.paidAt || payment.createdAt) : 'Pending'}
                </span>
              </div>

              <div className="grid grid-cols-[110px_12px_1fr] items-center">
                <span className="text-[#6B7280] font-semibold">Payment Mode</span>
                <span className="text-[#9CA3AF] font-bold">:</span>
                <span className="font-bold text-[#1A085C]">{paymentMode}</span>
              </div>

              <div className="grid grid-cols-[110px_12px_1fr] items-center">
                <span className="text-[#6B7280] font-semibold">Transaction Ref.</span>
                <span className="text-[#9CA3AF] font-bold">:</span>
                <span className="font-mono font-bold text-[#1A085C] text-[11px] truncate" title={transactionRef}>
                  {transactionRef}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 4. ITEMS TABLE (Royal Purple Header)                      */}
          {/* ========================================================= */}
          <div className="rounded-xl overflow-hidden border border-[#E9D5FF] shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead
                style={{
                  background: 'linear-gradient(90deg, #5B4CF5 0%, #6938EF 100%)',
                }}
                className="text-white text-[11px] font-bold tracking-wide"
              >
                <tr>
                  <th className="py-2.5 px-3.5 w-10 text-center font-black">#</th>
                  <th className="py-2.5 px-4 font-black">Description</th>
                  <th className="py-2.5 px-3 text-center w-14 font-black">Qty</th>
                  <th className="py-2.5 px-4 text-right w-24 font-black">Unit Price</th>
                  <th className="py-2.5 px-4 text-right w-28 font-black">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDF9] bg-white">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#FAF9FF]/60 transition-colors">
                    <td className="py-3 px-3.5 text-center font-bold text-[#1A085C]">
                      {item.num}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#1A085C] leading-snug">
                      {item.desc}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums font-semibold text-[#374151]">
                      {item.qty}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-[#374151]">
                      {formatCurrency(item.rate)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-black text-[#1A085C]">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ========================================================= */}
          {/* 5. PAYMENT TERMS & TOTALS CALCULATION WITH LEFT-SHIFTED STAMP */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start pt-1">
            {/* Left Box: Payment Terms & Notes (Dynamic) */}
            <div className="p-4 rounded-xl bg-[#FAF8FF] border border-[#E9D5FF] space-y-2.5">
              <h4 className="text-xs sm:text-[13px] font-extrabold text-[#1A085C] tracking-tight">
                Payment Terms &amp; Notes
              </h4>
              <ul className="space-y-1.5 text-[11px] leading-relaxed text-[#4B5563]">
                {termsAndNotes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5B4CF5] mt-1 shrink-0" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Box: Totals & Authentic Stamp (Shifted Left to avoid amount numbers) */}
            <div className="relative p-4 rounded-xl bg-[#FAF8FF] border border-[#E9D5FF] space-y-2 text-xs">
              {/* Authentic Rotated Stamp: Located inside totals box, shifted to left so amount values are 100% visible */}
              <div className="absolute left-8 sm:left-14 bottom-3 pointer-events-none select-none z-10">
                {isPaid && (
                  <div
                    style={{
                      transform: 'rotate(-12deg)',
                      boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.2)',
                    }}
                    className="border-[2.5px] border-emerald-600/90 text-emerald-600 font-black tracking-widest text-lg sm:text-xl px-3.5 py-1 rounded-lg uppercase opacity-90 font-mono inline-block bg-white/80 backdrop-blur-2xs"
                  >
                    PAID
                  </div>
                )}
                {isUnpaid && (
                  <div
                    style={{
                      transform: 'rotate(-12deg)',
                      boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.2)',
                    }}
                    className="border-[2.5px] border-amber-600/90 text-amber-600 font-black tracking-widest text-lg sm:text-xl px-3.5 py-1 rounded-lg uppercase opacity-90 font-mono inline-block bg-white/80 backdrop-blur-2xs"
                  >
                    UNPAID
                  </div>
                )}
                {isRefunded && (
                  <div
                    style={{
                      transform: 'rotate(-12deg)',
                      boxShadow: '0 0 0 1px rgba(124, 92, 232, 0.2)',
                    }}
                    className="border-[2.5px] border-[#7C5CE8] text-[#7C5CE8] font-black tracking-widest text-lg sm:text-xl px-3.5 py-1 rounded-lg uppercase opacity-90 font-mono inline-block bg-white/80 backdrop-blur-2xs"
                  >
                    REFUNDED
                  </div>
                )}
                {isFailed && (
                  <div
                    style={{
                      transform: 'rotate(-12deg)',
                      boxShadow: '0 0 0 1px rgba(220, 38, 38, 0.2)',
                    }}
                    className="border-[2.5px] border-rose-600 text-rose-600 font-black tracking-widest text-lg sm:text-xl px-3.5 py-1 rounded-lg uppercase opacity-90 font-mono inline-block bg-white/80 backdrop-blur-2xs"
                  >
                    FAILED
                  </div>
                )}
              </div>

              {/* Subtotal */}
              <div className="flex justify-between items-center text-[#4B5563]">
                <span className="font-medium">Subtotal</span>
                <span className="font-bold text-[#1A085C] tabular-nums">
                  {formatCurrency(payment.amount)}
                </span>
              </div>

              {/* Tax / GST */}
              <div className="flex justify-between items-center text-[#4B5563]">
                <span className="font-medium">Tax / GST</span>
                <span className="font-semibold text-[#1A085C]">Nil / Exempt</span>
              </div>

              {/* Total Amount in Brand Purple */}
              <div className="flex justify-between items-center py-1.5 border-y border-[#E9D5FF] text-sm sm:text-base font-black text-[#5B4CF5]">
                <span>Total Amount</span>
                <span className="tabular-nums font-black">
                  {formatCurrency(payment.amount)}
                </span>
              </div>

              {/* Total Settled */}
              <div className="flex justify-between items-center text-[#4B5563] pt-0.5">
                <span className="font-medium">Total Settled</span>
                <span className="font-bold text-[#1A085C] tabular-nums">
                  {formatCurrency(paidAmount)}
                </span>
              </div>

              {/* Balance Due */}
              <div className="flex justify-between items-center pt-1 border-t border-[#E9D5FF] text-xs">
                <span className="font-bold text-[#15803D]">Balance Due</span>
                <span
                  className={`font-black text-sm tabular-nums ${
                    isPaid ? 'text-[#15803D]' : 'text-rose-600'
                  }`}
                >
                  {isPaid ? '₹0.00' : formatCurrency(balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 6. FOOTER SIGN-OFF                                        */}
          {/* ========================================================= */}
          <div className="pt-6 border-t border-[#E5E7EB] text-center text-xs space-y-1">
            <p className="font-bold text-[#1A085C] text-xs sm:text-sm">
              <span className="text-[#1A085C]">Info</span>
              <span className="text-[#5B4CF5]">HQ</span>{' '}
              <span className="text-[#1A085C]">Pvt Ltd</span> &nbsp;•&nbsp; Prayagraj, Uttar Pradesh, India
            </p>
            <p className="text-[11px] font-medium text-[#4B5563]">
              billing@infohq.in &nbsp;&nbsp;|&nbsp;&nbsp; infohq.in
            </p>
            <p className="text-[10px] text-[#9CA3AF] pt-1">
              This is a computer-generated tax invoice verified by InfoHQ Command Center.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

