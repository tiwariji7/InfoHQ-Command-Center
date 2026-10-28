import React, { useState } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import type { AuthUser, HealthResponse } from '@infohq/shared';
import { LeadsInbox } from '../leads/LeadsInbox.js';
import { PipelineView } from '../pipeline/PipelineView.js';
import { ProjectsList } from '../projects/ProjectsList.js';
import { PaymentsView } from '../payments/PaymentsView.js';
import { OverviewDashboard } from '../dashboard/OverviewDashboard.js';
import { ModulePlaceholderView } from './ModulePlaceholderView.js';
import {
  Compass,
  Inbox,
  KanbanSquare,
  BriefcaseBusiness,
  FolderKanban,
  ListTodo,
  Rocket,
  Receipt,
  FileSpreadsheet,
  TrendingUp,
  UserCheck,
  MessagesSquare,
  SlidersHorizontal,
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
  icon: React.ElementType;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Shell: React.FC<ShellProps> = ({ user: _user, health: _health, apiError: _apiError }) => {
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // User details for Top-Right Header Profile
  const displayName =
    clerkUser?.fullName ||
    (clerkUser?.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : null) ||
    'Shivam Tiwari';
  const designation = 'Super Admin';
  const avatarLetter = (displayName ? displayName[0] : 'S').toUpperCase();

  // Navigation sections without subheadings for clean visual hierarchy
  const navigationSections: NavSection[] = [
    {
      title: 'DASHBOARD',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: Compass,
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
          icon: Inbox,
          badge: 'Active',
        },
        {
          id: 'pipeline',
          label: 'Sales Pipeline',
          icon: KanbanSquare,
          badge: 'Active',
        },
        {
          id: 'clients',
          label: 'Clients',
          icon: BriefcaseBusiness,
        },
      ],
    },
    {
      title: 'DELIVERY & ENGINEERING',
      items: [
        {
          id: 'projects',
          label: 'Projects',
          icon: FolderKanban,
          badge: 'Active',
        },
        {
          id: 'tasks',
          label: 'Tasks & Sprints',
          icon: ListTodo,
        },
        {
          id: 'deployments',
          label: 'Deployments & Releases',
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
          icon: Receipt,
          badge: 'Active',
        },
        {
          id: 'proposals',
          label: 'Proposals & Contracts',
          icon: FileSpreadsheet,
        },
        {
          id: 'analytics',
          label: 'Analytics & Reports',
          icon: TrendingUp,
        },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          id: 'team',
          label: 'Team & Roles',
          icon: UserCheck,
        },
        {
          id: 'communications',
          label: 'Communications',
          icon: MessagesSquare,
        },
        {
          id: 'settings',
          label: 'Settings & Security',
          icon: SlidersHorizontal,
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
    <div className="min-h-screen bg-brand-page flex flex-col lg:flex-row font-sans">
      {/* ========================================================= */}
      {/* LAPTOP / DESKTOP SIDEBAR (>= 1024px)                      */}
      {/* Fixed on side, independently scrollable with overscroll   */}
      {/* ========================================================= */}
      <aside className="hidden lg:flex flex-col w-[260px] xl:w-[276px] bg-white border-r border-brand-border h-screen sticky top-0 z-20 shrink-0 select-none">
        {/* Brand Header: InfoHQ with Capital I and Command Center gradient */}
        <div className="h-16 flex items-center px-5 border-b border-brand-border shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="text-[22px] font-black tracking-tight bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
                Info
              </span>
              <span className="text-[22px] font-black tracking-tight text-brand-heading ml-0.5">
                HQ
              </span>
            </div>
            <span className="text-[10px] font-bold tracking-wider uppercase bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent -mt-1">
              Command Center
            </span>
          </div>
        </div>

        {/* Scrollable Navigation List - Only scrolls when cursor is over sidebar */}
        <nav className="flex-1 px-3 py-3.5 overflow-y-auto space-y-4 text-xs overscroll-contain">
          {navigationSections.map((sec) => (
            <div key={sec.title} className="space-y-1">
              {/* Clean Section Header */}
              <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider px-3 py-1">
                {sec.title}
              </div>

              {/* Section Items - Clean without subheadings */}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeTab === item.id || (item.id === 'dashboard' && activeTab === 'overview');

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-control text-left transition-all group cursor-pointer ${
                      isActive
                        ? 'bg-brand-subtle text-brand-primary shadow-xs font-bold'
                        : 'text-brand-body hover:bg-brand-section hover:text-brand-heading font-medium'
                    }`}
                  >
                    {/* Premium Icon Micro-Tile */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isActive
                          ? 'bg-gradient-to-br from-[#7C5CE8] to-[#5B4CF5] text-white shadow-xs'
                          : 'bg-brand-page border border-brand-border/70 text-brand-muted group-hover:text-brand-heading group-hover:bg-white group-hover:border-brand-primary/30'
                      }`}
                    >
                      <Icon size={15} className="stroke-[2.2]" />
                    </div>

                    <span
                      className={`text-xs truncate flex-1 ${
                        isActive ? 'text-brand-primary font-bold' : 'text-brand-heading'
                      }`}
                    >
                      {item.label}
                    </span>

                    {item.badge && (
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                          item.badge === 'Live'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-chips-purpleBg text-chips-purpleText border border-purple-100'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* ========================================================= */}
      {/* MOBILE & TABLET SLIDE-OUT DRAWER (< 1024px)               */}
      {/* Opens ONLY when clicking the 3-lines hamburger button     */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Menu */}
          <div className="relative w-4/5 max-w-xs bg-white h-full flex flex-col z-10 shadow-2xl">
            {/* Drawer Header */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-brand-border shrink-0">
              <div className="flex flex-col select-none">
                <div className="flex items-center">
                  <span className="text-xl font-black tracking-tight bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
                    Info
                  </span>
                  <span className="text-xl font-black tracking-tight text-brand-heading ml-0.5">HQ</span>
                </div>
                <span className="text-[9.5px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent -mt-1">
                  Command Center
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-brand-muted hover:text-brand-heading rounded-control hover:bg-brand-section cursor-pointer"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Navigation List */}
            <nav className="flex-1 px-3 py-3.5 overflow-y-auto space-y-4 text-xs overscroll-contain">
              {navigationSections.map((sec) => (
                <div key={sec.title} className="space-y-1">
                  <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider px-3 py-1">
                    {sec.title}
                  </div>
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      activeTab === item.id || (item.id === 'dashboard' && activeTab === 'overview');

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-control text-left transition-all ${
                          isActive
                            ? 'bg-brand-subtle text-brand-primary font-bold shadow-xs'
                            : 'text-brand-body hover:bg-brand-section font-medium'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-gradient-to-br from-[#7C5CE8] to-[#5B4CF5] text-white shadow-xs'
                              : 'bg-brand-page border border-brand-border/70 text-brand-muted'
                          }`}
                        >
                          <Icon size={15} className="stroke-[2.2]" />
                        </div>
                        <span className="truncate flex-1 text-xs">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              item.badge === 'Live'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-chips-purpleBg text-chips-purpleText border border-purple-100'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Drawer Logout Footer */}
            <div className="p-3 border-t border-brand-border bg-white shrink-0">
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-control text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <LogOut size={15} />
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
        {/* Top Header Bar: Clean, uncluttered with Profile in Top Right Corner */}
        <header className="h-16 bg-white border-b border-brand-border flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            {/* 3-Lines Hamburger Button: visible on Mobile & Tablet (< 1024px) */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-brand-muted hover:text-brand-heading rounded-control hover:bg-brand-section transition-colors cursor-pointer"
              aria-label="Open navigation menu"
              title="Open menu"
            >
              <Menu size={22} className="stroke-[2.2]" />
            </button>

            {/* Mobile & Tablet Brand Title */}
            <div className="lg:hidden flex items-center gap-1 select-none">
              <span className="text-lg font-black tracking-tight bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
                Info
              </span>
              <span className="text-lg font-black tracking-tight text-brand-heading">HQ</span>
            </div>

            {/* Clean Breadcrumb Indicator on Desktop */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-brand-muted select-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-medium text-brand-heading">Command Center</span>
              <span>/</span>
              <span className="capitalize font-semibold text-brand-primary">
                {activeTab === 'dashboard' ? 'Overview' : activeTab}
              </span>
            </div>
          </div>

          {/* RIGHT TOP CORNER: Super Admin Profile (Name + Designation + Avatar + Logout) */}
          <div className="flex items-center gap-2.5 sm:gap-3 pl-3">
            {/* Name and Designation */}
            <div className="text-right hidden sm:block select-none">
              <div className="text-xs sm:text-[13px] font-bold text-brand-heading leading-tight">
                {displayName}
              </div>
              <div className="text-[10.5px] font-medium text-brand-muted">
                {designation}
              </div>
            </div>

            {/* Profile Avatar with First Letter */}
            <div
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] text-white flex items-center justify-center font-bold text-sm shadow-[0_2px_8px_rgba(124,92,232,0.3)] shrink-0 ring-2 ring-white select-none"
              title={`${displayName} (${designation})`}
            >
              {avatarLetter}
            </div>

            {/* Clean Logout Button */}
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="p-1.5 text-brand-muted hover:text-brand-destructive rounded-control hover:bg-brand-section transition-colors cursor-pointer shrink-0"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Dynamic Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto pb-12">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};
