import React, { useState, useEffect } from 'react';
import type { ClientPortalData } from '@infohq/shared';
import { fetchClientPortalData } from '../../lib/api.js';
import {
  FolderKanban,
  Receipt,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface ClientPortalViewProps {
  token: string;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({ token }) => {
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchClientPortalData(token)
      .then((res) => {
        if (isMounted) setData(res.data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Unable to access client portal.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  const formatISTDate = (timestamp?: number | null) => {
    if (!timestamp) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F8FF] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-3 border-[#7C5CE8] border-t-transparent animate-spin"></div>
          <span className="text-xs font-semibold text-[#1A085C]">Loading your client dashboard...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F8F8FF] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#EAE6F7] p-8 text-center shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-xl font-bold text-[#1A085C]">Portal Link Expired or Invalid</h2>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            {error || 'This secure client portal link is no longer active. Please contact InfoHQ support to request a fresh access link.'}
          </p>
          <div className="pt-2">
            <a
              href="https://infohq.in"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#7C5CE8]"
            >
              <span>Visit InfoHQ.in</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { client, overview, projects, invoices } = data;

  return (
    <div className="min-h-screen bg-[#F8F8FF] text-[#1A085C] font-sans antialiased pb-16">
      {/* Top Client Portal Navbar */}
      <header className="h-16 bg-white/90 backdrop-blur-md border-b border-[#EAE6F7] sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/infohq-brandlogo.webp" alt="InfoHQ" className="h-7 w-auto object-contain" />
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#F3F0FF] text-[#7C5CE8] border border-purple-200 uppercase tracking-wider">
            Client Portal
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#6B7280] hidden sm:inline">Signed in as:</span>
          <span className="font-bold text-[#1A085C]">{client.name}</span>
          <ShieldCheck size={16} className="text-emerald-600" />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Welcome Client Banner */}
        <div className="bg-white rounded-[24px] border border-[#EAE6F7] p-6 sm:p-8 shadow-[0_8px_30px_rgba(26,8,92,0.04)] relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#7C5CE8] flex items-center gap-1.5 mb-1">
                <Sparkles size={13} /> Official Client Workspace
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A085C]">
                Welcome, {client.name}
              </h1>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1 font-medium">
                {client.company ? `${client.company} • ` : ''}Real-time view of your active deliverables, sprint milestones &amp; invoices.
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-[11px] font-semibold text-[#6B7280] block">Account Identifier</span>
              <span className="text-xs font-bold font-mono text-[#7C5CE8]">{client.id}</span>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#EAE6F7]">
            <div className="p-3.5 bg-[#F8F8FF] rounded-2xl border border-[#EAE6F7]">
              <span className="text-[11px] font-semibold text-[#6B7280] block">Total Contract Value</span>
              <span className="text-base sm:text-lg font-black text-[#1A085C] font-mono">
                {formatCurrency(overview.totalBilled)}
              </span>
            </div>

            <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100">
              <span className="text-[11px] font-semibold text-emerald-800 block">Total Settled</span>
              <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                {formatCurrency(overview.totalPaid)}
              </span>
            </div>

            <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-100">
              <span className="text-[11px] font-semibold text-purple-800 block">Pending Balance</span>
              <span className="text-base sm:text-lg font-black text-[#7C5CE8] font-mono">
                {formatCurrency(overview.totalPending)}
              </span>
            </div>

            <div className="p-3.5 bg-[#F8F8FF] rounded-2xl border border-[#EAE6F7]">
              <span className="text-[11px] font-semibold text-[#6B7280] block">Active Deliverables</span>
              <span className="text-base sm:text-lg font-black text-[#1A085C] font-mono">
                {overview.activeProjectsCount} Project{overview.activeProjectsCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: Active Projects & Sprint Progress */}
        <div className="bg-white rounded-[24px] border border-[#EAE6F7] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#EAE6F7]">
            <FolderKanban size={18} className="text-[#7C5CE8]" />
            <h2 className="text-base font-bold text-[#1A085C]">Your Projects &amp; Deliverables</h2>
          </div>

          {projects.length === 0 ? (
            <p className="text-xs text-[#6B7280] italic py-4">No projects currently assigned to this account.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((proj) => {
                const pct = proj.totalTasks > 0 ? Math.round((proj.completedTasks / proj.totalTasks) * 100) : 0;
                return (
                  <div key={proj.id} className="p-4 rounded-2xl border border-[#EAE6F7] bg-[#FAFAFD] space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#1A085C] leading-snug">{proj.title}</h3>
                        <span className="text-[11px] text-[#6B7280] capitalize mt-0.5 block">
                          Status: <strong className="text-[#7C5CE8]">{proj.status.replace('_', ' ')}</strong>
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#7C5CE8]">{pct}% Done</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%)',
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        <span>{proj.completedTasks} of {proj.totalTasks} milestones done</span>
                      </span>
                      {proj.targetDate && (
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar size={13} /> Due: {formatISTDate(proj.targetDate)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Invoices & Payment Links */}
        <div className="bg-white rounded-[24px] border border-[#EAE6F7] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#EAE6F7]">
            <Receipt size={18} className="text-[#7C5CE8]" />
            <h2 className="text-base font-bold text-[#1A085C]">Invoices &amp; Online Payment</h2>
          </div>

          {invoices.length === 0 ? (
            <p className="text-xs text-[#6B7280] italic py-4">No invoices issued for this account yet.</p>
          ) : (
            <div className="divide-y divide-[#F0EDF9]">
              {invoices.map((inv) => {
                const isPaid = inv.status === 'received';
                return (
                  <div key={inv.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#7C5CE8]">{inv.invoiceNumber || inv.id.slice(0, 10)}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isPaid ? 'PAID' : 'PENDING'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[#1A085C]">{inv.title}</h4>
                      <div className="text-[11px] text-[#6B7280]">
                        Issued: {formatISTDate(inv.createdAt)} {inv.dueDate ? `• Due: ${formatISTDate(inv.dueDate)}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-base font-black text-[#1A085C] font-mono">
                          {formatCurrency(inv.amount)}
                        </span>
                        {isPaid && (
                          <span className="text-[10.5px] text-emerald-700 block font-semibold">
                            Paid on {formatISTDate(inv.paidAt || inv.createdAt)}
                          </span>
                        )}
                      </div>

                      {!isPaid && inv.razorpayPaymentLinkUrl && (
                        <a
                          href={inv.razorpayPaymentLinkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="h-9 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5B4CF5] to-[#7C5CE8] flex items-center gap-1.5 shadow-md hover:opacity-95"
                        >
                          <span>Pay Now</span>
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
