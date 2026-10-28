import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Payment, PaymentSummary } from '@infohq/shared';
import { fetchPayments, deletePaymentApi } from '../../lib/api.js';
import { CreatePaymentModal } from './CreatePaymentModal.js';
import { RecordPaymentModal } from './RecordPaymentModal.js';
import {
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Receipt,
  RefreshCw,
  Clock,
  Building2,
  FileCheck2,
} from 'lucide-react';

export const PaymentsView: React.FC = () => {
  const { getToken } = useAuth();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>({
    totalInvoiced: 0,
    totalCollected: 0,
    totalPending: 0,
    overdueCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPaymentForRecord, setSelectedPaymentForRecord] = useState<Payment | null>(null);

  const loadPayments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchPayments(getToken, {
        status: selectedStatus,
        search: searchTerm,
      });
      setPayments(res.payments);
      setSummary(res.summary);
    } catch (err: unknown) {
      console.error('Failed to load payments:', err);
      setError(err instanceof Error ? err.message : 'Failed to retrieve payments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [selectedStatus, searchTerm, getToken]);

  const handlePaymentCreated = (newPayment: Payment) => {
    setPayments((prev) => [newPayment, ...prev]);
    loadPayments();
  };

  const handlePaymentRecorded = (updatedPayment: Payment) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === updatedPayment.id ? updatedPayment : p))
    );
    loadPayments();
  };

  const handleDelete = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment record?')) return;
    try {
      await deletePaymentApi(getToken, paymentId);
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
      loadPayments();
    } catch (err: unknown) {
      console.error('Failed to delete payment:', err);
    }
  };

  const formatCurrency = (amt: number, curr = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    }).format(amt);
  };

  const formatISTDate = (timestamp?: number | string | null) => {
    if (!timestamp) return '—';
    const epoch = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    if (isNaN(epoch)) return String(timestamp);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(epoch));
  };

  const STATUS_TABS: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'All Invoices' },
    { key: 'pending', label: 'Pending Receivables' },
    { key: 'received', label: 'Received / Paid' },
    { key: 'failed', label: 'Failed' },
  ];

  // Recovery percentage
  const recoveryRate = useMemo(() => {
    if (summary.totalInvoiced === 0) return 0;
    return Math.min(100, Math.round((summary.totalCollected / summary.totalInvoiced) * 100));
  }, [summary]);

  const now = Date.now();

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 0. HEADER & CTA (Half-Gradient Title)                     */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE]">
              <Receipt size={12} className="text-[#7C3AED]" />
              Financial Ledger & Treasury
            </span>
            <span className="text-xs text-brand-muted hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-brand-muted hidden sm:inline">
              Cashflow realization & milestone invoicing
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A085C] mt-1">
            Billing &{' '}
            <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">
              Invoices Command
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={loadPayments}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white border border-[#EDE8F5] text-brand-muted hover:text-[#7C3AED] shadow-2xs transition-all cursor-pointer"
            title="Refresh Invoices"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-[#7C3AED]' : ''} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-xs sm:text-sm font-bold shadow-[0_4px_16px_rgba(124,58,237,0.25)] hover:shadow-[0_8px_24px_rgba(124,58,237,0.35)] transition-all cursor-pointer"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>New Milestone Invoice</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. BESPOKE CASHFLOW RECOVERY WATERFALL DECK (Unique!)     */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#EDE8F5] p-5 shadow-[0_4px_24px_rgba(124,58,237,0.04)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xl border border-emerald-100 shadow-2xs">
              ₹
            </div>
            <div>
              <div className="text-xs font-bold text-brand-muted uppercase tracking-wider">
                Collected Realization
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700 tabular-nums">
                {formatCurrency(summary.totalCollected)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <div>
              <div className="text-[11px] font-bold text-brand-muted uppercase">Total Invoiced</div>
              <div className="text-lg font-black text-[#1A085C] tabular-nums">
                {formatCurrency(summary.totalInvoiced)}
              </div>
            </div>
            <div className="h-8 w-px bg-[#EDE8F5]" />
            <div>
              <div className="text-[11px] font-bold text-amber-600 uppercase">Pending Dues</div>
              <div className="text-lg font-black text-amber-700 tabular-nums">
                {formatCurrency(summary.totalPending)}
              </div>
            </div>
            <div className="h-8 w-px bg-[#EDE8F5]" />
            <div>
              <div className="text-[11px] font-bold text-rose-600 uppercase flex items-center gap-1">
                <span>Overdue Invoices</span>
                {summary.overdueCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </div>
              <div className="text-lg font-black text-rose-600 tabular-nums">
                {summary.overdueCount} {summary.overdueCount === 1 ? 'invoice' : 'invoices'}
              </div>
            </div>
          </div>
        </div>

        {/* Realization Progress Bar */}
        <div className="space-y-1.5 pt-2 border-t border-[#EDE8F5]">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-brand-muted">Cashflow Realization Ratio</span>
            <span className="text-emerald-700 font-bold tabular-nums">
              {recoveryRate}% realized ({formatCurrency(summary.totalCollected)} / {formatCurrency(summary.totalInvoiced)})
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#FAF9FD] overflow-hidden border border-[#EDE8F5]">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-[#7C3AED] transition-all duration-300 rounded-full"
              style={{ width: `${recoveryRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TOOLBAR & FILTERS                                      */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#EDE8F5] p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const isActive = selectedStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-xs'
                    : 'bg-[#FAF9FD] text-[#475569] border border-[#EDE8F5] hover:bg-[#EDE9FE]/50 hover:text-[#7C3AED]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice #, client, or milestone..."
            className="w-full h-10 pl-9 pr-3 text-xs font-semibold border border-[#EDE8F5] bg-[#FAF9FD] rounded-xl focus:bg-white focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 outline-none transition-all"
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-brand-destructive rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. BESPOKE INVOICE LEDGER TABLE (Stripe-grade Precision)  */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#EDE8F5] shadow-[0_4px_24px_rgba(124,58,237,0.04)] overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={26} className="animate-spin text-[#7C3AED]" />
            <span className="text-xs font-bold text-brand-muted">Fetching billing ledger...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] mx-auto flex items-center justify-center mb-3 shadow-2xs">
              <Receipt size={26} />
            </div>
            <h3 className="text-base font-bold text-brand-heading">No Payments Recorded</h3>
            <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto font-medium">
              {searchTerm || selectedStatus !== 'all'
                ? 'No invoices match your filter criteria. Try clearing filters.'
                : 'Add your first milestone invoice or advance retainer to start tracking project billing.'}
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-xs font-bold shadow-xs inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              Create First Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#EDE8F5] bg-[#FAF9FD] text-[11px] font-bold text-brand-muted uppercase tracking-wider">
                  <th className="py-3.5 px-5">Invoice & Milestone</th>
                  <th className="py-3.5 px-4">Project & Client</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Payment Due / Settled</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE8F5]">
                {payments.map((py) => {
                  const isPaid = py.status === 'received';
                  const isOverdue =
                    py.status === 'pending' && py.dueDate && py.dueDate < now;

                  return (
                    <tr
                      key={py.id}
                      className="hover:bg-[#FAF9FD]/80 transition-colors group"
                    >
                      {/* Milestone Title & Invoice # */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-brand-heading text-xs">
                          {py.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {py.invoiceNumber ? (
                            <span className="font-mono text-[10px] font-bold text-[#7C3AED] bg-[#EDE9FE] px-1.5 py-0.2 rounded border border-[#DDD6FE]">
                              {py.invoiceNumber}
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-brand-muted">
                              NO-INV#
                            </span>
                          )}
                          {py.notes && (
                            <span className="text-[10px] text-brand-muted truncate max-w-[150px]">
                              {py.notes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Project & Client */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-brand-heading text-xs truncate max-w-[180px]">
                          {py.projectTitle || 'Client Deliverable'}
                        </div>
                        <div className="text-[11px] text-brand-muted font-medium flex items-center gap-1 mt-0.5">
                          <Building2 size={11} className="shrink-0" />
                          <span>{py.clientName}</span>
                          {py.company && <span>({py.company})</span>}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 font-black text-sm text-[#1A085C] tabular-nums">
                        {formatCurrency(py.amount, py.currency)}
                      </td>

                      {/* Due / Paid Date */}
                      <td className="py-4 px-4 text-xs">
                        {isPaid && py.paidAt ? (
                          <div className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <CheckCircle2 size={12} />
                            <span>Paid on {formatISTDate(py.paidAt)}</span>
                          </div>
                        ) : isOverdue ? (
                          <div className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            <span>Overdue: {formatISTDate(py.dueDate)}</span>
                          </div>
                        ) : py.dueDate ? (
                          <div className="flex items-center gap-1 text-amber-700 font-medium text-[11px]">
                            <Clock size={11} />
                            <span>Due by {formatISTDate(py.dueDate)}</span>
                          </div>
                        ) : (
                          <span className="text-brand-muted text-[11px]">No due date</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={11} />
                            Received
                          </span>
                        ) : py.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle size={11} />
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={11} />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {!isPaid && (
                            <button
                              onClick={() => setSelectedPaymentForRecord(py)}
                              className="px-2.5 py-1 rounded-lg bg-[#EDE9FE] text-[#7C3AED] hover:bg-[#DDD6FE] font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-colors"
                              title="Record received funds"
                            >
                              <FileCheck2 size={12} />
                              <span>Record Paid</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(py.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Payment Modal */}
      <CreatePaymentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handlePaymentCreated}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={Boolean(selectedPaymentForRecord)}
        payment={selectedPaymentForRecord}
        onClose={() => setSelectedPaymentForRecord(null)}
        onSuccess={handlePaymentRecorded}
      />
    </div>
  );
};
