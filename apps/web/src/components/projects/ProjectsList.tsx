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
  Sparkles,
  CheckCheck,
  BarChart2,
} from 'lucide-react';

export const ProjectsList: React.FC = () => {
  const { getToken } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic hover for top metric cards
  const [hoveredMetricIndex, setHoveredMetricIndex] = useState<number | null>(null);

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

  const getMonogram = (name?: string) => {
    if (!name) return 'HQ';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Concise status badges that never wrap
  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
            <span>In Progress</span>
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-orange-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
            <span>QA &amp; Review</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#F0FDF4] text-[#15803D] border border-green-200 shadow-2xs whitespace-nowrap">
            <CheckCircle2 size={10} />
            <span>Completed</span>
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold bg-[#FAF5FF] text-[#5B4CF5] border border-purple-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5B4CF5]" />
            <span>Planning</span>
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
      title: 'Portfolio Completion',
      value: `${overallCompletionRate}%`,
      subtext: 'Execution burn-up rate',
      icon: CheckCheck,
      iconBg: 'bg-[#F0FDF4]',
      iconColor: 'text-[#15803D]',
    },
    {
      id: 2,
      title: 'In Review & QA',
      value: reviewCount.toString(),
      subtext: `${reviewCount} in review • ${planningCount} in planning`,
      icon: Sparkles,
      iconBg: 'bg-[#FFF7ED]',
      iconColor: 'text-[#C2410C]',
    },
    {
      id: 3,
      title: 'Total Projects',
      value: totalCount.toString(),
      subtext: `${completedCount} successfully completed`,
      icon: Layers,
      iconBg: 'bg-[#F3F0FF]',
      iconColor: 'text-[#5B4CF5]',
    },
  ];

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
            <p className="text-xs text-[#6B7280] font-medium mt-0.5">
              Sprint milestones, scopes &amp; client deliverable contracts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Refresh Button */}
          <button
            onClick={loadProjects}
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
              background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
              boxShadow: '0 4px 14px rgba(99, 88, 240, 0.30)',
            }}
            className="h-8 px-3.5 rounded-full text-white text-xs font-bold inline-flex items-center gap-1.5 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={13} className="stroke-[2.5]" />
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
                  : 'bg-white/85 backdrop-blur-md border border-white/80 shadow-[0_4px_20px_rgba(26,8,92,0.03)] hover:bg-white/95 hover:border-[#5B4CF5]/40'
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
      {/* 1.1 SPRINT EXECUTION & DELIVERABLES GRAPH DECK            */}
      {/* ========================================================= */}
      <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 p-4 shadow-[0_4px_24px_rgba(26,8,92,0.03)] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#F3F0FF] text-[#5B4CF5] flex items-center justify-center">
            <BarChart2 size={13} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1A085C]">Sprint Execution Velocity</h3>
            <p className="text-[10px] text-[#6B7280]">Deliverable burn-up progress across engineering sprints</p>
          </div>
        </div>

        {/* Sprint Cycles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full md:w-auto">
          <div className="bg-[#F8F8FF]/80 p-2 rounded-xl border border-[#EAE6F7]/70 text-left">
            <div className="text-[10px] font-semibold text-[#6B7280]">Sprint Alpha</div>
            <div className="text-xs font-black text-[#15803D] mt-0.5">100% Completed</div>
            <div className="w-full bg-[#EAE6F7] h-1 rounded-full mt-1 overflow-hidden">
              <div className="w-full h-full bg-[#10B981]" />
            </div>
          </div>
          <div className="bg-[#F8F8FF]/80 p-2 rounded-xl border border-[#EAE6F7]/70 text-left">
            <div className="text-[10px] font-semibold text-[#6B7280]">Sprint Beta</div>
            <div className="text-xs font-black text-[#5B4CF5] mt-0.5">85% In Progress</div>
            <div className="w-full bg-[#EAE6F7] h-1 rounded-full mt-1 overflow-hidden">
              <div className="w-[85%] h-full bg-[#5B4CF5]" />
            </div>
          </div>
          <div className="bg-[#F8F8FF]/80 p-2 rounded-xl border border-[#EAE6F7]/70 text-left">
            <div className="text-[10px] font-semibold text-[#6B7280]">Sprint Gamma</div>
            <div className="text-xs font-black text-[#C2410C] mt-0.5">60% In Review</div>
            <div className="w-full bg-[#EAE6F7] h-1 rounded-full mt-1 overflow-hidden">
              <div className="w-[60%] h-full bg-[#F97316]" />
            </div>
          </div>
          <div className="bg-[#F8F8FF]/80 p-2 rounded-xl border border-[#EAE6F7]/70 text-left">
            <div className="text-[10px] font-semibold text-[#6B7280]">Sprint Delta</div>
            <div className="text-xs font-black text-[#6B7280] mt-0.5">Planning Phase</div>
            <div className="w-full bg-[#EAE6F7] h-1 rounded-full mt-1 overflow-hidden">
              <div className="w-[25%] h-full bg-[#7C5CE8]" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. FILTER TABS & SEARCH TOOLBAR                           */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/85 backdrop-blur-md p-2.5 rounded-2xl border border-white/80 shadow-2xs">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_CHIPS.map((chip) => {
            const isActive = selectedStatus === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => setSelectedStatus(chip.key)}
                style={
                  isActive
                    ? {
                        background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                        boxShadow: '0 2px 8px rgba(91,76,245,0.25)',
                      }
                    : {}
                }
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'text-white'
                    : 'bg-[#F8F8FF] text-[#6B7280] border border-[#EAE6F7] hover:border-[#5B4CF5]/40 hover:text-[#5B4CF5]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search title, client, or company..."
            className="w-full h-8 pl-8 pr-3 text-xs font-semibold border border-[#EAE6F7] bg-white rounded-full focus:border-[#5B4CF5] outline-none transition-all placeholder:text-[#9CA3AF] text-[#1A085C]"
          />
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
      {/* 3. BESPOKE PROJECT MATRIX CARDS                           */}
      {/* ========================================================= */}
      {isLoading ? (
        <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 p-16 flex flex-col items-center justify-center gap-2.5 shadow-2xs">
          <RefreshCw size={22} className="animate-spin text-[#5B4CF5]" />
          <span className="text-xs font-semibold text-[#6B7280]">Loading projects workspace...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-[#F3F0FF] text-[#5B4CF5] mx-auto flex items-center justify-center mb-2.5 shadow-2xs">
            <FolderKanban size={22} />
          </div>
          <h3 className="text-sm font-bold text-[#1A085C]">No Projects Found</h3>
          <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto font-medium">
            {searchTerm || selectedStatus !== 'all'
              ? 'No projects match your current filter criteria. Try resetting filters or search keyword.'
              : 'Start by creating your first client project or converting a won deal from the Sales Pipeline.'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
              boxShadow: '0 4px 14px rgba(99, 88, 240, 0.30)',
            }}
            className="mt-3.5 px-3.5 py-1.5 rounded-full text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={13} />
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {projects.map((proj) => {
            const totalTasks = proj.totalTasks || 0;
            const completedTasks = proj.completedTasks || 0;
            const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const clientInitials = getMonogram(proj.clientName);

            return (
              <div
                key={proj.id}
                onClick={() => setSelectedProjectId(proj.id)}
                className="bg-white/85 backdrop-blur-md rounded-2xl border border-white/80 p-4 shadow-[0_4px_24px_rgba(26,8,92,0.03)] hover:bg-white hover:border-[#5B4CF5]/40 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(91,76,245,0.08)] transition-all cursor-pointer flex flex-col justify-between gap-3 group"
              >
                <div className="space-y-2.5">
                  {/* Top Bar: Service Tag & Status Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-[#5B4CF5] bg-[#F3F0FF] px-2.5 py-0.5 rounded-full border border-purple-100 shadow-2xs">
                      {proj.serviceType || 'Client Project'}
                    </span>
                    {getStatusBadge(proj.status)}
                  </div>

                  {/* Title & Client with Monogram */}
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#5B4CF5]/15 to-[#E85AA0]/20 text-[#5B4CF5] font-black text-[10.5px] flex items-center justify-center shrink-0 border border-purple-100 mt-0.5">
                      {clientInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs sm:text-sm font-bold text-[#1A085C] group-hover:text-[#5B4CF5] transition-colors truncate">
                        {proj.title}
                      </h3>
                      <div className="text-[11px] text-[#6B7280] font-medium flex items-center gap-1 mt-0.5">
                        <Building2 size={10} className="text-[#9CA3AF] shrink-0" />
                        <span className="font-semibold text-[#4B5563] truncate">
                          {proj.clientName}
                        </span>
                        {proj.company && <span className="text-[#9CA3AF] truncate">({proj.company})</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Milestone Progress Bar */}
                <div className="space-y-1.5 bg-[#F8F8FF]/80 p-2.5 rounded-xl border border-[#EAE6F7]/80">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-[#6B7280] font-medium">Sprint Deliverables</span>
                    <span className="font-bold text-[#1A085C] tabular-nums">
                      {completedTasks}/{totalTasks} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-[#EAE6F7]">
                    <div
                      className="h-full bg-gradient-to-r from-[#5B4CF5] to-[#E85AA0] transition-all duration-300 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Footer Details */}
                <div className="pt-2 border-t border-[#EAE6F7] flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2.5">
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
                      <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#6B7280] font-medium">
                        <Calendar size={10} className="text-[#9CA3AF]" />
                        <span>{formatISTDate(proj.targetDate)}</span>
                      </div>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-0.5 text-xs font-bold text-[#5B4CF5] group-hover:translate-x-0.5 transition-transform">
                    <span>Manage</span>
                    <ChevronRight size={12} />
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
