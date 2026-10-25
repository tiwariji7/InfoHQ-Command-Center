import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Lead, LeadStage, LeadSource, PaginatedResponse } from '@infohq/shared';
import { fetchLeads } from '../../lib/api.js';
import { AddLeadModal } from './AddLeadModal.js';
import { LeadDetailDrawer } from './LeadDetailDrawer.js';
import {
  Search,
  Plus,
  Inbox,
  Phone,
  Mail,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

const STAGE_FILTERS: Array<{ id: LeadStage | 'all'; label: string }> = [
  { id: 'all', label: 'All Leads' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'proposal_sent', label: 'Proposal Sent' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

function getStageBadgeClasses(stage: LeadStage): string {
  switch (stage) {
    case 'new':
      return 'bg-[#FAF5FF] text-[#6B21A8] border-[#E9D5FF]';
    case 'contacted':
      return 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]';
    case 'proposal_sent':
      return 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]';
    case 'won':
      return 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]';
    case 'lost':
      return 'bg-[#F4F3F9] text-[#6B7280] border-[#EAE6F7]';
    default:
      return 'bg-brand-section text-brand-muted border-brand-border';
  }
}

function getSourceLabel(source: LeadSource): string {
  switch (source) {
    case 'website_contact':
      return 'Website Contact';
    case 'whatsapp_click':
      return 'WhatsApp Click';
    case 'linkedin':
      return 'LinkedIn';
    case 'referral':
      return 'Referral';
    case 'phone_call':
      return 'Phone Call';
    case 'other':
      return 'Other';
    default:
      return source;
  }
}

