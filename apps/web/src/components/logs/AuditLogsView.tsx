import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Sparkles,
  Layers,
  Check,
  ChevronLeft,
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<Record<string, 'clean' | 'raw'>>({});

  // Request race condition protection (CodeRabbit Finding #4)
  const activeRequestIdRef = useRef<number>(0);

  // Test Telegram button state
  const [isTestingTelegram, setIsTestingTelegram] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ message: string; delivered: boolean } | null>(null);

  // Reset to page 1 whenever filters change
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleModuleChange = (val: string) => {
    setSelectedModule(val);
    setPage(1);
  };

  const loadLogs = useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const offset = (page - 1) * pageSize;
      const res = await fetchAuditLogsApi(getToken, {
        search: search.trim() || undefined,
        entityType: selectedModule !== 'all' ? selectedModule : undefined,
        limit: pageSize,
        offset,
      });

      // Ignore superseded requests
      if (requestId === activeRequestIdRef.current) {
        setLogs(res.logs || []);
        setTotalCount(res.totalCount || 0);
        setRetentionDays(res.retentionDays || 30);
      }
    } catch (err: unknown) {
      if (requestId === activeRequestIdRef.current) {
        console.error('Failed to load audit logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to retrieve audit trail.');
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [getToken, search, selectedModule, page, pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleTestTelegramAlert = async () => {
    setIsTestingTelegram(true);
    setTestResult(null);
    try {
      const res = await testAuditLogTelemetryApi(getToken);
      setTestResult({
        message: res.message,
        delivered: Boolean(res.telegramDelivered),
      });
      await loadLogs();
      setTimeout(() => setTestResult(null), 8000);
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
    if (act.includes('LOGOUT')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">LOGOUT</span>;
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
    if (act.includes('PROJECT') || act.includes('TASK')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">PROJECT</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-700 border border-gray-200">{action}</span>;
  };

  const formatKeyName = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/_/g, ' ')
      .trim();
  };

  const renderCleanDetails = (detailsJson: string | null) => {
    if (!detailsJson) {
      return <span className="text-xs text-[#9CA3AF] italic">No extra metadata parameters recorded.</span>;
    }

    try {
      const parsed = JSON.parse(detailsJson);
      if (typeof parsed !== 'object' || parsed === null) {
        return <span className="text-xs text-[#1A085C] font-mono">{String(parsed)}</span>;
      }

      const entries = Object.entries(parsed);
      if (entries.length === 0) {
        return <span className="text-xs text-[#9CA3AF] italic">Empty parameter payload.</span>;
      }

      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {entries.map(([k, v]) => {
            const formattedKey = formatKeyName(k);
            let displayVal = '';
            let isBadge = false;

            if (typeof v === 'boolean') {
              displayVal = v ? 'True' : 'False';
              isBadge = true;
            } else if (typeof v === 'object' && v !== null) {
              displayVal = JSON.stringify(v);
            } else if (v === null || v === undefined) {
              displayVal = 'None / Empty';
            } else {
              displayVal = String(v);
            }

            return (
              <div
                key={k}
                className="bg-white rounded-xl border border-[#EAE6F7] p-2.5 flex flex-col justify-between shadow-xs hover:border-[#7C5CE8]/40 transition-colors"
              >
                <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider block mb-1">
                  {formattedKey}
                </span>
                {isBadge ? (
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold w-fit ${v ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-600'}`}>
                    {displayVal}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-[#1A085C] break-words line-clamp-3" title={displayVal}>
                    {displayVal}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      );
    } catch {
      return <pre className="text-xs font-mono text-[#1A085C] whitespace-pre-wrap">{detailsJson}</pre>;
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-[20px] border border-[#EAE6F7] p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5B4CF5]/10 to-[#7C5CE8]/20 text-[#5B4CF5] flex items-center justify-center border border-[#7C5CE8]/20 shrink-0">
              <ShieldAlert size={24} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-[#1A085C]">
                  Enterprise Audit Logs &amp; Security Telemetry
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Database size={10} />
                  Cloudflare D1 Live
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Exact second-by-second chronological audit trail of all staff logins, leads, payments, and project updates.
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
              title="Send diagnostic verification test ping to Telegram logs channel"
            >
              {isTestingTelegram ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
              <span>{isTestingTelegram ? 'Verifying...' : 'Test Telegram Alert'}</span>
            </button>
          </div>
        </div>

        {/* Diagnostic Alert Feedback */}
        {testResult && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-fadeIn ${
              testResult.delivered
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {testResult.delivered ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
            )}
            <div>
              <span className="font-bold">{testResult.delivered ? 'Telemetry Verified: ' : 'Notice: '}</span>
              <span>{testResult.message}</span>
            </div>
          </div>
        )}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl border border-[#EAE6F7] p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6B7280] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Recorded</span>
            <Layers size={14} className="text-[#7C5CE8]" />
          </div>
          <div className="text-2xl font-black text-[#1A085C]">{totalCount}</div>
          <span className="text-[10px] text-[#9CA3AF] mt-0.5 block">Events in 30-day window</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6F7] p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6B7280] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Storage Engine</span>
            <Database size={14} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">Cloudflare D1</div>
          <span className="text-[10px] text-[#9CA3AF] mt-0.5 block">infohq-command-center</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6F7] p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6B7280] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Telegram Channel</span>
            <Send size={14} className="text-[#5B4CF5]" />
          </div>
          <div className="text-xl font-black text-[#1A085C] font-mono truncate" title="-1004492774470">
            -1004492774470
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
            <Check size={10} /> Live Telemetry Linked
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-[#EAE6F7] p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6B7280] mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Retention Policy</span>
            <Calendar size={14} className="text-purple-600" />
          </div>
          <div className="text-2xl font-black text-[#1A085C]">{retentionDays} Days</div>
          <span className="text-[10px] text-[#9CA3AF] mt-0.5 block">Smooth second-by-second roll</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-[20px] border border-[#EAE6F7] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by actor, email, action, or target..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#EAE6F7] text-xs font-medium text-[#1A085C] placeholder-[#9CA3AF] outline-none focus:border-[#7C5CE8]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-[#EAE6F7] text-xs font-medium text-[#1A085C] bg-[#F8F8FF]">
            <Filter size={13} className="text-[#7C5CE8]" />
            <select
              value={selectedModule}
              onChange={(e) => handleModuleChange(e.target.value)}
              className="bg-transparent outline-none cursor-pointer font-bold text-[#1A085C]"
            >
              <option value="all">All Modules</option>
              <option value="auth">Auth &amp; Sessions</option>
              <option value="team">Team &amp; RBAC</option>
              <option value="clients">Clients Directory</option>
              <option value="projects">Projects &amp; Tasks</option>
              <option value="payments">Invoices &amp; Payments</option>
              <option value="leads">Leads &amp; Intake</option>
              <option value="system">System &amp; Diagnostics</option>
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
            Page {page} of {totalPages}
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
            const currentView = viewMode[log.id] || 'clean';

            return (
              <div key={log.id} className="p-4 hover:bg-[#FAF9FF]/60 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: Summary & Actor */}
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="mt-0.5 p-1 rounded-md text-[#9CA3AF] hover:text-[#1A085C] hover:bg-[#F3F0FF] transition-colors"
                      title="Toggle details"
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
                        <span className="flex items-center gap-0.5" title={`IP: ${log.ipAddress}`}>
                          <Globe size={10} />
                          {log.ipAddress}
                        </span>
                      )}
                      {log.userAgent && (
                        <span className="flex items-center gap-0.5 max-w-[150px] truncate" title={log.userAgent}>
                          <Monitor size={10} />
                          {log.userAgent}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="mt-3.5 ml-7 p-4 rounded-2xl bg-[#F8F8FF] border border-[#EAE6F7] shadow-inner transition-all animate-fadeIn">
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#EAE6F7]">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-[#7C5CE8]" />
                        <span className="text-xs font-bold text-[#1A085C]">
                          Activity Changes &amp; Payload
                        </span>
                        <span className="text-[10px] font-mono text-[#6B7280]">
                          (ID: {log.id})
                        </span>
                      </div>

                      {/* Toggle Clean View vs Raw JSON */}
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-[#EAE6F7]">
                        <button
                          onClick={() => setViewMode((prev) => ({ ...prev, [log.id]: 'clean' }))}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            currentView === 'clean'
                              ? 'bg-[#5B4CF5] text-white'
                              : 'text-[#6B7280] hover:text-[#1A085C]'
                          }`}
                        >
                          Clean View
                        </button>
                        <button
                          onClick={() => setViewMode((prev) => ({ ...prev, [log.id]: 'raw' }))}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            currentView === 'raw'
                              ? 'bg-[#5B4CF5] text-white'
                              : 'text-[#6B7280] hover:text-[#1A085C]'
                          }`}
                        >
                          Raw JSON
                        </button>
                      </div>
                    </div>

                    {currentView === 'clean' ? (
                      renderCleanDetails(log.detailsJson)
                    ) : (
                      <div className="p-3 rounded-xl bg-[#1A085C] text-[#E0E7FF] font-mono text-[11px] overflow-x-auto shadow-inner border border-[#2D1B69]">
                        <pre className="whitespace-pre-wrap leading-relaxed text-[#F3F0FF]">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(log.detailsJson || '{}'), null, 2);
                            } catch {
                              return log.detailsJson;
                            }
                          })()}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Pagination Footer (CodeRabbit Finding #6) */}
        {totalPages > 1 && (
          <div className="p-4 bg-[#F8F8FF] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#6B7280]">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} events
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="h-8 px-2.5 rounded-lg border border-[#EAE6F7] text-xs font-semibold text-[#1A085C] bg-white hover:bg-[#FAF9FF] disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>

              <div className="px-3 text-xs font-bold text-[#1A085C]">
                {page} / {totalPages}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="h-8 px-2.5 rounded-lg border border-[#EAE6F7] text-xs font-semibold text-[#1A085C] bg-white hover:bg-[#FAF9FF] disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
