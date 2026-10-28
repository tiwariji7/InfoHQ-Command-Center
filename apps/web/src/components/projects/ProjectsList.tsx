import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Project } from '@infohq/shared';
import { fetchProjects } from '../../lib/api.js';
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
  Building2,
  Layers,
} from 'lucide-react';

export const ProjectsList: React.FC = () => {
  const { getToken } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchProjects(getToken, {
        status: selectedStatus,
        search: searchTerm,
      });
      setProjects(res.projects);
    } catch (err: unknown) {
      console.error('Failed to load projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to retrieve projects.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [selectedStatus, searchTerm, getToken]);

  const handleProjectCreated = (newProject: Project) => {
    setProjects((prev) => [newProject, ...prev]);
    setSelectedProjectId(newProject.id);
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
  };

  // Metrics summary
  const totalCount = projects.length;
  const inProgressCount = projects.filter((p) => p.status === 'in_progress').length;
  const reviewCount = projects.filter((p) => p.status === 'review').length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const planningCount = projects.filter((p) => p.status === 'planning').length;

  const STATUS_CHIPS: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'All Projects' },
    { key: 'planning', label: 'Planning' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'review', label: 'In Review' },
    { key: 'completed', label: 'Completed' },
    { key: 'on_hold', label: 'On Hold' },
  ];

  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            In Progress
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            In Review
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={11} />
            Completed
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Clock size={11} />
            On Hold
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF5FF] text-[#6B21A8] border border-purple-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9333EA]" />
            Planning
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

  // Completion calculation across active portfolio
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

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 0. HEADER & CTA (Half-Gradient Title)                     */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDE9FE] text-[#7C3AED] border border-[#DDD6FE]">
              <Layers size={12} className="text-[#7C3AED]" />
              Delivery & Engineering Hub
            </span>
            <span className="text-xs text-brand-muted hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-brand-muted hidden sm:inline">
              Sprint milestones, scope, & client contracts
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A085C] mt-1">
            Projects &{' '}
            <span className="bg-gradient-to-r from-[#FF4D8D] via-[#A855F7] to-[#5B4CF5] bg-clip-text text-transparent">
              Deliverables Matrix
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={loadProjects}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white border border-[#EDE8F5] text-brand-muted hover:text-[#7C3AED] shadow-2xs transition-all cursor-pointer"
            title="Refresh Projects"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-[#7C3AED]' : ''} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-xs sm:text-sm font-bold shadow-[0_4px_16px_rgba(124,58,237,0.25)] hover:shadow-[0_8px_24px_rgba(124,58,237,0.35)] transition-all cursor-pointer"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. BESPOKE PORTFOLIO DELIVERY HEALTH DECK (Unique!)       */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#EDE8F5] p-5 shadow-[0_4px_24px_rgba(124,58,237,0.04)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-brand-muted uppercase tracking-wider">
              Portfolio Execution Health
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#1A085C] mt-0.5">
              {inProgressCount + reviewCount} Active Client Deliverables
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-[#2563EB]" />
              <div>
                <div className="text-[10px] font-bold text-brand-muted uppercase">In Progress</div>
                <div className="text-sm font-black text-brand-heading tabular-nums">{inProgressCount}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-[#F59E0B]" />
              <div>
                <div className="text-[10px] font-bold text-brand-muted uppercase">In Review</div>
                <div className="text-sm font-black text-brand-heading tabular-nums">{reviewCount}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-[#10B981]" />
              <div>
                <div className="text-[10px] font-bold text-brand-muted uppercase">Completed</div>
                <div className="text-sm font-black text-emerald-700 tabular-nums">{completedCount}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-[#7C3AED]" />
              <div>
                <div className="text-[10px] font-bold text-brand-muted uppercase">Planning</div>
                <div className="text-sm font-black text-brand-heading tabular-nums">{planningCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Segmented Delivery Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-3 rounded-full bg-[#FAF9FD] overflow-hidden flex border border-[#EDE8F5]">
            {totalCount > 0 && (
              <>
                <div
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                  className="h-full bg-emerald-500 transition-all duration-300"
                  title={`Completed: ${completedCount}`}
                />
                <div
                  style={{ width: `${(inProgressCount / totalCount) * 100}%` }}
                  className="h-full bg-blue-600 transition-all duration-300"
                  title={`In Progress: ${inProgressCount}`}
                />
                <div
                  style={{ width: `${(reviewCount / totalCount) * 100}%` }}
                  className="h-full bg-amber-500 transition-all duration-300"
                  title={`In Review: ${reviewCount}`}
                />
                <div
                  style={{ width: `${(planningCount / totalCount) * 100}%` }}
                  className="h-full bg-[#7C3AED] transition-all duration-300"
                  title={`Planning: ${planningCount}`}
                />
              </>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-brand-muted">
            <span>Overall Task Completion Rate across portfolio</span>
            <span className="font-bold text-[#7C3AED] tabular-nums">{overallCompletionRate}% delivered</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. FILTER & SEARCH TOOLBAR                                */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#EDE8F5] p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_CHIPS.map((chip) => {
            const isActive = selectedStatus === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => setSelectedStatus(chip.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-xs'
                    : 'bg-[#FAF9FD] text-[#475569] border border-[#EDE8F5] hover:bg-[#EDE9FE]/50 hover:text-[#7C3AED]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, client, or company..."
            className="w-full h-10 pl-9 pr-3 text-xs font-semibold border border-[#EDE8F5] bg-[#FAF9FD] rounded-xl focus:bg-white focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15 outline-none transition-all"
          />
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-brand-destructive rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. BESPOKE PROJECT MATRIX CARDS                           */}
      {/* ========================================================= */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-[#EDE8F5] p-20 flex flex-col items-center justify-center gap-3 shadow-2xs">
          <RefreshCw size={26} className="animate-spin text-[#7C3AED]" />
          <span className="text-xs font-bold text-brand-muted">Loading projects workspace...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EDE8F5] p-16 text-center shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] mx-auto flex items-center justify-center mb-3 shadow-2xs">
            <FolderKanban size={26} />
          </div>
          <h3 className="text-base font-bold text-brand-heading">No Projects Found</h3>
          <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto font-medium">
            {searchTerm || selectedStatus !== 'all'
              ? 'No projects match your current filter criteria. Try resetting filters or search keyword.'
              : 'Start by creating your first client project or converting a won deal from the Sales Pipeline.'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white text-xs font-bold shadow-xs inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            const totalTasks = proj.totalTasks || 0;
            const completedTasks = proj.completedTasks || 0;
            const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <div
                key={proj.id}
                onClick={() => setSelectedProjectId(proj.id)}
                className="bg-white rounded-2xl border border-[#EDE8F5] p-5 shadow-[0_4px_20px_rgba(124,58,237,0.04)] hover:border-[#7C3AED]/40 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(124,58,237,0.08)] transition-all cursor-pointer flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-3">
                  {/* Top Bar: Service Tag & Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#7C3AED] bg-[#EDE9FE] px-2.5 py-0.5 rounded-lg">
                      {proj.serviceType || 'Client Project'}
                    </span>
                    {getStatusBadge(proj.status)}
                  </div>

                  {/* Title & Client */}
                  <div>
                    <h3 className="text-base font-bold text-[#1A085C] group-hover:text-[#7C3AED] transition-colors line-clamp-1">
                      {proj.title}
                    </h3>
                    <div className="text-xs text-brand-muted font-medium flex items-center gap-1.5 mt-1">
                      <Building2 size={12} className="text-brand-muted shrink-0" />
                      <span className="font-semibold text-brand-heading truncate">
                        {proj.clientName}
                      </span>
                      {proj.company && <span className="text-brand-muted">({proj.company})</span>}
                    </div>
                  </div>
                </div>

                {/* Milestone Progress Bar */}
                <div className="space-y-2 bg-[#FAF9FD] p-3 rounded-xl border border-[#EDE8F5]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-brand-muted font-medium">Sprint Deliverables</span>
                    <span className="font-bold text-[#1A085C] tabular-nums">
                      {completedTasks}/{totalTasks} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-[#EDE8F5]">
                    <div
                      className="h-full bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] transition-all duration-300 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Footer Details: Budget, Target Date & Manage Trigger */}
                <div className="pt-3 border-t border-[#EDE8F5] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 font-black text-emerald-700 tabular-nums">
                      {proj.budget ? (
                        <>
                          <IndianRupee size={12} />
                          <span>{proj.budget}</span>
                        </>
                      ) : (
                        <span className="text-brand-muted text-[11px]">Budget TBD</span>
                      )}
                    </div>
                    {proj.targetDate && (
                      <div className="hidden sm:flex items-center gap-1 text-[11px] text-brand-muted font-medium">
                        <Calendar size={11} />
                        <span>{formatISTDate(proj.targetDate)}</span>
                      </div>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] group-hover:translate-x-0.5 transition-transform">
                    <span>Manage</span>
                    <ChevronRight size={13} />
                  </div>
                </div>
              </div>
            );
          })}
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
