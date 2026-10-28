import React, { useState } from 'react';
import { useClerk } from '@clerk/clerk-react';
import type { AuthUser, HealthResponse } from '@infohq/shared';
import { LeadsInbox } from '../leads/LeadsInbox.js';
import { PipelineView } from '../pipeline/PipelineView.js';
import { ProjectsList } from '../projects/ProjectsList.js';
import { PaymentsView } from '../payments/PaymentsView.js';
import { OverviewDashboard } from '../dashboard/OverviewDashboard.js';
import { ModulePlaceholderView } from './ModulePlaceholderView.js';
import {
  LayoutDashboard,
  Inbox,
  Kanban,
  Building2,
  Briefcase,
  CheckSquare,
  Rocket,
  CreditCard,
  FileText,
  BarChart3,
  Users,
  Mail,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface ShellProps {
  user: AuthUser;
  health: HealthResponse | null;
  apiError: string | null;
}

interface NavItem {
  id: string;
  label: string;
  subtext: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Shell: React.FC<ShellProps> = ({ user, health: _health, apiError: _apiError }) => {
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Exact navigation sections specified by user
  const navigationSections: NavSection[] = [
    {
      title: 'DASHBOARD',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          subtext: 'Executive pulse, KPIs, real-time command center',
          icon: LayoutDashboard,
          badge: 'Live',
        },
      ],
    },
    {
      title: 'SALES & CLIENTS',
      items: [
        {
          id: 'leads',
          label: 'Leads Inbox',
          subtext: 'Website enquiries, consultation requests',
          icon: Inbox,
          badge: 'Active',
        },
        {
          id: 'pipeline',
          label: 'Sales Pipeline',
          subtext: 'New → Contacted → Proposal → Won/Lost',
          icon: Kanban,
          badge: 'Active',
        },
        {
          id: 'clients',
          label: 'Clients',
          subtext: 'Client profiles, contacts, history',
          icon: Building2,
        },
      ],
    },
    {
      title: 'DELIVERY & ENGINEERING',
      items: [
        {
          id: 'projects',
          label: 'Projects',
          subtext: 'Milestones, deadlines, deliverables',
          icon: Briefcase,
          badge: 'Active',
        },
        {
          id: 'tasks',
          label: 'Tasks & Sprints',
          subtext: 'Assignments, priorities, progress',
          icon: CheckSquare,
        },
        {
          id: 'deployments',
          label: 'Deployments & Releases',
          subtext: 'Release history, environments, status',
          icon: Rocket,
        },
      ],
    },
    {
      title: 'FINANCE & GROWTH',
      items: [
        {
          id: 'billing',
          label: 'Billing & Invoices',
          subtext: 'Invoices, payments, pending dues',
          icon: CreditCard,
          badge: 'Active',
        },
        {
          id: 'proposals',
          label: 'Proposals & Contracts',
          subtext: 'Quotes, project estimates, agreements',
          icon: FileText,
        },
        {
          id: 'analytics',
          label: 'Analytics & Reports',
          subtext: 'Revenue, conversion, client growth',
          icon: BarChart3,
        },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          id: 'team',
          label: 'Team & Roles',
          subtext: 'Employees, assignments, permissions',
          icon: Users,
        },
        {
          id: 'communications',
          label: 'Communications',
          subtext: 'Email history, follow-ups, notifications',
          icon: Mail,
        },
        {
          id: 'settings',
          label: 'Settings & Security',
          subtext: 'Roles, audit logs, integrations, configuration',
          icon: Settings,
        },
      ],
    },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
      case 'overview':
        return (
          <OverviewDashboard
            onNavigateTab={handleSelectTab}
            onOpenAddLead={() => handleSelectTab('leads')}
            onOpenCreateProject={() => handleSelectTab('projects')}
            onOpenCreatePayment={() => handleSelectTab('billing')}
            onSelectLeadId={(_id) => handleSelectTab('leads')}
            onSelectProjectId={(_id) => handleSelectTab('projects')}
          />
        );
      case 'leads':
        return <LeadsInbox />;
      case 'pipeline':
        return <PipelineView />;
      case 'projects':
        return <ProjectsList />;
      case 'billing':
      case 'payments':
        return <PaymentsView />;
      case 'clients':
        return (
          <ModulePlaceholderView
            moduleKey="clients"
            title="Clients"
            subtitle="Client profiles, contacts, history"
            section="SALES & CLIENTS"
            onNavigateTab={handleSelectTab}
          />
        );
      case 'tasks':
        return (
          <ModulePlaceholderView
            moduleKey="tasks"
            title="Tasks & Sprints"
            subtitle="Assignments, priorities, progress"
            section="DELIVERY & ENGINEERING"
            onNavigateTab={handleSelectTab}
          />
        );
      case 'deployments':
        return (
          <ModulePlaceholderView
            moduleKey="deployments"
            title="Deployments & Releases"
            subtitle="Release history, environments, status"
            section="DELIVERY & ENGINEERING"
            onNavigateTab={handleSelectTab}
          />
        );
      case 'proposals':
        return (
          <ModulePlaceholderView
            moduleKey="proposals"
            title="Proposals & Contracts"
            subtitle="Quotes, project estimates, agreements"
            section="FINANCE & GROWTH"
            onNavigateTab={handleSelectTab}
          />
        );
      case 'analytics':
        return (
          <ModulePlaceholderView
            moduleKey="analytics"
            title="Analytics & Reports"
            subtitle="Revenue, conversion, client growth"
            section="FINANCE & GROWTH"
            onNavigateTab={handleSelectTab}
          />
        );
      case 'team':
        return (
          <ModulePlaceholderView
            moduleKey="team"
            title="Team & Roles"
            subtitle="Employees, assignments, permissions"
            section="OPERATIONS"
            onNavigateTab={handleSelectTab}
          />
        );
      case 'communications':
        return (
          <ModulePlaceholderView
            moduleKey="communications"
            title="Communications"
            subtitle="Email history, follow-ups, notifications"
            section="OPERATIONS"
            onNavigateTab={handleSelectTab}
          />
        );
      case 'settings':
        return (
          <ModulePlaceholderView
            moduleKey="settings"
            title="Settings & Security"
            subtitle="Roles, audit logs, integrations, configuration"
            section="OPERATIONS"
            onNavigateTab={handleSelectTab}
          />
        );
      default:
        return (
          <OverviewDashboard
            onNavigateTab={handleSelectTab}
            onOpenAddLead={() => handleSelectTab('leads')}
            onOpenCreateProject={() => handleSelectTab('projects')}
            onOpenCreatePayment={() => handleSelectTab('billing')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-brand-page flex flex-col md:flex-row font-sans">
      {/* ========================================================= */}
      {/* DESKTOP SIDEBAR (260px) - Fixed and Styled with Subtitles */}
      {/* ========================================================= */}
      <aside className="hidden md:flex flex-col w-[260px] xl:w-[276px] bg-white border-r border-brand-border h-screen sticky top-0 z-20 shrink-0">
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-brand-border shrink-0">
          <div className="flex items-center gap-2 select-none">
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
              info
            </span>
            <span className="text-xl font-black tracking-tight text-brand-heading">
              HQ
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-subtle text-[#5B4CF5] border border-purple-100 ml-1">
              Command
            </span>
          </div>
        </div>

        {/* Scrollable Navigation List */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4 text-xs">
          {navigationSections.map((sec) => (
            <div key={sec.title} className="space-y-1">
              {/* Section Header */}
              <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider px-3 py-1">
                {sec.title}
              </div>

              {/* Section Items */}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id || (item.id === 'dashboard' && activeTab === 'overview');

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-start gap-2.5 p-2.5 rounded-control text-left transition-all group cursor-pointer ${
                      isActive
                        ? 'bg-brand-subtle text-brand-primary shadow-xs'
                        : 'text-brand-body hover:bg-brand-section hover:text-brand-heading'
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-white text-brand-primary shadow-xs'
                          : 'text-brand-muted group-hover:text-brand-heading'
                      }`}
                    >
                      <Icon size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold text-xs truncate ${isActive ? 'text-brand-primary' : 'text-brand-heading'}`}>
                          {item.label}
                        </span>
                        {item.badge && (
                          <span
                            className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded ${
                              item.badge === 'Live'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-chips-purpleBg text-chips-purpleText border border-purple-100'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] text-brand-muted truncate leading-tight mt-0.5">
                        {item.subtext}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Footer with Superadmin Profile & Logout */}
        <div className="p-3 border-t border-brand-border bg-white shrink-0">
          <div className="flex items-center justify-between gap-2 p-2 rounded-control bg-brand-page border border-brand-border">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C5CE8] to-[#5B4CF5] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                SA
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-brand-heading truncate">
                  {user.email || 'Superadmin'}
                </div>
                <div className="text-[10px] text-brand-muted capitalize">
                  {user.role} • Single Superadmin
                </div>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="p-1.5 text-brand-muted hover:text-brand-destructive rounded-control hover:bg-white transition-colors cursor-pointer shrink-0"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MOBILE DRAWER NAVIGATION (Slide-out menu for phones)       */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Menu */}
          <div className="relative w-4/5 max-w-xs bg-white h-full flex flex-col z-10 shadow-2xl">
            <div className="h-14 flex items-center justify-between px-4 border-b border-brand-border">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
                  info
                </span>
                <span className="text-lg font-black text-brand-heading">HQ</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-brand-muted hover:text-brand-heading"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4 text-xs">
              {navigationSections.map((sec) => (
                <div key={sec.title} className="space-y-1">
                  <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider px-2 py-1">
                    {sec.title}
                  </div>
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id || (item.id === 'dashboard' && activeTab === 'overview');

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-control text-left ${
                          isActive
                            ? 'bg-brand-subtle text-brand-primary font-semibold'
                            : 'text-brand-body hover:bg-brand-section'
                        }`}
                      >
                        <Icon size={16} className={isActive ? 'text-brand-primary' : 'text-brand-muted'} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="p-3 border-t border-brand-border">
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 p-2 rounded-control text-xs font-semibold text-rose-600 bg-rose-50"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MAIN CONTENT AREA                                         */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 md:h-16 bg-white border-b border-brand-border flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-brand-muted hover:text-brand-heading rounded-control hover:bg-brand-section"
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>

            <div className="md:hidden flex items-center gap-1.5">
              <span className="text-base font-black bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
                info
              </span>
              <span className="text-base font-black text-brand-heading">HQ</span>
            </div>

            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-subtle text-[#5B4CF5] text-xs font-semibold border border-purple-100">
              <ShieldCheck size={14} />
              <span>Superadmin Command Center</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-brand-muted hidden sm:flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>D1 Studio: Connected</span>
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

        {/* Dynamic Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto pb-24 md:pb-8">
          {renderActiveView()}
        </main>
      </div>

      {/* ========================================================= */}
      {/* MOBILE BOTTOM NAVIGATION (Quick shortcuts for phone)      */}
      {/* ========================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-brand-border flex items-center justify-around z-20 px-2 shadow-lg">
        <button
          onClick={() => handleSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center gap-1 py-1 ${
            activeTab === 'dashboard' || activeTab === 'overview'
              ? 'text-brand-primary font-bold'
              : 'text-brand-muted font-medium'
          }`}
        >
          <LayoutDashboard size={18} />
          <span className="text-[10px]">Dashboard</span>
        </button>

        <button
          onClick={() => handleSelectTab('leads')}
          className={`flex flex-col items-center justify-center gap-1 py-1 ${
            activeTab === 'leads' ? 'text-brand-primary font-bold' : 'text-brand-muted font-medium'
          }`}
        >
          <Inbox size={18} />
          <span className="text-[10px]">Leads</span>
        </button>

        <button
          onClick={() => handleSelectTab('pipeline')}
          className={`flex flex-col items-center justify-center gap-1 py-1 ${
            activeTab === 'pipeline' ? 'text-brand-primary font-bold' : 'text-brand-muted font-medium'
          }`}
        >
          <Kanban size={18} />
          <span className="text-[10px]">Pipeline</span>
        </button>

        <button
          onClick={() => handleSelectTab('projects')}
          className={`flex flex-col items-center justify-center gap-1 py-1 ${
            activeTab === 'projects' ? 'text-brand-primary font-bold' : 'text-brand-muted font-medium'
          }`}
        >
          <Briefcase size={18} />
          <span className="text-[10px]">Projects</span>
        </button>

        <button
          onClick={() => handleSelectTab('billing')}
          className={`flex flex-col items-center justify-center gap-1 py-1 ${
            activeTab === 'billing' || activeTab === 'payments'
              ? 'text-brand-primary font-bold'
              : 'text-brand-muted font-medium'
          }`}
        >
          <CreditCard size={18} />
          <span className="text-[10px]">Billing</span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-1 py-1 text-brand-muted font-medium"
        >
          <Menu size={18} />
          <span className="text-[10px]">More</span>
        </button>
      </nav>
    </div>
  );
};
