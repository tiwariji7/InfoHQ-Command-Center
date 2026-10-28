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
  subtext: string;
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

  // Premium Navigation Sections with Curated Executive Icons
  const navigationSections: NavSection[] = [
    {
      title: 'DASHBOARD',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          subtext: 'Executive pulse, KPIs, real-time command center',
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
          subtext: 'Website enquiries, consultation requests',
          icon: Inbox,
          badge: 'Active',
        },
        {
          id: 'pipeline',
          label: 'Sales Pipeline',
          subtext: 'New → Contacted → Proposal → Won/Lost',
          icon: KanbanSquare,
          badge: 'Active',
        },
        {
          id: 'clients',
          label: 'Clients',
          subtext: 'Client profiles, contacts, history',
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
          subtext: 'Milestones, deadlines, deliverables',
          icon: FolderKanban,
          badge: 'Active',
        },
        {
          id: 'tasks',
          label: 'Tasks & Sprints',
          subtext: 'Assignments, priorities, progress',
          icon: ListTodo,
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
          icon: Receipt,
          badge: 'Active',
        },
        {
          id: 'proposals',
          label: 'Proposals & Contracts',
          subtext: 'Quotes, project estimates, agreements',
          icon: FileSpreadsheet,
        },
        {
          id: 'analytics',
          label: 'Analytics & Reports',
          subtext: 'Revenue, conversion, client growth',
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
          subtext: 'Employees, assignments, permissions',
          icon: UserCheck,
        },
        {
          id: 'communications',
          label: 'Communications',
          subtext: 'Email history, follow-ups, notifications',
          icon: MessagesSquare,
        },
        {
          id: 'settings',
          label: 'Settings & Security',
          subtext: 'Roles, audit logs, integrations, configuration',
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
    <div className="min-h-screen bg-brand-page flex flex-col md:flex-row font-sans">
      {/* ========================================================= */}
      {/* DESKTOP SIDEBAR (264px)                                   */}
      {/* ========================================================= */}
      <aside className="hidden md:flex flex-col w-[264px] xl:w-[280px] bg-white border-r border-brand-border h-screen sticky top-0 z-20 shrink-0">
        {/* Brand Header: InfoHQ with Command Center in gradient */}
        <div className="h-16 flex items-center px-5 border-b border-brand-border shrink-0">
          <div className="flex flex-col select-none">
            <div className="flex items-center">
              <span className="text-[22px] font-black tracking-tight bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
                info
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

        {/* Scrollable Navigation List */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4 text-xs">
          {navigationSections.map((sec) => (
            <div key={sec.title} className="space-y-1">
              {/* Section Header */}
              <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider px-3 py-1">
                {sec.title}
              </div>

              {/* Section Items with Premium Micro-Tile Icons */}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeTab === item.id || (item.id === 'dashboard' && activeTab === 'overview');

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-control text-left transition-all group cursor-pointer ${
                      isActive
                        ? 'bg-brand-subtle text-brand-primary shadow-xs'
                        : 'text-brand-body hover:bg-brand-section hover:text-brand-heading'
                    }`}
                  >
                    {/* Premium Icon Micro-Tile */}
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isActive
                          ? 'bg-gradient-to-br from-[#7C5CE8] to-[#5B4CF5] text-white shadow-xs'
                          : 'bg-brand-page border border-brand-border/70 text-brand-muted group-hover:text-brand-heading group-hover:bg-white group-hover:border-brand-primary/30'
                      }`}
                    >
                      <Icon size={15} className="stroke-[2.2]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-semibold text-xs truncate ${
                            isActive ? 'text-brand-primary font-bold' : 'text-brand-heading'
                          }`}
                        >
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
            <div className="h-16 flex items-center justify-between px-4 border-b border-brand-border">
              <div className="flex flex-col select-none">
                <div className="flex items-center">
                  <span className="text-lg font-black bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
                    info
                  </span>
                  <span className="text-lg font-black text-brand-heading ml-0.5">HQ</span>
                </div>
                <span className="text-[9.5px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent -mt-1">
                  Command Center
                </span>
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
                    const isActive =
                      activeTab === item.id || (item.id === 'dashboard' && activeTab === 'overview');

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
        {/* Top Header Bar: Clean, uncluttered with Profile in Top Right Corner */}
        <header className="h-16 bg-white border-b border-brand-border flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-brand-muted hover:text-brand-heading rounded-control hover:bg-brand-section cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>

            {/* Mobile Brand (visible only on small screens) */}
            <div className="md:hidden flex items-center gap-1 select-none">
              <span className="text-base font-black bg-gradient-to-r from-[#7C5CE8] via-[#6366F1] to-[#5B4CF5] bg-clip-text text-transparent">
                info
              </span>
              <span className="text-base font-black text-brand-heading">HQ</span>
            </div>

            {/* Clean Breadcrumb/Status Indicator on Desktop */}
            <div className="hidden md:flex items-center gap-2 text-xs text-brand-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-medium text-brand-heading">Command Center</span>
              <span>/</span>
              <span className="capitalize font-semibold text-brand-primary">
                {activeTab === 'dashboard' ? 'Overview' : activeTab}
              </span>
            </div>
          </div>

          {/* RIGHT TOP CORNER: Super Admin Profile (Name + Designation + Avatar + Logout) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 pl-3">
              {/* Name and Designation */}
              <div className="text-right hidden sm:block select-none">
                <div className="text-xs sm:text-[13px] font-bold text-brand-heading leading-tight">
                  {displayName}
                </div>
                <div className="text-[11px] font-medium text-brand-muted">
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
          <Compass size={18} />
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
          <KanbanSquare size={18} />
          <span className="text-[10px]">Pipeline</span>
        </button>

        <button
          onClick={() => handleSelectTab('projects')}
          className={`flex flex-col items-center justify-center gap-1 py-1 ${
            activeTab === 'projects' ? 'text-brand-primary font-bold' : 'text-brand-muted font-medium'
          }`}
        >
          <FolderKanban size={18} />
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
          <Receipt size={18} />
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
