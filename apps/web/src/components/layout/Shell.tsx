import React, { useState, useRef, useEffect } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import { AnimatePresence } from 'framer-motion';
import type { AuthUser, HealthResponse } from '@infohq/shared';
import { PageTransition } from '../motion/index.js';
import { LeadsInbox } from '../leads/LeadsInbox.js';
import { PipelineView } from '../pipeline/PipelineView.js';
import { ProjectsList } from '../projects/ProjectsList.js';
import { PaymentsView } from '../payments/PaymentsView.js';
import { OverviewDashboard } from '../dashboard/OverviewDashboard.js';
import { ModulePlaceholderView } from './ModulePlaceholderView.js';
import { CommandPalette } from './CommandPalette.js';
import { TasksView } from '../tasks/TasksView.js';
import { TeamRBACView } from '../team/TeamRBACView.js';
import {
  Compass,
  Inbox,
  KanbanSquare,
  BriefcaseBusiness,
  FolderKanban,
  ListTodo,
  Receipt,
  FileSpreadsheet,
  TrendingUp,
  UserCheck,
  SlidersHorizontal,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Mail,
  User,
  Calendar,
  KeyRound,
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
  const clerk = useClerk();
  const { signOut } = clerk;
  const { user: clerkUser } = useUser();

  const getInitialTab = (): string => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (hash) return hash;
      const saved = localStorage.getItem('infohq_active_tab');
      if (saved) return saved;
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Global Cmd+K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync state if hash in URL changes
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (hash && hash !== activeTab) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [activeTab]);

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

  // Navigation sections matching reference images & CRM_design.md
  const navigationSections: NavSection[] = [
    {
      title: 'DASHBOARD',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: Compass,
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
        },
        {
          id: 'pipeline',
          label: 'Sales Pipeline',
          icon: KanbanSquare,
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
        },
        {
          id: 'tasks',
          label: 'Tasks & Sprints',
          icon: ListTodo,
        },
      ],
    },
    {
      title: 'FINANCE',
      items: [
        {
          id: 'billing',
          label: 'Payments & Invoices',
          icon: Receipt,
        },
        {
          id: 'proposals',
          label: 'Proposals & Contracts',
          icon: FileSpreadsheet,
        },
      ],
    },
    {
      title: 'MANAGEMENT',
      items: [
        {
          id: 'analytics',
          label: 'Analytics & Report',
          icon: TrendingUp,
        },
        {
          id: 'team',
          label: 'Team & Roles',
          icon: UserCheck,
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
    if (typeof window !== 'undefined') {
      window.location.hash = `#/${tabId}`;
      localStorage.setItem('infohq_active_tab', tabId);
    }
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
        return <TasksView />;
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
        return <TeamRBACView />;
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
    <div className="min-h-screen bg-[#F8F8FF] flex flex-col lg:flex-row font-sans">
      {/* ========================================================= */}
      {/* LAPTOP / DESKTOP SIDEBAR (>= 1024px)                      */}
      {/* Whisper Pale Lavender background: #F3F0FA, scrollable     */}
      {/* ========================================================= */}
      <aside
        data-lenis-prevent
        className={`hidden lg:flex flex-col bg-[#FFFFFF] border-r border-[#EAE6F7] h-screen sticky top-0 z-20 shrink-0 select-none transition-all duration-300 ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[260px] xl:w-[276px]'
        }`}
      >
        {/* Brand Header: Official InfoHQ Brand Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#EAE6F7] shrink-0 bg-[#FFFFFF]">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 select-none py-1">
              <img
                src="/infohq-brandlogo.webp"
                alt="InfoHQ Logo"
                className="h-8 w-auto object-contain"
              />
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#F3F0FF] text-[#5B4CF5] border border-purple-200/80 shadow-2xs tracking-wider uppercase">
                HQ
              </span>
            </div>
          ) : (
            <div className="mx-auto flex flex-col items-center select-none py-1">
              <img
                src="/favicon.webp"
                alt="InfoHQ"
                className="w-8 h-8 rounded-xl object-contain shadow-2xs border border-purple-100"
              />
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
                    style={
                      isActive
                        ? {
                            background: 'linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%)',
                            boxShadow: '0 4px 18px rgba(124, 92, 232, 0.28)',
                            color: '#FFFFFF',
                          }
                        : undefined
                    }
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-all group cursor-pointer ${
                      isActive
                        ? 'text-white font-bold'
                        : 'text-[#4B5563] hover:bg-white hover:text-[#1A085C] font-semibold'
                    } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
                  >
                    <Icon
                      size={18}
                      className={
                        isActive
                          ? 'text-white stroke-[2.2]'
                          : 'text-[#6B7280] group-hover:text-[#1A085C] stroke-[2]'
                      }
                    />

                    {!sidebarCollapsed && (
                      <span className="text-xs truncate flex-1">
                        {item.label}
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
          <div
            data-lenis-prevent
            className="relative w-4/5 max-w-xs bg-[#FFFFFF] h-[100dvh] max-h-screen flex flex-col z-10 shadow-2xl border-r border-[#EAE6F7]"
          >
            {/* Drawer Header with InfoHQ Logo */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-[#EAE6F7] shrink-0 bg-[#FFFFFF]">
              <div className="flex items-center gap-2 select-none">
                <img
                  src="/infohq-brandlogo.webp"
                  alt="InfoHQ Logo"
                  className="h-7 w-auto object-contain"
                />
                <span className="px-1.5 py-0.5 rounded-full text-[8.5px] font-black bg-[#F3F0FF] text-[#5B4CF5] border border-purple-200 tracking-wider uppercase">
                  HQ
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
                        style={
                          isActive
                            ? {
                                background: 'linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%)',
                                boxShadow: '0 4px 14px rgba(99, 88, 240, 0.30)',
                                color: '#FFFFFF',
                              }
                            : undefined
                        }
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-left transition-all ${
                          isActive
                            ? 'text-white font-bold'
                            : 'text-[#4B5563] hover:bg-white hover:text-[#1A085C] font-semibold'
                        }`}
                      >
                        <Icon
                          size={18}
                          className={
                            isActive
                              ? 'text-white stroke-[2.2]'
                              : 'text-[#6B7280] stroke-[2]'
                          }
                        />
                        <span className="truncate flex-1 text-xs">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Drawer Logout Footer */}
            <div className="p-3 border-t border-[#EAE6F7] bg-[#F8F8FF] shrink-0">
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
        <header className="h-16 bg-white/85 backdrop-blur-md border-b border-[#EAE6F7] flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30 shrink-0 shadow-[0_2px_12px_rgba(26,8,92,0.03)]">
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

            {/* Mobile & Tablet Brand with Official Logo */}
            <div className="lg:hidden flex items-center gap-2 select-none">
              <img
                src="/infohq-brandlogo.webp"
                alt="InfoHQ Logo"
                className="h-6 sm:h-7 w-auto object-contain"
              />
              <span className="px-1.5 py-0.5 rounded-full text-[8.5px] font-black bg-[#F3F0FF] text-[#5B4CF5] border border-purple-200 tracking-wider uppercase">
                HQ
              </span>
            </div>

            {/* Desktop Brand (Visible when sidebar is collapsed) */}
            {sidebarCollapsed && (
              <div className="hidden lg:flex items-center gap-2 select-none pr-1">
                <img
                  src="/infohq-brandlogo.webp"
                  alt="InfoHQ Logo"
                  className="h-7 w-auto object-contain"
                />
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#F3F0FF] text-[#5B4CF5] border border-purple-200 tracking-wider uppercase">
                  Command
                </span>
              </div>
            )}

            {/* Desktop Collapse / Expand Toggle Pill Button (Single Arrow) */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex w-9 h-9 rounded-full bg-white border border-[#EAE6F7] hover:bg-white hover:border-[#7C3AED]/40 text-brand-muted hover:text-[#7C3AED] transition-all items-center justify-center cursor-pointer shadow-2xs"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Center Search Pill Bar - Clicking triggers Global Command Palette */}
          <div className="hidden md:flex items-center flex-1 max-w-md lg:max-w-lg mx-4">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-full h-10 px-3.5 rounded-full bg-white border border-[#EAE6F7] text-xs sm:text-sm text-left flex items-center justify-between hover:border-[#7C5CE8] hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 text-brand-muted group-hover:text-[#1A085C]">
                <Search size={16} className="text-[#7C5CE8]" />
                <span className="text-xs text-[#6B7280]">Search leads, projects, invoices, or jump to tab...</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F8F8FF] border border-[#EAE6F7] text-[10.5px] font-mono text-[#7C5CE8] font-bold">
                ⌘ K
              </div>
            </button>
          </div>

          {/* Right Section: Date + Notifications + Profile Dropdown (Clean, Simple, Without Boxy Pill Backgrounds) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Simple Clean Date Display (Without Boxy Pill Background) */}
            <div className="hidden xl:flex items-center gap-2 px-1 text-left leading-tight">
              <div className="w-7 h-7 rounded-full bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shrink-0">
                <Calendar size={13} className="stroke-[2.2]" />
              </div>
              <div className="text-left leading-tight">
                <div className="text-[11px] font-bold text-[#1A085C]">
                  {new Intl.DateTimeFormat('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date())}
                </div>
                <div className="text-[9.5px] font-medium text-[#6B7280]">Have a productive day!</div>
              </div>
            </div>

            {/* Clean Notifications Button (Without Boxy Pill Background) */}
            <button
              className="w-8 h-8 rounded-xl hover:bg-white/80 text-[#6B7280] hover:text-[#5B4CF5] transition-all flex items-center justify-center cursor-pointer relative"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={17} />
              <span className="w-2 h-2 rounded-full bg-[#EF4444] absolute top-1.5 right-1.5 ring-1.5 ring-[#F8F8FF]" />
            </button>

            {/* Clean User Profile (Without Boxy Pill Background) */}
            <div className="relative pl-1" ref={dropdownRef}>
              <div
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 py-1 px-1.5 rounded-xl hover:bg-white/80 transition-all cursor-pointer select-none"
                role="button"
                tabIndex={0}
                aria-label="User profile menu"
                aria-expanded={profileDropdownOpen}
              >
                {/* Profile Avatar: 2-Stop Gradient */}
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#5B4CF5] to-[#E85AA0] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0"
                  title={`${displayName} (${designation})`}
                >
                  {avatarLetter}
                </div>

                {/* Name and Email */}
                <div className="text-left hidden sm:block leading-tight">
                  <div className="text-xs font-bold text-[#1A085C] truncate max-w-[130px]">
                    {displayName}
                  </div>
                  <div className="text-[10px] font-medium text-[#6B7280] truncate max-w-[130px]">
                    {userEmail}
                  </div>
                </div>

                {/* Dropdown Chevron */}
                <ChevronDown
                  size={13}
                  className={`text-[#6B7280] transition-transform duration-200 hidden sm:block ${
                    profileDropdownOpen ? 'rotate-180 text-[#5B4CF5]' : ''
                  }`}
                />
              </div>

              {/* Profile Dropdown Popover */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-[#EAE6F7] shadow-[0_12px_36px_rgba(124,58,237,0.12)] p-4 z-50 animate-fadeIn text-xs">
                  {/* User Profile Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-[#EAE6F7]">
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
                  <div className="py-3 space-y-2 text-[11px] text-brand-muted border-b border-[#EAE6F7]">
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

                  {/* Security Profile & Passkey Actions */}
                  <div className="pt-2 pb-1 border-b border-[#EAE6F7]">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        clerk.openUserProfile();
                      }}
                      className="w-full flex items-center justify-between py-2 px-2.5 rounded-xl text-xs font-semibold text-[#1A085C] hover:bg-[#F3F0FF] hover:text-[#7C5CE8] transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <KeyRound size={14} className="text-[#7C5CE8]" />
                        <span>Security, Passkeys &amp; MFA</span>
                      </span>
                      <span className="text-[10px] font-bold text-[#7C5CE8] bg-purple-100 px-1.5 py-0.5 rounded">Setup</span>
                    </button>
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

        {/* Dynamic Page Container with Motion 2: Blur-Fade Page Transition */}
        <main className="flex-1 px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3.5 max-w-[1440px] w-full mx-auto">
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={activeTab}>
              {renderActiveView()}
            </PageTransition>
          </AnimatePresence>
        </main>

        {/* Global Command Palette (⌘K) Modal */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigateTab={handleSelectTab}
        />
      </div>
    </div>
  );
};