function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getWhatsAppDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export const LeadsInbox: React.FC = () => {
  const { getToken } = useAuth();

  const [leadsData, setLeadsData] = useState<PaginatedResponse<Lead> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchLeads(getToken, {
        page,
        pageSize,
        stage: stageFilter === 'all' ? undefined : stageFilter,
        search: searchQuery.trim() || undefined,
      });
      setLeadsData(res);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load leads.');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, page, pageSize, stageFilter, searchQuery]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  function handleStageChange(stage: LeadStage | 'all') {
    setStageFilter(stage);
    setPage(1);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadLeads();
  }

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-heading">
            Leads Inbox
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
            Centralized repository for website inquiries, calls, and referrals.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="hq-btn-primary self-start sm:self-auto text-sm"
        >
          <Plus size={16} />
          Add Lead
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="hq-card bg-white p-4 space-y-3 border-brand-border">
        {/* Stage Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {STAGE_FILTERS.map((filter) => {
            const isActive = stageFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => handleStageChange(filter.id)}
                className={`px-3 py-1.5 rounded-chip text-xs font-medium border transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                    : 'bg-brand-section text-brand-body border-brand-border hover:bg-brand-wash/40'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-lightGray pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client name, email, or phone..."
              className="w-full h-10 pl-9 pr-3 rounded-control border border-brand-border text-xs sm:text-sm text-brand-heading placeholder:text-brand-lightGray focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            />
          </div>
          <button type="submit" className="hq-btn-secondary text-xs sm:text-sm px-4">
            Search
          </button>
        </form>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="p-4 rounded-control bg-brand-errorBg border border-red-200 text-xs text-brand-destructive flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={loadLeads} className="underline font-medium">
            Retry
          </button>
        </div>
      )}

      {/* Table / Cards Container */}
      <div className="hq-card bg-white p-0 overflow-hidden border-brand-border">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 size={24} className="animate-spin text-brand-primary" />
            <span className="text-xs text-brand-muted">Loading leads...</span>
          </div>
        ) : !leadsData || leadsData.data.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-section text-brand-muted flex items-center justify-center mx-auto mb-3">
              <Inbox size={22} />
            </div>
            <h3 className="text-sm font-semibold text-brand-heading">
              No Leads Found
            </h3>
            <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
              {searchQuery || stageFilter !== 'all'
                ? 'No leads matched your filter criteria. Try adjusting the filter or search keyword.'
                : 'Your leads inbox is empty. Add a lead manually to get started.'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="hq-btn-secondary mt-4 text-xs"
            >
              <Plus size={14} />
              Add First Lead
            </button>
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table View (hidden on mobile <= 767px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-brand-border bg-brand-section text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Service & Budget</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Quick Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-sm">
                  {leadsData.data.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className="hover:bg-brand-section/50 transition-colors cursor-pointer"
                    >
                      {/* Name & Company */}
                      <td className="py-3.5 px-4 font-semibold text-brand-heading">
                        <div>{lead.name}</div>
                        {lead.company && (
                          <div className="text-[11px] font-normal text-brand-muted">
                            {lead.company}
                          </div>
                        )}
                      </td>

                      {/* Phone & Email */}
                      <td className="py-3.5 px-4 text-xs space-y-0.5">
                        {lead.phone && (
                          <div className="text-brand-heading font-mono text-[11px]">
                            {lead.phone}
                          </div>
                        )}
                        {lead.email && (
                          <div className="text-brand-muted truncate max-w-[180px]">
                            {lead.email}
                          </div>
                        )}
                        {!lead.phone && !lead.email && (
                          <span className="text-brand-lightGray italic text-xs">
                            None provided
                          </span>
                        )}
                      </td>

                      {/* Service & Budget */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-brand-heading truncate max-w-[160px]">
                          {lead.serviceNeeded || '—'}
                        </div>
                        {lead.budget && (
                          <div className="text-brand-muted font-medium tabular-nums text-[11px]">
                            ₹{lead.budget}
                          </div>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-chip text-[11px] font-medium bg-brand-section border border-brand-border text-brand-body">
                          {getSourceLabel(lead.source)}
                        </span>
                      </td>

                      {/* Stage Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-chip text-[11px] font-semibold border capitalize ${getStageBadgeClasses(
                            lead.stage
                          )}`}
                        >
                          {lead.stage.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Created date */}
                      <td className="py-3.5 px-4 text-xs text-brand-muted whitespace-nowrap">
                        {formatDate(lead.createdAt)}
                      </td>

                      {/* Quick Contact Icons */}
                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="inline-flex items-center gap-1.5 justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.phone && (
                            <>
                              <a
                                href={`tel:${lead.phone}`}
                                title="Call Client"
                                className="p-1.5 rounded-chip text-brand-muted hover:text-brand-primary hover:bg-brand-subtle transition-colors"
                              >
                                <Phone size={15} />
                              </a>
                              <a
                                href={`https://wa.me/${getWhatsAppDigits(lead.phone)}`}
                                target="_blank"
                                rel="noreferrer"
                                title="WhatsApp Chat"
                                className="p-1.5 rounded-chip text-brand-muted hover:text-green-600 hover:bg-green-50 transition-colors"
                              >
                                <MessageCircle size={15} />
                              </a>
                            </>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              title="Email Client"
                              className="p-1.5 rounded-chip text-brand-muted hover:text-brand-primary hover:bg-brand-subtle transition-colors"
                            >
                              <Mail size={15} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (<= 767px) */}
            <div className="md:hidden divide-y divide-brand-border">
              {leadsData.data.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className="p-4 space-y-2.5 cursor-pointer hover:bg-brand-section/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-base font-bold text-brand-heading">
                        {lead.name}
                      </h4>
                      {lead.company && (
                        <div className="text-xs text-brand-muted font-medium">
                          {lead.company}
                        </div>
                      )}
                      <span className="text-[11px] text-brand-muted">
                        {getSourceLabel(lead.source)} • {formatDate(lead.createdAt)}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-chip text-[11px] font-semibold border capitalize ${getStageBadgeClasses(
                        lead.stage
                      )}`}
                    >
                      {lead.stage.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-xs text-brand-body space-y-1 bg-brand-section/50 p-2.5 rounded-control border border-brand-border/60">
                    {lead.serviceNeeded && (
                      <div>
                        <span className="text-brand-muted">Service:</span> {lead.serviceNeeded}
                      </div>
                    )}
                    {lead.budget && (
                      <div>
                        <span className="text-brand-muted">Budget:</span> ₹{lead.budget}
                      </div>
                    )}
                    {lead.phone && (
                      <div>
                        <span className="text-brand-muted">Phone:</span> {lead.phone}
                      </div>
                    )}
                    {lead.email && (
                      <div className="truncate">
                        <span className="text-brand-muted">Email:</span> {lead.email}
                      </div>
                    )}
                  </div>

                  {/* Mobile Quick Action Buttons (min 44px touch targets) */}
                  <div
                    className="flex items-center gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lead.phone && (
                      <>
                        <a
                          href={`tel:${lead.phone}`}
                          className="flex-1 h-10 rounded-control bg-brand-section border border-brand-border flex items-center justify-center gap-1.5 text-xs font-medium text-brand-heading"
                        >
                          <Phone size={15} className="text-brand-primary" />
                          Call
                        </a>
                        <a
                          href={`https://wa.me/${getWhatsAppDigits(lead.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 h-10 rounded-control bg-green-50 border border-green-200 flex items-center justify-center gap-1.5 text-xs font-medium text-green-700"
                        >
                          <MessageCircle size={15} />
                          WhatsApp
                        </a>
                      </>
                    )}
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex-1 h-10 rounded-control bg-brand-section border border-brand-border flex items-center justify-center gap-1.5 text-xs font-medium text-brand-heading"
                      >
                        <Mail size={15} className="text-brand-primary" />
                        Email
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-4 py-3 bg-brand-section border-t border-brand-border text-xs">
              <span className="text-brand-muted">
                Showing{' '}
                <strong className="text-brand-heading">
                  {leadsData.data.length}
                </strong>{' '}
                of <strong className="text-brand-heading">{leadsData.pagination.total}</strong> leads
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={leadsData.pagination.page <= 1}
                  className="p-1.5 rounded-chip border border-brand-border bg-white text-brand-heading disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-wash/30 transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-brand-heading font-medium">
                  {leadsData.pagination.page} / {leadsData.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(leadsData.pagination.totalPages, p + 1))}
                  disabled={leadsData.pagination.page >= leadsData.pagination.totalPages}
                  className="p-1.5 rounded-chip border border-brand-border bg-white text-brand-heading disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-wash/30 transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          loadLeads();
        }}
      />

      <LeadDetailDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onLeadUpdated={() => {
          loadLeads();
        }}
      />
    </div>
  );
};
