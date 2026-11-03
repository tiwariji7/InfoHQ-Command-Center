import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Payment, PaymentSummary } from '@infohq/shared';
import { fetchPayments, deletePaymentApi, syncRazorpayPaymentApi, resendPaymentLinkApi } from '../../lib/api.js';
import { CreatePaymentModal } from './CreatePaymentModal.js';
import { RecordPaymentModal } from './RecordPaymentModal.js';
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer.js';
import { PrintableInvoiceModal } from './PrintableInvoiceModal.js';
import { ClientDetailDrawer } from './ClientDetailDrawer.js';
import {
  Plus,
  Search,
  AlertCircle,
  Trash2,
  Receipt,
  RefreshCw,
  IndianRupee,
  AlertTriangle,
  TrendingUp,
  Eye,
  Download,
  Clock,
  Send,
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

  // Dynamic hover for top metric cards
  const [hoveredMetricIndex, setHoveredMetricIndex] = useState<number | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPaymentForRecord, setSelectedPaymentForRecord] = useState<Payment | null>(null);
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<Payment | null>(null);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Payment | null>(null);
  const [selectedClientForDetail, setSelectedClientForDetail] = useState<Payment | null>(null);

  const loadPayments = async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const res = await fetchPayments(getToken, {
        status: selectedStatus,
        search: searchTerm,
      });
      setPayments(res.payments);
      setSummary(res.summary);
    } catch (err: unknown) {
      if (!isBackground) {
        console.error('Failed to load payments:', err);
        setError(err instanceof Error ? err.message : 'Failed to retrieve payments.');
      }
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadPayments(false);
  }, [selectedStatus, searchTerm, getToken]);

  // Silent live auto-refresh without page reloads or spinners
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadPayments(true);
      }
    }, 8000);

    const onVisible = () => {
      if (!document.hidden) {
        loadPayments(true);
      }
    };

    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [selectedStatus, searchTerm, getToken]);

  const handlePaymentCreated = (newPayment: Payment) => {
    setPayments((prev) => [newPayment, ...prev]);
    loadPayments(true);
  };

  const handlePaymentRecorded = (updatedPayment: Payment) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === updatedPayment.id ? updatedPayment : p))
    );
    loadPayments(true);
  };

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResendLink = async (paymentId: string) => {
    setResendingId(paymentId);
    try {
      const res = await resendPaymentLinkApi(getToken, paymentId);
      alert(res.message || 'Fresh 24h payment link generated and sent to client via Email & Telegram!');
      loadPayments(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to generate/resend link.');
    } finally {
      setResendingId(null);
    }
  };

  const handleSyncRazorpay = async (paymentId: string) => {
    setSyncingId(paymentId);
    try {
      const res = await syncRazorpayPaymentApi(getToken, paymentId);
      if (res.payment) {
        setPayments((prev) =>
          prev.map((p) => (p.id === paymentId ? res.payment! : p))
        );
      }
      loadPayments(true);
      alert(res.message || 'Payment status updated directly from Razorpay.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to sync with Razorpay.');
    } finally {
      setSyncingId(null);
    }
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
    { key: 'expired', label: 'Expired (24h)' },
    { key: 'failed', label: 'Failed' },
  ];

  const recoveryRate = useMemo(() => {
    if (summary.totalInvoiced === 0) return 0;
    return Math.min(100, Math.round((summary.totalCollected / summary.totalInvoiced) * 100));
  }, [summary]);

  const now = Date.now();

  const paymentMetricCards = [
    {
      id: 0,
      title: 'Collected Realization',
      value: formatCurrency(summary.totalCollected),
      subtext: `↑ ${recoveryRate}% cashflow realized`,
      icon: IndianRupee,
      iconBg: 'bg-[#FFF0F7]',
      iconColor: 'text-[#E85AA0]',
    },
    {
      id: 1,
      title: 'Total Invoiced Ledger',
      value: formatCurrency(summary.totalInvoiced),
      subtext: 'Across all client milestones',
      icon: Receipt,
      iconBg: 'bg-[#F3F0FF]',
      iconColor: 'text-[#5B4CF5]',
    },
    {
      id: 2,
      title: 'Pending Receivables',
      value: formatCurrency(summary.totalPending),
      subtext: 'Awaiting client disbursement',
      icon: Clock,
      iconBg: 'bg-[#FFF7ED]',
      iconColor: 'text-[#C2410C]',
    },
    {
      id: 3,
      title: 'Overdue Invoices',
      value: summary.overdueCount.toString(),
      subtext: summary.overdueCount > 0 ? 'Requires immediate follow-up' : 'Zero overdue dues',
      icon: AlertTriangle,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
    },
  ];

  return (
    <div className="relative space-y-4 sm:space-y-5">
      {/* Ambient Glassmorphic Soft Glow Orbs */}
      <div className="absolute -top-10 left-10 w-80 h-80 bg-[#7C5CE8]/[0.07] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-[#E85AA0]/[0.07] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-[#3B82F6]/[0.05] rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ========================================================= */}
      {/* 0. HEADER & CTA                                           */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shadow-2xs">
            <Receipt size={16} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A085C]">
              Billing &amp;{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Invoices Command
              </span>
            </h1>
            <p className="text-xs text-[#6B7280] font-medium mt-0.5">
              Cashflow realization, milestone invoicing &amp; billing treasury ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Live Sync Real-time Badge */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[11px] font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Sync</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadPayments(false)}
            disabled={isLoading}
            className="h-8 px-3 rounded-full bg-white/85 backdrop-blur-md hover:bg-white border border-white/80 hover:border-[#5B4CF5]/40 text-[#5B4CF5] text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Invoices"
          >
            <RefreshCw size={11} className={isLoading ? 'animate-spin text-[#5B4CF5]' : 'text-[#5B4CF5]'} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* New Milestone Invoice CTA Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #5B4CF5 0%, #7C5CE8 50%, #E85AA0 100%)',
              boxShadow: '0 8px 24px -2px rgba(91, 76, 245, 0.42), 0 2px 8px rgba(232, 90, 160, 0.28)',
              color: '#FFFFFF',
            }}
            className="h-10 sm:h-11 px-5 sm:px-6 rounded-full text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 cursor-pointer shadow-lg shrink-0"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Plus size={14} className="stroke-[3] text-white" />
            </div>
            <span>New Milestone Invoice</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. TOP SUMMARY METRIC CARDS WITH DYNAMIC HOVER            */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {paymentMetricCards.map((card, idx) => {
          const isHovered = hoveredMetricIndex === idx;
          const CardIcon = card.icon;

          return (
            <div
              key={card.id}
              onMouseEnter={() => setHoveredMetricIndex(idx)}
              onMouseLeave={() => setHoveredMetricIndex(null)}
              style={
                isHovered
                  ? {
                    background: 'linear-gradient(135deg, #E8604E 0%, #DD4985 35%, #914FBB 70%, #5782E0 100%)',
                    boxShadow: '0 8px 24px rgba(221, 73, 133, 0.35)',
                  }
                  : {}
              }
              className={`rounded-2xl p-3 sm:p-4 transition-all duration-300 cursor-pointer flex flex-col justify-between ${isHovered
                  ? 'text-white -translate-y-1'
                  : 'bg-white border border-[#E5E1F0] shadow-[0_4px_20px_rgba(26,8,92,0.06)] hover:border-[#5B4CF5]/40'
                }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors ${isHovered
                      ? 'bg-white/20 backdrop-blur-xs text-white'
                      : `${card.iconBg} ${card.iconColor} border border-[#EAE6F7]/60 shadow-2xs`
                    }`}
                >
                  <CardIcon size={14} className="sm:hidden" />
                  <CardIcon size={15} className="hidden sm:block" />
                </div>
              </div>

              <div className="mt-2 sm:mt-2.5">
                <span
                  className={`text-[10px] sm:text-[10.5px] font-semibold block truncate ${isHovered ? 'text-white/90' : 'text-[#6B7280]'
                    }`}
                >
                  {card.title}
                </span>
                <div
                  className={`text-lg sm:text-xl font-black tabular-nums tracking-tight mt-0.5 truncate ${isHovered ? 'text-white' : 'text-[#1A085C]'
                    }`}
                >
                  {card.value}
                </div>
                <span
                  className={`text-[9.5px] sm:text-[10px] block truncate mt-0.5 ${isHovered ? 'text-white/90 font-medium' : 'text-[#10B981] font-bold'
                    }`}
                >
                  {card.subtext}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 1.1 CASHFLOW REALIZATION TIMELINE DECK                    */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#E5E1F0] p-4 shadow-[0_4px_20px_rgba(26,8,92,0.06)] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center">
            <TrendingUp size={13} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1A085C]">Cashflow Recovery &amp; Liquidity Ratio</h3>
            <p className="text-[10px] text-[#6B7280]">
              Realized {formatCurrency(summary.totalCollected)} of {formatCurrency(summary.totalInvoiced)} ({recoveryRate}% realized)
            </p>
          </div>
        </div>

        {/* Realization Progress Bar */}
        <div className="w-full md:w-80 space-y-1">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-semibold text-[#6B7280]">Realization Velocity</span>
            <span className="font-black text-[#15803D]">{recoveryRate}%</span>
          </div>
          <div className="w-full h-2 bg-[#F8F8FF] rounded-full overflow-hidden border border-[#EAE6F7]">
            <div
              className="h-full bg-gradient-to-r from-[#5B4CF5] to-[#E85AA0] rounded-full transition-all duration-500"
              style={{ width: `${recoveryRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. FILTER TABS & SEARCH TOOLBAR                           */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-[#E5E1F0] shadow-[0_4px_20px_rgba(26,8,92,0.06)]">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const isActive = selectedStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                style={
                  isActive
                    ? {
                      background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                      boxShadow: '0 2px 8px rgba(91,76,245,0.25)',
                    }
                    : {}
                }
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${isActive
                    ? 'text-white'
                    : 'bg-[#F8F8FF] text-[#6B7280] border border-[#EAE6F7] hover:border-[#5B4CF5]/40 hover:text-[#5B4CF5]'
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice #, client, or milestone..."
            className="w-full h-8 pl-8 pr-3 text-xs font-semibold border border-[#EAE6F7] bg-white rounded-full focus:border-[#5B4CF5] outline-none transition-all placeholder:text-[#9CA3AF] text-[#1A085C]"
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-rose-600 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. BESPOKE INVOICE LEDGER TABLE (Stripe-Grade Master View)*/}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#E5E1F0] shadow-[0_4px_20px_rgba(26,8,92,0.06)] overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2.5">
            <RefreshCw size={22} className="animate-spin text-[#5B4CF5]" />
            <span className="text-xs font-semibold text-[#6B7280]">Fetching billing ledger...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F3F0FF] text-[#5B4CF5] mx-auto flex items-center justify-center mb-2.5 shadow-2xs">
              <Receipt size={22} />
            </div>
            <h3 className="text-sm font-bold text-[#1A085C]">No Payments Recorded</h3>
            <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto font-medium">
              {searchTerm || selectedStatus !== 'all'
                ? 'No invoices match your filter criteria. Try clearing filters.'
                : 'Add your first milestone invoice or advance retainer to start tracking project billing.'}
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                boxShadow: '0 4px 14px rgba(99, 88, 240, 0.30)',
              }}
              className="mt-3.5 px-3.5 py-1.5 rounded-full text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={13} />
              Create First Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs table-auto">
              <thead>
                <tr className="border-b border-[#EAE6F7] bg-[#F8F8FF]/60 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice</th>
                  <th className="py-3 px-4">Clients</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6F7]/60">
                {payments.map((py) => {
                  const isPaid = py.status === 'received';
                  const expiresAt = py.expiresAt || (py.razorpayPaymentLinkId ? py.createdAt + 24 * 60 * 60 * 1000 : null);
                  const isExpired = !isPaid && (py.status === 'expired' || (expiresAt ? expiresAt < now : false));
                  const isOverdue = !isPaid && !isExpired && py.dueDate && py.dueDate < now;

                  return (
                    <tr
                      key={py.id}
                      onClick={() => setSelectedClientForDetail(py)}
                      className="hover:bg-slate-50/80 transition-all duration-300 ease-in-out group cursor-pointer"
                    >
                      {/* 1. Invoice Number (Simple text, no pills) */}
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#1A085C]" title={`Created: ${formatISTDate(py.createdAt)}`}>
                        {py.invoiceNumber || `INV-${py.id.slice(-6).toUpperCase()}`}
                      </td>

                      {/* 2. Clients (Profile pic initial e.g. Shivam -> S + Client name + small company name) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#5B4CF5] to-[#7C5CE8] text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                            {(py.clientName?.trim()?.[0] || 'C').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-[#1A085C] leading-snug group-hover:text-[#5B4CF5] transition-colors truncate">
                              {py.clientName || 'Direct Client'}
                            </div>
                            {py.company && (
                              <div className="text-[10px] text-[#6B7280] leading-snug mt-0.5 truncate">
                                {py.company}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Project (Only project name, truncated if long) */}
                      <td className="py-3.5 px-4">
                        <span
                          className="text-xs text-[#4B5563] font-medium truncate max-w-[170px] block"
                          title={py.projectTitle || py.title || 'Client Deliverable'}
                        >
                          {py.projectTitle || py.title || 'Client Deliverable'}
                        </span>
                      </td>

                      {/* 4. Amount (Collected: green, Pending: yellow, Overdue: red) */}
                      <td className="py-3.5 px-4 font-bold text-xs sm:text-sm tabular-nums whitespace-nowrap">
                        <span
                          className={
                            isPaid
                              ? 'text-[#15803D]'
                              : isOverdue
                                ? 'text-rose-600'
                                : 'text-amber-500'
                          }
                        >
                          {formatCurrency(py.amount, py.currency)}
                        </span>
                      </td>

                      {/* 5. Status (Proper color, simple text without pills/cylinders) */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold">
                        {isPaid ? (
                          <div className="flex items-center gap-1.5 text-[#15803D]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                            <span>Received</span>
                          </div>
                        ) : isExpired ? (
                          <div className="flex items-center gap-1.5 text-amber-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>Expired (24h)</span>
                          </div>
                        ) : isOverdue ? (
                          <div className="flex items-center gap-1.5 text-rose-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            <span>Overdue</span>
                          </div>
                        ) : py.status === 'failed' ? (
                          <div className="flex items-center gap-1.5 text-rose-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Failed</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>Pending</span>
                          </div>
                        )}
                      </td>

                      {/* 6. Action (Eye to view invoice, Download icon for PDF) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setSelectedInvoiceForPrint(py)}
                            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#5B4CF5] hover:bg-[#F3F0FF] transition-colors cursor-pointer"
                            title="View Invoice"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            onClick={() => setSelectedInvoiceForPrint(py)}
                            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#10B981] hover:bg-[#F0FDF4] transition-colors cursor-pointer"
                            title="Download Invoice PDF"
                          >
                            <Download size={15} />
                          </button>

                          {!isPaid && (
                            <button
                              onClick={() => handleResendLink(py.id)}
                              disabled={resendingId === py.id}
                              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#5B4CF5] hover:bg-[#F3F0FF] transition-colors disabled:opacity-50 cursor-pointer"
                              title={isExpired ? "Payment link expired. Generate new 24h link & resend" : "Resend 24-hour payment link"}
                            >
                              <Send size={13} className={resendingId === py.id ? 'animate-spin' : ''} />
                            </button>
                          )}

                          {!isPaid && py.razorpayPaymentLinkId && (
                            <button
                              onClick={() => handleSyncRazorpay(py.id)}
                              disabled={syncingId === py.id}
                              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#15803D] hover:bg-green-50 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Sync live status from Razorpay"
                            >
                              <RefreshCw size={13} className={syncingId === py.id ? 'animate-spin' : ''} />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(py.id)}
                            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
        onOpenInvoice={(py) => setSelectedInvoiceForPrint(py)}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={Boolean(selectedPaymentForRecord)}
        payment={selectedPaymentForRecord}
        onClose={() => setSelectedPaymentForRecord(null)}
        onSuccess={handlePaymentRecorded}
      />

      {/* Invoice Detail Drawer */}
      <InvoiceDetailDrawer
        payment={selectedInvoiceForDetail}
        onClose={() => setSelectedInvoiceForDetail(null)}
        onRecordPayment={(py) => {
          setSelectedInvoiceForDetail(null);
          setSelectedPaymentForRecord(py);
        }}
        onDeletePayment={handleDelete}
      />

      {/* Printable Invoice Modal (PDF & Print) */}
      {selectedInvoiceForPrint && (
        <PrintableInvoiceModal
          isOpen={Boolean(selectedInvoiceForPrint)}
          onClose={() => setSelectedInvoiceForPrint(null)}
          payment={selectedInvoiceForPrint}
        />
      )}

      {/* Client Detail Drawer (Side Card matching theme and 4 tabs) */}
      <ClientDetailDrawer
        payment={selectedClientForDetail}
        allPayments={payments}
        onClose={() => setSelectedClientForDetail(null)}
        onOpenInvoice={(inv) => {
          setSelectedInvoiceForPrint(inv);
        }}
        onOpenCreateInvoice={() => setIsCreateModalOpen(true)}
      />
    </div>
  );
};
