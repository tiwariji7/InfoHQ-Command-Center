import React, { useState, useRef, useEffect } from 'react';
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
  Search,
  Bell,
  Sun,
  HelpCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Mail,
  User,
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

export const Shell: React.FC<ShellProps> = ({ user: initialUser, health: _health, apiError: _apiError }) => {
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // User details from Clerk
  const displayName =
    clerkUser?.fullName ||
    (clerkUser?.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : null) ||
    'Shivam Tiwari';
  const userEmail =
    clerkUser?.primaryEmailAddress?.emailAddress || initialUser.email || 'superadmin@infohq.in';
  const designation = 'Super Admin';
  const avatarLetter = (displayName ? displayName[0] : 'S').toUpperCase();
  const userCreatedAt = clerkUser?.createdAt ? new Date(clerkUser.createdAt).toLocaleDateString('en-IN') : 'Active';

  // Navigation sections without subheadings
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
    <div className="min-h-screen bg-[#F8F7FC] flex flex-col lg:flex-row font-sans">
      {/* ========================================================= */}
      {/* LAPTOP / DESKTOP SIDEBAR (>= 1024px)                      */}
      {/* Whisper Pale Lavender background: #FAF9FD, scrollable     */}
      {/* ========================================================= */}
      <aside
        data-lenis-prevent
        className={`hidden lg:flex flex-col bg-[#FAF9FD] border-r border-[#EDE8F5] h-screen sticky top-0 z-20 shrink-0 select-none transition-all duration-300 ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[260px] xl:w-[276px]'
        }`}
      >
        {/* Brand Header: InfoHQ with Capital I and Command Center gradient */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#EDE8F5] shrink-0 bg-[#FAF9FD]">
          {!sidebarCollapsed ? (
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className="text-[22px] font-black tracking-tight bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#5B4CF5] bg-clip-text text-transparent">
                  Info
                </span>
                <span className="text-[22px] font-black tracking-tight text-[#1A085C] ml-0.5">
                  HQ
                </span>
              </div>
              <span className="text-[10px] font-bold tracking-wider uppercase bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#7C3AED] bg-clip-text text-transparent -mt-1">
                Command Center
              </span>
            </div>
          ) : (
            <div className="mx-auto">
              <span className="text-xl font-black bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] bg-clip-text text-transparent">
                I
              </span>
              <span className="text-xl font-black text-[#1A085C]">HQ</span>
            </div>
          )}
        </div>

        {/* Scrollable Navigation List - Scrolls smoothly whenever cursor is over sidebar */}
        <nav
          data-lenis-prevent
          className="flex-1 px-3 py-3.5 sidebar-scroll space-y-4 text-xs overscroll-contain"
        >
          {navigationSections.map((sec) => (
            <div key={sec.title} className="space-y-1">
              {/* Clean Section Header (Hidden when collapsed) */}
              {!sidebarCollapsed && (
                <div className="text-[10px] font-bold text-brand-muted uppercase tracking-wider px-3 py-1">
                  {sec.title}
                </div>
              )}

              {/* Section Items */}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeTab === item.id || (item.id === 'dashboard' && activeTab === 'overview');

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-control text-left transition-all group cursor-pointer ${
                      isActive
                        ? 'bg-[#EDE9FE] text-[#7C3AED] font-bold shadow-xs'
                        : 'text-brand-body hover:bg-white hover:text-brand-heading font-medium'
                    } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                  >
                    {/* Premium Icon Micro-Tile */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isActive
                          ? 'bg-[#7C3AED] text-white shadow-xs'
                          : 'bg-white border border-[#EDE8F5] text-brand-muted group-hover:text-brand-heading group-hover:border-[#7C3AED]/40'
                      }`}
                    >
                      <Icon size={15} className="stroke-[2.2]" />
                    </div>

                    {!sidebarCollapsed && (
                      <>
                        <span
                          className={`text-xs truncate flex-1 ${
                            isActive ? 'text-[#7C3AED] font-bold' : 'text-brand-heading'
                          }`}
                        >
                          {item.label}
                        </span>

                        {item.badge && (
                          <span
                            className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                              item.badge === 'Live'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-purple-50 text-[#7C3AED] border border-purple-100'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
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
          <div
            data-lenis-prevent
            className="relative w-4/5 max-w-xs bg-[#FAF9FD] h-[100dvh] max-h-screen flex flex-col z-10 shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-[#EDE8F5] shrink-0 bg-[#FAF9FD]">
              <div className="flex flex-col select-none">
                <div className="flex items-center">
                  <span className="text-xl font-black tracking-tight bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#5B4CF5] bg-clip-text text-transparent">
                    Info
                  </span>
                  <span className="text-xl font-black tracking-tight text-[#1A085C] ml-0.5">HQ</span>
                </div>
                <span className="text-[9.5px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#7C3AED] bg-clip-text text-transparent -mt-1">
                  Command Center
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-brand-muted hover:text-brand-heading rounded-control hover:bg-white cursor-pointer"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Navigation List - Smoothly scrollable */}
            <nav
              data-lenis-prevent
              className="flex-1 px-3 py-3.5 sidebar-scroll space-y-4 text-xs overscroll-contain"
            >
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
                            ? 'bg-[#EDE9FE] text-[#7C3AED] font-bold shadow-xs'
                            : 'text-brand-body hover:bg-white font-medium'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-[#7C3AED] text-white shadow-xs'
                              : 'bg-white border border-[#EDE8F5] text-brand-muted'
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
                                : 'bg-purple-50 text-[#7C3AED] border border-purple-100'
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
            <div className="p-3 border-t border-[#EDE8F5] bg-[#FAF9FD] shrink-0">
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-control text-xs font-semibold text-rose-600 bg-white border border-rose-100 hover:bg-rose-50 transition-colors cursor-pointer shadow-xs"
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
        {/* ========================================================= */}
        {/* TOP FLOATING NAVBAR (Inspired by Reference Image)         */}
        {/* ========================================================= */}
        <header className="h-16 bg-white border-b border-[#EDE8F5] flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30 shrink-0 shadow-[0_2px_12px_rgba(124,58,237,0.03)]">
          {/* Left section: Hamburger / Collapse / Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* 3-Lines Hamburger Button: visible on Mobile & Tablet (< 1024px) */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-brand-muted hover:text-[#7C3AED] rounded-control hover:bg-[#F8F7FC] transition-colors cursor-pointer"
              aria-label="Open navigation menu"
              title="Open menu"
            >
              <Menu size={22} className="stroke-[2.2]" />
            </button>

            {/* Mobile & Tablet Brand Title */}
            <div className="lg:hidden flex items-center gap-1 select-none">
              <span className="text-lg font-black tracking-tight bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#5B4CF5] bg-clip-text text-transparent">
                Info
              </span>
              <span className="text-lg font-black tracking-tight text-[#1A085C]">HQ</span>
            </div>

            {/* Desktop Brand (Visible when sidebar is collapsed, matching mockup) */}
            {sidebarCollapsed && (
              <div className="hidden lg:flex flex-col select-none pr-1">
                <div className="flex items-center">
                  <span className="text-[19px] font-black tracking-tight bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#5B4CF5] bg-clip-text text-transparent">
                    Info
                  </span>
                  <span className="text-[19px] font-black tracking-tight text-[#1A085C] ml-0.5">
                    HQ
                  </span>
                </div>
                <span className="text-[8.5px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#7C3AED] bg-clip-text text-transparent -mt-0.5">
                  Command Center
                </span>
              </div>
            )}

            {/* Desktop Collapse / Expand Toggle Pill Button (Single Arrow) */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex w-9 h-9 rounded-full bg-[#F8F7FC] border border-[#EDE8F5] hover:bg-white hover:border-[#7C3AED]/40 text-brand-muted hover:text-[#7C3AED] transition-all items-center justify-center cursor-pointer shadow-2xs"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Center Search Pill Bar (Matching the uploaded image) */}
          <div className="hidden md:flex items-center flex-1 max-w-md lg:max-w-lg mx-4">
            <div className="w-full relative flex items-center">
              <div className="absolute left-3.5 text-brand-muted pointer-events-none">
                <Search size={16} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads, clients, projects, invoices..."
                className="w-full h-10 pl-9 pr-14 rounded-full bg-[#F8F7FC] border border-[#EDE8F5] text-xs sm:text-sm text-brand-heading placeholder:text-brand-muted/70 focus:bg-white focus:border-[#7C3AED] focus:ring-3 focus:ring-[#7C3AED]/15 transition-all outline-none"
              />
              <div className="absolute right-2.5 px-1.5 py-0.5 rounded bg-white border border-[#EDE8F5] text-[10px] font-mono text-brand-muted pointer-events-none">
                ⌘ K
              </div>
            </div>
          </div>

          {/* Right Section: Theme Toggle + Notifications + Help + Profile Dropdown */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Theme Toggle Pill */}
            <button
              className="w-9 h-9 rounded-full bg-[#F8F7FC] border border-[#EDE8F5] hover:bg-white hover:border-[#7C3AED]/40 text-brand-muted hover:text-[#7C3AED] transition-all flex items-center justify-center cursor-pointer shadow-2xs"
              title="Theme mode"
              aria-label="Theme mode"
            >
              <Sun size={17} />
            </button>

            {/* Notifications Pill with Red Badge Dot */}
            <button
              className="w-9 h-9 rounded-full bg-[#F8F7FC] border border-[#EDE8F5] hover:bg-white hover:border-[#7C3AED]/40 text-brand-muted hover:text-[#7C3AED] transition-all flex items-center justify-center cursor-pointer relative shadow-2xs"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={17} />
              <span className="w-2 h-2 rounded-full bg-[#EF4444] absolute top-2 right-2 ring-1.5 ring-white" />
            </button>

            {/* Help / Support Pill */}
            <button
              className="hidden sm:flex w-9 h-9 rounded-full bg-[#F8F7FC] border border-[#EDE8F5] hover:bg-white hover:border-[#7C3AED]/40 text-brand-muted hover:text-[#7C3AED] transition-all items-center justify-center cursor-pointer shadow-2xs"
              title="Help and documentation"
              aria-label="Help and documentation"
            >
              <HelpCircle size={17} />
            </button>

            {/* Super Admin Profile Pill (Clickable Dropdown Trigger) */}
            <div className="relative pl-1 sm:pl-2" ref={dropdownRef}>
              <div
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 py-1 px-1.5 sm:px-2 rounded-full hover:bg-[#F8F7FC] border border-transparent hover:border-[#EDE8F5] transition-all cursor-pointer select-none"
                role="button"
                tabIndex={0}
                aria-label="User profile menu"
                aria-expanded={profileDropdownOpen}
              >
                {/* Profile Avatar: Soft Purple #8B5CF6 with First Letter S */}
                <div
                  className="w-9 h-9 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center font-bold text-sm shadow-[0_2px_8px_rgba(139,92,246,0.35)] shrink-0 ring-2 ring-white select-none"
                  title={`${displayName} (${designation})`}
                >
                  {avatarLetter}
                </div>

                {/* Name and Designation */}
                <div className="text-left hidden md:block">
                  <div className="text-xs sm:text-[13px] font-bold text-brand-heading leading-tight truncate max-w-[130px]">
                    {displayName}
                  </div>
                  <div className="text-[10.5px] font-medium text-brand-muted">
                    {designation}
                  </div>
                </div>

                {/* Dropdown Chevron */}
                <ChevronDown
                  size={14}
                  className={`text-brand-muted transition-transform duration-200 hidden sm:block ${
                    profileDropdownOpen ? 'rotate-180 text-[#7C3AED]' : ''
                  }`}
                />
              </div>

              {/* Profile Dropdown Popover */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-[#EDE8F5] shadow-[0_12px_36px_rgba(124,58,237,0.12)] p-4 z-50 animate-fadeIn text-xs">
                  {/* User Profile Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-[#EDE8F5]">
                    <div className="w-11 h-11 rounded-full bg-[#8B5CF6] text-white flex items-center justify-center font-extrabold text-base shadow-xs shrink-0 ring-2 ring-purple-100">
                      {avatarLetter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-brand-heading truncate">
                        {displayName}
                      </div>
                      <div className="text-[11px] text-brand-muted truncate mt-0.5">
                        {userEmail}
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EDE9FE] text-[#7C3AED]">
                        {designation}
                      </span>
                    </div>
                  </div>

                  {/* Clerk User Info Rows */}
                  <div className="py-3 space-y-2 text-[11px] text-brand-muted border-b border-[#EDE8F5]">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User size={13} className="text-[#7C3AED]" />
                        <span>Role</span>
                      </span>
                      <span className="font-semibold text-brand-heading">Superadmin</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Mail size={13} className="text-[#7C3AED]" />
                        <span>Auth Email</span>
                      </span>
                      <span className="font-medium text-brand-heading truncate max-w-[130px]">
                        {userEmail}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-emerald-600" />
                        <span>Status</span>
                      </span>
                      <span className="font-bold text-emerald-700">Active Session</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Joined</span>
                      <span className="font-medium text-brand-heading">{userCreatedAt}</span>
                    </div>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-control text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Container: Whisper Slate-Lavender #F8F7FC */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto pb-12">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};
