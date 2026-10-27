import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Project } from '@infohq/shared';
import { fetchProjects } from '../../lib/api.js';
import { CreateProjectModal } from './CreateProjectModal.js';
import { ProjectDetailDrawer } from './ProjectDetailDrawer.js';
import {
  Briefcase,
  Plus,
  Search,
  AlertCircle,
  IndianRupee,
  Loader2,
  ChevronRight,
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
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            In Progress
          </span>
        );
      case 'review':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            In Review
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200">
            Completed
          </span>
        );
      case 'on_hold':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            On Hold
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Planning
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="hq-card bg-white border-brand-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-chip bg-brand-subtle flex items-center justify-center text-brand-primary">
                <Briefcase size={18} />
              </div>
              <h1 className="text-2xl font-bold text-brand-heading">
                Projects & Deliverables
              </h1>
            </div>
            <p className="text-sm text-brand-body mt-1">
              Track client contracts, milestones, and deliverable execution across all services.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="hq-btn-primary flex items-center gap-1.5"
            >
              <Plus size={16} />
              <span>New Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="hq-card bg-white border-brand-border p-3.5">
          <div className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
            Total Projects
          </div>
          <div className="text-xl font-bold text-brand-heading mt-1">{totalCount}</div>
        </div>

        <div className="hq-card bg-white border-brand-border p-3.5">
          <div className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider">
            Planning
          </div>
          <div className="text-xl font-bold text-brand-heading mt-1">{planningCount}</div>
        </div>

        <div className="hq-card bg-white border-brand-border p-3.5">
          <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
            In Progress
          </div>
          <div className="text-xl font-bold text-brand-heading mt-1">{inProgressCount}</div>
        </div>

        <div className="hq-card bg-white border-brand-border p-3.5">
          <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
            In Review
          </div>
          <div className="text-xl font-bold text-brand-heading mt-1">{reviewCount}</div>
        </div>

        <div className="hq-card bg-white border-brand-border p-3.5">
          <div className="text-[11px] font-semibold text-green-600 uppercase tracking-wider">
            Completed
          </div>
          <div className="text-xl font-bold text-brand-heading mt-1">{completedCount}</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="hq-card bg-white border-brand-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setSelectedStatus(chip.key)}
              className={`px-3 py-1.5 rounded-control text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedStatus === chip.key
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-brand-muted hover:bg-brand-section'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-2.5 text-brand-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, client, or company..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Projects List View */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-brand-destructive rounded-control text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="hq-card bg-white border-brand-border p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-brand-primary" />
          <span className="text-xs text-brand-muted">Loading projects workspace...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="hq-card bg-white border-brand-border p-16 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-subtle text-brand-primary mx-auto flex items-center justify-center mb-3">
            <Briefcase size={22} />
          </div>
          <h3 className="text-sm font-bold text-brand-heading">No Projects Found</h3>
          <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
            {searchTerm || selectedStatus !== 'all'
              ? 'No projects match your filter criteria. Try resetting filters.'
              : 'Start by creating your first client project or converting a won lead from the Sales Pipeline.'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="hq-btn-primary text-xs mt-4 inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const totalTasks = proj.totalTasks || 0;
            const completedTasks = proj.completedTasks || 0;
            const percent =
              totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <div
                key={proj.id}
                onClick={() => setSelectedProjectId(proj.id)}
                className="hq-card bg-white border-brand-border hover:border-brand-primary/40 hover:shadow-card transition-all cursor-pointer p-5 flex flex-col justify-between gap-4 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-brand-primary">
                      {proj.serviceType}
                    </span>
                    {getStatusBadge(proj.status)}
                  </div>

                  <h3 className="text-base font-bold text-brand-heading mt-2 group-hover:text-brand-primary transition-colors line-clamp-1">
                    {proj.title}
                  </h3>

                  <div className="text-xs text-brand-muted mt-0.5">
                    Client:{' '}
                    <span className="font-semibold text-brand-heading">
                      {proj.clientName}
                    </span>
                    {proj.company && ` (${proj.company})`}
                  </div>
                </div>

                {/* Task Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-brand-muted">Deliverables</span>
                    <span className="font-semibold text-brand-heading">
                      {completedTasks}/{totalTasks} tasks ({percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-brand-section rounded-full overflow-hidden border border-brand-border">
                    <div
                      className="h-full bg-brand-primary transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Footer details */}
                <div className="pt-3 border-t border-brand-border flex items-center justify-between text-xs text-brand-muted">
                  <div className="flex items-center gap-1 font-semibold text-brand-heading">
                    {proj.budget ? (
                      <>
                        <IndianRupee size={12} className="text-brand-primary" />
                        <span>{proj.budget}</span>
                      </>
                    ) : (
                      <span>Budget: TBD</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 group-hover:text-brand-primary transition-colors">
                    <span>Manage</span>
                    <ChevronRight size={14} />
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
