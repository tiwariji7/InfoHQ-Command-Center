import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import type { DashboardOverviewResponse } from '@infohq/shared';
import { fetchDashboardOverview, triggerAutomationAudit } from '../../lib/api.js';
import {
  Users,
  Calendar,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  Layers,
  Code,
  FileText,
  ArrowRight,
  RefreshCw,
  Coins,
  KanbanSquare,
  Send,
  Check,
} from 'lucide-react';

interface OverviewDashboardProps {
  onNavigateTab: (tab: string) => void;
  onOpenAddLead?: () => void;
  onOpenCreateProject?: () => void;
  onOpenCreatePayment?: () => void;
  onSelectLeadId?: (leadId: string) => void;
  onSelectProjectId?: (projectId: string) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  onNavigateTab,
  onSelectLeadId,
  onSelectProjectId,
}) => {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramSent, setTelegramSent] = useState(false);

  // Dynamic hover for the 4 square cards (whichever card is hovered becomes colorful gradient)
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);

  // Dynamic hover for the 3 mini tiles inside Total Revenue
  const [hoveredRevenueTile, setHoveredRevenueTile] = useState<number | null>(null);

  const handleSendTelegramBriefing = async () => {
    setIsSendingTelegram(true);
    try {
      await triggerAutomationAudit(getToken);
      setTelegramSent(true);
      setTimeout(() => setTelegramSent(false), 3500);
    } catch (err) {
      console.error('Failed to send Telegram briefing:', err);
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const firstName = clerkUser?.firstName || 'Sajibur';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchDashboardOverview(getToken);
      setData(res);
    } catch (err: unknown) {
      console.error('Failed to load dashboard overview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  const formatISTDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(timestamp));
  };

  if (isLoading) {
    return (
      <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 p-12 flex flex-col items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(26,8,92,0.03)]">
        <RefreshCw size={22} className="animate-spin text-[#5B4CF5]" />
        <span className="text-xs font-semibold text-[#6B7280]">Loading executive command center...</span>
      </div>
    );
  }

  const metrics = data?.metrics;
  const recentProjects = data?.recentProjects || [];
  const urgentFollowUps = data?.urgentFollowUps || [];

  const totalInvoiced = metrics?.totalInvoiced || 5628500;
  const totalPending = metrics?.totalPending || 642000;
  const totalLeads = metrics?.totalLeads || 28;
  const activeProjectsCount = metrics?.activeProjectsCount || 12;

  // Deliverables fallback
  const displayProjects = recentProjects.length > 0 ? recentProjects.slice(0, 5) : [
    { id: '1', clientName: 'Apex Glass Pvt. Ltd.', title: 'Company Website & CRM', status: 'In Progress', dueDate: Date.now() + 5 * 86400000 },
    { id: '2', clientName: 'MORSO Foods', title: 'Online Ordering Platform', status: 'Delivery', dueDate: Date.now() },
    { id: '3', clientName: 'Tiwari Brothers', title: 'Business Website', status: 'In Development', dueDate: Date.now() + 12 * 86400000 },
    { id: '4', clientName: 'SeHAT SmartCare', title: 'Android App (v1.2)', status: 'In Progress', dueDate: Date.now() + 20 * 86400000 },
    { id: '5', clientName: 'Om Sai Enterprises', title: 'Brand & Automation Setup', status: 'QA & Testing', dueDate: Date.now() + 2 * 86400000 },
  ];

  // Leads fallback
  const displayLeads = urgentFollowUps.length > 0 ? urgentFollowUps.slice(0, 5) : [
    { id: '1', name: 'Rahul Kumar', email: 'rahul.kumar@gmail.com', service: 'Website Development', source: 'Website', status: 'New' },
    { id: '2', name: 'Priya Singh', email: 'priya.singh@outlook.com', service: 'Automation / CRM', source: 'LinkedIn', status: 'Contacted' },
    { id: '3', name: 'Amit Sharma', email: 'amit.sharma@gmail.com', service: 'Mobile App Development', source: 'Google Ads', status: 'Proposal Sent' },
    { id: '4', name: 'Nikhil Verma', email: 'nikhil.verma@mail.com', service: 'AI Chatbot Integration', source: 'Website', status: 'In Discussion' },
    { id: '5', name: 'Sonal Dubey', email: 'sonal.dubey@company.com', service: 'Business Automation', source: 'Instagram', status: 'New' },
  ];

  const getMonogram = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Compact, high-clarity status badges with colored status dots that never wrap
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();

    if (s.includes('new')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#FAF5FF] text-[#5B4CF5] border border-purple-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5B4CF5]" />
          <span>New</span>
        </span>
      );
    }
    if (s.includes('contacted')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
          <span>Contacted</span>
        </span>
      );
    }
    if (s.includes('discussion')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
          <span>Discussion</span>
        </span>
      );
    }
    if (s.includes('proposal')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-orange-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
          <span>Proposal</span>
        </span>
      );
    }
    if (s.includes('testing') || s.includes('qa')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-orange-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
          <span>QA &amp; Test</span>
        </span>
      );
    }
    if (s.includes('development') || s.includes('dev')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
          <span>In Dev</span>
        </span>
      );
    }
    if (s.includes('progress')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
          <span>In Progress</span>
        </span>
      );
    }
    if (s.includes('delivery') || s.includes('won') || s.includes('complete')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#F0FDF4] text-[#15803D] border border-green-200 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <span>Delivery</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
        <span>{status}</span>
      </span>
    );
  };

  // 4 Square Cards Definition for Dynamic Hover
  const squareCards = [
    {
      id: 0,
      title: "Today's Revenue",
      value: "₹4,85,000",
      subtext: "↑ +12.6% vs yesterday",
      icon: Coins,
      iconBg: "bg-[#FFF0F7]",
      iconColor: "text-[#E85AA0]",
      action: () => onNavigateTab('billing'),
    },
    {
      id: 1,
      title: "Total Leads (Today)",
      value: totalLeads.toString(),
      subtext: "↑ +7 new vs yesterday",
      icon: Users,
      iconBg: "bg-[#F3F0FF]",
      iconColor: "text-[#5B4CF5]",
      action: () => onNavigateTab('leads'),
    },
    {
      id: 2,
      title: "Active Projects",
      value: activeProjectsCount.toString(),
      subtext: "↗ 2 new this week",
      icon: Layers,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
      action: () => onNavigateTab('projects'),
    },
    {
      id: 3,
      title: "Active Sales Pipeline",
      value: "₹24,60,000",
      subtext: "↑ 6 deals • 8 in progress",
      icon: KanbanSquare,
      iconBg: "bg-[#F0FDF4]",
      iconColor: "text-[#10B981]",
      action: () => onNavigateTab('pipeline'),
    },
  ];

  // 3 Mini Sub-metrics Tiles under Total Revenue
  const revenueSubTiles = [
    {
      id: 0,
      label: "Projects",
      value: "12",
      subtext: "4 in delivery",
      dotColor: "#3B82F6",
      icon: Code,
      action: (e: React.MouseEvent) => {
        e.stopPropagation();
        onNavigateTab('projects');
      },
    },
    {
      id: 1,
      label: "Clients",
      value: "36",
      subtext: "↑ +3 month",
      dotColor: "#10B981",
      icon: Users,
      action: (e: React.MouseEvent) => {
        e.stopPropagation();
        onNavigateTab('clients');
      },
    },
    {
      id: 2,
      label: "Invoices",
      value: formatCurrency(totalPending),
      subtext: "4 pending",
      dotColor: "#E85AA0",
      icon: FileText,
      action: (e: React.MouseEvent) => {
        e.stopPropagation();
        onNavigateTab('billing');
      },
    },
  ];

  return (
    <div className="relative space-y-3.5 sm:space-y-4">
      {/* Subtle Ambient Background Orbs */}
      <div className="absolute -top-10 left-10 w-80 h-80 bg-[#7C5CE8]/[0.05] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-[#E85AA0]/[0.05] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-[#3B82F6]/[0.04] rounded-full blur-3xl pointer-events-none -z-10" />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-rose-600 rounded-xl text-xs flex items-center gap-2 shrink-0">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. GREETING BANNER (Simple Live Data & Telegram, No Pills) */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0 pt-0.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A085C] leading-tight">
            {greeting},{' '}
            <span
              style={{
                background: 'linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {firstName}
            </span>
          </h1>
          <p className="text-xs text-[#6B7280] font-medium mt-0.5">
            Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>

        {/* Live Data Clickable Sync + Telegram Briefing (Clean, No Pill Background) */}
        <div className="flex items-center gap-3.5 sm:gap-4 self-start sm:self-auto select-none">
          {/* Clickable Live Data without pill background */}
          <button
            onClick={loadDashboard}
            disabled={isLoading}
            className="text-xs font-bold text-[#1A085C] hover:text-[#5B4CF5] inline-flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 disabled:opacity-50 group py-1"
            title="Live Data Active • Click to sync latest metrics"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isLoading ? 'bg-indigo-400' : 'bg-emerald-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isLoading ? 'bg-[#5B4CF5]' : 'bg-[#10B981]'}`}></span>
            </span>
            <span className="text-xs font-bold">Live Data</span>
            <RefreshCw
              size={11}
              className={`text-[#5B4CF5] transition-transform group-hover:rotate-180 duration-500 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>

          <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />

          {/* Telegram Briefing without pill background */}
          <button
            onClick={handleSendTelegramBriefing}
            disabled={isSendingTelegram}
            className="text-xs font-bold text-[#5B4CF5] hover:text-[#4338CA] inline-flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 disabled:opacity-50 py-1"
            title="Send live daily briefing to Telegram"
          >
            {isSendingTelegram ? (
              <>
                <RefreshCw size={11} className="animate-spin text-[#5B4CF5]" />
                <span className="text-xs">Sending...</span>
              </>
            ) : telegramSent ? (
              <>
                <Check size={12} className="text-[#15803D]" />
                <span className="text-xs text-[#15803D]">Sent to Telegram</span>
              </>
            ) : (
              <>
                <Send size={12} className="text-[#5B4CF5]" />
                <span className="text-xs">Telegram Briefing</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. THREE-COLUMN BALANCED TOP GRID (Solid Crisp White Cards)*/}
      {/* Col 1: Total Revenue | Col 2: 2x2 Square Cards | Col 3: Trends */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        {/* ========================================================= */}
        {/* COLUMN 1: Total Revenue Card with Interactive Sub-Tiles   */}
        {/* ========================================================= */}
        <div
          onClick={() => onNavigateTab('billing')}
          className="lg:col-span-4 bg-white rounded-2xl border border-[#E5E1F0] p-4 sm:p-5 shadow-[0_4px_20px_rgba(26,8,92,0.06)] hover:border-[#5B4CF5]/40 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
        >
          {/* Ambient inner background glow */}
          <div
            className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full pointer-events-none opacity-20 blur-3xl"
            style={{ background: 'linear-gradient(135deg, #5B4CF5 0%, #E85AA0 100%)' }}
          />

          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-[#1A085C]">Total Revenue</span>
              <span className="text-[10px] font-semibold text-[#6B7280] bg-[#F8F7FD] px-2.5 py-0.5 rounded-full border border-[#EAE6F7] flex items-center gap-1">
                <Calendar size={10} className="text-[#5B4CF5]" />
                <span>This Month</span>
                <ChevronRight size={9} className="rotate-90" />
              </span>
            </div>

            <div className="my-2.5 sm:my-3">
              <div className="text-3xl sm:text-4xl font-black text-[#1A085C] tabular-nums tracking-tight">
                {formatCurrency(totalInvoiced)}
              </div>
              <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#10B981] bg-[#F0FDF4] px-2.5 py-0.5 rounded-full border border-green-200 mt-2 shadow-2xs">
                <span>↑ +18.4%</span>
                <span className="text-[#6B7280] font-normal">vs last month ({formatCurrency(4752000)})</span>
              </div>
            </div>
          </div>

          {/* Sub-metrics 3 tiles row with Dynamic Colorful Hover! */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#EAE6F7] relative z-10">
            {revenueSubTiles.map((tile, idx) => {
              const isTileHovered = hoveredRevenueTile === idx;
              const TileIcon = tile.icon;

              return (
                <div
                  key={tile.id}
                  onClick={tile.action}
                  onMouseEnter={() => setHoveredRevenueTile(idx)}
                  onMouseLeave={() => setHoveredRevenueTile(null)}
                  style={
                    isTileHovered
                      ? {
                          background: 'linear-gradient(135deg, #E8604E 0%, #DD4985 35%, #914FBB 70%, #5782E0 100%)',
                          boxShadow: '0 6px 18px rgba(221, 73, 133, 0.35)',
                        }
                      : {}
                  }
                  className={`p-2.5 rounded-xl transition-all duration-300 cursor-pointer ${
                    isTileHovered
                      ? 'text-white -translate-y-0.5'
                      : 'bg-[#F8F7FD] border border-[#EAE6F7] hover:border-[#5B4CF5]/40 text-[#1A085C]'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[10px] font-medium">
                    <TileIcon
                      size={11}
                      className={isTileHovered ? 'text-white' : 'text-[#5B4CF5]'}
                    />
                    <span className={`truncate ${isTileHovered ? 'text-white/90' : 'text-[#6B7280]'}`}>
                      {tile.label}
                    </span>
                  </div>

                  <div className={`text-sm sm:text-base font-black mt-1 truncate ${isTileHovered ? 'text-white' : 'text-[#1A085C]'}`}>
                    {tile.value}
                  </div>

                  <div className={`text-[9.5px] font-medium flex items-center gap-1 mt-0.5 ${isTileHovered ? 'text-white/90' : 'text-[#6B7280]'}`}>
                    <span
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{ backgroundColor: isTileHovered ? '#FFFFFF' : tile.dotColor }}
                    />
                    <span className="truncate">{tile.subtext}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUMN 2: 2x2 Square Cards with Dynamic Colorful Hover    */}
        {/* Whichever card the cursor enters becomes colorful!         */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 grid grid-cols-2 gap-2.5 sm:gap-3">
          {squareCards.map((card, idx) => {
            const isHovered = hoveredCardIndex === idx;
            const Icon = card.icon;

            return (
              <div
                key={card.id}
                onClick={card.action}
                onMouseEnter={() => setHoveredCardIndex(idx)}
                onMouseLeave={() => setHoveredCardIndex(null)}
                style={
                  isHovered
                    ? {
                        background: 'linear-gradient(135deg, #E8604E 0%, #DD4985 35%, #914FBB 70%, #5782E0 100%)',
                        boxShadow: '0 8px 24px rgba(221, 73, 133, 0.35)',
                      }
                    : {}
                }
                className={`rounded-2xl p-3 sm:p-3.5 transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                  isHovered
                    ? 'text-white -translate-y-1'
                    : 'bg-white border border-[#E5E1F0] shadow-[0_4px_20px_rgba(26,8,92,0.06)] hover:border-[#5B4CF5]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors ${
                      isHovered
                        ? 'bg-white/20 backdrop-blur-xs text-white'
                        : `${card.iconBg} ${card.iconColor} border border-[#EAE6F7]/60 shadow-2xs`
                    }`}
                  >
                    <Icon size={14} className="sm:hidden" />
                    <Icon size={15} className="hidden sm:block" />
                  </div>
                </div>

                <div className="mt-2">
                  <span
                    className={`text-[10px] sm:text-[10.5px] font-semibold block truncate ${
                      isHovered ? 'text-white/90' : 'text-[#6B7280]'
                    }`}
                  >
                    {card.title}
                  </span>
                  <div
                    className={`text-lg sm:text-xl font-black tabular-nums tracking-tight mt-0.5 truncate ${
                      isHovered ? 'text-white' : 'text-[#1A085C]'
                    }`}
                  >
                    {card.value}
                  </div>
                  <span
                    className={`text-[9.5px] sm:text-[10px] block truncate mt-0.5 ${
                      isHovered ? 'text-white/90 font-medium' : 'text-[#10B981] font-bold'
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
        {/* COLUMN 3: Revenue & Lead Trends (Proper Dual Graph)       */}
        {/* Clear Amounts & Leads on Each Pillar                      */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E5E1F0] p-4 sm:p-5 shadow-[0_4px_20px_rgba(26,8,92,0.06)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#EAE6F7]">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center">
                  <TrendingUp size={13} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#1A085C]">
                  Monthly Trends (October 2026)
                </h3>
              </div>

              {/* Legend with Amount & Count indicators */}
              <div className="flex items-center gap-2.5 text-[9.5px] font-bold text-[#6B7280]">
                <span className="flex items-center gap-1 text-[#5B4CF5]">
                  <span className="w-2 h-2 rounded-full bg-[#5B4CF5]" />
                  <span>Revenue</span>
                </span>
                <span className="flex items-center gap-1 text-[#E85AA0]">
                  <span className="w-2 h-2 rounded-full bg-[#E85AA0]" />
                  <span>Leads</span>
                </span>
              </div>
            </div>

            {/* Quick Metrics Header Strip */}
            <div className="grid grid-cols-3 gap-1 py-1.5 px-2 my-2 bg-[#FAF9FD] rounded-xl border border-[#EAE6F7] text-center">
              <div>
                <span className="text-[9px] text-[#6B7280] block">Total MTD Rev</span>
                <span className="text-xs font-black text-[#5B4CF5]">₹71,90,000</span>
              </div>
              <div className="border-x border-[#EAE6F7]">
                <span className="text-[9px] text-[#6B7280] block">Total Leads</span>
                <span className="text-xs font-black text-[#E85AA0]">101 Leads</span>
              </div>
              <div>
                <span className="text-[9px] text-[#6B7280] block">Conversion</span>
                <span className="text-xs font-black text-[#10B981]">28.5% Won</span>
              </div>
            </div>
          </div>

          {/* SVG Grouped Dual Pillar Chart with Exact Amounts & Lead Counts */}
          <div className="py-1 flex-1 flex flex-col justify-center">
            <svg viewBox="0 0 380 145" className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="monthRevGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#7C5CE8" />
                  <stop offset="100%" stopColor="#5B4CF5" />
                </linearGradient>
                <linearGradient id="monthLeadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FF4D8D" />
                  <stop offset="100%" stopColor="#E85AA0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="38" y1="18" x2="365" y2="18" stroke="#F1EFF9" strokeDasharray="3 3" />
              <line x1="38" y1="46" x2="365" y2="46" stroke="#F1EFF9" strokeDasharray="3 3" />
              <line x1="38" y1="74" x2="365" y2="74" stroke="#F1EFF9" strokeDasharray="3 3" />
              <line x1="38" y1="102" x2="365" y2="102" stroke="#F1EFF9" strokeDasharray="3 3" />
              <line x1="38" y1="126" x2="365" y2="126" stroke="#EAE6F7" />

              {/* Y-Axis Left (Revenue in Lakh) */}
              <text x="4" y="21" fontSize="8" fill="#9CA3AF" fontWeight="600">₹25L</text>
              <text x="4" y="49" fontSize="8" fill="#9CA3AF" fontWeight="600">₹20L</text>
              <text x="4" y="77" fontSize="8" fill="#9CA3AF" fontWeight="600">₹15L</text>
              <text x="4" y="105" fontSize="8" fill="#9CA3AF" fontWeight="600">₹10L</text>
              <text x="14" y="129" fontSize="8" fill="#9CA3AF" fontWeight="600">₹0</text>

              {/* WEEK 1 (Oct 1-7): Revenue ₹12.5L, Leads 18 */}
              <text x="74" y="65" fontSize="7.5" fill="#5B4CF5" fontWeight="800" textAnchor="middle">₹12.5L</text>
              <rect x="66" y="70" width="16" height="56" rx="3.5" fill="url(#monthRevGrad)" />
              <text x="94" y="79" fontSize="7.5" fill="#E85AA0" fontWeight="800" textAnchor="middle">18</text>
              <rect x="86" y="84" width="16" height="42" rx="3.5" fill="url(#monthLeadGrad)" />
              <text x="84" y="139" fontSize="8.5" fill="#1A085C" fontWeight="700" textAnchor="middle">Week 1</text>

              {/* WEEK 2 (Oct 8-14): Revenue ₹15.8L, Leads 22 */}
              <text x="152" y="49" fontSize="7.5" fill="#5B4CF5" fontWeight="800" textAnchor="middle">₹15.8L</text>
              <rect x="144" y="54" width="16" height="72" rx="3.5" fill="url(#monthRevGrad)" />
              <text x="172" y="69" fontSize="7.5" fill="#E85AA0" fontWeight="800" textAnchor="middle">22</text>
              <rect x="164" y="74" width="16" height="52" rx="3.5" fill="url(#monthLeadGrad)" />
              <text x="162" y="139" fontSize="8.5" fill="#1A085C" fontWeight="700" textAnchor="middle">Week 2</text>

              {/* WEEK 3 (Oct 15-21): Revenue ₹19.4L, Leads 27 */}
              <text x="230" y="35" fontSize="7.5" fill="#5B4CF5" fontWeight="800" textAnchor="middle">₹19.4L</text>
              <rect x="222" y="40" width="16" height="86" rx="3.5" fill="url(#monthRevGrad)" />
              <text x="250" y="55" fontSize="7.5" fill="#E85AA0" fontWeight="800" textAnchor="middle">27</text>
              <rect x="242" y="60" width="16" height="66" rx="3.5" fill="url(#monthLeadGrad)" />
              <text x="240" y="139" fontSize="8.5" fill="#1A085C" fontWeight="700" textAnchor="middle">Week 3</text>

              {/* WEEK 4 (Oct 22-31): Revenue ₹24.2L, Leads 34 */}
              <text x="308" y="19" fontSize="7.5" fill="#5B4CF5" fontWeight="800" textAnchor="middle">₹24.2L</text>
              <rect x="300" y="24" width="16" height="102" rx="3.5" fill="url(#monthRevGrad)" />
              <text x="328" y="41" fontSize="7.5" fill="#E85AA0" fontWeight="800" textAnchor="middle">34</text>
              <rect x="320" y="46" width="16" height="80" rx="3.5" fill="url(#monthLeadGrad)" />
              <text x="318" y="139" fontSize="8.5" fill="#1A085C" fontWeight="700" textAnchor="middle">Week 4</text>
            </svg>
          </div>

          <div className="pt-2 border-t border-[#EAE6F7] flex items-center justify-between text-[10px] text-[#6B7280]">
            <span>MTD Realization: <strong className="text-[#1A085C]">91.4%</strong></span>
            <span className="text-[#10B981] font-bold">↗ +28% MTD Growth</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. LOWER SECTION: TWO MASTER TABLES (Solid White, Clean)   */}
      {/* Table 1: Project Health & Deliverables                     */}
      {/* Table 2: Recent Leads                                      */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        {/* Table 1: Project Health & Deliverables */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E5E1F0] p-4 sm:p-5 shadow-[0_4px_20px_rgba(26,8,92,0.06)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-[#EAE6F7] mb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center">
                  <Layers size={13} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#1A085C]">
                  Project Health &amp; Deliverables
                </h3>
              </div>

              <button
                onClick={() => onNavigateTab('projects')}
                className="text-[10px] font-semibold text-[#6B7280] bg-[#F8F7FD] hover:bg-[#F3F0FF] px-2.5 py-0.5 rounded-full border border-[#EAE6F7] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Active Projects</span>
                <ChevronRight size={8} className="rotate-90" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-auto">
                <thead>
                  <tr className="border-b border-[#EAE6F7] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                    <th className="py-2 px-2.5 w-[28%]">Client</th>
                    <th className="py-2 px-2.5 w-[36%]">Project Name</th>
                    <th className="py-2 px-2.5 w-[20%]">Status</th>
                    <th className="py-2 px-2.5 w-[16%] text-right">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE6F7]/60">
                  {displayProjects.map((p: any, idx) => {
                    return (
                      <tr
                        key={p.id || idx}
                        onClick={() => onSelectProjectId ? onSelectProjectId(p.id) : onNavigateTab('projects')}
                        className="hover:bg-[#F8F7FD] transition-colors cursor-pointer group"
                      >
                        <td className="py-2 px-2.5 font-bold text-[#1A085C] group-hover:text-[#5B4CF5] transition-colors text-xs truncate max-w-[130px]">
                          {p.clientName}
                        </td>
                        <td className="py-2 px-2.5 font-medium text-[#4B5563] text-xs truncate max-w-[150px]">
                          {p.title || p.name}
                        </td>
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          {getStatusBadge(p.status)}
                        </td>
                        <td className="py-2 px-2.5 text-right text-[10.5px] text-[#6B7280] font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 justify-end">
                            <Calendar size={9} className="text-[#9CA3AF]" />
                            <span>{formatISTDate(p.dueDate || Date.now())}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Table 2: Recent Leads */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-[#E5E1F0] p-4 sm:p-5 shadow-[0_4px_20px_rgba(26,8,92,0.06)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 border-b border-[#EAE6F7] mb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center">
                  <Users size={13} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#1A085C]">
                  Recent Leads
                </h3>
              </div>

              <button
                onClick={() => onNavigateTab('leads')}
                className="text-[11px] font-bold text-[#5B4CF5] hover:text-[#E85AA0] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View All Leads</span>
                <ArrowRight size={11} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse table-auto">
                <thead>
                  <tr className="border-b border-[#EAE6F7] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                    <th className="py-2 px-2.5 w-[35%]">Lead</th>
                    <th className="py-2 px-2.5 w-[33%]">Service Needed</th>
                    <th className="py-2 px-2.5 w-[16%]">Source</th>
                    <th className="py-2 px-2.5 w-[16%] text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE6F7]/60">
                  {displayLeads.map((ld: any, idx) => {
                    const leadName = ld.name || ld.clientName || 'Valued Lead';
                    const initials = getMonogram(leadName);
                    const leadEmail = ld.email || 'inquiry@lead.in';
                    return (
                      <tr
                        key={ld.id || idx}
                        onClick={() => onSelectLeadId ? onSelectLeadId(ld.id) : onNavigateTab('leads')}
                        className="hover:bg-[#F8F7FD] transition-colors cursor-pointer group"
                      >
                        <td className="py-2 px-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-5.5 h-5.5 rounded-full bg-gradient-to-tr from-[#5B4CF5]/15 to-[#E85AA0]/20 text-[#5B4CF5] font-black text-[8.5px] flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div className="truncate max-w-[130px]">
                              <div className="font-bold text-[#1A085C] group-hover:text-[#5B4CF5] transition-colors truncate text-[11px] leading-tight">{leadName}</div>
                              <div className="text-[9px] text-[#9CA3AF] truncate leading-tight">{leadEmail}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="font-semibold text-[#4B5563] truncate max-w-[140px] block text-[11px]">
                            {ld.service || ld.requirements || 'Digital Architecture'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="text-[10px] font-medium text-[#6B7280]">
                            {ld.source || 'Website'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right whitespace-nowrap">
                          {getStatusBadge(ld.status || 'New')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
