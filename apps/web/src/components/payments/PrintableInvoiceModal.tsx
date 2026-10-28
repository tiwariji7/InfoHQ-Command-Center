import React, { useRef } from 'react';
import type { Payment } from '@infohq/shared';
import {
  X,
  Printer,
  ExternalLink,
  CheckCircle2,
  Clock,
  ShieldCheck,
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
  const clientCompany = payment.company || clientName;

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
        desc: payment.title || 'Advance Milestone: Architecture, Engineering & Design Delivery',
        qty: 1,
        rate: payment.amount,
        amount: payment.amount,
      },
    ];
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#EDE8F5] flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Control Bar (Hidden on print) */}
        <div className="print:hidden h-14 px-5 border-b border-[#EDE8F5] flex items-center justify-between bg-[#FAF9FD] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#1A085C] uppercase tracking-wider">
              Tax Invoice Document
            </span>
            <span className="text-xs font-mono font-bold text-[#7C3AED] bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
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
              onClick={handlePrint}
              className="h-8 px-3 rounded-lg bg-white border border-[#EDE8F5] text-brand-heading hover:bg-[#FAF9FD] text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Printer size={13} className="text-[#7C3AED]" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-[#1A085C] hover:bg-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet (A4 Proportion) */}
        <div
          ref={invoiceRef}
          id="printable-invoice-sheet"
          className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-10 bg-white font-sans text-brand-heading space-y-8"
        >
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-[#EDE8F5]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
                  InfoHQ
                </span>
                <span className="text-sm font-bold text-slate-400">Pvt Ltd</span>
              </div>
              <p className="text-xs text-brand-muted mt-1 font-medium leading-relaxed">
                Engineering Studio for AI, SaaS & Digital Systems<br />
                Prayagraj, Uttar Pradesh, India<br />
                Email: billing@infohq.in • Web: infohq.in
              </p>
            </div>

            {/* Invoice Meta Box */}
            <div className="text-left sm:text-right space-y-1">
              <div className="inline-block">
                {isPaid ? (
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>PAID IN FULL</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock size={13} className="text-amber-600" />
                    <span>PAYMENT DUE</span>
                  </div>
                )}
              </div>

              <div className="text-xs font-mono font-bold text-brand-heading pt-1">
                Invoice No: <span className="text-[#7C3AED]">{invoiceCode}</span>
              </div>
              <div className="text-xs text-brand-muted">
                Issued: {formatISTDate(payment.createdAt)}
              </div>
              <div className="text-xs text-brand-muted">
                Due Date: <span className="font-semibold text-brand-heading">{formatISTDate(payment.dueDate)}</span>
              </div>
            </div>
          </div>

          {/* Bill To & Settlement Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl bg-[#FAF9FD] border border-[#EDE8F5]">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-muted">
                Billed To
              </span>
              <h3 className="text-sm font-bold text-[#1A085C] mt-1">
                {clientName}
              </h3>
              {clientCompany && clientCompany !== clientName && (
                <div className="text-xs text-brand-muted font-medium">{clientCompany}</div>
              )}
              {payment.clientEmail && (
                <div className="text-xs text-brand-muted mt-0.5">{payment.clientEmail}</div>
              )}
              {payment.clientPhone && (
                <div className="text-xs text-brand-muted font-mono">{payment.clientPhone}</div>
              )}
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-muted">
                Payment Settlement
              </span>
              <div className="text-xs font-bold text-[#1A085C] mt-1">
                {isPaid ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <ShieldCheck size={14} />
                    <span>Settled via {payment.paymentMethod || 'Razorpay Online'}</span>
                  </span>
                ) : (
                  <span>Online Settlement / UPI / NetBanking</span>
                )}
              </div>
              {payment.paidAt && (
                <div className="text-xs text-brand-muted mt-0.5">
                  Paid On: {formatISTDate(payment.paidAt)}
                </div>
              )}
              {payment.razorpayPaymentId && (
                <div className="text-xs font-mono text-brand-muted mt-0.5">
                  Txn ID: {payment.razorpayPaymentId}
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-[#EDE8F5] rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9FD] border-b border-[#EDE8F5] text-[10px] font-black uppercase text-brand-muted">
                <tr>
                  <th className="py-2.5 px-4 w-10">#</th>
                  <th className="py-2.5 px-4">Milestone Description</th>
                  <th className="py-2.5 px-4 text-center w-16">Qty</th>
                  <th className="py-2.5 px-4 text-right w-24">Rate</th>
                  <th className="py-2.5 px-4 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE8F5]">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-brand-muted">{item.num}</td>
                    <td className="py-3 px-4 font-semibold text-[#1A085C]">{item.desc}</td>
                    <td className="py-3 px-4 text-center tabular-nums">{item.qty}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-brand-muted">
                      {formatCurrency(item.rate)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-[#1A085C]">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Calculation Card */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pt-2">
            <div className="text-xs text-brand-muted space-y-1 max-w-sm">
              <span className="font-bold text-brand-heading">Payment Terms & Notes:</span>
              <p className="leading-relaxed">
                Thank you for your business. Payment for this milestone covers system setup and kickoff delivery.
                Direct UPI / Card payment supported via Razorpay.
              </p>
            </div>

            <div className="w-full sm:w-64 space-y-2 text-xs">
              <div className="flex justify-between text-brand-muted pb-1.5 border-b border-[#EDE8F5]">
                <span>Subtotal</span>
                <span className="font-semibold text-brand-heading tabular-nums">
                  {formatCurrency(payment.amount)}
                </span>
              </div>
              <div className="flex justify-between text-brand-muted pb-1.5 border-b border-[#EDE8F5]">
                <span>Tax / GST</span>
                <span className="font-semibold text-brand-heading">Nil / Exempt</span>
              </div>
              <div className="flex justify-between text-base font-black text-[#1A085C] pt-1">
                <span>Total Due</span>
                <span className="text-[#7C3AED] tabular-nums">
                  {formatCurrency(payment.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Live Razorpay CTA for Unpaid Invoices */}
          {!isPaid && payment.razorpayPaymentLinkUrl && (
            <div className="print:hidden p-4 rounded-xl bg-gradient-to-r from-[#EDE9FE] to-[#F5F3FF] border border-[#DDD6FE] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black text-[#1A085C]">
                  Pay Online with Instant UPI, Cards or NetBanking
                </div>
                <div className="text-[11px] text-brand-muted">
                  Powered by Razorpay Secure Payments
                </div>
              </div>
              <a
                href={payment.razorpayPaymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md shadow-[#7C3AED]/20 shrink-0"
              >
                <span>Pay {formatCurrency(payment.amount)}</span>
                <ExternalLink size={13} />
              </a>
            </div>
          )}

          {/* Footer Sign-off */}
          <div className="pt-8 border-t border-[#EDE8F5] text-center text-xs text-brand-muted">
            <p className="font-semibold text-brand-heading">
              InfoHQ Pvt Ltd • Prayagraj, India
            </p>
            <p className="text-[11px] mt-0.5">
              This is a computer-generated invoice. For payment reconciliation queries, reach out to billing@infohq.in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
