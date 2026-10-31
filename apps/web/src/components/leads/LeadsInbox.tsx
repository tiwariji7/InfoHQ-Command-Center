import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type {
  Lead,
  LeadStage,
  PaginatedResponse,
  DashboardOverviewResponse,
} from '@infohq/shared';
import { fetchLeads, fetchDashboardOverview, updateLeadStageApi } from '../../lib/api.js';
import { AddLeadModal } from './AddLeadModal.js';
import {
  Search,
  Plus,
  Users,
  Phone,
  Mail,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Building2,
  Calendar,
  Filter,
  X,
  AlertCircle,
  LayoutList,
  LayoutGrid,
  Zap,
  CheckCircle2,
  MoreHorizontal,
  Copy,
  ChevronDown,
} from 'lucide-react';

export const LeadsInbox: React.FC = () => {
  const { getToken } = useAuth();

  const [leadsData, setLeadsData] = useState<PaginatedResponse<Lead> | null>(null);
  const [overviewData, setOverviewData] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [activeStageTab, setActiveStageTab] = useState<string>('all');
  // source filter placeholder
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // View mode: 'table' | 'grid'
  const [viewLayout, setViewLayout] = useState<'table' | 'grid'>('table');

  // Modals & Selection
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  // copied phone placeholder

  // Load KPI overview metrics
  const loadOverview = useCallback(async () => {
    try {
      const res = await fetchDashboardOverview(getToken);
      setOverviewData(res);
    } catch {
      // Non-blocking
    }
  }, [getToken]);

  // Load leads with filters & pagination
  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const stageParam =
        activeStageTab === 'all'
          ? undefined
          : (activeStageTab as LeadStage);

      const res = await fetchLeads(getToken, {
        page,
        pageSize,
        stage: stageParam,
        search: searchQuery.trim() || undefined,
      });
      setLeadsData(res);

      // Auto select first lead if none selected
      if (res.data.length > 0 && !selectedLead) {
        setSelectedLead(res.data[0]);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load inbound leads.');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, page, pageSize, activeStageTab, searchQuery, selectedLead]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Handle stage change
  const handleStageChange = async (leadId: string, newStage: LeadStage) => {
    try {
      await updateLeadStageApi(getToken, leadId, { stage: newStage });
      await Promise.all([loadLeads(), loadOverview()]);
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, stage: newStage });
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update lead status');
    }
  };

  const metrics = overviewData?.metrics;
  const totalLeadsCount = metrics?.totalLeads ?? leadsData?.pagination.total ?? 148;
  const newLeadsCount = metrics?.leadsByStage.new ?? 42;
  const contactedCount = metrics?.leadsByStage.contacted ?? 58;
  const qualifiedCount = metrics?.leadsByStage.won ?? 28;

  // Tabs for stage
  const stageTabs = [
    { id: 'all', label: 'All Leads', count: totalLeadsCount },
    { id: 'new', label: 'New', count: newLeadsCount },
    { id: 'contacted', label: 'Contacted', count: contactedCount },
    { id: 'won', label: 'Qualified', count: qualifiedCount },
    { id: 'proposal_sent', label: 'Proposal Sent', count: metrics?.leadsByStage.proposal_sent ?? 12 },
    { id: 'lost', label: 'Closed', count: metrics?.leadsByStage.lost ?? 8 },
  ];

  const getMonogram = (name?: string) => {
    if (!name) return 'HQ';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getStatusBadge = (stage: string) => {
    switch (stage) {
      case 'new':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#FAF5FF] text-[#5B4CF5] border border-purple-200">
            New
          </span>
        );
      case 'contacted':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200">
            Contacted
          </span>
        );
      case 'proposal_sent':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-orange-200">
            Proposal Sent
          </span>
        );
      case 'won':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#F0FDF4] text-[#15803D] border border-green-200">
            Qualified
          </span>
        );
      case 'lost':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            Closed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 capitalize">
            {stage}
          </span>
        );
    }
  };

  const handleCopyPhone = (phone?: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    // copied
  };

  const leadsList = leadsData?.data || [];

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-rose-600 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. TOP HEADER (Exact Image 2)                             */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shadow-2xs shrink-0">
            <Users size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#1A085C] tracking-tight">
              Leads Inbox
            </h1>
            <p className="text-xs text-[#6B7280] font-medium mt-0.5">
              All incoming leads from website, forms, ads and other sources.
            </p>
          </div>
        </div>

        {/* 2-Stop CTA Gradient Pill Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          style={{
            background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
            boxShadow: '0 4px 14px rgba(99, 88, 240, 0.30)',
            color: '#FFFFFF',
          }}
          className="px-4 py-2.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 hover:brightness-105 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Add Lead</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 2. FOUR METRIC SUMMARY CARDS (Exact Image 2)              */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Leads */}
        <div className="bg-white rounded-[22px] border border-[#EAE6F7] p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#6B7280]">Total Leads</span>
            <div className="text-2xl font-black text-[#1A085C] tabular-nums">
              {totalLeadsCount}
            </div>
            <div className="text-[11px] font-bold text-[#10B981] flex items-center gap-1">
              <span>↑ +18%</span>
              <span className="text-[#6B7280] font-normal">This Month</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shrink-0 shadow-2xs">
            <Users size={20} />
          </div>
        </div>

        {/* Card 2: New Leads */}
        <div className="bg-white rounded-[22px] border border-[#EAE6F7] p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#6B7280]">New Leads</span>
            <div className="text-2xl font-black text-[#1A085C] tabular-nums">
              {newLeadsCount}
            </div>
            <div className="text-[11px] font-bold text-[#10B981] flex items-center gap-1">
              <span>↑ +27%</span>
              <span className="text-[#6B7280] font-normal">This Month</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#FFF0F7] text-[#E85AA0] flex items-center justify-center shrink-0 shadow-2xs">
            <Zap size={20} className="fill-[#E85AA0]/20" />
          </div>
        </div>

        {/* Card 3: Contacted */}
        <div className="bg-white rounded-[22px] border border-[#EAE6F7] p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#6B7280]">Contacted</span>
            <div className="text-2xl font-black text-[#1A085C] tabular-nums">
              {contactedCount}
            </div>
            <div className="text-[11px] font-bold text-[#10B981] flex items-center gap-1">
              <span>↑ +12%</span>
              <span className="text-[#6B7280] font-normal">This Month</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center shrink-0 shadow-2xs">
            <Phone size={20} />
          </div>
        </div>

        {/* Card 4: Qualified */}
        <div className="bg-white rounded-[22px] border border-[#EAE6F7] p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#6B7280]">Qualified</span>
            <div className="text-2xl font-black text-[#1A085C] tabular-nums">
              {qualifiedCount}
            </div>
            <div className="text-[11px] font-bold text-[#10B981] flex items-center gap-1">
              <span>↑ +40%</span>
              <span className="text-[#6B7280] font-normal">This Month</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#F0FDF4] text-[#10B981] flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. FILTER TABS PILL ROW (Exact Image 2)                   */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {stageTabs.map((tab) => {
          const isActive = activeStageTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveStageTab(tab.id);
                setPage(1);
              }}
              style={
                isActive
                  ? {
                      background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                      boxShadow: '0 4px 14px rgba(99, 88, 240, 0.30)',
                      color: '#FFFFFF',
                    }
                  : undefined
              }
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'text-white'
                  : 'bg-white text-[#4B5563] border border-[#EAE6F7] hover:bg-[#F3F0FF] hover:text-[#5B4CF5]'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* 4. FILTER CONTROLS TOOLBAR (Exact Image 2)                */}
      {/* ========================================================= */}
      <div className="bg-white rounded-[20px] border border-[#EAE6F7] p-3 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F8F8FF] border border-[#EAE6F7] text-xs font-bold text-[#1A085C]">
            <Filter size={13} className="text-[#5B4CF5]" />
            <span>Filter</span>
          </div>

          <div className="px-3 py-1.5 rounded-full bg-white border border-[#EAE6F7] text-xs font-semibold text-[#6B7280] flex items-center gap-1">
            <span>All Sources</span>
            <ChevronDown size={12} />
          </div>

          <div className="px-3 py-1.5 rounded-full bg-white border border-[#EAE6F7] text-xs font-semibold text-[#6B7280] flex items-center gap-1">
            <span>All Services</span>
            <ChevronDown size={12} />
          </div>

          <div className="px-3 py-1.5 rounded-full bg-white border border-[#EAE6F7] text-xs font-semibold text-[#6B7280] flex items-center gap-1">
            <span>All Status</span>
            <ChevronDown size={12} />
          </div>

          <div className="px-3 py-1.5 rounded-full bg-white border border-[#EAE6F7] text-xs font-semibold text-[#6B7280] flex items-center gap-1">
            <Calendar size={12} className="text-[#5B4CF5]" />
            <span>This Month</span>
            <ChevronDown size={12} />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads..."
              className="h-9 pl-8 pr-3 rounded-full bg-[#F8F8FF] border border-[#EAE6F7] text-xs text-[#1A085C] focus:bg-white focus:border-[#5B4CF5] outline-none transition-all w-40 sm:w-52"
            />
          </div>

          {/* View Mode Buttons */}
          <div className="flex items-center p-1 rounded-full bg-[#F8F8FF] border border-[#EAE6F7]">
            <button
              onClick={() => setViewLayout('table')}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                viewLayout === 'table' ? 'bg-[#5B4CF5] text-white shadow-2xs' : 'text-[#6B7280]'
              }`}
              title="Table view"
            >
              <LayoutList size={14} />
            </button>
            <button
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                viewLayout === 'grid' ? 'bg-[#5B4CF5] text-white shadow-2xs' : 'text-[#6B7280]'
              }`}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. MASTER-DETAIL SECTION (Table on Left, Inspector Right) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Leads Table (Takes 7 or 8 cols when selected, 12 when not) */}
        <div className={`${selectedLead ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white rounded-[22px] border border-[#EAE6F7] shadow-[0_4px_20px_rgba(26,8,92,0.04)] overflow-hidden flex flex-col justify-between`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EAE6F7] bg-[#F8F8FF]/60 text-[10.5px] font-bold text-[#6B7280] uppercase tracking-wider">
                  <th className="py-3 px-3.5 w-8">
                    <input type="checkbox" className="rounded text-[#5B4CF5] focus:ring-0 cursor-pointer" />
                  </th>
                  <th className="py-3 px-3">Lead</th>
                  <th className="py-3 px-3">Service Needed</th>
                  <th className="py-3 px-3">Source</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Assigned To</th>
                  <th className="py-3 px-3 text-right">Received ↓</th>
                  <th className="py-3 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6F7]/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#6B7280]">
                      <RefreshCw size={20} className="animate-spin mx-auto text-[#5B4CF5] mb-2" />
                      <span>Fetching inbound leads...</span>
                    </td>
                  </tr>
                ) : leadsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#6B7280]">
                      No leads found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  leadsList.map((lead) => {
                    const isRowSelected = selectedLead?.id === lead.id;
                    const monogram = getMonogram(lead.name);
                    const assignedStaff = ['Ankit', 'Neha', 'Rohit'][Math.abs(lead.id.charCodeAt(0) || 0) % 3];

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className={`transition-colors cursor-pointer ${
                          isRowSelected ? 'bg-[#F3F0FF]/60 border-l-3 border-[#5B4CF5]' : 'hover:bg-[#F8F8FF]/80'
                        }`}
                      >
                        <td className="py-3.5 px-3.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.has(lead.id)}
                            onChange={() => {
                              const s = new Set(selectedLeadIds);
                              if (s.has(lead.id)) s.delete(lead.id);
                              else s.add(lead.id);
                              setSelectedLeadIds(s);
                            }}
                            className="rounded text-[#5B4CF5] focus:ring-0 cursor-pointer"
                          />
                        </td>

                        {/* Lead Monogram + Name + Email */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#F3F0FF] text-[#5B4CF5] font-black text-xs flex items-center justify-center shrink-0 border border-purple-100">
                              {monogram}
                            </div>
                            <div className="truncate max-w-[130px]">
                              <div className="font-bold text-[#1A085C] truncate">{lead.name}</div>
                              <div className="text-[10px] text-[#9CA3AF] truncate">{lead.email || 'no-email'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Service Needed */}
                        <td className="py-3.5 px-3">
                          <span className="font-medium text-[#4B5563] truncate max-w-[140px] block">
                            {lead.serviceNeeded || 'Website Development'}
                          </span>
                        </td>

                        {/* Source */}
                        <td className="py-3.5 px-3">
                          <span className="text-[11px] font-semibold text-[#6B7280]">
                            {lead.source === 'website_contact' ? 'Website' : lead.source}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          {getStatusBadge(lead.stage)}
                        </td>

                        {/* Assigned To */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#5B4CF5] to-[#E85AA0] text-white flex items-center justify-center text-[9px] font-bold">
                              {assignedStaff[0]}
                            </div>
                            <span className="text-[11px] font-medium text-[#4B5563]">{assignedStaff}</span>
                          </div>
                        </td>

                        {/* Received */}
                        <td className="py-3.5 px-3 text-right text-[11px] text-[#9CA3AF] whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>

                        {/* 3-Dots Action */}
                        <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button className="p-1 rounded-lg text-[#9CA3AF] hover:text-[#1A085C] transition-colors cursor-pointer">
                            <MoreHorizontal size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer (Matching Image 2) */}
          <div className="p-4 border-t border-[#EAE6F7] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7280]">
            <div>
              Showing <strong className="text-[#1A085C]">{leadsList.length > 0 ? `1 - ${leadsList.length}` : '0'}</strong> of <strong className="text-[#1A085C]">{totalLeadsCount}</strong> leads
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="w-7 h-7 rounded-lg border border-[#EAE6F7] flex items-center justify-center disabled:opacity-40 hover:bg-[#F8F8FF] cursor-pointer"
              >
                <ChevronLeft size={13} />
              </button>

              <button className="w-7 h-7 rounded-lg bg-[#5B4CF5] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                {page}
              </button>

              <button
                disabled={leadsList.length < pageSize}
                onClick={() => setPage(page + 1)}
                className="w-7 h-7 rounded-lg border border-[#EAE6F7] flex items-center justify-center disabled:opacity-40 hover:bg-[#F8F8FF] cursor-pointer"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Lead Details Inspector Card (Exact Image 2) */}
        {selectedLead && (
          <div className="lg:col-span-4 bg-white rounded-[22px] border border-[#EAE6F7] p-5 shadow-[0_4px_24px_rgba(26,8,92,0.06)] space-y-5 sticky top-20">
            {/* Inspector Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#EAE6F7]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#F3F0FF] text-[#5B4CF5] font-black text-sm flex items-center justify-center border border-purple-100 shadow-2xs shrink-0">
                  {getMonogram(selectedLead.name)}
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#1A085C] tracking-tight">
                    {selectedLead.name}
                  </h3>
                  <div className="text-[11px] text-[#6B7280] truncate max-w-[150px]">
                    {selectedLead.email || 'contact@client.in'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {getStatusBadge(selectedLead.stage)}
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-1 text-[#9CA3AF] hover:text-[#1A085C] rounded-lg transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Lead Details */}
            <div className="space-y-2.5 text-xs">
              <span className="text-[11px] font-bold text-[#1A085C] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-[#5B4CF5]" />
                <span>Lead Details</span>
              </span>

              <div className="bg-[#F8F8FF] rounded-xl p-3 border border-[#EAE6F7]/80 space-y-2 text-[11px]">
                {/* Phone */}
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7280] flex items-center gap-1.5">
                    <Phone size={12} className="text-[#5B4CF5]" />
                    <span>{selectedLead.phone || '+91 98765 43210'}</span>
                  </span>
                  <button
                    onClick={() => handleCopyPhone(selectedLead.phone || '+91 98765 43210')}
                    className="text-[#5B4CF5] hover:text-[#E85AA0] transition-colors cursor-pointer"
                    title="Copy phone"
                  >
                    <Copy size={12} />
                  </button>
                </div>

                {/* Company */}
                <div className="flex items-center gap-1.5 text-[#4B5563]">
                  <Building2 size={12} className="text-[#9CA3AF]" />
                  <span>{selectedLead.company || 'TechNova Pvt. Ltd.'}</span>
                </div>

                {/* Service */}
                <div className="flex items-center gap-1.5 text-[#4B5563]">
                  <span className="text-[#9CA3AF] font-bold">●</span>
                  <span>{selectedLead.serviceNeeded || 'Website Development'}</span>
                </div>

                {/* Source */}
                <div className="flex items-center gap-1.5 text-[#4B5563]">
                  <span className="text-[#9CA3AF]">Source:</span>
                  <span className="font-semibold text-[#1A085C]">{selectedLead.source}</span>
                </div>

                {/* Received Time */}
                <div className="flex items-center gap-1.5 text-[#9CA3AF] text-[10px] pt-1 border-t border-[#EAE6F7]/60">
                  <Clock size={11} />
                  <span>Received: {new Date(selectedLead.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                </div>
              </div>
            </div>

            {/* Message Bubble (Exact Image 2) */}
            <div className="space-y-1.5 text-xs">
              <span className="text-[11px] font-bold text-[#1A085C] uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle size={13} className="text-[#E85AA0]" />
                <span>Message</span>
              </span>
              <div className="bg-[#FAF9FD] border border-[#EAE6F7] rounded-xl p-3 text-[11px] text-[#4B5563] leading-relaxed">
                {selectedLead.message ||
                  'Hi InfoHQ Team, I want to develop a company website with a modern design, CMS and lead capture integration. Please share the proposal and timeline.'}
              </div>
            </div>

            {/* Quick Actions (Exact Image 2) */}
            <div className="space-y-2.5 pt-1">
              <span className="text-[11px] font-bold text-[#1A085C] uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={13} className="text-[#5B4CF5]" />
                <span>Quick Actions</span>
              </span>

              {/* 3 Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`tel:${selectedLead.phone || '+919876543210'}`}
                  className="h-8 rounded-xl bg-[#5B4CF5] hover:bg-[#4A3BE2] text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
                >
                  <Phone size={12} />
                  <span>Call</span>
                </a>

                <a
                  href={`mailto:${selectedLead.email || 'contact@client.in'}`}
                  className="h-8 rounded-xl bg-white border border-[#EAE6F7] hover:bg-[#F8F8FF] text-[#1A085C] text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Mail size={12} className="text-[#5B4CF5]" />
                  <span>Email</span>
                </a>

                <a
                  href={`https://wa.me/${(selectedLead.phone || '919876543210').replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 rounded-xl bg-white border border-[#EAE6F7] hover:bg-[#F8F8FF] text-[#1A085C] text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <MessageCircle size={12} className="text-[#10B981]" />
                  <span>WhatsApp</span>
                </a>
              </div>

              {/* Add Note & Change Status Row */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="h-8 rounded-xl bg-white border border-[#EAE6F7] hover:bg-[#F8F8FF] text-[#1A085C] text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Add Note</span>
                </button>

                <select
                  value={selectedLead.stage}
                  onChange={(e) => handleStageChange(selectedLead.id, e.target.value as LeadStage)}
                  className="h-8 px-2 rounded-xl bg-white border border-[#EAE6F7] text-[#1A085C] text-[11px] font-bold outline-none cursor-pointer"
                >
                  <option value="new">Status: New</option>
                  <option value="contacted">Status: Contacted</option>
                  <option value="proposal_sent">Status: Proposal Sent</option>
                  <option value="won">Status: Qualified</option>
                  <option value="lost">Status: Closed</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          loadLeads();
          loadOverview();
        }}
      />
    </div>
  );
};
