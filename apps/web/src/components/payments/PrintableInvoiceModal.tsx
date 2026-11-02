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
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
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
  const [zoomMode, setZoomMode] = useState<'fit' | 'actual'>('fit');

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
        `Payment transaction could not be completed. Please regenerate a new payment link or retry.`
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

  // Robust Download PDF handler with guaranteed Invoice Number visibility
  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    try {
      const html2pdf = await loadHtml2Pdf();
      const element = document.getElementById('invoice-container') || invoiceRef.current;
      if (!element) {
        handlePrintOnly();
        return;
      }

      // Clone element cleanly or configure html2pdf with explicit rendering parameters
      const opt = {
        margin: [6, 6, 6, 6],
        filename: `${invoiceCode}_${clientName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#FFFFFF',
          letterRendering: true,
          windowWidth: 1024,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.warn('[html2pdf fallback to clean iframe print]:', err);
      handlePrintOnly();
    } finally {
      setIsGenerating(false);
    }
  };

  // Bulletproof print using isolated iframe (fixes blank print bug permanently)
  const handlePrintOnly = () => {
    const element = document.getElementById('invoice-container') || invoiceRef.current;
    if (!element) {
      window.print();
      return;
    }

    // Create an isolated hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Collect all head stylesheets and styles from parent
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${invoiceCode} - ${clientName}</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 0;
              background: #FFFFFF !important;
              color: #1A085C !important;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            #invoice-container {
              width: 100% !important;
              max-width: 100% !important;
              min-height: 100vh !important;
              box-shadow: none !important;
              border: none !important;
              padding: 4mm 2mm !important;
              margin: 0 auto !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
            }
          </style>
        </head>
        <body>
          ${element.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error('Iframe print error:', e);
        window.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 3000);
      }
    }, 350);
  };

  const paidAmount = isPaid ? payment.amount : 0;
  const balanceDue = isPaid ? 0 : payment.amount;

  return (
    <div
      data-lenis-prevent="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Moveable Modal Container matching other CRM cards */}
      <div
        ref={cardRef}
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        className="popup-card relative w-full max-w-[860px] h-[calc(100vh-2.5rem)] max-h-[94vh] bg-[#F8F7FF] rounded-3xl shadow-[0_25px_60px_-15px_rgba(26,8,92,0.35)] border border-[#E5E1F0] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================= */}
        {/* 4-SIDE DRAG GRIPS (Left & Right Edge Drag Strips)         */}
        {/* ========================================================= */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          className="absolute left-0 top-12 bottom-4 w-3.5 z-30 cursor-grab active:cursor-grabbing hover:bg-purple-500/10 transition-colors"
          style={{ touchAction: 'none' }}
          title="Drag left border to move card"
        />
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          className="absolute right-0 top-12 bottom-4 w-3.5 z-30 cursor-grab active:cursor-grabbing hover:bg-purple-500/10 transition-colors"
          style={{ touchAction: 'none' }}
          title="Drag right border to move card"
        />

        {/* ========================================================= */}
        {/* TOP TITLE & CONTROL BAR (Pinned at top & Top Drag Handle) */}
        {/* ========================================================= */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          style={{ touchAction: 'none' }}
          className="h-14 px-4 sm:px-6 border-b border-[#E5E1F0] flex items-center justify-between bg-white shrink-0 z-20 cursor-grab active:cursor-grabbing select-none"
          title="Click and drag from header or edges to move • Double-click to reset position"
        >
          {/* Left: Document Info */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-black text-[#1A085C] uppercase tracking-wider">
              Official Invoice
            </span>
            <span className="text-xs font-mono font-extrabold text-[#5B4CF5]">
              {invoiceCode}
            </span>
          </div>

          {/* Center: Draggable grip indicator */}
          <div
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F3F0FF] text-[#7C5CE8] text-[11px] font-semibold"
            title="Drag from 4 sides or header to move"
          >
            <GripHorizontal size={14} />
            <span>Move</span>
          </div>

          {/* Right: Icon-only Action Controls (Eye, Download, Print, Close) */}
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

            {/* 1. Eye Icon: Toggle Fit / Zoom Preview */}
            <button
              onClick={() => setZoomMode((prev) => (prev === 'fit' ? 'actual' : 'fit'))}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                zoomMode === 'actual'
                  ? 'bg-[#5B4CF5] text-white border-[#5B4CF5] shadow-xs'
                  : 'bg-white text-[#1A085C] border-[#E5E1F0] hover:text-[#5B4CF5] hover:border-[#5B4CF5] hover:bg-purple-50/50'
              }`}
              title={zoomMode === 'actual' ? 'Viewing 100% A4 Scale (Click to fit)' : 'Viewing Fit-to-screen (Click for 100% scale)'}
            >
              <Eye size={15} />
            </button>

            {/* 2. Download Icon: High Quality PDF Export */}
            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              style={{
                background: 'linear-gradient(135deg, #5B4CF5 0%, #7C5CE8 100%)',
                boxShadow: '0 2px 8px rgba(91, 76, 245, 0.35)',
              }}
              className="w-8 h-8 rounded-full text-white flex items-center justify-center transition-all hover:brightness-110 cursor-pointer disabled:opacity-60"
              title="Download clean A4 PDF"
            >
              {isGenerating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
            </button>

            {/* 3. Print Icon: Direct Clean Iframe Print */}
            <button
              onClick={handlePrintOnly}
              className="w-8 h-8 rounded-full bg-white border border-[#E5E1F0] text-[#1A085C] hover:text-[#5B4CF5] hover:border-[#5B4CF5] hover:bg-purple-50/50 flex items-center justify-center transition-all shadow-2xs cursor-pointer"
              title="Print Invoice"
            >
              <Printer size={15} className="text-[#5B4CF5]" />
            </button>

            {/* 4. Close Icon */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-[#6B7280] hover:text-[#1A085C] hover:bg-[#F3F0FF] flex items-center justify-center transition-colors cursor-pointer ml-1"
              title="Close Invoice"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SCROLLABLE VIEWPORT FOR TRUE A4 CANVAS                    */}
        {/* ========================================================= */}
        <div
          className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 md:p-8 bg-slate-100/70"
          data-lenis-prevent="true"
        >
          {/* ========================================================= */}
          {/* TRUE A4 INVOICE SHEET: id="invoice-container"             */}
          {/* Max Width 794px, Min Height 1123px (A4 Ratio)             */}
          {/* ========================================================= */}
          <div
            ref={invoiceRef}
            id="invoice-container"
            style={{
              backgroundColor: '#FFFFFF',
              width: zoomMode === 'actual' ? '794px' : '100%',
              maxWidth: '794px',
              minHeight: '1123px',
            }}
            className="mx-auto bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 sm:p-12 md:p-14 font-sans text-slate-900 flex flex-col justify-between transition-all"
          >
            {/* Top & Main Body Section */}
            <div className="space-y-7">
              {/* ========================================================= */}
              {/* 1. BRAND HEADER: Info (Navy #1A085C), HQ (Violet #5B4CF5) */}
              {/* ========================================================= */}
              <div className="space-y-3">
                <div>
                  <h1 className="text-2xl sm:text-[28px] font-black tracking-tight leading-none">
                    <span className="text-[#1A085C]">Info</span>
                    <span className="text-[#5B4CF5]">HQ</span>{' '}
                    <span className="text-[#1A085C]">Pvt Ltd</span>
                  </h1>
                  <p className="text-xs sm:text-[13px] font-semibold text-[#4B5563] mt-1 tracking-tight">
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
              {/* 2. INVOICE TITLE & INVOICE NUMBER (NO PILL BACKGROUND)    */}
              {/* ========================================================= */}
              <div className="space-y-1 pt-1">
                <h2 className="text-2xl sm:text-3xl font-black text-[#1A085C] tracking-tight uppercase">
                  INVOICE
                </h2>

                {/* Clean Plain Typography (Zero Pill Box) */}
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#6B7280]">
                  <span>Invoice No.</span>
                  <span
                    id="invoice-number-text"
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
                {/* Left Column: Bill To (Clean Plain Account ID) */}
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
                    <span
                      className="font-mono font-bold text-[#1A085C] text-[11px] truncate"
                      title={transactionRef}
                    >
                      {transactionRef}
                    </span>
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* 4. ITEMS TABLE (Royal Purple Header #5B4CF5)              */}
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
                      <th className="py-2.5 px-4 text-right w-28 font-black">Unit Price</th>
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
              {/* 5. PAYMENT TERMS & TOTALS CALCULATION WITH LEFT STAMP     */}
              {/* ========================================================= */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-1">
                {/* Left Box: Payment Terms & Notes + Authentic Status Stamp */}
                <div className="p-4 sm:p-5 rounded-xl bg-[#FAF8FF] border border-[#E9D5FF] flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
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

                  {/* Stamp Container on the LEFT (Never overlaps amounts/totals) */}
                  <div className="pt-2 flex items-center justify-start select-none pointer-events-none">
                    {isPaid && (
                      <div
                        style={{
                          transform: 'rotate(-8deg)',
                          boxShadow: '0 2px 8px rgba(22, 163, 74, 0.15)',
                        }}
                        className="border-[2.5px] border-emerald-600 text-emerald-600 bg-emerald-50/90 font-black tracking-widest text-base sm:text-lg px-4 py-1 rounded-lg uppercase font-mono inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={16} />
                        <span>PAID</span>
                      </div>
                    )}

                    {isUnpaid && (
                      <div
                        style={{
                          transform: 'rotate(-8deg)',
                          boxShadow: '0 2px 8px rgba(217, 119, 6, 0.15)',
                        }}
                        className="border-[2.5px] border-amber-600 text-amber-600 bg-amber-50/90 font-black tracking-widest text-base sm:text-lg px-4 py-1 rounded-lg uppercase font-mono inline-flex items-center gap-1.5"
                      >
                        <Clock size={16} />
                        <span>UNPAID</span>
                      </div>
                    )}

                    {isRefunded && (
                      <div
                        style={{
                          transform: 'rotate(-8deg)',
                          boxShadow: '0 2px 8px rgba(124, 92, 232, 0.15)',
                        }}
                        className="border-[2.5px] border-[#7C5CE8] text-[#7C5CE8] bg-purple-50/90 font-black tracking-widest text-base sm:text-lg px-4 py-1 rounded-lg uppercase font-mono inline-flex items-center gap-1.5"
                      >
                        <RotateCcw size={16} />
                        <span>REFUNDED</span>
                      </div>
                    )}

                    {isFailed && (
                      <div
                        style={{
                          transform: 'rotate(-8deg)',
                          boxShadow: '0 2px 8px rgba(220, 38, 38, 0.15)',
                        }}
                        className="border-[2.5px] border-rose-600 text-rose-600 bg-rose-50/90 font-black tracking-widest text-base sm:text-lg px-4 py-1 rounded-lg uppercase font-mono inline-flex items-center gap-1.5"
                      >
                        <AlertCircle size={16} />
                        <span>FAILED</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Box: Clean Totals Calculation (Free from any overlapping stamps) */}
                <div className="p-4 sm:p-5 rounded-xl bg-[#FAF8FF] border border-[#E9D5FF] space-y-2.5 text-xs">
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
                  <div className="flex justify-between items-center py-2 border-y border-[#E9D5FF] text-sm sm:text-base font-black text-[#5B4CF5]">
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
                  <div className="flex justify-between items-center pt-1.5 border-t border-[#E9D5FF] text-xs">
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
            </div>

            {/* ========================================================= */}
            {/* 6. PINNED FOOTER SIGN-OFF (Strictly at Bottom of A4)      */}
            {/* ========================================================= */}
            <div className="mt-auto pt-8 border-t border-[#E5E7EB] text-center text-xs space-y-1">
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
    </div>
  );
};

