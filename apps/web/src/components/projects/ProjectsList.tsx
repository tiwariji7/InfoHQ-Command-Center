import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Project, ProjectStatus } from '@infohq/shared';
import { fetchProjects, updateProjectApi } from '../../lib/api.js';
import { CreateProjectModal } from './CreateProjectModal.js';
import { ProjectDetailDrawer } from './ProjectDetailDrawer.js';
import {
  FolderKanban,
  Plus,
  Search,
  AlertCircle,
  IndianRupee,
  RefreshCw,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  CheckCheck,
  Kanban,
  LayoutGrid,
  FolderTree,
  Globe,
  Smartphone,
  Zap,
  Palette,
  Cpu,
  ArrowRight,
  Check,
  type LucideIcon,
} from 'lucide-react';

export type ProjectCategory =
  | 'all'
  | 'web_saas'
  | 'mobile'
  | 'ai_automation'
  | 'ui_ux'
  | 'custom_engineering';

export interface CategoryDefinition {
  id: ProjectCategory;
  name: string;
  badge: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  gradient: string;
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'web_saas',
    name: 'Web Apps & SaaS',
    badge: 'Web & SaaS',
    icon: Globe,
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'mobile',
    name: 'Mobile Apps',
    badge: 'Mobile App',
    icon: Smartphone,
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    gradient: 'from-purple-500 to-pink-600',
  },
  {
    id: 'ai_automation',
    name: 'AI & Automation',
    badge: 'AI & Auto',
    icon: Zap,
    color: '#EC4899',
    bgColor: '#FDF2F8',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-700',
    gradient: 'from-pink-500 to-rose-600',
  },
  {
    id: 'ui_ux',
    name: 'UI/UX & Design',
    badge: 'UI/UX',
    icon: Palette,
    color: '#F97316',
    bgColor: '#FFF7ED',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    gradient: 'from-orange-500 to-amber-600',
  },
  {
    id: 'custom_engineering',
    name: 'Custom Engineering',
    badge: 'Engineering',
    icon: Cpu,
    color: '#10B981',
    bgColor: '#ECFDF5',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    gradient: 'from-emerald-500 to-teal-600',
  },
];

function detectCategory(project: Project): ProjectCategory {
  const text = `${project.serviceType || ''} ${project.title || ''} ${project.description || ''}`.toLowerCase();
  if (
    text.includes('mobile') ||
    text.includes('ios') ||
    text.includes('android') ||
    text.includes('flutter') ||
    text.includes('react native') ||
    text.includes('app')
  ) {
    return 'mobile';
  }
  if (
    text.includes('ai') ||
    text.includes('agent') ||
    text.includes('automation') ||
    text.includes('llm') ||
    text.includes('gpt') ||
    text.includes('bot') ||
    text.includes('webhook')
  ) {
    return 'ai_automation';
  }
  if (
    text.includes('design') ||
    text.includes('ui') ||
    text.includes('ux') ||
    text.includes('figma') ||
    text.includes('brand') ||
    text.includes('prototype') ||
    text.includes('landing')
  ) {
    return 'ui_ux';
  }
  if (
    text.includes('cloud') ||
    text.includes('devops') ||
    text.includes('infra') ||
    text.includes('database') ||
    text.includes('security') ||
    text.includes('architecture') ||
    text.includes('backend') ||
    text.includes('api') ||
    text.includes('custom')
  ) {
    return 'custom_engineering';
  }
  return 'web_saas';
}

function getCategoryMeta(catId: ProjectCategory): CategoryDefinition {
  const found = CATEGORIES.find((c) => c.id === catId);
  return found || CATEGORIES[0];
}

type ViewMode = 'stages' | 'categories' | 'grid';

