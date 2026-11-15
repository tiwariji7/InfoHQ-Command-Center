import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { ProjectTask, TaskPriority, TaskStatus, Project } from '@infohq/shared';
import { fetchAllTasksApi, updateTaskApi, createTaskApi, deleteTaskApi, fetchProjects } from '../../lib/api.js';
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Trash2,
  FolderKanban,
  User,
  Search,
  Sparkles,
  RefreshCw,
  CheckSquare,
} from 'lucide-react';

type EnrichedTask = ProjectTask & { project_title?: string; client_name?: string };

interface TasksViewProps {
  onOpenProject?: (projectId: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ onOpenProject: _onOpenProject }) => {
  const { getToken } = useAuth();

  const [tasks, setTasks] = useState<EnrichedTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [priorityFilter, _setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  // Quick Task Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [targetProjectId, setTargetProjectId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        fetchAllTasksApi(getToken),
        fetchProjects(getToken),
      ]);
      setTasks(tasksRes.tasks || []);
      setProjects(projectsRes.projects || []);
      if (projectsRes.projects && projectsRes.projects.length > 0 && !targetProjectId) {
        setTargetProjectId(projectsRes.projects[0].id);
      }
    } catch (err: unknown) {
      console.error('Failed to load tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to retrieve tasks.');
    } finally {
      setIsLoading(false);
    }
  }, [getToken, targetProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle Task Status (todo -> in_progress -> done -> todo)
  const handleToggleStatus = async (task: EnrichedTask) => {
    const nextStatus: TaskStatus =
      task.status === 'todo'
        ? 'in_progress'
        : task.status === 'in_progress'
        ? 'done'
        : 'todo';

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );

    try {
      await updateTaskApi(getToken, task.projectId, task.id, { status: nextStatus });
    } catch (err) {
      console.error('Failed to update task status:', err);
      // Revert on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
    }
  };

  // Delete Task
  const handleDeleteTask = async (task: EnrichedTask) => {
    if (!confirm(`Are you sure you want to delete task: "${task.title}"?`)) return;

    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await deleteTaskApi(getToken, task.projectId, task.id);
    } catch (err) {
      console.error('Failed to delete task:', err);
      loadData();
    }
  };

  // Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !targetProjectId) return;

    setIsSubmitting(true);
    try {
      const res = await createTaskApi(getToken, targetProjectId, {
        title: newTitle.trim(),
        priority: newPriority,
        status: 'todo',
      });
      const proj = projects.find((p) => p.id === targetProjectId);
      const newTask: EnrichedTask = {
        ...res.task,
        project_title: proj?.title,
        client_name: proj?.clientName,
      };
      setTasks((prev) => [newTask, ...prev]);
      setNewTitle('');
      setIsCreating(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (selectedProjectId !== 'all' && t.projectId !== selectedProjectId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchProject = t.project_title?.toLowerCase().includes(q);
        const matchClient = t.client_name?.toLowerCase().includes(q);
        if (!matchTitle && !matchProject && !matchClient) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, selectedProjectId, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const todo = tasks.filter((t) => t.status === 'todo').length;
    return { total, done, inProgress, todo };
  }, [tasks]);

  const priorityBadge = (priority?: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Medium</span>;
      case 'low':
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">Low</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-[20px] border border-[#EAE6F7] p-5 sm:p-6 shadow-[0_8px_30px_rgba(26,8,92,0.05),0_1px_3px_rgba(26,8,92,0.02)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F3F0FF] text-[#7C5CE8] flex items-center justify-center">
              <CheckSquare size={20} className="stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#1A085C]">
                Engineering Tasks &amp; Sprints
              </h1>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5 font-medium">
                Unified multi-project task management and execution tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={loadData}
              className="h-9 px-3 rounded-xl border border-[#EAE6F7] bg-white text-xs font-semibold text-[#1A085C] hover:bg-[#F8F8FF] transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setIsCreating(true)}
              className="h-9 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#5B4CF5] via-[#7C5CE8] to-[#914FBB] flex items-center gap-1.5 shadow-[0_4px_14px_rgba(124,92,232,0.30)] hover:opacity-95 transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#EAE6F7]">
          <div className="p-3 bg-[#F8F8FF] rounded-xl border border-[#EAE6F7]">
            <span className="text-[11px] font-semibold text-[#6B7280] block">Total Deliverables</span>
            <span className="text-lg font-black text-[#1A085C] font-mono">{stats.total}</span>
          </div>
          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-800 block">Completed</span>
            <span className="text-lg font-black text-emerald-700 font-mono">{stats.done}</span>
          </div>
          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
            <span className="text-[11px] font-semibold text-purple-800 block">In Progress</span>
            <span className="text-lg font-black text-[#7C5CE8] font-mono">{stats.inProgress}</span>
          </div>
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
            <span className="text-[11px] font-semibold text-amber-800 block">To-Do / Backlog</span>
            <span className="text-lg font-black text-amber-700 font-mono">{stats.todo}</span>
          </div>
        </div>
      </div>

      {/* Creation Modal / Form Bar */}
      {isCreating && (
        <form
          onSubmit={handleCreateTask}
          className="bg-white rounded-2xl border-2 border-[#7C5CE8] p-4 shadow-lg space-y-3 animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-[#1A085C] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#7C5CE8]" /> Create Task Across Projects
            </h3>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-[#6B7280] hover:text-[#1A085C] text-xs font-semibold"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title (e.g. Implement Razorpay Webhook, Setup D1 Index...)"
                className="w-full h-10 px-3 rounded-xl border border-[#EAE6F7] text-xs font-medium text-[#1A085C] outline-none focus:border-[#7C5CE8]"
              />
            </div>
            <div>
              <select
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#EAE6F7] text-xs font-medium text-[#1A085C] outline-none focus:border-[#7C5CE8]"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.clientName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#6B7280]">Priority:</span>
              {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map((pr) => (
                <button
                  key={pr}
                  type="button"
                  onClick={() => setNewPriority(pr)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    newPriority === pr
                      ? 'bg-[#7C5CE8] text-white shadow-2xs'
                      : 'bg-[#F8F8FF] text-[#6B7280] border border-[#EAE6F7]'
                  }`}
                >
                  {pr}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newTitle.trim()}
              className="h-8 px-4 rounded-xl text-xs font-bold text-white bg-[#7C5CE8] hover:bg-[#6A48DC] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Save Task'}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#EAE6F7]">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-3 text-[#6B7280]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, projects, clients..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-[#F8F8FF] border border-[#EAE6F7] text-xs font-medium text-[#1A085C] outline-none focus:border-[#7C5CE8]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Tabs */}
          <div className="flex p-0.5 bg-[#F8F8FF] rounded-xl border border-[#EAE6F7]">
            {(['all', 'todo', 'in_progress', 'done'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-white text-[#7C5CE8] shadow-2xs'
                    : 'text-[#6B7280] hover:text-[#1A085C]'
                }`}
              >
                {st === 'all' ? 'All' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Project selector */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-9 px-3 rounded-xl bg-[#F8F8FF] border border-[#EAE6F7] text-xs font-medium text-[#1A085C] outline-none"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-[20px] border border-[#EAE6F7] divide-y divide-[#F0EDF9] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-[#6B7280]">
            <RefreshCw size={24} className="mx-auto mb-2 text-[#7C5CE8] animate-spin" />
            <span>Loading task backlog and sprints...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#6B7280]">
            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
            <h3 className="text-sm font-bold text-[#1A085C]">All tasks clear!</h3>
            <p className="mt-1 text-[11px]">No matching deliverables found in this view.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isDone = task.status === 'done';
            const isInProgress = task.status === 'in_progress';
            return (
              <div
                key={task.id}
                className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                  isDone ? 'bg-[#FAFAFD]/60 opacity-75' : 'hover:bg-[#FAF9FF]/80'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Status Toggle Button */}
                  <button
                    onClick={() => handleToggleStatus(task)}
                    className="shrink-0 cursor-pointer"
                    title={`Click to mark ${isDone ? 'To-Do' : isInProgress ? 'Done' : 'In Progress'}`}
                  >
                    {isDone ? (
                      <CheckCircle2 size={20} className="text-emerald-600" />
                    ) : isInProgress ? (
                      <Clock size={20} className="text-[#7C5CE8] animate-pulse" />
                    ) : (
                      <Circle size={20} className="text-[#9CA3AF] hover:text-[#7C5CE8]" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs sm:text-sm font-bold tracking-tight ${
                        isDone ? 'line-through text-[#6B7280]' : 'text-[#1A085C]'
                      }`}
                    >
                      {task.title}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[#6B7280] flex-wrap font-medium">
                      {task.project_title && (
                        <span className="flex items-center gap-1 font-semibold text-[#7C5CE8]">
                          <FolderKanban size={11} /> {task.project_title}
                        </span>
                      )}
                      {task.client_name && (
                        <span className="flex items-center gap-1 text-[#4B5563]">
                          • <User size={11} /> {task.client_name}
                        </span>
                      )}
                      <span>
                        • Status: <strong className="capitalize">{task.status.replace('_', ' ')}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {priorityBadge(task.priority)}

                  <button
                    onClick={() => handleDeleteTask(task)}
                    className="p-1.5 text-[#9CA3AF] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
