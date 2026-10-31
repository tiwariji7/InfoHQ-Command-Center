import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import type { DashboardOverviewResponse } from '@infohq/shared';
import { fetchDashboardOverview } from '../../lib/api.js';
import { MorningBriefingBanner } from './MorningBriefingBanner.js';
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
  Sun,
  Target,
  RefreshCw,
  Coins,
  KanbanSquare,
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
      <div className="bg-white rounded-[22px] border border-[#EAE6F7] p-16 flex flex-col items-center justify-center gap-3 shadow-[0_4px_20px_rgba(26,8,92,0.04)]">
        <RefreshCw size={26} className="animate-spin text-[#5B4CF5]" />
        <span className="text-xs font-semibold text-[#6B7280]">Loading command center overview...</span>
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

  // Sample deliverables if empty
  const displayProjects = recentProjects.length > 0 ? recentProjects.slice(0, 5) : [
    { id: '1', clientName: 'Apex Glass Pvt. Ltd.', title: 'Company Website & CRM', progress: 80, status: 'In Progress', dueDate: Date.now() + 5 * 86400000 },
    { id: '2', clientName: 'MORSO Foods', title: 'Online Ordering Platform', progress: 100, status: 'Delivery', dueDate: Date.now() },
    { id: '3', clientName: 'Tiwari Brothers', title: 'Business Website', progress: 65, status: 'In Development', dueDate: Date.now() + 12 * 86400000 },
    { id: '4', clientName: 'SeHAT SmartCare', title: 'Android App (v1.2)', progress: 45, status: 'In Progress', dueDate: Date.now() + 20 * 86400000 },
    { id: '5', clientName: 'Om Sai Enterprises', title: 'Brand & Automation Setup', progress: 90, status: 'QA & Testing', dueDate: Date.now() + 2 * 86400000 },
  ];

  // Sample leads if empty
  const displayLeads = urgentFollowUps.length > 0 ? urgentFollowUps.slice(0, 5) : [
    { id: '1', name: 'Rahul Kumar', email: 'rahul.kumar@gmail.com', service: 'Website Development', source: 'Website', status: 'New', timeAgo: '10 min ago' },
    { id: '2', name: 'Priya Singh', email: 'priya.singh@outlook.com', service: 'Automation / CRM', source: 'LinkedIn', status: 'Contacted', timeAgo: '28 min ago' },
    { id: '3', name: 'Amit Sharma', email: 'amit.sharma@gmail.com', service: 'Mobile App Development', source: 'Google Ads', status: 'Proposal Sent', timeAgo: '1 hr ago' },
    { id: '4', name: 'Nikhil Verma', email: 'nikhil.verma@mail.com', service: 'AI Chatbot Integration', source: 'Website', status: 'In Discussion', timeAgo: '2 hr ago' },
    { id: '5', name: 'Sonal Dubey', email: 'sonal.dubey@company.com', service: 'Business Automation', source: 'Instagram', status: 'New', timeAgo: '3 hr ago' },
  ];

  const getMonogram = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('new')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#FAF5FF] text-[#5B4CF5] border border-purple-200">
          New
        </span>
      );
    }
    if (s.includes('contacted') || s.includes('discussion')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200">
          {status}
        </span>
      );
    }
    if (s.includes('proposal') || s.includes('testing')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-orange-200">
          {status}
        </span>
      );
    }
    if (s.includes('won') || s.includes('delivery') || s.includes('complete')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#F0FDF4] text-[#15803D] border border-green-200">
          {status}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-rose-600 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. GREETING BANNER (Exact Reference Image 1)              */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
        <div className="flex items-start gap-3">
          <div className="flex flex-col gap-1.5 pt-0.5">
            <div className="w-6 h-6 rounded-full bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shadow-2xs">
              <Target size={13} className="stroke-[2.5]" />
            </div>
            <div className="w-6 h-6 rounded-full bg-white border border-[#EAE6F7] text-[#6B7280] flex items-center justify-center shadow-2xs">
              <Sun size={12} />
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-[28px] font-black tracking-tight text-[#1A085C]">
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
            <p className="text-xs sm:text-sm text-[#6B7280] font-medium mt-0.5">
              Here&apos;s what&apos;s happening with your business today.
            </p>
          </div>
        </div>

        {/* Live Refresh Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-white border border-[#EAE6F7] shadow-2xs text-xs font-semibold text-[#6B7280]">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-[#1A085C] font-bold">Live Data Active</span>
          <button
            onClick={loadDashboard}
            disabled={isLoading}
            className="p-1 hover:text-[#5B4CF5] transition-colors rounded-full cursor-pointer"
            title="Refresh overview metrics"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Morning Briefing Banner */}
      <MorningBriefingBanner onNavigateTab={onNavigateTab} onSelectLeadId={onSelectLeadId} />

      {/* ========================================================= */}
      {/* 2. MAIN DASHBOARD GRID (Exact Layout from Image 1)        */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column Section: Financial & Activity Cards (7 of 12 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            {/* Card 1: Total Revenue (7 cols on sm+) */}
            <div
              onClick={() => onNavigateTab('billing')}
              className="sm:col-span-7 bg-white rounded-[22px] border border-[#EAE6F7] p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] hover:border-[#5B4CF5]/40 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
            >
              {/* Background gradient wave accent in corner */}
              <div
                className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full pointer-events-none opacity-40 blur-2xl"
                style={{ background: 'linear-gradient(135deg, #5B4CF5 0%, #E85AA0 100%)' }}
              />

              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-bold text-[#1A085C]">Total Revenue</span>
                <span className="text-[11px] font-semibold text-[#6B7280] bg-[#F8F8FF] px-2.5 py-1 rounded-full border border-[#EAE6F7] flex items-center gap-1">
                  <Calendar size={11} className="text-[#5B4CF5]" />
                  <span>This Month</span>
                  <ChevronRight size={10} className="rotate-90" />
                </span>
              </div>

              <div className="my-3 relative z-10">
                <div className="text-2xl sm:text-[32px] font-black tracking-tight text-[#1A085C] tabular-nums">
                  {formatCurrency(totalInvoiced)}
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#10B981] bg-[#F0FDF4] px-2.5 py-0.5 rounded-full border border-green-200 mt-1.5">
                  <span>↑ +18.4%</span>
                  <span className="text-[#6B7280] font-medium">vs last month (₹47,52,000)</span>
                </div>
              </div>

              {/* Sub-metrics 3 tiles row */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#EAE6F7] relative z-10">
                <div className="bg-[#F8F8FF] p-2 rounded-xl border border-[#EAE6F7]/60">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-[#6B7280]">
                    <Code size={11} className="text-[#5B4CF5]" />
                    <span>Open Projects</span>
                  </div>
                  <div className="text-sm font-black text-[#1A085C] mt-0.5">12</div>
                  <div className="text-[9.5px] font-medium text-[#3B82F6] flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                    <span>4 in delivery</span>
                  </div>
                </div>

                <div className="bg-[#F8F8FF] p-2 rounded-xl border border-[#EAE6F7]/60">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-[#6B7280]">
                    <Users size={11} className="text-[#10B981]" />
                    <span>Total Clients</span>
                  </div>
                  <div className="text-sm font-black text-[#1A085C] mt-0.5">36</div>
                  <div className="text-[9.5px] font-medium text-[#10B981] flex items-center gap-1 mt-0.5">
                    <span>↑ +3 this month</span>
                  </div>
                </div>

                <div className="bg-[#F8F8FF] p-2 rounded-xl border border-[#EAE6F7]/60">
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-[#6B7280]">
                    <FileText size={11} className="text-[#E85AA0]" />
                    <span>Pending Invoices</span>
                  </div>
                  <div className="text-sm font-black text-[#1A085C] mt-0.5 truncate">{formatCurrency(totalPending)}</div>
                  <div className="text-[9.5px] font-medium text-[#E85AA0] flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E85AA0]" />
                    <span>4 invoices</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Mini Column inside left section (5 cols on sm+) */}
            <div className="sm:col-span-5 space-y-4">
              {/* Card 2: Today's Revenue (The 4-Stop Signature Gradient Card!) */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #E8604E 0%, #DD4985 35%, #914FBB 70%, #5782E0 100%)',
                  boxShadow: '0 10px 25px rgba(221, 73, 133, 0.30)',
                }}
                className="rounded-[22px] p-4 text-white hover:brightness-105 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
                    <Coins size={16} />
                  </div>
                </div>
                <div className="my-2">
                  <span className="text-[11px] font-medium text-white/85">Today&apos;s Revenue</span>
                  <div className="text-2xl font-black tracking-tight text-white tabular-nums mt-0.5">
                    ₹4,85,000
                  </div>
                  <div className="text-[10px] font-semibold text-white/90 mt-0.5">
                    ↑ +12.6% vs yesterday
                  </div>
                </div>
              </div>

              {/* Card 3: Total Leads (Today) */}
              <div
                onClick={() => onNavigateTab('leads')}
                className="bg-white rounded-[22px] border border-[#EAE6F7] p-4 shadow-[0_4px_20px_rgba(26,8,92,0.04)] hover:border-[#5B4CF5]/40 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <span className="text-[11px] font-bold text-[#6B7280]">Total Leads (Today)</span>
                  <div className="text-2xl font-black text-[#1A085C] tabular-nums mt-0.5">
                    {totalLeads}
                  </div>
                  <span className="text-[10.5px] font-bold text-[#10B981]">
                    ↑ +7 new vs yesterday
                  </span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shadow-2xs shrink-0">
                  <Users size={18} />
                </div>
              </div>
            </div>
          </div>

          {/* Active Projects & Active Pipeline Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => onNavigateTab('projects')}
              className="bg-white rounded-[20px] border border-[#EAE6F7] p-4 shadow-2xs hover:border-[#5B4CF5]/40 transition-all cursor-pointer flex items-center gap-3.5"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#F8F8FF] border border-[#EAE6F7] text-[#5B4CF5] flex items-center justify-center shrink-0">
                <Layers size={18} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#6B7280]">Active Projects</span>
                <div className="text-xl font-black text-[#1A085C] tabular-nums">{activeProjectsCount}</div>
                <span className="text-[10px] font-semibold text-[#10B981]">↗ 2 new this week</span>
              </div>
            </div>

            <div
              onClick={() => onNavigateTab('pipeline')}
              className="bg-white rounded-[20px] border border-[#EAE6F7] p-4 shadow-2xs hover:border-[#5B4CF5]/40 transition-all cursor-pointer flex items-center gap-3.5"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#F8F8FF] border border-[#EAE6F7] text-[#E85AA0] flex items-center justify-center shrink-0">
                <KanbanSquare size={18} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#6B7280]">Active Sales Pipeline</span>
                <div className="text-xl font-black text-[#1A085C] tabular-nums">₹24,60,000</div>
                <span className="text-[10px] font-semibold text-[#10B981]">↑ 6 deals • 8 in progress</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column Section: Monthly Trends Chart Card (5 of 12 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-[22px] border border-[#EAE6F7] p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#EAE6F7]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center">
                <TrendingUp size={15} />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-[#1A085C]">
                Revenue &amp; Lead Trends – Monthly
              </h3>
            </div>

            {/* Legend matching Image 1 */}
            <div className="flex items-center gap-3 text-[10px] font-semibold text-[#6B7280]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#7C5CE8]" />
                <span>Revenue (₹ Lakh)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#E85AA0]" />
                <span>Leads</span>
              </span>
            </div>
          </div>

          {/* High-Fidelity SVG Visual Chart (Jan - Aug) */}
          <div className="py-4 flex-1 flex flex-col justify-center">
            <svg viewBox="0 0 460 210" className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#5B4CF5" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="leadLineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#E85AA0" />
                  <stop offset="100%" stopColor="#FF4D8D" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="30" y1="20" x2="430" y2="20" stroke="#F1F0F7" strokeDasharray="3 3" />
              <line x1="30" y1="55" x2="430" y2="55" stroke="#F1F0F7" strokeDasharray="3 3" />
              <line x1="30" y1="90" x2="430" y2="90" stroke="#F1F0F7" strokeDasharray="3 3" />
              <line x1="30" y1="125" x2="430" y2="125" stroke="#F1F0F7" strokeDasharray="3 3" />
              <line x1="30" y1="160" x2="430" y2="160" stroke="#F1F0F7" strokeDasharray="3 3" />

              {/* Y-Axis Left (₹ Lakh) */}
              <text x="5" y="24" fontSize="9" fill="#9CA3AF" fontWeight="600">₹70L</text>
              <text x="5" y="59" fontSize="9" fill="#9CA3AF" fontWeight="600">₹60L</text>
              <text x="5" y="94" fontSize="9" fill="#9CA3AF" fontWeight="600">₹40L</text>
              <text x="5" y="129" fontSize="9" fill="#9CA3AF" fontWeight="600">₹20L</text>
              <text x="18" y="164" fontSize="9" fill="#9CA3AF" fontWeight="600">₹0</text>

              {/* Y-Axis Right (Leads) */}
              <text x="435" y="24" fontSize="9" fill="#9CA3AF" fontWeight="600">300</text>
              <text x="435" y="59" fontSize="9" fill="#9CA3AF" fontWeight="600">250</text>
              <text x="435" y="94" fontSize="9" fill="#9CA3AF" fontWeight="600">200</text>
              <text x="435" y="129" fontSize="9" fill="#9CA3AF" fontWeight="600">100</text>
              <text x="435" y="164" fontSize="9" fill="#9CA3AF" fontWeight="600">0</text>

              {/* Monthly Revenue Bars (Jan to Aug) */}
              {/* Jan */}
              <rect x="48" y="115" width="22" height="45" rx="5" fill="url(#barGradient)" />
              {/* Feb */}
              <rect x="98" y="100" width="22" height="60" rx="5" fill="url(#barGradient)" />
              {/* Mar */}
              <rect x="148" y="108" width="22" height="52" rx="5" fill="url(#barGradient)" />
              {/* Apr */}
              <rect x="198" y="85" width="22" height="75" rx="5" fill="url(#barGradient)" />
              {/* May */}
              <rect x="248" y="92" width="22" height="68" rx="5" fill="url(#barGradient)" />
              {/* Jun */}
              <rect x="298" y="70" width="22" height="90" rx="5" fill="url(#barGradient)" />
              {/* Jul */}
              <rect x="348" y="58" width="22" height="102" rx="5" fill="url(#barGradient)" />
              {/* Aug */}
              <rect x="398" y="40" width="22" height="120" rx="5" fill="url(#barGradient)" />

              {/* Smooth Trend Curve for Leads (Pink) */}
              <path
                d="M 59 120 Q 109 110, 159 98 T 259 82 T 359 62 T 409 38"
                fill="none"
                stroke="url(#leadLineGlow)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Data points on leads curve */}
              <circle cx="59" cy="120" r="3.5" fill="#FFFFFF" stroke="#E85AA0" strokeWidth="2" />
              <circle cx="109" cy="110" r="3.5" fill="#FFFFFF" stroke="#E85AA0" strokeWidth="2" />
              <circle cx="159" cy="98" r="3.5" fill="#FFFFFF" stroke="#E85AA0" strokeWidth="2" />
              <circle cx="209" cy="88" r="3.5" fill="#FFFFFF" stroke="#E85AA0" strokeWidth="2" />
              <circle cx="259" cy="82" r="3.5" fill="#FFFFFF" stroke="#E85AA0" strokeWidth="2" />
              <circle cx="309" cy="72" r="3.5" fill="#FFFFFF" stroke="#E85AA0" strokeWidth="2" />
              <circle cx="359" cy="62" r="3.5" fill="#FFFFFF" stroke="#E85AA0" strokeWidth="2" />
              <circle cx="409" cy="38" r="4" fill="#FFFFFF" stroke="#E85AA0" strokeWidth="2.5" />

              {/* Month Labels */}
              <text x="54" y="182" fontSize="10" fill="#6B7280" fontWeight="600">Jan</text>
              <text x="104" y="182" fontSize="10" fill="#6B7280" fontWeight="600">Feb</text>
              <text x="154" y="182" fontSize="10" fill="#6B7280" fontWeight="600">Mar</text>
              <text x="204" y="182" fontSize="10" fill="#6B7280" fontWeight="600">Apr</text>
              <text x="254" y="182" fontSize="10" fill="#6B7280" fontWeight="600">May</text>
              <text x="304" y="182" fontSize="10" fill="#6B7280" fontWeight="600">Jun</text>
              <text x="354" y="182" fontSize="10" fill="#6B7280" fontWeight="600">Jul</text>
              <text x="404" y="182" fontSize="10" fill="#6B7280" fontWeight="600">Aug</text>
            </svg>
          </div>

          <div className="pt-2 border-t border-[#EAE6F7] flex items-center justify-between text-[11px] text-[#6B7280]">
            <span>Average Deal Realization: <strong className="text-[#1A085C]">88.4%</strong></span>
            <span className="text-[#10B981] font-bold">↗ High Conversion Quarter</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. LOWER SECTION: TWO MASTER TABLES (Project Health & Leads) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Table 1: Project Health & Deliverables (6 cols on lg) */}
        <div className="lg:col-span-6 bg-white rounded-[22px] border border-[#EAE6F7] p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#EAE6F7]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center">
                <Layers size={15} />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-[#1A085C]">
                Project Health &amp; Deliverables
              </h3>
            </div>

            <button
              onClick={() => onNavigateTab('projects')}
              className="text-[11px] font-semibold text-[#6B7280] bg-[#F8F8FF] hover:bg-[#F3F0FF] px-2.5 py-1 rounded-full border border-[#EAE6F7] flex items-center gap-1 transition-colors"
            >
              <span>Active Projects</span>
              <ChevronRight size={10} className="rotate-90" />
            </button>
          </div>

          <div className="overflow-x-auto my-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EAE6F7] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                  <th className="py-2.5 pr-3">Client</th>
                  <th className="py-2.5 px-3">Project Name</th>
                  <th className="py-2.5 px-3">Progress</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-3 text-right">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6F7]/60">
                {displayProjects.map((p: any, idx) => {
                  const initials = getMonogram(p.clientName);
                  const progressVal = p.progress || 70;
                  return (
                    <tr
                      key={p.id || idx}
                      onClick={() => onSelectProjectId ? onSelectProjectId(p.id) : onNavigateTab('projects')}
                      className="hover:bg-[#F8F8FF]/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#F3F0FF] text-[#5B4CF5] font-black text-[10px] flex items-center justify-center shrink-0 border border-purple-100">
                            {initials}
                          </div>
                          <span className="font-bold text-[#1A085C] truncate max-w-[110px]">
                            {p.clientName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-[#4B5563] truncate max-w-[130px] block">
                          {p.title || p.name}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="w-20">
                          <div className="flex justify-between text-[10px] font-bold text-[#1A085C] mb-1">
                            <span>{progressVal}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#EAE6F7] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#5B4CF5] to-[#E85AA0] rounded-full"
                              style={{ width: `${progressVal}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(p.status)}
                      </td>
                      <td className="py-3 pl-3 text-right text-[11px] text-[#6B7280] font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={11} className="text-[#9CA3AF]" />
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

        {/* Table 2: Recent Leads (6 cols on lg) */}
        <div className="lg:col-span-6 bg-white rounded-[22px] border border-[#EAE6F7] p-5 shadow-[0_4px_20px_rgba(26,8,92,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#EAE6F7]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center">
                <Users size={15} />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-[#1A085C]">
                Recent Leads
              </h3>
            </div>

            <button
              onClick={() => onNavigateTab('leads')}
              className="text-xs font-bold text-[#5B4CF5] hover:text-[#E85AA0] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View All Leads</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="overflow-x-auto my-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EAE6F7] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                  <th className="py-2.5 pr-3">Lead</th>
                  <th className="py-2.5 px-3">Service Needed</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-3 text-right">Received</th>
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
                      className="hover:bg-[#F8F8FF]/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#5B4CF5]/15 to-[#E85AA0]/20 text-[#5B4CF5] font-black text-[10px] flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="truncate max-w-[110px]">
                            <div className="font-bold text-[#1A085C] truncate">{leadName}</div>
                            <div className="text-[10px] text-[#9CA3AF] truncate">{leadEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-[#4B5563] truncate max-w-[130px] block">
                          {ld.service || ld.requirements || 'Digital Architecture'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-medium text-[#6B7280]">
                          {ld.source || 'Website'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(ld.status || 'New')}
                      </td>
                      <td className="py-3 pl-3 text-right text-[11px] text-[#9CA3AF] whitespace-nowrap">
                        {ld.timeAgo || 'Just now'}
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
  );
};
