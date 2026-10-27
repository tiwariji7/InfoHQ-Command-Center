import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Payment, PaymentSummary } from '@infohq/shared';
import { fetchPayments, deletePaymentApi } from '../../lib/api.js';
import { CreatePaymentModal } from './CreatePaymentModal.js';
import { RecordPaymentModal } from './RecordPaymentModal.js';
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Loader2,
  Trash2,
  ArrowUpRight,
  Receipt,
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

  const STATUS_TABS: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'All Invoices' },
    { key: 'pending', label: 'Pending' },
    { key: 'paid', label: 'Collected / Paid' },
    { key: 'overdue', label: 'Overdue' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="hq-card bg-white border-brand-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-chip bg-brand-subtle flex items-center justify-center text-brand-primary">
                <CreditCard size={18} />
              </div>
              <h1 className="text-2xl font-bold text-brand-heading">
                Payments & Milestone Billing
              </h1>
            </div>
            <p className="text-sm text-brand-body mt-1">
              Track project milestones, advance retainers, and client receivables.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="hq-btn-primary flex items-center gap-1.5"
            >
              <Plus size={16} />
              <span>New Milestone Invoice</span>
            </button>
          </div>
        </div>
      </div>

      {/* Financial Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="hq-card bg-white border-brand-border p-4">
          <div className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
            Total Invoiced
          </div>
          <div className="text-xl font-bold text-brand-heading mt-1">
            {formatCurrency(summary.totalInvoiced)}
          </div>
        </div>

        <div className="hq-card bg-white border-brand-border p-4">
          <div className="text-[11px] font-semibold text-green-600 uppercase tracking-wider flex items-center gap-1">
            <span>Collected</span>
            <ArrowUpRight size={14} />
          </div>
          <div className="text-xl font-bold text-green-700 mt-1">
            {formatCurrency(summary.totalCollected)}
          </div>
        </div>

        <div className="hq-card bg-white border-brand-border p-4">
          <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
            Outstanding Balance
          </div>
          <div className="text-xl font-bold text-amber-700 mt-1">
            {formatCurrency(summary.totalPending)}
          </div>
        </div>

        <div className="hq-card bg-white border-brand-border p-4">
          <div className="text-[11px] font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1">
            <span>Overdue Invoices</span>
            {summary.overdueCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <div className="text-xl font-bold text-red-600 mt-1">
            {summary.overdueCount}
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="hq-card bg-white border-brand-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedStatus(tab.key)}
              className={`px-3 py-1.5 rounded-control text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedStatus === tab.key
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-brand-muted hover:bg-brand-section'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-2.5 text-brand-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice, project, client, or UTR..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-brand-destructive rounded-control text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Payments List / Table */}
      {isLoading ? (
        <div className="hq-card bg-white border-brand-border p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-brand-primary" />
          <span className="text-xs text-brand-muted">Loading payments & billing...</span>
        </div>
      ) : payments.length === 0 ? (
        <div className="hq-card bg-white border-brand-border p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-subtle text-brand-primary mx-auto flex items-center justify-center mb-3">
            <Receipt size={22} />
          </div>
          <h3 className="text-sm font-bold text-brand-heading">No Payments Recorded</h3>
          <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
            {searchTerm || selectedStatus !== 'all'
              ? 'No payments match your filter criteria.'
              : 'Add your first milestone invoice or advance retainer to track client billing.'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="hq-btn-primary text-xs mt-4 inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            Create First Milestone Invoice
          </button>
        </div>
      ) : (
        <div className="hq-card bg-white border-brand-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-brand-border bg-brand-section/50 text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Milestone / Invoice</th>
                  <th className="py-3 px-4">Project & Client</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {payments.map((py) => {
                  const isPaid = py.status === 'paid';
                  const isOverdue =
                    py.status === 'pending' && py.dueDate && py.dueDate < Date.now();

                  return (
                    <tr
                      key={py.id}
                      className="hover:bg-brand-section/40 transition-colors group"
                    >
                      {/* Milestone Title & Invoice # */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-brand-heading">{py.title}</div>
                        {py.invoiceNumber && (
                          <div className="font-mono text-[10px] text-brand-primary mt-0.5">
                            {py.invoiceNumber}
                          </div>
                        )}
                        {py.notes && (
                          <div className="text-[10px] text-brand-muted line-clamp-1 mt-0.5">
                            Ref: {py.notes}
                          </div>
                        )}
                      </td>

                      {/* Project & Client */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-brand-heading">
                          {py.projectTitle || 'Project'}
                        </div>
                        <div className="text-[11px] text-brand-muted">
                          {py.clientName}
                          {py.company && ` (${py.company})`}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 font-bold text-sm text-brand-heading">
                        {formatCurrency(py.amount, py.currency)}
                      </td>

                      {/* Due / Paid Date */}
                      <td className="py-3 px-4 text-brand-muted">
                        {isPaid && py.paidAt ? (
                          <div className="flex items-center gap-1 text-green-700 font-medium">
                            <CheckCircle2 size={13} />
                            <span>Paid {new Date(py.paidAt).toLocaleDateString()}</span>
                          </div>
                        ) : py.dueDate ? (
                          <div
                            className={`flex items-center gap-1 ${
                              isOverdue ? 'text-red-600 font-bold' : ''
                            }`}
                          >
                            <Calendar size={13} />
                            <span>Due {new Date(py.dueDate).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span>Upon Completion</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isPaid ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200">
                            Paid
                          </span>
                        ) : isOverdue ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                            Overdue
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => setSelectedPaymentForRecord(py)}
                              className="px-2.5 py-1 rounded-control bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary/90 transition-colors flex items-center gap-1"
                            >
                              <CheckCircle2 size={13} />
                              <span>Mark Paid</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(py.id)}
                            className="p-1 text-brand-lightGray hover:text-brand-destructive rounded transition-colors"
                            title="Delete invoice record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Payment Modal */}
      <CreatePaymentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handlePaymentCreated}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={Boolean(selectedPaymentForRecord)}
        onClose={() => setSelectedPaymentForRecord(null)}
        onSuccess={handlePaymentRecorded}
        payment={selectedPaymentForRecord}
      />
    </div>
  );
};
