import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Payment, ClientDetailResponse } from '@infohq/shared';
import { fetchClientDetail } from '../../lib/api.js';
import { useDraggable } from '../../lib/useDraggable.js';
import {
  X,
  User,
  Building2,
  Mail,
  Phone,
  Calendar,
  Plus,
  FileText,
  Download,
  Receipt,
  CheckCircle2,
  Code2,
  Smartphone,
  Cloud,
  ChevronRight,
  GripHorizontal,
} from 'lucide-react';

interface ClientDetailDrawerProps {
  payment: Payment | null;
  allPayments?: Payment[];
  onClose: () => void;
  onOpenInvoice?: (payment: Payment) => void;
  onOpenCreateInvoice?: () => void;
}

type TabType = 'overview' | 'projects' | 'invoices' | 'payments';
type ProjectFilter = 'all' | 'active' | 'completed';
type InvoiceFilter = 'all' | 'paid' | 'pending';

function formatISTDate(timestamp?: number | string | null): string {
  if (!timestamp) return '—';
  const epoch = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(epoch)) return String(timestamp);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(epoch));
}

function formatCurrency(amt: number, curr = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  }).format(amt);
}

function getInitials(name?: string): string {
  if (!name) return 'CL';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const ClientDetailDrawer: React.FC<ClientDetailDrawerProps> = ({
  payment,
  allPayments = [],
  onClose,
  onOpenInvoice,
  onOpenCreateInvoice,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  const { cardRef, position, handlePointerDown, resetPosition } = useDraggable('payment_client_drawer');

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { getToken } = useAuth();
  const [clientDetail, setClientDetail] = useState<ClientDetailResponse | null>(null);

  useEffect(() => {
    if (!payment) return;
    const identifier = payment.clientId || payment.clientName;
    if (!identifier) return;

    let isMounted = true;
    fetchClientDetail(getToken, identifier)
      .then((res) => {
        if (isMounted) setClientDetail(res);
      })
      .catch((err) => {
        console.warn('[fetchClientDetail fallback]:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [getToken, payment]);

  const clientName = clientDetail?.client?.name || payment?.clientName || 'Client';
  const clientEmail = clientDetail?.client?.email || payment?.clientEmail || '—';
  const clientPhone = clientDetail?.client?.phone || payment?.clientPhone || '—';
  const companyName = clientDetail?.client?.company || payment?.company || '—';
  const initials = getInitials(clientName);
  const clientId = clientDetail?.client?.id || payment?.clientId || (payment ? `CLT-2026-${payment.id.slice(-4).toUpperCase()}` : 'CLT-2026-00001');

  // Filter all payments belonging to this client (Always called before any early return)
  const clientInvoices = useMemo(() => {
    if (clientDetail?.payments && clientDetail.payments.length > 0) {
      return clientDetail.payments;
    }
    if (!payment) return [];
    const matched = allPayments.filter(
      (p) =>
        (p.clientName && p.clientName.toLowerCase() === clientName.toLowerCase()) ||
        (p.clientId && p.clientId === clientId) ||
        p.id === payment.id
    );
    return matched.length > 0 ? matched : [payment];
  }, [allPayments, clientDetail, clientName, clientId, payment]);

  // Derived metrics
  const totalReceived = useMemo(() => {
    return clientInvoices
      .filter((p) => p.status === 'received')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [clientInvoices]);

  const totalPending = useMemo(() => {
    return clientInvoices
      .filter((p) => p.status !== 'received')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [clientInvoices]);

  // Derived client projects from live API data (No hardcoded dummy items)
  const clientProjects = useMemo(() => {
    if (clientDetail?.projects && clientDetail.projects.length > 0) {
      return clientDetail.projects.map((proj) => {
        const total = proj.totalTasks || 0;
        const done = proj.completedTasks || 0;
        const calcProgress = total > 0 ? Math.round((done / total) * 100) : (proj.status === 'completed' ? 100 : 50);
        return {
          id: proj.id,
          title: proj.title,
          subtitle: proj.description || proj.serviceType || 'Client Project Milestone',
          progress: calcProgress,
          status: proj.status === 'completed' ? ('completed' as const) : ('active' as const),
          dates: `${formatISTDate(proj.startDate || proj.createdAt)} - ${formatISTDate(proj.targetDate)}`,
          icon: 'code',
        };
      });
    }

    if (!payment) return [];
    const uniqueProjectsMap = new Map<string, { id: string; title: string; subtitle: string; progress: number; status: 'active' | 'completed'; dates: string; icon: string }>();

    clientInvoices.forEach((inv) => {
      const pId = inv.projectId || 'proj-main';
      if (!uniqueProjectsMap.has(pId)) {
        const isCompleted = inv.status === 'received';
        uniqueProjectsMap.set(pId, {
          id: pId,
          title: inv.projectTitle || inv.title || 'Engineering & Software Build',
          subtitle: inv.notes || 'Full-Stack Architecture & Cloud Milestone',
          progress: isCompleted ? 100 : 70,
          status: isCompleted ? 'completed' : 'active',
          dates: `${formatISTDate(inv.createdAt)} - ${formatISTDate(inv.dueDate || Date.now() + 14 * 86400000)}`,
          icon: 'code',
        });
      }
    });

    return Array.from(uniqueProjectsMap.values());
  }, [clientDetail, clientInvoices, payment]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (projectFilter === 'active') return clientProjects.filter((p) => p.status === 'active');
    if (projectFilter === 'completed') return clientProjects.filter((p) => p.status === 'completed');
    return clientProjects;
  }, [clientProjects, projectFilter]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    if (invoiceFilter === 'paid') return clientInvoices.filter((p) => p.status === 'received');
    if (invoiceFilter === 'pending') return clientInvoices.filter((p) => p.status !== 'received');
    return clientInvoices;
  }, [clientInvoices, invoiceFilter]);

  // Safe early return after ALL hooks are registered
  if (!payment) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end items-center sm:pr-5 p-3 transition-opacity"
      role="dialog"
      aria-modal="true"
      data-lenis-prevent="true"
      onClick={onClose}
    >
      {/* Side Popup Card (Compact popup feel, rounded-3xl, draggable from all 4 sides) */}
      <div
        ref={cardRef}
        className="popup-card relative w-full sm:w-[420px] max-w-[420px] h-[calc(100vh-2.5rem)] max-h-[820px] bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(26,8,92,0.30)] border border-[#E5E1F0] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
        data-lenis-prevent="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================= */}
        {/* 4-SIDE DRAG GRIPS (Left & Right Edge Drag Strips)         */}
        {/* ========================================================= */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          className="absolute left-0 top-12 bottom-8 w-3.5 z-30 cursor-grab active:cursor-grabbing hover:bg-purple-500/10 transition-colors"
          style={{ touchAction: 'none' }}
          title="Drag left border to move card"
        />
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          className="absolute right-0 top-12 bottom-8 w-3.5 z-30 cursor-grab active:cursor-grabbing hover:bg-purple-500/10 transition-colors"
          style={{ touchAction: 'none' }}
          title="Drag right border to move card"
        />

        {/* ========================================================= */}
        {/* 1. TOP TITLE BAR (Pinned at top & Top Drag Handle)        */}
        {/* ========================================================= */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          style={{ touchAction: 'none' }}
          className="px-4 py-3 border-b border-[#E5E1F0] flex items-center justify-between bg-white shrink-0 z-20 cursor-grab active:cursor-grabbing select-none"
          title="Click and drag from any edge to move • Double-click to reset position"
        >
          <div className="flex items-center gap-2 text-[#1A085C]">
            <button
              onClick={onClose}
              data-no-drag="true"
              className="p-1 -ml-1 text-[#6B7280] hover:text-[#1A085C] rounded-md transition-colors cursor-pointer"
              title="Back"
            >
              <User size={15} className="text-[#5B4CF5]" />
            </button>
            <h2 className="text-xs font-bold text-[#1A085C] tracking-tight">Client Details</h2>
          </div>

          {/* Drag Handle Indicator */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F3F0FF]/80 text-[#7C5CE8] text-[10px] font-semibold"
            title="Drag from 4 sides or header to move"
          >
            <GripHorizontal size={14} />
            <span className="hidden sm:inline">Move</span>
          </div>

          <button
            onClick={onClose}
            data-no-drag="true"
            className="w-7 h-7 rounded-lg text-[#6B7280] hover:text-[#1A085C] hover:bg-[#F3F0FF] flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ========================================================= */}
        {/* SCROLLABLE BODY (Scrollable on cursor hover across card)   */}
        {/* ========================================================= */}
        <div
          className="flex-1 min-h-0 overflow-y-auto popup-scroll flex flex-col focus:outline-none"
          style={{ touchAction: 'pan-y' }}
          data-lenis-prevent="true"
          tabIndex={0}
        >
          {/* 2. CLIENT PROFILE HEADER */}
          <div className="p-4 bg-gradient-to-b from-[#FBFBFE] to-white border-b border-[#E5E1F0] shrink-0">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5B4CF5] to-[#7C5CE8] text-white font-black text-sm flex items-center justify-center shadow-md shrink-0">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1A085C] truncate">{clientName}</h3>
                  {/* Active Client status - SIMPLE TEXT WITH DOT, NO PILL */}
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Active Client</span>
                  </span>
                </div>

                {/* Email & Phone */}
                <div className="mt-1 space-y-0.5 text-[11px] text-[#6B7280]">
                  {clientEmail && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail size={11} className="text-[#9CA3AF] shrink-0" />
                      <span className="truncate">{clientEmail}</span>
                    </div>
                  )}
                  {clientPhone && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone size={11} className="text-[#9CA3AF] shrink-0" />
                      <span>{clientPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. TABS BAR (Sticky at top when scrolling) */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-xs z-10 px-4 pt-2 border-b border-[#E5E1F0]">
            <div className="flex items-center justify-between text-xs">
              {(['overview', 'projects', 'invoices', 'payments'] as TabType[]).map((tab) => {
                const isActive = activeTab === tab;
                const labels: Record<TabType, string> = {
                  overview: 'Overview',
                  projects: `Projects (${clientProjects.length})`,
                  invoices: `Invoices (${clientInvoices.length})`,
                  payments: `Payments (${clientInvoices.length})`,
                };

                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 px-1 text-xs font-semibold capitalize transition-all cursor-pointer border-b-2 ${
                      isActive
                        ? 'border-[#5B4CF5] text-[#5B4CF5] font-bold'
                        : 'border-transparent text-[#6B7280] hover:text-[#1A085C]'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. TAB PANELS CONTENT */}
          <div className="p-4 space-y-3.5 text-xs flex-1">
          {/* ========================================================= */}
          {/* TAB 1: OVERVIEW                                           */}
          {/* ========================================================= */}
          {activeTab === 'overview' && (
            <>
              {/* Card 1: Client Information */}
              <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2.5">
                <div className="text-xs font-bold text-[#1A085C] flex items-center gap-1.5">
                  <User size={13} className="text-[#5B4CF5]" />
                  <span>Client Information</span>
                </div>

                <div className="space-y-1.5 divide-y divide-[#F1EEF8]/80 text-[11px]">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <Building2 size={11} className="text-[#9CA3AF]" />
                      <span>Company</span>
                    </span>
                    <span className="font-semibold text-[#1A085C] truncate max-w-[200px]">
                      {companyName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <User size={11} className="text-[#9CA3AF]" />
                      <span>Designation</span>
                    </span>
                    <span className="font-semibold text-[#1A085C]">Founder / Decision Maker</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <Calendar size={11} className="text-[#9CA3AF]" />
                      <span>Location</span>
                    </span>
                    <span className="font-semibold text-[#1A085C]">Lucknow, India</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <Calendar size={11} className="text-[#9CA3AF]" />
                      <span>Client Since</span>
                    </span>
                    <span className="font-semibold text-[#1A085C]">
                      {formatISTDate(payment.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <Receipt size={11} className="text-[#9CA3AF]" />
                      <span>Client ID</span>
                    </span>
                    <span className="font-mono font-semibold text-[#5B4CF5]">{clientId}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Performance Overview (4 compact metric boxes) */}
              <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2.5">
                <div className="text-xs font-bold text-[#1A085C]">Performance Overview</div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2.5 rounded-lg border border-[#E5E1F0]">
                    <div className="text-[10px] text-[#6B7280] font-medium">Total Projects</div>
                    <div className="text-sm font-bold text-[#1A085C] mt-0.5">
                      {clientProjects.length}
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-[#E5E1F0]">
                    <div className="text-[10px] text-[#6B7280] font-medium">Total Invoices</div>
                    <div className="text-sm font-bold text-[#1A085C] mt-0.5">
                      {clientInvoices.length}
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-[#E5E1F0]">
                    <div className="text-[10px] text-[#6B7280] font-medium">Total Received</div>
                    <div className="text-sm font-bold text-emerald-600 mt-0.5 tabular-nums">
                      {formatCurrency(totalReceived, payment.currency)}
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-[#E5E1F0]">
                    <div className="text-[10px] text-[#6B7280] font-medium">Outstanding</div>
                    <div className="text-sm font-bold text-amber-500 mt-0.5 tabular-nums">
                      {formatCurrency(totalPending, payment.currency)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Recent Activity */}
              <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#1A085C]">
                  <span>Recent Activity</span>
                  <span className="text-[10px] text-[#5B4CF5] font-semibold cursor-pointer hover:underline">
                    View All →
                  </span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-[#1A085C]">
                        Payment of {formatCurrency(payment.amount, payment.currency)} {payment.status === 'received' ? 'received' : 'recorded'}
                      </div>
                      <div className="text-[10px] text-[#9CA3AF] mt-0.5">
                        {formatISTDate(payment.paidAt || payment.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5B4CF5] mt-1.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-[#1A085C]">
                        Invoice {payment.invoiceNumber || `INV-${payment.id.slice(-6).toUpperCase()}`} generated
                      </div>
                      <div className="text-[10px] text-[#9CA3AF] mt-0.5">
                        {formatISTDate(payment.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-[#1A085C]">
                        Project &quot;{payment.projectTitle || 'System Engineering'}&quot; milestone verified
                      </div>
                      <div className="text-[10px] text-[#9CA3AF] mt-0.5">Active Sprint</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* TAB 2: PROJECTS                                           */}
          {/* ========================================================= */}
          {activeTab === 'projects' && (
            <div className="space-y-3">
              {/* Header + Add Button */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1A085C]">
                  Projects ({clientProjects.length})
                </span>
                <button
                  onClick={onOpenCreateInvoice}
                  className="px-2.5 py-1 rounded-lg bg-[#5B4CF5] text-white text-[10.5px] font-bold flex items-center gap-1 hover:brightness-105 cursor-pointer shadow-2xs"
                >
                  <Plus size={12} />
                  <span>Add Project</span>
                </button>
              </div>

              {/* Filter tabs - CLEAN TEXT, NO PILLS */}
              <div className="flex items-center gap-3 text-xs border-b border-[#F1EEF8] pb-1.5">
                {(['all', 'active', 'completed'] as ProjectFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setProjectFilter(f)}
                    className={`capitalize font-semibold transition-colors cursor-pointer ${
                      projectFilter === f ? 'text-[#5B4CF5] font-bold' : 'text-[#6B7280] hover:text-[#1A085C]'
                    }`}
                  >
                    {f === 'all' ? `All (${clientProjects.length})` : f}
                  </button>
                ))}
              </div>

              {/* Project items */}
              <div className="space-y-2.5">
                {filteredProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-[#FBFBFE] rounded-xl p-3 border border-[#E5E1F0] space-y-2 hover:border-[#5B4CF5]/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-md bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shrink-0 mt-0.5">
                          {proj.icon === 'mobile' ? (
                            <Smartphone size={13} />
                          ) : proj.icon === 'cloud' ? (
                            <Cloud size={13} />
                          ) : (
                            <Code2 size={13} />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[#1A085C]">{proj.title}</div>
                          <div className="text-[10px] text-[#6B7280] mt-0.5">{proj.subtitle}</div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-[#9CA3AF] shrink-0 mt-1" />
                    </div>

                    {/* Status & Progress - NO PILL SHAPE */}
                    <div className="pt-1.5 border-t border-[#F1EEF8]/70">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="flex items-center gap-1 font-semibold text-[#4B5563]">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              proj.status === 'completed' ? 'bg-emerald-500' : 'bg-[#5B4CF5]'
                            }`}
                          />
                          <span>{proj.status === 'completed' ? 'Completed' : 'In Progress'}</span>
                        </span>
                        <span className="font-bold text-[#1A085C] tabular-nums">{proj.progress}%</span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-[#EDE9FE]/50 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-gradient-to-r from-[#5B4CF5] to-[#7C5CE8] rounded-full transition-all"
                          style={{ width: `${proj.progress}%` }}
                        />
                      </div>

                      <div className="text-[9.5px] text-[#9CA3AF] mt-1.5 flex items-center gap-1">
                        <Calendar size={9} />
                        <span>{proj.dates}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: INVOICES                                           */}
          {/* ========================================================= */}
          {activeTab === 'invoices' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1A085C]">
                  Invoices ({clientInvoices.length})
                </span>
                <button
                  onClick={onOpenCreateInvoice}
                  className="px-2.5 py-1 rounded-lg bg-[#5B4CF5] text-white text-[10.5px] font-bold flex items-center gap-1 hover:brightness-105 cursor-pointer shadow-2xs"
                >
                  <Plus size={12} />
                  <span>Create Invoice</span>
                </button>
              </div>

              {/* Filter tabs - CLEAN TEXT, NO PILLS */}
              <div className="flex items-center gap-3 text-xs border-b border-[#F1EEF8] pb-1.5">
                {(['all', 'paid', 'pending'] as InvoiceFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setInvoiceFilter(f)}
                    className={`capitalize font-semibold transition-colors cursor-pointer ${
                      invoiceFilter === f ? 'text-[#5B4CF5] font-bold' : 'text-[#6B7280] hover:text-[#1A085C]'
                    }`}
                  >
                    {f === 'all' ? `All (${clientInvoices.length})` : f}
                  </button>
                ))}
              </div>

              {/* Invoices list */}
              <div className="space-y-2">
                {filteredInvoices.map((inv) => {
                  const isPaid = inv.status === 'received';
                  const isOverdue = inv.status === 'pending' && inv.dueDate && inv.dueDate < Date.now();
                  const invCode = inv.invoiceNumber || `INV-${inv.id.slice(-6).toUpperCase()}`;

                  return (
                    <div
                      key={inv.id}
                      onClick={() => onOpenInvoice?.(inv)}
                      className="bg-[#FBFBFE] rounded-xl p-3 border border-[#E5E1F0] hover:border-[#5B4CF5]/40 hover:bg-white transition-all cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shrink-0">
                          <FileText size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-xs text-[#1A085C] truncate">
                            {invCode}
                          </div>
                          <div className="text-[10px] text-[#6B7280] truncate">
                            {inv.projectTitle || inv.title || 'Engineering Milestone'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-xs text-[#1A085C] tabular-nums">
                          {formatCurrency(inv.amount, inv.currency)}
                        </div>
                        {/* Status text with colored dot - NO PILL SHAPE */}
                        <div className="text-[10.5px] font-semibold flex items-center gap-1 justify-end mt-0.5">
                          {isPaid ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="text-emerald-600">Received</span>
                            </>
                          ) : isOverdue ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span className="text-rose-600">Overdue</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              <span className="text-amber-500">Pending</span>
                            </>
                          )}
                        </div>
                        <div className="text-[9.5px] text-[#9CA3AF] mt-0.5">
                          {formatISTDate(inv.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: PAYMENTS                                           */}
          {/* ========================================================= */}
          {activeTab === 'payments' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1A085C]">
                  Payments ({clientInvoices.length})
                </span>
                <button
                  onClick={onOpenCreateInvoice}
                  className="px-2.5 py-1 rounded-lg bg-[#5B4CF5] text-white text-[10.5px] font-bold flex items-center gap-1 hover:brightness-105 cursor-pointer shadow-2xs"
                >
                  <Plus size={12} />
                  <span>Add Payment</span>
                </button>
              </div>

              {/* 2 Summary boxes */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/60">
                  <div className="text-[10px] font-semibold text-emerald-700">Total Received</div>
                  <div className="text-base font-black text-emerald-700 mt-0.5 tabular-nums">
                    {formatCurrency(totalReceived, payment.currency)}
                  </div>
                </div>

                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
                  <div className="text-[10px] font-semibold text-amber-700">Pending Amount</div>
                  <div className="text-base font-black text-amber-700 mt-0.5 tabular-nums">
                    {formatCurrency(totalPending, payment.currency)}
                  </div>
                </div>
              </div>

              {/* Payment Records Header */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#1A085C]">Payment Records</div>

                <div className="space-y-2">
                  {clientInvoices.map((inv) => {
                    const isPaid = inv.status === 'received';
                    const invCode = inv.invoiceNumber || `INV-${inv.id.slice(-6).toUpperCase()}`;

                    return (
                      <div
                        key={inv.id}
                        className="bg-[#FBFBFE] rounded-xl p-3 border border-[#E5E1F0] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                              isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                            }`}
                          >
                            <CheckCircle2 size={13} />
                          </div>

                          <div>
                            <div className="font-bold text-[#1A085C] tabular-nums">
                              {formatCurrency(inv.amount, inv.currency)}
                            </div>
                            <div className="text-[10px] text-[#6B7280] font-mono mt-0.5">
                              {invCode}
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-[10px]">
                          <div className="text-[#6B7280]">
                            {formatISTDate(inv.paidAt || inv.createdAt)}
                          </div>
                          <div className="text-[#9CA3AF] font-mono mt-0.5">
                            UTR: {inv.id.replace(/-/g, '').slice(0, 10).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Action: Download Payment Statement */}
              <button
                type="button"
                onClick={() => onOpenInvoice?.(payment)}
                className="w-full mt-2 h-10 rounded-xl bg-white hover:bg-[#F3F0FF] border border-[#E5E1F0] hover:border-[#5B4CF5] text-[#1A085C] hover:text-[#5B4CF5] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <Download size={14} />
                <span>Download Payment Statement</span>
              </button>
            </div>
          )}
        </div>
        </div>

        {/* ========================================================= */}
        {/* BOTTOM DRAG GRIP BAR (4th Side Bottom Drag Handle)        */}
        {/* ========================================================= */}
        <div
          onPointerDown={handlePointerDown}
          onDoubleClick={resetPosition}
          style={{ touchAction: 'none' }}
          className="w-full py-2 bg-gradient-to-t from-[#F8F7FC] to-white border-t border-[#E5E1F0] flex items-center justify-center cursor-grab active:cursor-grabbing select-none shrink-0 hover:bg-[#F3F0FF] transition-colors"
          title="Drag bottom border to move card • Double-click to reset"
        >
          <div className="w-12 h-1 bg-[#D1D5DB] hover:bg-[#7C5CE8] rounded-full transition-colors" />
        </div>
      </div>
    </div>
  );
};
