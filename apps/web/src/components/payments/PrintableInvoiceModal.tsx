import React, { useRef } from 'react';
import type { Payment } from '@infohq/shared';
import {
  X,
  Printer,
  Download,
  ExternalLink,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface PrintableInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment;
}

export const PrintableInvoiceModal: React.FC<PrintableInvoiceModalProps> = ({
  isOpen,
  onClose,
  payment,
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const isPaid = payment.status === 'received';
  const invoiceCode = payment.invoiceNumber || `INV-2026-${payment.id.slice(-4).toUpperCase()}`;

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
  const clientEmail = payment.clientEmail || 'contact@client.in';
  const clientPhone = payment.clientPhone || '+91 98892 40590';

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
        desc: payment.title || 'Advance Milestone — Mobile App Initiation & Architecture',
        qty: 1,
        rate: payment.amount,
        amount: payment.amount,
      },
    ];
  }

  const handleDownloadPdf = () => {
    window.print();
  };

  const paidAmount = isPaid ? payment.amount : 0;
  const balanceDue = isPaid ? 0 : payment.amount;

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Print-specific style injected into page */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            background: #FFFFFF !important;
            color: #0F172A !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-invoice-sheet,
          #printable-invoice-sheet * {
            visibility: visible;
          }
          #printable-invoice-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-hidden-control {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Control Bar (Hidden on print) */}
        <div className="print-hidden-control h-14 px-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Tax Invoice Document
            </span>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {invoiceCode}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {payment.razorpayPaymentLinkUrl && !isPaid && (
              <a
                href={payment.razorpayPaymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <span>Pay via Razorpay</span>
                <ExternalLink size={12} />
              </a>
            )}

            <button
              onClick={handleDownloadPdf}
              className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              title="Save as PDF or Print"
            >
              <Download size={13} />
              <span>Download PDF</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Printer size={13} className="text-slate-500" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet (Exact match to reference design) */}
        <div
          ref={invoiceRef}
          id="printable-invoice-sheet"
          className="flex-1 min-h-0 overflow-y-auto p-8 sm:p-12 bg-white font-sans text-slate-900 space-y-7"
        >
          {/* Header Row: InfoHQ Branding (Left) and INVOICE Title + Dates (Right) */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-100">
            <div>
              <div className="text-3xl font-black tracking-tight text-slate-900">
                Info<span className="text-[#2563EB]">HQ</span>
              </div>
              <div className="text-sm font-semibold text-slate-600 mt-0.5">
                Pvt Ltd
              </div>
              <div className="text-xs text-slate-500 mt-2 font-normal leading-relaxed space-y-0.5">
                <div>Engineering Studio for AI, SaaS &amp; Digital Systems</div>
                <div>Prayagraj, Uttar Pradesh, India</div>
                <div className="pt-0.5 text-slate-500 font-medium">billing@infohq.in • infohq.in</div>
              </div>
            </div>

            {/* Right Meta Column: Status Badge, Title, Invoice #, Dates */}
            <div className="text-left sm:text-right space-y-2">
              <div>
                {isPaid ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                    <CheckCircle2 size={13} />
                    <span>PAID IN FULL</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
                    <Clock size={13} />
                    <span>PAYMENT DUE</span>
                  </span>
                )}
              </div>

              <div className="text-2xl font-black text-slate-900 tracking-wider pt-1">
                INVOICE
              </div>

              <div className="text-xs space-y-1 pt-1">
                <div className="flex sm:justify-end gap-3 text-slate-600">
                  <span className="text-slate-400">Invoice No:</span>
                  <span className="font-bold text-[#1D4ED8] font-mono">{invoiceCode}</span>
                </div>
                <div className="flex sm:justify-end gap-3 text-slate-600">
                  <span className="text-slate-400">Issue Date:</span>
                  <span className="font-semibold text-slate-800">{formatISTDate(payment.createdAt)}</span>
                </div>
                <div className="flex sm:justify-end gap-3 text-slate-600">
                  <span className="text-slate-400">Due Date:</span>
                  <span className="font-semibold text-slate-800">{formatISTDate(payment.dueDate)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bill To & Payment Details Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left Card: Bill To */}
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                BILL TO
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                {clientName}
              </h3>
              <div className="text-xs text-slate-600 mt-0.5">{clientEmail}</div>
              <div className="text-xs text-slate-600 mt-0.5">{clientPhone}</div>
            </div>

            {/* Right Card: Payment Details */}
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                PAYMENT DETAILS
              </span>
              <div className="mt-1">
                {isPaid ? (
                  <span className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Paid via {payment.paymentMethod || 'UPI / Online'}</span>
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-700 inline-flex items-center gap-1">
                    <Clock size={13} className="text-amber-600" />
                    <span>Online Settlement / UPI / NetBanking</span>
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {isPaid ? `Paid on: ${formatISTDate(payment.paidAt)}` : `Due by: ${formatISTDate(payment.dueDate)}`}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5 truncate">
                Payment reference: {payment.razorpayPaymentId || '—'}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-slate-400">#</th>
                  <th className="py-2.5 px-4">DESCRIPTION</th>
                  <th className="py-2.5 px-4 text-center w-16">QTY</th>
                  <th className="py-2.5 px-4 text-right w-24">UNIT PRICE</th>
                  <th className="py-2.5 px-4 text-right w-28">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-slate-400">{item.num}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.desc}</td>
                    <td className="py-3 px-4 text-center tabular-nums text-slate-700">{item.qty}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                      {formatCurrency(item.rate)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Section: Payment Terms & Totals Calculation */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-1">
            {/* Left: Terms & Notes */}
            <div className="text-xs text-slate-600 space-y-1.5 max-w-sm">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 pb-0.5 border-b border-slate-200 inline-block">
                PAYMENT TERMS &amp; NOTES
              </span>
              <p className="leading-relaxed text-xs text-slate-600">
                {payment.notes || 'Payment received for the initial system setup and project kickoff milestone.'}
              </p>
            </div>

            {/* Right: Calculations */}
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 pb-1.5 border-b border-slate-100">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(payment.amount)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 pb-1.5 border-b border-slate-100">
                <span>Tax / GST</span>
                <span className="font-semibold text-slate-800">Nil / Exempt</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-0.5">
                <span>Total Paid</span>
                <span className="text-[#1D4ED8] tabular-nums">
                  {formatCurrency(paidAmount)}
                </span>
              </div>

              {/* Highlight Box: Balance Due */}
              <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#DBEAFE] flex justify-between items-center mt-2">
                <span className="font-bold text-slate-900 text-xs">Balance Due</span>
                <span
                  className={`font-black text-base tabular-nums ${
                    isPaid ? 'text-[#15803D]' : 'text-[#1D4ED8]'
                  }`}
                >
                  {isPaid ? '₹0.00' : formatCurrency(balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Sign-off */}
          <div className="pt-6 border-t border-slate-100 text-center text-xs text-slate-500 space-y-0.5">
            <p className="font-semibold text-slate-700">
              InfoHQ Pvt Ltd • Prayagraj, India
            </p>
            <p className="text-[11px] text-slate-400">
              This is a computer-generated invoice. For billing queries, contact billing@infohq.in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
