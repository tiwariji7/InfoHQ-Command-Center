import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  fetchAuditLogsApi,
  testAuditLogTelemetryApi,
} from '../../lib/api.js';
import type { AuditLogItem } from '@infohq/shared';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Send,
  Calendar,
  User,
  Globe,
  Monitor,
  ChevronDown,
  ChevronRight,
  Database,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Test Telegram button state
  const [isTestingTelegram, setIsTestingTelegram] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchAuditLogsApi(getToken, {
        search: search.trim() || undefined,
        entityType: selectedModule !== 'all' ? selectedModule : undefined,
        limit: 100,
      });
      setLogs(res.logs || []);
      setTotalCount(res.totalCount || 0);
      setRetentionDays(res.retentionDays || 30);
    } catch (err: unknown) {
      console.error('Failed to load audit logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to retrieve audit trail.');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, search, selectedModule]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleTestTelegramAlert = async () => {
    setIsTestingTelegram(true);
    setTestResult(null);
    try {
      const res = await testAuditLogTelemetryApi(getToken);
      setTestResult(res.message);
      await loadLogs();
      setTimeout(() => setTestResult(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to trigger Telegram test log.');
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const formatIST = (timestamp: number) => {
    return (
      new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date(timestamp)) + ' IST'
    );
  };

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('LOGIN')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">LOGIN</span>;
    }
    if (act.includes('INVITE') || act.includes('TEAM')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">TEAM</span>;
    }
    if (act.includes('PAYMENT') || act.includes('INVOICE')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">PAYMENT</span>;
    }
    if (act.includes('LEAD')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">LEAD</span>;
    }
    if (act.includes('CLIENT')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">CLIENT</span>;
    }
    if (act.includes('PROJECT')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">PROJECT</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-700 border border-gray-200">{action}</span>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-[20px] border border-[#EAE6F7] p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#5B4CF5]/10 to-[#7C5CE8]/20 text-[#5B4CF5] flex items-center justify-center border border-[#7C5CE8]/20">
              <ShieldAlert size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-bold text-[#1A085C]">
                  Enterprise Audit Logs &amp; Security Telemetry
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Database size={10} />
                  D1 Live
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Real-time chronological audit trail of all administrative, staff, and system events.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 30-Day Retention Notice */}
            <div className="h-9 px-3 rounded-xl bg-[#F8F8FF] border border-[#EAE6F7] text-xs font-semibold text-[#1A085C] flex items-center gap-2">
              <Calendar size={13} className="text-[#7C5CE8]" />
              <span>30-Day Rolling Purge Active</span>
            </div>

            {/* Test Telegram Dispatch Button */}
            <button
              onClick={handleTestTelegramAlert}
              disabled={isTestingTelegram}
              className="h-9 px-3.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5B4CF5] to-[#7C5CE8] hover:opacity-95 disabled:opacity-50 flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              title="Send verification test ping to Telegram logs channel"
            >
              {isTestingTelegram ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
              <span>{isTestingTelegram ? 'Dispatching...' : 'Test Telegram Alert'}</span>
            </button>
          </div>
        </div>

        {testResult && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{testResult} Check your Telegram channel for the formatted alert!</span>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-[20px] border border-[#EAE6F7] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor, email, target, or action..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#EAE6F7] text-xs font-medium text-[#1A085C] placeholder-[#9CA3AF] outline-none focus:border-[#7C5CE8]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-[#EAE6F7] text-xs font-medium text-[#1A085C] bg-[#F8F8FF]">
            <Filter size={13} className="text-[#7C5CE8]" />
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="bg-transparent outline-none cursor-pointer font-bold text-[#1A085C]"
            >
              <option value="all">All Modules</option>
              <option value="auth">Auth &amp; Sessions</option>
              <option value="team">Team &amp; RBAC</option>
              <option value="clients">Clients Directory</option>
              <option value="projects">Projects &amp; Tasks</option>
              <option value="payments">Invoices &amp; Payments</option>
              <option value="leads">Leads &amp; Intake</option>
              <option value="system">System &amp; Cron</option>
            </select>
          </div>

          <button
            onClick={loadLogs}
            disabled={isLoading}
            className="h-10 px-3 rounded-xl border border-[#EAE6F7] text-xs font-semibold text-[#1A085C] hover:bg-[#F8F8FF] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh logs"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#7C5CE8]' : 'text-[#6B7280]'} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Audit Logs List */}
      <div className="bg-white rounded-[20px] border border-[#EAE6F7] divide-y divide-[#F0EDF9] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#F8F8FF] flex items-center justify-between">
          <span className="text-xs font-extrabold text-[#1A085C] uppercase tracking-wider">
            Audit Activity Trail ({logs.length} of {totalCount} records)
          </span>
          <span className="text-[11px] text-[#6B7280]">
            Automatic {retentionDays}-day retention window
          </span>
        </div>

        {isLoading && logs.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#6B7280]">
            <RefreshCw size={24} className="mx-auto mb-2 text-[#7C5CE8] animate-spin" />
            <span>Loading enterprise audit logs from Cloudflare D1...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-xs text-rose-600 flex flex-col items-center gap-2">
            <AlertCircle size={22} className="text-rose-500" />
            <span>{error}</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#6B7280]">
            <ShieldAlert size={28} className="mx-auto mb-2 text-[#9CA3AF] stroke-[1.5]" />
            <span className="font-semibold text-sm text-[#1A085C] block">No audit logs found</span>
            <span className="text-[11px] text-[#9CA3AF] mt-0.5 block">
              Events will appear here in real-time as users perform actions in the Command Center.
            </span>
          </div>
        ) : (
          logs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div key={log.id} className="p-4 hover:bg-[#FAF9FF]/60 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: Summary & Actor */}
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="mt-0.5 p-1 rounded-md text-[#9CA3AF] hover:text-[#1A085C] hover:bg-[#F3F0FF] transition-colors"
                      title="Toggle JSON details"
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getActionBadge(log.action)}
                        <span className="text-xs font-bold text-[#1A085C]">{log.summary}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6B7280]">
                        <span className="flex items-center gap-1 font-medium text-[#1A085C]">
                          <User size={11} className="text-[#7C5CE8]" />
                          {log.actorName} ({log.actorRole})
                        </span>
                        {log.actorEmail && (
                          <span className="font-mono text-[#4B5563]">{log.actorEmail}</span>
                        )}
                        {log.entityName && (
                          <span className="px-1.5 py-0.5 bg-[#F3F0FF] text-[#5B4CF5] rounded font-medium text-[10px]">
                            Target: {log.entityName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Meta (IP, Device, Timestamp) */}
                  <div className="flex flex-col md:items-end text-left md:text-right gap-0.5 text-[11px] text-[#6B7280] shrink-0 pl-7 md:pl-0">
                    <span className="font-mono font-semibold text-[#1A085C]">{formatIST(log.createdAt)}</span>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-[#9CA3AF]">
                      {log.ipAddress && (
                        <span className="flex items-center gap-0.5">
                          <Globe size={10} />
                          {log.ipAddress}
                        </span>
                      )}
                      {log.userAgent && (
                        <span className="flex items-center gap-0.5 max-w-[140px] truncate" title={log.userAgent}>
                          <Monitor size={10} />
                          {log.userAgent}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details JSON Drawer */}
                {isExpanded && (
                  <div className="mt-3 ml-7 p-3.5 rounded-xl bg-[#1A085C] text-[#E0E7FF] font-mono text-[11px] overflow-x-auto shadow-inner border border-[#2D1B69]">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-white/70 text-[10px] font-sans font-bold">
                      <span className="flex items-center gap-1.5">
                        <FileCode size={12} className="text-[#7C5CE8]" />
                        Event Metadata &amp; Change Payload (ID: {log.id})
                      </span>
                      <span>Action: {log.action}</span>
                    </div>
                    {log.detailsJson ? (
                      <pre className="whitespace-pre-wrap leading-relaxed text-[#F3F0FF]">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(log.detailsJson), null, 2);
                          } catch {
                            return log.detailsJson;
                          }
                        })()}
                      </pre>
                    ) : (
                      <span className="text-white/40 italic">No extra metadata payload recorded.</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