export const ProjectsList: React.FC = () => {
  const { getToken } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic hover for top metric cards
  const [hoveredMetricIndex, setHoveredMetricIndex] = useState<number | null>(null);

  // View switch: 'stages' (Stage 1 to 4 lanes), 'categories' (Category grouped), 'grid' (classic grid)
  const [viewMode, setViewMode] = useState<ViewMode>('stages');

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Silent auto-refresh loader
  const loadProjects = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsBackgroundSyncing(true);
      }

      try {
        const res = await fetchProjects(getToken, {
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          search: searchTerm.trim() || undefined,
        });
        setProjects(res.projects);
      } catch (err: unknown) {
        console.error('Failed to load projects:', err);
        if (!isBackground) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve projects.');
        }
      } finally {
        if (!isBackground) {
          setIsLoading(false);
        } else {
          setIsBackgroundSyncing(false);
        }
      }
    },
    [getToken, selectedStatus, searchTerm]
  );

  // Initial load & filter change
  useEffect(() => {
    loadProjects(false);
  }, [loadProjects]);

  // Background auto-refresh polling every 8s + window focus
  useEffect(() => {
    const interval = setInterval(() => {
      loadProjects(true);
    }, 8000);

    const onFocus = () => {
      loadProjects(true);
    };

    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadProjects]);

  const handleProjectCreated = (newProject: Project) => {
    setProjects((prev) => [newProject, ...prev]);
    setSelectedProjectId(newProject.id);
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
  };

  // Quick 1-click stage advancement
  const handleQuickStatusChange = async (
    e: React.MouseEvent,
    projectId: string,
    newStatus: ProjectStatus
  ) => {
    e.stopPropagation();
    setUpdatingProjectId(projectId);
    try {
      const res = await updateProjectApi(getToken, projectId, { status: newStatus });
      handleProjectUpdated(res.project);
    } catch (err) {
      console.error('Failed to quick-advance project stage:', err);
    } finally {
      setUpdatingProjectId(null);
    }
  };

  // Metrics calculations
  const totalCount = projects.length;
  const inProgressCount = projects.filter((p) => p.status === 'in_progress').length;
  const reviewCount = projects.filter((p) => p.status === 'review').length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const planningCount = projects.filter((p) => p.status === 'planning').length;

  const overallCompletionRate = useMemo(() => {
    if (projects.length === 0) return 0;
    let totalT = 0;
    let completedT = 0;
    for (const p of projects) {
      totalT += p.totalTasks || 0;
      completedT += p.completedTasks || 0;
    }
    if (totalT === 0) return 0;
    return Math.round((completedT / totalT) * 100);
  }, [projects]);

  // Filtered projects by category and search
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const cat = detectCategory(p);
        if (cat !== selectedCategory) return false;
      }
      return true;
    });
  }, [projects, selectedCategory]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: projects.length,
      web_saas: 0,
      mobile: 0,
      ai_automation: 0,
      ui_ux: 0,
      custom_engineering: 0,
    };
    for (const p of projects) {
      const cat = detectCategory(p);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [projects]);

  // Stages partitioning for Stage View
  const stagePartition = useMemo(() => {
    return {
      planning: filteredProjects.filter((p) => p.status === 'planning'),
      in_progress: filteredProjects.filter((p) => p.status === 'in_progress'),
      review: filteredProjects.filter((p) => p.status === 'review'),
      completed: filteredProjects.filter((p) => p.status === 'completed'),
      on_hold: filteredProjects.filter((p) => p.status === 'on_hold'),
    };
  }, [filteredProjects]);

  const getMonogram = (name?: string) => {
    if (!name) return 'HQ';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'planning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#FAF5FF] text-[#7C5CE8] border border-purple-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C5CE8] animate-pulse" />
            <span>Stage 1: Planning</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
            <span>Stage 2: In Dev</span>
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-orange-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
            <span>Stage 3: QA Review</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#F0FDF4] text-[#15803D] border border-green-200 shadow-2xs whitespace-nowrap">
            <CheckCircle2 size={10} />
            <span>Stage 4: Completed</span>
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap">
            <Clock size={10} />
            <span>On Hold</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs whitespace-nowrap">
            <span>{status}</span>
          </span>
        );
    }
  };

  const formatISTDate = (timestamp?: number | string | null) => {
    if (!timestamp) return 'TBD';
    const epoch = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    if (isNaN(epoch)) return String(timestamp);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(epoch));
  };

  const projectMetricCards = [
    {
      id: 0,
      title: 'Active Deliverables',
      value: (inProgressCount + reviewCount).toString(),
      subtext: `${inProgressCount} in dev • ${reviewCount} in review`,
      icon: FolderKanban,
      iconBg: 'bg-[#FFF0F7]',
      iconColor: 'text-[#E85AA0]',
    },
    {
      id: 1,
      title: 'Portfolio Burn-Up',
      value: `${overallCompletionRate}%`,
      subtext: 'Task completion rate',
      icon: CheckCheck,
      iconBg: 'bg-[#F0FDF4]',
      iconColor: 'text-[#15803D]',
    },
    {
      id: 2,
      title: 'Stage 1: Planning (Won Deals)',
      value: planningCount.toString(),
      subtext: 'Kickoff & scope setup',
      icon: Sparkles,
      iconBg: 'bg-[#F3F0FF]',
      iconColor: 'text-[#7C5CE8]',
    },
    {
      id: 3,
      title: 'Total Projects Delivered',
      value: totalCount.toString(),
      subtext: `${completedCount} completed successfully`,
      icon: Layers,
      iconBg: 'bg-[#EFF6FF]',
      iconColor: 'text-[#3B82F6]',
    },
  ];

  // Helper card renderer
  const renderProjectCard = (proj: Project, options?: { showNextAction?: boolean }) => {
    const totalTasks = proj.totalTasks || 0;
    const completedTasks = proj.completedTasks || 0;
    const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const clientInitials = getMonogram(proj.clientName);
    const cat = detectCategory(proj);
    const catMeta = getCategoryMeta(cat);
    const CatIcon = catMeta.icon;
    const isWonAutoCreated = Boolean(proj.leadId);
    const isUpdating = updatingProjectId === proj.id;

    return (
      <div
        key={proj.id}
        onClick={() => setSelectedProjectId(proj.id)}
        className="bg-white rounded-2xl border border-[#E5E1F0] p-3.5 sm:p-4 shadow-[0_4px_20px_rgba(26,8,92,0.05)] hover:border-[#5B4CF5]/50 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(91,76,245,0.09)] transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group relative"
      >
        {/* Top Badges: Category & Status */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold ${catMeta.bgColor} ${catMeta.textColor} border ${catMeta.borderColor} shadow-2xs whitespace-nowrap`}
              >
                <CatIcon size={10} />
                <span>{catMeta.badge}</span>
              </span>

              {isWonAutoCreated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border border-amber-200 shadow-2xs whitespace-nowrap" title="Auto-converted from Won Lead">
                  <Zap size={9} className="text-amber-600 fill-amber-500" />
                  <span>Won Deal</span>
                </span>
              )}
            </div>

            {getStatusBadge(proj.status)}
          </div>

          {/* Title & Client with Monogram */}
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#5B4CF5]/15 to-[#E85AA0]/20 text-[#5B4CF5] font-black text-[11px] flex items-center justify-center shrink-0 border border-purple-100 mt-0.5 shadow-2xs">
              {clientInitials}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-[13px] font-bold text-[#1A085C] group-hover:text-[#5B4CF5] transition-colors leading-tight line-clamp-2">
                {proj.title}
              </h3>
              <div className="text-[11px] text-[#6B7280] font-medium flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="font-semibold text-[#374151] truncate max-w-[130px]">
                  {proj.clientName}
                </span>
                {proj.company && (
                  <span className="text-[#9CA3AF] text-[10px] truncate max-w-[100px]">
                    • {proj.company}
                  </span>
                )}
                {proj.clientId && (
                  <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    {proj.clientId}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Deliverable Sprint Progress Bar */}
        <div className="space-y-1.5 bg-[#F8F8FF]/90 p-2.5 rounded-xl border border-[#EAE6F7]">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#6B7280] font-semibold">Sprint Deliverables</span>
            <span className="font-black text-[#1A085C] tabular-nums">
              {completedTasks}/{totalTasks} ({percent}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-[#EAE6F7]">
            <div
              className="h-full bg-gradient-to-r from-[#5B4CF5] via-[#7C5CE8] to-[#E85AA0] transition-all duration-300 rounded-full"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Footer: Budget, Target Date & Quick Actions */}
        <div className="pt-2 border-t border-[#F0EDF9] flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 font-black text-[#10B981] tabular-nums text-xs">
              {proj.budget ? (
                <>
                  <IndianRupee size={11} />
                  <span>{proj.budget}</span>
                </>
              ) : (
                <span className="text-[#9CA3AF] text-[10px] font-medium">Budget TBD</span>
              )}
            </div>

            {proj.targetDate && (
              <div className="flex items-center gap-1 text-[10px] text-[#6B7280] font-medium">
                <Calendar size={10} className="text-[#9CA3AF]" />
                <span>{formatISTDate(proj.targetDate)}</span>
              </div>
            )}
          </div>

          {/* Quick Stage Advancement Button or Manage */}
          <div className="flex items-center gap-1">
            {options?.showNextAction && proj.status === 'planning' && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={(e) => handleQuickStatusChange(e, proj.id, 'in_progress')}
                className="px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE] border border-blue-200 text-[10px] font-bold inline-flex items-center gap-1 transition-all"
                title="Advance to Stage 2 (In Development)"
              >
                <span>Start Dev</span>
                <ArrowRight size={10} />
              </button>
            )}

            {options?.showNextAction && proj.status === 'in_progress' && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={(e) => handleQuickStatusChange(e, proj.id, 'review')}
                className="px-2 py-0.5 rounded-md bg-[#FFF7ED] text-[#C2410C] hover:bg-[#FFEDD5] border border-orange-200 text-[10px] font-bold inline-flex items-center gap-1 transition-all"
                title="Advance to Stage 3 (QA & Review)"
              >
                <span>To QA</span>
                <ArrowRight size={10} />
              </button>
            )}

            {options?.showNextAction && proj.status === 'review' && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={(e) => handleQuickStatusChange(e, proj.id, 'completed')}
                className="px-2 py-0.5 rounded-md bg-[#F0FDF4] text-[#15803D] hover:bg-[#DCFCE7] border border-green-200 text-[10px] font-bold inline-flex items-center gap-1 transition-all"
                title="Mark Completed"
              >
                <Check size={10} />
                <span>Finish</span>
              </button>
            )}

            <div className="inline-flex items-center gap-0.5 text-xs font-bold text-[#5B4CF5] group-hover:translate-x-0.5 transition-transform ml-1">
              <span>Manage</span>
              <ChevronRight size={12} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative space-y-4 sm:space-y-5">
      {/* Ambient Glassmorphic Soft Glow Orbs */}
      <div className="absolute -top-10 left-10 w-80 h-80 bg-[#7C5CE8]/[0.07] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-[#E85AA0]/[0.07] rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-[#3B82F6]/[0.05] rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ========================================================= */}
      {/* 0. HEADER & CTA                                           */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center shadow-2xs">
            <Layers size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A085C]">
                Projects &amp;{' '}
                <span
                  style={{
                    background: 'linear-gradient(90deg, #E8604E 0%, #DD4985 35%, #914FBB 65%, #5782E0 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Deliverables Matrix
                </span>
              </h1>

              {/* Silent Background Sync Live Indicator */}
              <div
                className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200"
                title="Continuous background auto-refresh keeps projects synced live"
              >
                <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isBackgroundSyncing ? 'animate-ping' : ''}`} />
                <span>Live Sync</span>
              </div>
            </div>
            <p className="text-xs text-[#6B7280] font-medium mt-0.5">
              Categorized deliverable sprint pipelines, automated won lead kickoffs &amp; contracts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Refresh Button */}
          <button
            onClick={() => loadProjects(false)}
            disabled={isLoading}
            className="h-8 px-3 rounded-full bg-white/85 backdrop-blur-md hover:bg-white border border-white/80 hover:border-[#5B4CF5]/40 text-[#5B4CF5] text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Projects"
          >
            <RefreshCw size={11} className={isLoading ? 'animate-spin text-[#5B4CF5]' : 'text-[#5B4CF5]'} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* New Project CTA Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #5B4CF5 0%, #7C5CE8 50%, #E85AA0 100%)',
              boxShadow: '0 8px 24px -2px rgba(91, 76, 245, 0.42), 0 2px 8px rgba(232, 90, 160, 0.28)',
              color: '#FFFFFF',
            }}
            className="h-9 sm:h-10 px-4 sm:px-5 rounded-full text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 cursor-pointer shadow-lg shrink-0"
          >
            <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Plus size={13} className="stroke-[3] text-white" />
            </div>
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. TOP SUMMARY METRIC CARDS WITH DYNAMIC HOVER            */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {projectMetricCards.map((card, idx) => {
          const isHovered = hoveredMetricIndex === idx;
          const CardIcon = card.icon;

          return (
            <div
              key={card.id}
              onMouseEnter={() => setHoveredMetricIndex(idx)}
              onMouseLeave={() => setHoveredMetricIndex(null)}
              style={
                isHovered
                  ? {
                      background: 'linear-gradient(135deg, #E8604E 0%, #DD4985 35%, #914FBB 70%, #5782E0 100%)',
                      boxShadow: '0 8px 24px rgba(221, 73, 133, 0.35)',
                    }
                  : {}
              }
              className={`rounded-2xl p-3 sm:p-4 transition-all duration-300 cursor-pointer flex flex-col justify-between ${
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
                  <CardIcon size={14} className="sm:hidden" />
                  <CardIcon size={15} className="hidden sm:block" />
                </div>
              </div>

              <div className="mt-2 sm:mt-2.5">
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
      {/* 2. CATEGORY CLASSIFICATION TABS & TOOLBAR                 */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#E5E1F0] p-3 shadow-[0_4px_20px_rgba(26,8,92,0.06)] space-y-3">
        {/* Top Row: Service Category Pills & View Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Category Filter Pills with Live Item Counts */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              style={
                selectedCategory === 'all'
                  ? {
                      background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                      boxShadow: '0 2px 8px rgba(91,76,245,0.25)',
                      color: '#FFFFFF',
                    }
                  : {}
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'all'
                  ? 'text-white'
                  : 'bg-[#F8F8FF] text-[#6B7280] border border-[#EAE6F7] hover:border-[#5B4CF5]/40 hover:text-[#5B4CF5]'
              }`}
            >
              <Layers size={12} />
              <span>All Categories</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  selectedCategory === 'all' ? 'bg-white/25 text-white' : 'bg-gray-200/70 text-gray-700'
                }`}
              >
                {categoryCounts.all || 0}
              </span>
            </button>

            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              const Icon = cat.icon;
              const count = categoryCounts[cat.id] || 0;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={
                    isActive
                      ? {
                          background: 'linear-gradient(90deg, #5B4CF5 0%, #7C5CE8 100%)',
                          boxShadow: '0 2px 8px rgba(91,76,245,0.25)',
                          color: '#FFFFFF',
                        }
                  : {}
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'text-white'
                      : 'bg-[#F8F8FF] text-[#6B7280] border border-[#EAE6F7] hover:border-[#5B4CF5]/40 hover:text-[#5B4CF5]'
                  }`}
                >
                  <Icon size={12} className={isActive ? 'text-white' : cat.textColor} />
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive ? 'bg-white/25 text-white' : 'bg-gray-200/70 text-gray-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View Switcher: Stages vs Categories vs Grid */}
          <div className="flex items-center gap-1.5 bg-[#F8F8FF] p-1 rounded-xl border border-[#EAE6F7] self-start lg:self-auto shrink-0">
            <button
              onClick={() => setViewMode('stages')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'stages'
                  ? 'bg-white text-[#5B4CF5] shadow-2xs border border-[#5B4CF5]/20'
                  : 'text-[#6B7280] hover:text-[#1A085C]'
              }`}
              title="Organized Stage-by-Stage Columns (Stage 1 to 4)"
            >
              <Kanban size={13} />
              <span>Stage Columns</span>
            </button>

            <button
              onClick={() => setViewMode('categories')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'categories'
                  ? 'bg-white text-[#5B4CF5] shadow-2xs border border-[#5B4CF5]/20'
                  : 'text-[#6B7280] hover:text-[#1A085C]'
              }`}
              title="Grouped by Service Categories (Web, Mobile, AI, etc.)"
            >
              <FolderTree size={13} />
              <span>Category Groups</span>
            </button>

            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#5B4CF5] shadow-2xs border border-[#5B4CF5]/20'
                  : 'text-[#6B7280] hover:text-[#1A085C]'
              }`}
              title="Grid Matrix View"
            >
              <LayoutGrid size={13} />
              <span>Matrix Grid</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Status Filter Chips & Fast Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-[#F0EDF9]">
          {/* Status Filter Chips (For Matrix/Grid Views) */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { key: 'all', label: 'All Stages' },
              { key: 'planning', label: 'Stage 1: Planning' },
              { key: 'in_progress', label: 'Stage 2: In Dev' },
              { key: 'review', label: 'Stage 3: Review' },
              { key: 'completed', label: 'Stage 4: Completed' },
              { key: 'on_hold', label: 'On Hold' },
            ].map((chip) => {
              const isActive = selectedStatus === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => setSelectedStatus(chip.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#1A085C] text-white shadow-2xs'
                      : 'bg-[#F8F8FF] text-[#6B7280] hover:text-[#1A085C] hover:bg-gray-100'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, client, or CLT ID..."
              className="w-full h-8 pl-8 pr-3 text-xs font-semibold border border-[#EAE6F7] bg-white rounded-xl focus:border-[#5B4CF5] outline-none transition-all placeholder:text-[#9CA3AF] text-[#1A085C]"
            />
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-rose-600 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. DYNAMIC VIEWS                                          */}
      {/* ========================================================= */}
      {isLoading ? (
        <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 p-16 flex flex-col items-center justify-center gap-2.5 shadow-2xs">
          <RefreshCw size={22} className="animate-spin text-[#5B4CF5]" />
          <span className="text-xs font-semibold text-[#6B7280]">Loading categorized projects...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-[#F3F0FF] text-[#5B4CF5] mx-auto flex items-center justify-center mb-2.5 shadow-2xs">
            <FolderKanban size={22} />
          </div>
          <h3 className="text-sm font-bold text-[#1A085C]">No Projects in this Category</h3>
          <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto font-medium">
            {searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all'
              ? 'No projects match your current filter or category criteria. Try selecting "All Categories" or resetting your search.'
              : 'New won leads automatically appear in Stage 1 (Planning). You can also create a new project manually.'}
          </p>
          <div className="mt-3.5 flex items-center justify-center gap-2">
            {(selectedCategory !== 'all' || selectedStatus !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedStatus('all');
                  setSearchTerm('');
                }}
                className="px-3.5 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-[#1A085C] text-xs font-bold transition-all cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                boxShadow: '0 4px 14px rgba(99, 88, 240, 0.30)',
              }}
              className="px-3.5 py-1.5 rounded-full text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={13} />
              Create Project
            </button>
          </div>
        </div>
      ) : viewMode === 'stages' ? (
        /* ========================================================= */
        /* VIEW 1: STAGE COLUMNS DECK (Stage 1 to Stage 4)           */
        /* ========================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {/* LANE 1: STAGE 1 - PLANNING (Won Leads Land Here) */}
          <div className="bg-[#FAF5FF]/70 rounded-2xl border border-purple-200/80 p-3 space-y-3 shadow-2xs">
            {/* Lane Header */}
            <div className="flex items-center justify-between pb-2 border-b border-purple-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7C5CE8] shadow-[0_0_8px_rgba(124,92,232,0.6)]" />
                <div>
                  <h3 className="text-xs font-black text-[#1A085C]">Stage 1: Planning</h3>
                  <p className="text-[10px] text-purple-700 font-medium">Auto-Won Deals &amp; Kickoff</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800">
                {stagePartition.planning.length}
              </span>
            </div>

            {/* Stage Projects Cards */}
            <div className="space-y-3">
              {stagePartition.planning.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-purple-200 text-purple-400 text-xs">
                  <span>No projects in Stage 1</span>
                  <p className="text-[10px] mt-1 text-purple-300">Convert a lead to "Won" to auto-create here</p>
                </div>
              ) : (
                stagePartition.planning.map((p) => renderProjectCard(p, { showNextAction: true }))
              )}
            </div>
          </div>

          {/* LANE 2: STAGE 2 - IN PROGRESS & EXECUTION */}
          <div className="bg-[#EFF6FF]/70 rounded-2xl border border-blue-200/80 p-3 space-y-3 shadow-2xs">
            {/* Lane Header */}
            <div className="flex items-center justify-between pb-2 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse" />
                <div>
                  <h3 className="text-xs font-black text-[#1A085C]">Stage 2: Execution</h3>
                  <p className="text-[10px] text-blue-700 font-medium">Active Sprints &amp; Dev</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800">
                {stagePartition.in_progress.length}
              </span>
            </div>

            {/* Stage Projects Cards */}
            <div className="space-y-3">
              {stagePartition.in_progress.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-blue-200 text-blue-400 text-xs">
                  <span>No projects in active dev</span>
                </div>
              ) : (
                stagePartition.in_progress.map((p) => renderProjectCard(p, { showNextAction: true }))
              )}
            </div>
          </div>

          {/* LANE 3: STAGE 3 - QA & CLIENT REVIEW */}
          <div className="bg-[#FFF7ED]/70 rounded-2xl border border-orange-200/80 p-3 space-y-3 shadow-2xs">
            {/* Lane Header */}
            <div className="flex items-center justify-between pb-2 border-b border-orange-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                <div>
                  <h3 className="text-xs font-black text-[#1A085C]">Stage 3: Review</h3>
                  <p className="text-[10px] text-orange-700 font-medium">Staging QA &amp; Audits</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-800">
                {stagePartition.review.length}
              </span>
            </div>

            {/* Stage Projects Cards */}
            <div className="space-y-3">
              {stagePartition.review.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-orange-200 text-orange-400 text-xs">
                  <span>No projects in review</span>
                </div>
              ) : (
                stagePartition.review.map((p) => renderProjectCard(p, { showNextAction: true }))
              )}
            </div>
          </div>

          {/* LANE 4: STAGE 4 - COMPLETED & SHIPPED */}
          <div className="bg-[#F0FDF4]/70 rounded-2xl border border-green-200/80 p-3 space-y-3 shadow-2xs">
            {/* Lane Header */}
            <div className="flex items-center justify-between pb-2 border-b border-green-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <div>
                  <h3 className="text-xs font-black text-[#1A085C]">Stage 4: Completed</h3>
                  <p className="text-[10px] text-green-700 font-medium">Delivered Deliverables</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-green-100 text-green-800">
                {stagePartition.completed.length}
              </span>
            </div>

            {/* Stage Projects Cards */}
            <div className="space-y-3">
              {stagePartition.completed.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-green-200 text-green-400 text-xs">
                  <span>No completed projects yet</span>
                </div>
              ) : (
                stagePartition.completed.map((p) => renderProjectCard(p, { showNextAction: false }))
              )}
            </div>
          </div>
        </div>
      ) : viewMode === 'categories' ? (
        /* ========================================================= */
        /* VIEW 2: CATEGORY GROUPED DECK                             */
        /* ========================================================= */
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const catProjects = filteredProjects.filter((p) => detectCategory(p) === cat.id);
            if (catProjects.length === 0 && selectedCategory !== 'all') return null;

            const CatIcon = cat.icon;

            return (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-[#E5E1F0] p-4 shadow-[0_4px_20px_rgba(26,8,92,0.05)] space-y-3.5"
              >
                {/* Category Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-[#F0EDF9]">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cat.bgColor} ${cat.textColor} border ${cat.borderColor} shadow-2xs`}>
                      <CatIcon size={16} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[#1A085C] flex items-center gap-2">
                        <span>{cat.name}</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F3F0FF] text-[#5B4CF5]">
                          {catProjects.length} {catProjects.length === 1 ? 'Project' : 'Projects'}
                        </span>
                      </h2>
                      <p className="text-[10.5px] text-[#6B7280]">
                        Deliverables and technical contracts for {cat.name.toLowerCase()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setViewMode('stages');
                    }}
                    className="text-xs font-bold text-[#5B4CF5] hover:text-[#7C5CE8] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View in Stages</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                {catProjects.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-[#EAE6F7] text-gray-400 text-xs">
                    No projects under {cat.name} yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {catProjects.map((p) => renderProjectCard(p, { showNextAction: true }))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ========================================================= */
        /* VIEW 3: CLASSIC MATRIX GRID                               */
        /* ========================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredProjects.map((proj) => renderProjectCard(proj, { showNextAction: true }))}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleProjectCreated}
      />

      {/* Project Detail Drawer */}
      <ProjectDetailDrawer
        projectId={selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
        onProjectUpdated={handleProjectUpdated}
      />
    </div>
  );
};
