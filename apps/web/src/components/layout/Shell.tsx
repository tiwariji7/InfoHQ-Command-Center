import React, { useState } from 'react';
import { useClerk } from '@clerk/clerk-react';
import type { AuthUser, HealthResponse } from '@infohq/shared';
import { LeadsInbox } from '../leads/LeadsInbox.js';
import { PipelineView } from '../pipeline/PipelineView.js';
import { ProjectsList } from '../projects/ProjectsList.js';
import {
  ShieldCheck,
  LayoutDashboard,
  Inbox,
  Kanban,
  Briefcase,
  Mail,
  LogOut,
  Database,
  Server,
  Lock,
} from 'lucide-react';

interface ShellProps {
  user: AuthUser;
  health: HealthResponse | null;
  apiError: string | null;
}

export const Shell: React.FC<ShellProps> = ({ user, health, apiError }) => {
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'pipeline' | 'projects'>('leads');

  return (
    <div className="min-h-screen bg-brand-page flex flex-col md:flex-row">
      {/* Sidebar - Desktop (248px) / Tablet (72px) */}
      <aside className="hidden md:flex flex-col w-[72px] lg:w-[248px] bg-white border-r border-brand-border h-screen sticky top-0 z-20 transition-all">
        {/* Brand header */}
        <div className="h-16 flex items-center px-4 lg:px-6 border-b border-brand-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-chip bg-brand-primary flex items-center justify-center text-white font-bold text-sm shadow-sm">
              HQ
            </div>
            <div className="hidden lg:block">
              <div className="text-sm font-bold text-brand-heading leading-tight">
                InfoHQ
              </div>
              <div className="text-[11px] text-brand-muted tracking-tight">
                Command Center
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-control font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'bg-brand-subtle text-brand-primary'
                : 'text-brand-body hover:bg-brand-section'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="hidden lg:inline">Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('leads')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-control font-medium text-sm transition-colors ${
              activeTab === 'leads'
                ? 'bg-brand-subtle text-brand-primary'
                : 'text-brand-body hover:bg-brand-section'
            }`}
          >
            <Inbox size={20} />
            <span className="hidden lg:inline">Leads Inbox</span>
            <span className="hidden lg:inline ml-auto text-[10px] bg-chips-purpleBg text-chips-purpleText font-semibold px-1.5 py-0.5 rounded border border-purple-100">
              Active
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pipeline')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-control font-medium text-sm transition-colors ${
              activeTab === 'pipeline'
                ? 'bg-brand-subtle text-brand-primary'
                : 'text-brand-body hover:bg-brand-section'
            }`}
          >
            <Kanban size={20} />
            <span className="hidden lg:inline">Pipeline</span>
            <span className="hidden lg:inline ml-auto text-[10px] bg-chips-purpleBg text-chips-purpleText font-semibold px-1.5 py-0.5 rounded border border-purple-100">
              Active
            </span>
          </button>

          <button
            onClick={() => setActiveTab('projects')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-control font-medium text-sm transition-colors ${
              activeTab === 'projects'
                ? 'bg-brand-subtle text-brand-primary'
                : 'text-brand-body hover:bg-brand-section'
            }`}
          >
            <Briefcase size={20} />
            <span className="hidden lg:inline">Projects</span>
            <span className="hidden lg:inline ml-auto text-[10px] bg-chips-purpleBg text-chips-purpleText font-semibold px-1.5 py-0.5 rounded border border-purple-100">
              Active
            </span>
          </button>

          <button
            disabled
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-brand-lightGray font-medium text-sm cursor-not-allowed opacity-60"
            title="Available in Step 6"
          >
            <Mail size={20} />
            <span className="hidden lg:inline">Newsletter</span>
            <span className="hidden lg:inline ml-auto text-[10px] bg-brand-section text-brand-muted px-1.5 py-0.5 rounded">
              Step 6
            </span>
          </button>
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-brand-border">
          <div className="flex items-center justify-between gap-2 p-2 rounded-control bg-brand-section">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-brand-wash text-brand-primary flex items-center justify-center font-bold text-xs shrink-0">
                SA
              </div>
              <div className="hidden lg:block truncate">
                <div className="text-xs font-semibold text-brand-heading truncate">
                  {user.email || 'Superadmin'}
                </div>
                <div className="text-[10px] text-brand-muted capitalize">
                  {user.role}
                </div>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="p-1.5 text-brand-muted hover:text-brand-destructive rounded hover:bg-white transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (64px desktop / 56px mobile) */}
        <header className="h-14 md:h-16 bg-white border-b border-brand-border flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-chip bg-brand-primary flex items-center justify-center text-white font-bold text-xs">
                HQ
              </div>
              <span className="text-sm font-bold text-brand-heading">InfoHQ</span>
            </div>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-chip bg-chips-purpleBg text-chips-purpleText text-xs font-medium border border-purple-100">
              <ShieldCheck size={14} />
              <span>Single Superadmin Mode</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-brand-muted hidden sm:block">
              Environment: <span className="font-medium text-brand-heading">Local Dev</span>
            </div>
            <button
              onClick={() => signOut()}
              className="md:hidden p-2 text-brand-muted hover:text-brand-destructive"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto space-y-6 pb-20 md:pb-8">
          {activeTab === 'projects' ? (
            <ProjectsList />
          ) : activeTab === 'pipeline' ? (
            <PipelineView />
          ) : activeTab === 'leads' ? (
            <LeadsInbox />
          ) : (
            <>
              {/* Welcome & Stage Banner */}
              <div className="hq-card bg-white border-brand-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-brand-heading">
                      System Overview
                    </h1>
                    <p className="text-sm text-brand-body mt-1">
                      InfoHQ Command Center: Leads Inbox, 5-stage opportunity pipeline, and Projects & Tasks workspace.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <button
                      onClick={() => setActiveTab('projects')}
                      className="hq-btn-primary text-xs"
                    >
                      <Briefcase size={14} />
                      Projects & Tasks
                    </button>
                    <button
                      onClick={() => setActiveTab('pipeline')}
                      className="hq-btn-secondary text-xs"
                    >
                      <Kanban size={14} />
                      Sales Pipeline
                    </button>
                    <button
                      onClick={() => setActiveTab('leads')}
                      className="hq-btn-secondary text-xs"
                    >
                      <Inbox size={14} />
                      Leads Inbox
                    </button>
                  </div>
                </div>
              </div>

              {/* Infrastructure Health & Status Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Clerk Authentication card */}
                <div className="hq-card bg-white border-brand-border p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-control bg-brand-subtle flex items-center justify-center text-brand-primary">
                      <Lock size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-brand-heading">
                        Clerk Identity
                      </h2>
                      <div className="text-xs text-brand-muted">Server Allowlist</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-brand-border">
                      <span className="text-brand-muted">Clerk User ID</span>
                      <span className="font-mono text-brand-heading truncate max-w-[150px]">
                        {user.clerkUserId}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-brand-border">
                      <span className="text-brand-muted">Role</span>
                      <span className="font-semibold text-brand-primary uppercase text-[11px]">
                        {user.role}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-brand-muted">Public Signup</span>
                      <span className="text-brand-destructive font-medium">Blocked</span>
                    </div>
                  </div>
                </div>

                {/* Cloudflare Worker API card */}
                <div className="hq-card bg-white border-brand-border p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-control bg-brand-subtle flex items-center justify-center text-brand-primary">
                      <Server size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-brand-heading">
                        Cloudflare Worker
                      </h2>
                      <div className="text-xs text-brand-muted">Hono API</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-brand-border">
                      <span className="text-brand-muted">Health Endpoint</span>
                      <span
                        className={
                          health?.status === 'ok'
                            ? 'text-green-600 font-semibold'
                            : 'text-brand-muted'
                        }
                      >
                        {health?.status === 'ok' ? 'Online' : apiError ? 'Offline' : 'Checking...'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-brand-border">
                      <span className="text-brand-muted">API Version</span>
                      <span className="font-mono text-brand-heading">
                        {health?.version || '0.1.0'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-brand-muted">Route Protection</span>
                      <span className="text-green-600 font-medium">Active (Fail-closed)</span>
                    </div>
                  </div>
                </div>

                {/* Cloudflare Storage card */}
                <div className="hq-card bg-white border-brand-border p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-control bg-brand-subtle flex items-center justify-center text-brand-primary">
                      <Database size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-brand-heading">
                        Cloudflare D1
                      </h2>
                      <div className="text-xs text-brand-muted">Relational Storage</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-brand-border">
                      <span className="text-brand-muted">D1 Database</span>
                      <span className="font-mono text-brand-heading">DB (active)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-brand-border">
                      <span className="text-brand-muted">Schema Version</span>
                      <span className="font-mono text-brand-heading">0002_leads_core</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-brand-muted">Atomic Writes</span>
                      <span className="text-green-600 font-medium">Active (Batching)</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Navigation (64px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-brand-border flex items-center justify-around z-20 px-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center justify-center gap-1 py-1 ${
            activeTab === 'overview' ? 'text-brand-primary' : 'text-brand-muted'
          }`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[11px] font-medium">Overview</span>
        </button>
        <button
          onClick={() => setActiveTab('leads')}
          className={`flex flex-col items-center justify-center gap-1 py-1 ${
            activeTab === 'leads' ? 'text-brand-primary' : 'text-brand-muted'
          }`}
        >
          <Inbox size={20} />
          <span className="text-[11px] font-medium">Leads</span>
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex flex-col items-center justify-center gap-1 py-1 ${
            activeTab === 'pipeline' ? 'text-brand-primary' : 'text-brand-muted'
          }`}
        >
          <Kanban size={20} />
          <span className="text-[11px] font-medium">Pipeline</span>
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex flex-col items-center justify-center gap-1 py-1 ${
            activeTab === 'projects' ? 'text-brand-primary' : 'text-brand-muted'
          }`}
        >
          <Briefcase size={20} />
          <span className="text-[11px] font-medium">Projects</span>
        </button>
        <button
          disabled
          className="flex flex-col items-center justify-center gap-1 text-brand-lightGray py-1 opacity-50"
        >
          <Mail size={20} />
          <span className="text-[11px]">Newsletter</span>
        </button>
      </nav>
    </div>
  );
};
