import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Payment } from '@infohq/shared';
import { updatePaymentApi } from '../../lib/api.js';
import {
  X,
  Printer,
  Download,
  Eye,
  ExternalLink,
  Loader2,
  GripHorizontal,
  Edit3,
  Save,
  Check,
} from 'lucide-react';
import { useDraggable } from '../../lib/useDraggable.js';

interface PrintableInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment;
  onPaymentUpdated?: (updated: Payment) => void;
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
  onPaymentUpdated,
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { getToken } = useAuth();

  // Draggable window state matching Client Profile & Create Payment modals
  const { cardRef, position, handlePointerDown, resetPosition } = useDraggable('printable_invoice_modal');

  // Local payment state for immediate update reflection
  const [currentPayment, setCurrentPayment] = useState<Payment>(payment);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(payment.title || '');
  const [editNotes, setEditNotes] = useState(payment.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPayment(payment);
    setEditTitle(payment.title || '');
    setEditNotes(payment.notes || '');
  }, [payment]);

  if (!isOpen) return null;

  // Payment Status resolution
  const statusLower = (currentPayment.status || '').toLowerCase();
  const isPaid = statusLower === 'received' || statusLower === 'paid' || statusLower === 'completed';
  const isRefunded = statusLower === 'refunded';
  const isFailed = statusLower === 'failed';
  const expiresAt = currentPayment.expiresAt || (currentPayment.razorpayPaymentLinkId ? currentPayment.createdAt + 24 * 60 * 60 * 1000 : null);
  const isExpired = !isPaid && (statusLower === 'expired' || (expiresAt ? expiresAt < Date.now() : false));
  const isUnpaid = !isPaid && !isRefunded && !isFailed && !isExpired;

  const invoiceCode = currentPayment.invoiceNumber || `INV-2026-${currentPayment.id.slice(-4).toUpperCase()}`;
  const clientId = currentPayment.clientId || `CLT-2026-${currentPayment.id.slice(-4).toUpperCase()}`;

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

  const clientName = currentPayment.clientName || 'Valued Client';
  const clientEmail = currentPayment.clientEmail || '—';
  const clientPhone = currentPayment.clientPhone || '—';

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
    ? formatPaymentMethod(currentPayment.paymentMethod)
    : 'Online Checkout / UPI';

  // Real Razorpay Transaction Ref ID
  const transactionRef = currentPayment.razorpayPaymentId
    ? currentPayment.razorpayPaymentId
    : isPaid
    ? (currentPayment.id.startsWith('pay_') ? currentPayment.id : `pay_${currentPayment.id.replace(/[^a-zA-Z0-9]/g, '').slice(-14)}`)
    : 'Pending Online Checkout';

  // Parse custom items or derive from payment
  let items: Array<{ num: number; desc: string; qty: number; rate: number; amount: number }> = [];
  if (currentPayment.itemsJson) {
    try {
      items = JSON.parse(currentPayment.itemsJson);
    } catch {
      // fallback
    }
  }

  if (items.length === 0) {
    items = [
      {
        num: 1,
        desc: currentPayment.title || 'Project Milestone Delivery',
        qty: 1,
        rate: currentPayment.amount,
        amount: currentPayment.amount,
      },
    ];
  }

  // Handle saving inline invoice edits
  const handleSaveInvoiceEdit = async () => {
    if (!editTitle.trim()) {
      setSaveError('Milestone Title is required.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await updatePaymentApi(getToken, currentPayment.id, {
        title: editTitle.trim(),
        notes: editNotes.trim(),
      });
      setCurrentPayment(res.payment);
      onPaymentUpdated?.(res.payment);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 700);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // Clean Download PDF: Direct client render of #invoice-container matching screen 1:1
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
        margin: [0, 0, 0, 0],
        filename: `${invoiceCode}_${clientName.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#FFFFFF',
          windowWidth: 794,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (clientErr) {
      console.warn('[Client HTML2PDF failed, falling back to print]:', clientErr);
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  // Clean print handler
  const handlePrintOnly = () => {
    window.print();
  };

  // Reconciled Financials (No GST)
  const baseAmount = currentPayment.amount;
  const recordedSettled = isPaid ? currentPayment.amount : 0;
  const paidAmount = recordedSettled;
  const balanceDue = Math.max(0, baseAmount - paidAmount);

  return (
    <div
      data-lenis-prevent="true"
      className="printable-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Print-specific style: Exact A4 full-page, zero bottom gap, pinned footer, never blank page */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            background: #FFFFFF !important;
            color: #1A085C !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide surrounding app elements */
          header, nav, aside, .sidebar, .app-layout {
            display: none !important;
          }
          /* Keep #root visible but hide everything inside except printable overlay */
          body * {
            visibility: hidden;
          }
          .printable-modal-overlay,
          .printable-modal-overlay *,
          #invoice-container,
          #invoice-container * {
            visibility: visible !important;
          }
          .print-hidden-control {
            display: none !important;
            visibility: hidden !important;
          }
          .printable-modal-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #FFFFFF !important;
            overflow: visible !important;
            backdrop-filter: none !important;
            z-index: 999999 !important;
          }
          .popup-card {
            position: static !important;
            transform: none !important;
            max-width: 100% !important;
            max-height: none !important;
            height: auto !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #FFFFFF !important;
          }
          #invoice-container {
            position: relative !important;
            width: 210mm !important;
            max-width: 210mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            box-sizing: border-box !important;
            padding: 12mm 14mm 10mm 14mm !important;
            margin: 0 auto !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-shadow: none !important;
            border: none !important;
            background: #FFFFFF !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
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

          {/* Right: Action Controls */}
          <div className="flex items-center gap-2" data-no-drag="true">
            {currentPayment.razorpayPaymentLinkUrl && !isPaid && (
              <a
                href={currentPayment.razorpayPaymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="h-8 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs mr-1"
                title="Open Online Payment Link"
              >
                <span>Pay Online</span>
                <ExternalLink size={12} />
              </a>
            )}

            {/* Edit Invoice Button */}
            <button
              type="button"
              onClick={() => {
                setEditTitle(currentPayment.title || '');
                setEditNotes(currentPayment.notes || '');
                setSaveError(null);
                setIsEditing(!isEditing);
              }}
              disabled={isGenerating}
              className={`h-8 px-2.5 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                isEditing
                  ? 'bg-purple-100 text-[#5B4CF5] border-purple-300'
                  : 'bg-white text-[#6B7280] border-[#E5E1F0] hover:text-[#1A085C] hover:bg-slate-50'
              }`}
              title="Edit Milestone Title & Description"
            >
              <Edit3 size={13} />
              <span>{isEditing ? 'Close Edit' : 'Edit'}</span>
            </button>

            {/* 1. Eye Icon: Official View Indicator */}
            <div
              className="w-8 h-8 rounded-full bg-[#F3F0FF] text-[#5B4CF5] border border-purple-200 flex items-center justify-center shadow-2xs"
              title="Official Verified Invoice View"
            >
              <Eye size={15} />
            </div>

            {/* 2. Download Icon: High Quality PDF Export */}
            <button
              type="button"
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
              type="button"
              onClick={handlePrintOnly}
              className="w-8 h-8 rounded-full bg-white border border-[#E5E1F0] text-[#1A085C] hover:bg-slate-50 hover:text-[#5B4CF5] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              title="Print Invoice"
            >
              <Printer size={14} className="text-[#5B4CF5]" />
            </button>

            {/* 4. Close Icon */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full text-[#6B7280] hover:text-[#1A085C] hover:bg-purple-100/60 flex items-center justify-center transition-colors cursor-pointer ml-1"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* INLINE EDIT PANEL (Hidden on Print)                       */}
        {/* ========================================================= */}
        {isEditing && (
          <div className="print-hidden-control p-4 sm:p-5 bg-[#F8F7FF] border-b border-purple-200 space-y-3 shrink-0 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1A085C] flex items-center gap-1.5">
                <Edit3 size={14} className="text-[#5B4CF5]" />
                <span>Edit Invoice Details</span>
              </span>
              {saveError && <span className="text-[11px] text-rose-600 font-medium">{saveError}</span>}
              {saveSuccess && (
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <Check size={13} /> Updated successfully!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-[#1A085C] text-[11px] block">
                  Payment Description / Milestone Title *
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Architecture Sprint Delivery"
                  className="w-full px-3 py-1.5 rounded-xl border border-[#E5E1F0] bg-white text-xs font-medium text-[#1A085C] focus:outline-hidden focus:border-[#5B4CF5]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#1A085C] text-[11px] block">
                  Description / Deliverables &amp; Notes
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Scope of work, deliverables summary, or payment instructions..."
                  className="w-full px-3 py-1.5 rounded-xl border border-[#E5E1F0] bg-white text-xs font-medium text-[#1A085C] focus:outline-hidden focus:border-[#5B4CF5]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#6B7280] hover:text-[#1A085C] bg-white border border-[#E5E1F0] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving || !editTitle.trim()}
                onClick={handleSaveInvoiceEdit}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5B4CF5] to-[#7C5CE8] hover:brightness-105 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* Printable Invoice Sheet Container: id="invoice-container" */}
        {/* Natural view on CRM screen, strict 297mm A4 on print/download */}
        {/* ========================================================= */}
        <div
          ref={invoiceRef}
          id="invoice-container"
          style={{
            backgroundColor: '#FFFFFF',
            boxSizing: 'border-box',
          }}
          className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 md:p-10 bg-white font-sans text-slate-900 flex flex-col justify-between"
        >
          {/* Top Section: Header, Meta, Items, Notes & Totals */}
          <div className="space-y-6">
            {/* ========================================================= */}
            {/* 1. BRAND HEADER: InfoHQ Official Typography Logo (No Favicon) */}
            {/* ========================================================= */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 select-none">
                    <div className="text-2xl sm:text-[28px] font-black tracking-tight leading-none flex items-center">
                      <span
                        style={{
                          background: 'linear-gradient(90deg, #E8604E 0%, #FF6B4A 50%, #DD4985 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          color: '#E8604E',
                        }}
                      >
                        Info
                      </span>
                      <span
                        style={{
                          background: 'linear-gradient(135deg, #5B4CF5 0%, #7C5CE8 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          color: '#5B4CF5',
                        }}
                      >
                        HQ
                      </span>
                    </div>
                    <span className="text-[#1A085C] font-black text-sm tracking-tight">Pvt Ltd</span>
                  </div>
                  <p className="text-[11px] sm:text-xs font-semibold text-[#4B5563] mt-1.5 tracking-tight">
                    Engineering Studio for AI, SaaS &amp; Digital Systems
                  </p>
                </div>
                <div className="text-left sm:text-right text-[10.5px] font-medium text-[#6B7280] shrink-0 leading-tight">
                  <div className="font-semibold text-[#1A085C]">Prayagraj &bull; Pune, India</div>
                  <div className="font-mono text-[10px] text-[#7C5CE8] mt-0.5">https://infohq.in</div>
                </div>
              </div>

              {/* Brand Signature Gradient Accent Bar */}
              <div
                className="w-full h-[2.5px] rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%)',
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

              {/* Clean plain typography */}
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

                {/* Account ID */}
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
                  <span className="font-bold text-[#1A085C]">{formatISTDate(currentPayment.createdAt)}</span>
                </div>

                <div className="grid grid-cols-[110px_12px_1fr] items-center">
                  <span className="text-[#6B7280] font-semibold">Payment Date</span>
                  <span className="text-[#9CA3AF] font-bold">:</span>
                  <span className="font-bold text-[#1A085C]">
                    {isPaid ? formatISTDate(currentPayment.paidAt || currentPayment.createdAt) : 'Pending'}
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
            {/* 5. PAYMENT TERMS & TOTALS CALCULATION WITH CLEAN STAMP    */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start pt-1">
              {/* Left Box: Payment Description & Notes */}
              <div className="p-4 rounded-xl bg-[#FAF8FF] border border-[#E9D5FF] space-y-2.5 text-xs min-h-[140px]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-[13px] font-extrabold text-[#1A085C] tracking-tight">
                    Payment Terms &amp; Notes
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="print-hidden-control text-[11px] font-bold text-[#5B4CF5] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 size={11} />
                    <span>Edit</span>
                  </button>
                </div>

                {currentPayment.title || currentPayment.notes ? (
                  <div className="space-y-2 text-[11px] leading-relaxed text-[#4B5563]">
                    {currentPayment.title && (
                      <div className="space-y-0.5">
                        <span className="font-bold text-[#1A085C] block">Payment Description / Milestone:</span>
                        <p className="text-[#374151] font-medium">{currentPayment.title}</p>
                      </div>
                    )}
                    {currentPayment.notes && (
                      <div className="space-y-0.5 pt-1.5 border-t border-[#E9D5FF]/60">
                        <span className="font-bold text-[#1A085C] block">Terms &amp; Notes:</span>
                        <p className="text-[#374151] whitespace-pre-line">{currentPayment.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#9CA3AF] italic pt-1">
                    No specific payment terms or notes provided.
                  </p>
                )}
              </div>

              {/* Right Box: Totals & Authentic Stamp (Clean, No GST) */}
              <div className="relative p-4 rounded-xl bg-[#FAF8FF] border border-[#E9D5FF] space-y-2 text-xs min-h-[140px]">
                {/* Rotated Stamp */}
                <div className="absolute right-24 sm:right-28 bottom-2.5 pointer-events-none select-none z-10">
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
                  {isExpired && (
                    <div
                      style={{
                        transform: 'rotate(-12deg)',
                        boxShadow: '0 0 0 1px rgba(217, 119, 6, 0.2)',
                      }}
                      className="border-[2.5px] border-amber-600 text-amber-700 font-black tracking-widest text-lg sm:text-xl px-3.5 py-1 rounded-lg uppercase opacity-90 font-mono inline-block bg-white/80 backdrop-blur-2xs"
                    >
                      EXPIRED
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
                    {formatCurrency(baseAmount)}
                  </span>
                </div>

                {/* Total Amount in Brand Purple */}
                <div className="flex justify-between items-center py-1.5 border-y border-[#E9D5FF] text-sm sm:text-base font-black text-[#5B4CF5]">
                  <span>Total Amount</span>
                  <span className="tabular-nums font-black">
                    {formatCurrency(baseAmount)}
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
          </div>

          {/* ========================================================= */}
          {/* 6. PINNED FOOTER SIGN-OFF (Strictly at Bottom of A4)      */}
          {/* ========================================================= */}
          <div className="mt-auto pt-5 border-t border-[#E5E7EB] text-center text-xs space-y-1.5 shrink-0">
            <p className="font-bold text-[#1A085C] text-xs sm:text-[13px] flex items-center justify-center gap-1">
              <span
                style={{
                  background: 'linear-gradient(90deg, #E8604E 0%, #FF6B4A 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: '#E8604E',
                }}
              >
                Info
              </span>
              <span
                style={{
                  background: 'linear-gradient(135deg, #5B4CF5 0%, #7C5CE8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: '#5B4CF5',
                }}
              >
                HQ
              </span>{' '}
              <span className="text-[#1A085C]">Pvt Ltd</span> &nbsp;•&nbsp; Prayagraj &amp; Pune, India
            </p>
            <p className="text-[11px] font-medium text-[#4B5563]">
              billing@infohq.in &nbsp;&nbsp;|&nbsp;&nbsp; https://infohq.in
            </p>
            <p className="text-[10px] text-[#9CA3AF]">
              This is a computer-generated invoice verified by InfoHQ Command Center.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
