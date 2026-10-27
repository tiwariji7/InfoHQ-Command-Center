import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type {
  Project,
  ProjectTask,
  TaskPriority,
  TaskStatus,
  ProjectDetailResponse,
  Payment,
} from '@infohq/shared';
import {
  fetchProjectDetail,
  updateProjectApi,
  createTaskApi,
  updateTaskApi,
  deleteTaskApi,
  fetchPayments,
  deletePaymentApi,
} from '../../lib/api.js';
import {
  X,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  IndianRupee,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Clock,
  Briefcase,
  Receipt,
  CheckSquare,
} from 'lucide-react';
import { CreatePaymentModal } from '../payments/CreatePaymentModal.js';
import { RecordPaymentModal } from '../payments/RecordPaymentModal.js';

interface ProjectDetailDrawerProps {
  projectId: string | null;
  onClose: () => void;
  onProjectUpdated: (project: Project) => void;
}

export const ProjectDetailDrawer: React.FC<ProjectDetailDrawerProps> = ({
  projectId,
  onClose,
  onProjectUpdated,
}) => {
  const { getToken } = useAuth();

  const [projectData, setProjectData] = useState<ProjectDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab state inside drawer
  const [activeDrawerTab, setActiveDrawerTab] = useState<'tasks' | 'billing'>('tasks');

  // Tasks state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Billing & Payments state
  const [projectPayments, setProjectPayments] = useState<Payment[]>([]);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);
  const [isCreatePaymentOpen, setIsCreatePaymentOpen] = useState(false);
  const [recordPaymentTarget, setRecordPaymentTarget] = useState<Payment | null>(null);

  // Load project details
  useEffect(() => {
    if (!projectId) {
      setProjectData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchProjectDetail(getToken, projectId)
      .then((data) => {
        if (isMounted) {
          setProjectData(data);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load project details.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [projectId, getToken]);

  // Load project payments
  const loadProjectPayments = useCallback(async () => {
    if (!projectId) return;
    setIsPaymentsLoading(true);
    try {
      const res = await fetchPayments(getToken, { projectId });
      setProjectPayments(res.payments);
    } catch (err: unknown) {
      console.error('Failed to load project payments:', err);
    } finally {
      setIsPaymentsLoading(false);
    }
  }, [projectId, getToken]);

  useEffect(() => {
    if (projectId) {
      loadProjectPayments();
    }
  }, [projectId, loadProjectPayments]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && projectId) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectId, onClose]);

  if (!projectId) return null;

  const project = projectData?.project;
  const tasks = projectData?.tasks || [];

  // Status update handler
  const handleStatusChange = async (newStatus: Project['status']) => {
    if (!project) return;
    const previousStatus = project.status;

    setProjectData((prev) =>
      prev ? { ...prev, project: { ...prev.project, status: newStatus } } : null
    );

    try {
      const res = await updateProjectApi(getToken, project.id, { status: newStatus });
      onProjectUpdated(res.project);
    } catch (err: unknown) {
      console.error('Failed to update project status:', err);
      setProjectData((prev) =>
        prev ? { ...prev, project: { ...prev.project, status: previousStatus } } : null
      );
    }
  };

  // Add task handler
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newTaskTitle.trim()) return;

    setIsAddingTask(true);
    try {
      const res = await createTaskApi(getToken, project.id, {
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        status: 'todo',
      });

      setProjectData((prev) => {
        if (!prev) return null;
        const updatedTasks = [...prev.tasks, res.task];
        const completedCount = updatedTasks.filter((t) => t.status === 'done').length;
        const updatedProject = {
          ...prev.project,
          totalTasks: updatedTasks.length,
          completedTasks: completedCount,
        };
        onProjectUpdated(updatedProject);
        return {
          project: updatedProject,
          tasks: updatedTasks,
        };
      });

      setNewTaskTitle('');
      setNewTaskPriority('medium');
    } catch (err: unknown) {
      console.error('Failed to create task:', err);
    } finally {
      setIsAddingTask(false);
    }
  };

  // Toggle task status handler
  const handleToggleTaskStatus = async (task: ProjectTask) => {
    if (!project) return;
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';

    setProjectData((prev) => {
      if (!prev) return null;
      const updatedTasks = prev.tasks.map((t) =>
        t.id === task.id ? { ...t, status: newStatus } : t
      );
      const completedCount = updatedTasks.filter((t) => t.status === 'done').length;
      const updatedProject = {
        ...prev.project,
        completedTasks: completedCount,
      };
      onProjectUpdated(updatedProject);
      return {
        project: updatedProject,
        tasks: updatedTasks,
      };
    });

    try {
      await updateTaskApi(getToken, project.id, task.id, { status: newStatus });
    } catch (err: unknown) {
      console.error('Failed to toggle task:', err);
      fetchProjectDetail(getToken, project.id).then((data) => setProjectData(data));
    }
  };

  // Delete task handler
  const handleDeleteTask = async (taskId: string) => {
    if (!project) return;
    if (!confirm('Are you sure you want to delete this task?')) return;

    setProjectData((prev) => {
      if (!prev) return null;
      const updatedTasks = prev.tasks.filter((t) => t.id !== taskId);
      const completedCount = updatedTasks.filter((t) => t.status === 'done').length;
      const updatedProject = {
        ...prev.project,
        totalTasks: updatedTasks.length,
        completedTasks: completedCount,
      };
      onProjectUpdated(updatedProject);
      return {
        project: updatedProject,
        tasks: updatedTasks,
      };
    });

    try {
      await deleteTaskApi(getToken, project.id, taskId);
    } catch (err: unknown) {
      console.error('Failed to delete task:', err);
      fetchProjectDetail(getToken, project.id).then((data) => setProjectData(data));
    }
  };

  // Delete payment handler
  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this milestone payment?')) return;
    try {
      await deletePaymentApi(getToken, paymentId);
      setProjectPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } catch (err: unknown) {
      console.error('Failed to delete payment:', err);
    }
  };

  // Quick Client Contact URLs
  const cleanPhone = project?.clientPhone?.replace(/\D/g, '') || '';
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${encodeURIComponent(
        `Hi ${project?.clientName}, regarding your ${project?.serviceType} project with InfoHQ...`
      )}`
    : null;

  const mailtoUrl = project?.clientEmail
    ? `mailto:${project.clientEmail}?subject=${encodeURIComponent(
        `[InfoHQ Project] ${project.title}`
      )}`
    : null;

  // Filtered tasks
  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'active') return t.status !== 'done';
    if (taskFilter === 'completed') return t.status === 'done';
    return true;
  });

  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.status === 'done').length;
  const progressPercent =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Milestone financial summary
  let totalProjectInvoiced = 0;
  let totalProjectCollected = 0;
  for (const py of projectPayments) {
    if (py.status !== 'failed') totalProjectInvoiced += py.amount;
    if (py.status === 'received') totalProjectCollected += py.amount;
  }
  const projectPendingBalance = totalProjectInvoiced - totalProjectCollected;

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amt);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 flex justify-end">
      <div
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-brand-border animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-brand-border flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-chip bg-brand-subtle flex items-center justify-center text-brand-primary">
              <Briefcase size={16} />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-brand-primary uppercase tracking-wider">
                Project Workspace
              </span>
              <h2 className="text-base font-bold text-brand-heading leading-tight truncate max-w-md">
                {project?.title || 'Loading Project...'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-brand-muted hover:text-brand-heading rounded hover:bg-brand-section transition-colors"
            aria-label="Close drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && !project && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-brand-primary" />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-brand-destructive rounded-control text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {project && (
            <>
              {/* Project Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-brand-section rounded-card border border-brand-border">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-brand-muted">Status:</span>
                  <select
                    value={project.status}
                    onChange={(e) => handleStatusChange(e.target.value as Project['status'])}
                    className="px-2.5 py-1 text-xs font-semibold rounded-control border border-brand-border bg-white text-brand-heading focus:border-brand-primary focus:outline-none capitalize cursor-pointer"
                  >
                    <option value="planning">Planning</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">In Review</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 text-xs text-brand-muted">
                  {project.budget && (
                    <div className="flex items-center gap-1 font-semibold text-brand-heading">
                      <IndianRupee size={13} className="text-brand-primary" />
                      <span>{project.budget}</span>
                    </div>
                  )}
                  {project.targetDate && (
                    <div className="flex items-center gap-1">
                      <Calendar size={13} />
                      <span>Due {new Date(project.targetDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Client Info & Communication Actions */}
              <div className="hq-card bg-white border border-brand-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                      Client Profile
                    </div>
                    <div className="text-sm font-bold text-brand-heading mt-0.5">
                      {project.clientName}
                    </div>
                    {project.company && (
                      <div className="text-xs text-brand-muted">{project.company}</div>
                    )}
                    <div className="text-xs text-brand-primary font-medium mt-1">
                      Service: {project.serviceType}
                    </div>
                  </div>

                  {/* Quick Contact Buttons */}
                  <div className="flex items-center gap-2">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-control bg-green-50 text-green-700 hover:bg-green-100 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-green-200"
                        title="Open WhatsApp chat"
                      >
                        <MessageCircle size={14} />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    )}
                    {project.clientPhone && (
                      <a
                        href={`tel:${project.clientPhone}`}
                        className="p-1.5 rounded-control bg-brand-section text-brand-heading hover:bg-brand-border text-xs transition-colors"
                        title={`Call ${project.clientPhone}`}
                      >
                        <Phone size={14} />
                      </a>
                    )}
                    {mailtoUrl && (
                      <a
                        href={mailtoUrl}
                        className="p-1.5 rounded-control bg-brand-section text-brand-heading hover:bg-brand-border text-xs transition-colors"
                        title={`Email ${project.clientEmail}`}
                      >
                        <Mail size={14} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Project Description/Scope */}
                {project.description && (
                  <div className="mt-3 pt-3 border-t border-brand-border text-xs text-brand-body leading-relaxed whitespace-pre-wrap">
                    {project.description}
                  </div>
                )}
              </div>

              {/* Progress Bar Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-brand-heading">Deliverables & Progress</span>
                  <span className="font-semibold text-brand-primary">
                    {completedTasksCount} / {totalTasksCount} tasks ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-brand-section rounded-full overflow-hidden border border-brand-border">
                  <div
                    className="h-full bg-brand-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Section Tabs: Tasks vs Milestone Billing */}
              <div className="flex items-center gap-2 border-b border-brand-border pb-2">
                <button
                  type="button"
                  onClick={() => setActiveDrawerTab('tasks')}
                  className={`px-3 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeDrawerTab === 'tasks'
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-brand-muted hover:bg-brand-section'
                  }`}
                >
                  <CheckSquare size={14} />
                  <span>Tasks & Milestones ({totalTasksCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDrawerTab('billing')}
                  className={`px-3 py-1.5 rounded-control text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeDrawerTab === 'billing'
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-brand-muted hover:bg-brand-section'
                  }`}
                >
                  <Receipt size={14} />
                  <span>Milestone Billing ({projectPayments.length})</span>
                </button>
              </div>

              {/* Tab 1: Tasks Management */}
              {activeDrawerTab === 'tasks' ? (
                <div className="space-y-3">
                  {/* Filter and Add Task Bar */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        onClick={() => setTaskFilter('all')}
                        className={`px-2.5 py-1 rounded-control font-medium transition-colors ${
                          taskFilter === 'all'
                            ? 'bg-brand-section text-brand-heading font-semibold'
                            : 'text-brand-muted hover:text-brand-heading'
                        }`}
                      >
                        All ({totalTasksCount})
                      </button>
                      <button
                        onClick={() => setTaskFilter('active')}
                        className={`px-2.5 py-1 rounded-control font-medium transition-colors ${
                          taskFilter === 'active'
                            ? 'bg-brand-section text-brand-heading font-semibold'
                            : 'text-brand-muted hover:text-brand-heading'
                        }`}
                      >
                        Active ({totalTasksCount - completedTasksCount})
                      </button>
                      <button
                        onClick={() => setTaskFilter('completed')}
                        className={`px-2.5 py-1 rounded-control font-medium transition-colors ${
                          taskFilter === 'completed'
                            ? 'bg-brand-section text-brand-heading font-semibold'
                            : 'text-brand-muted hover:text-brand-heading'
                        }`}
                      >
                        Done ({completedTasksCount})
                      </button>
                    </div>
                  </div>

                  {/* Inline Add Task Form */}
                  <form onSubmit={handleAddTask} className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Add a new milestone or task..."
                      className="flex-1 px-3 py-2 text-xs border border-brand-border rounded-control focus:border-brand-primary focus:outline-none"
                    />
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                      className="px-2.5 py-2 text-xs border border-brand-border rounded-control bg-white text-brand-heading focus:border-brand-primary focus:outline-none capitalize"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isAddingTask || !newTaskTitle.trim()}
                      className="hq-btn-primary text-xs py-2 px-3 flex items-center gap-1 shrink-0"
                    >
                      {isAddingTask ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Plus size={13} />
                      )}
                      <span>Add</span>
                    </button>
                  </form>

                  {/* Task List */}
                  <div className="space-y-2 mt-2">
                    {filteredTasks.length === 0 ? (
                      <div className="py-8 text-center text-xs text-brand-muted border border-dashed border-brand-border rounded-card bg-brand-section/50">
                        No tasks found in this view. Add a task above to start tracking deliverables.
                      </div>
                    ) : (
                      filteredTasks.map((task) => {
                        const isDone = task.status === 'done';
                        return (
                          <div
                            key={task.id}
                            className={`p-3 rounded-control border transition-all flex items-start justify-between gap-3 ${
                              isDone
                                ? 'bg-brand-section/40 border-brand-border text-brand-muted opacity-80'
                                : 'bg-white border-brand-border hover:border-brand-primary/40'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleTaskStatus(task)}
                                className={`mt-0.5 transition-colors ${
                                  isDone ? 'text-green-600' : 'text-brand-muted hover:text-brand-primary'
                                }`}
                                aria-label={isDone ? 'Mark task as todo' : 'Mark task as done'}
                              >
                                {isDone ? (
                                  <CheckCircle2 size={16} className="fill-green-100" />
                                ) : (
                                  <Circle size={16} />
                                )}
                              </button>
                              <div className="min-w-0">
                                <span
                                  className={`text-xs font-medium block break-words ${
                                    isDone ? 'line-through text-brand-muted' : 'text-brand-heading'
                                  }`}
                                >
                                  {task.title}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span
                                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded uppercase border ${
                                      task.priority === 'urgent'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : task.priority === 'high'
                                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                                        : task.priority === 'medium'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : 'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}
                                  >
                                    {task.priority}
                                  </span>
                                  {task.completedAt && (
                                    <span className="text-[10px] text-brand-muted flex items-center gap-0.5">
                                      <Clock size={10} />
                                      Done {new Date(task.completedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-brand-lightGray hover:text-brand-destructive p-1 rounded transition-colors shrink-0"
                              title="Delete task"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* Tab 2: Milestone Billing */
                <div className="space-y-4">
                  {/* Financial Snapshot */}
                  <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-brand-section rounded-card border border-brand-border">
                    <div>
                      <span className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">
                        Invoiced
                      </span>
                      <div className="text-sm font-bold text-brand-heading mt-0.5">
                        {formatCurrency(totalProjectInvoiced)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-green-700 uppercase font-bold tracking-wider">
                        Collected
                      </span>
                      <div className="text-sm font-bold text-green-700 mt-0.5">
                        {formatCurrency(totalProjectCollected)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-700 uppercase font-bold tracking-wider">
                        Pending
                      </span>
                      <div className="text-sm font-bold text-amber-700 mt-0.5">
                        {formatCurrency(projectPendingBalance)}
                      </div>
                    </div>
                  </div>

                  {/* Add Milestone Invoice Button */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-heading">
                      Payment Milestones & Invoices
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatePaymentOpen(true)}
                      className="hq-btn-primary text-xs py-1 px-2.5 flex items-center gap-1"
                    >
                      <Plus size={13} />
                      <span>Add Milestone</span>
                    </button>
                  </div>

                  {/* Milestone List */}
                  {isPaymentsLoading ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 size={20} className="animate-spin text-brand-primary" />
                    </div>
                  ) : projectPayments.length === 0 ? (
                    <div className="py-8 text-center text-xs text-brand-muted border border-dashed border-brand-border rounded-card bg-brand-section/50">
                      No payment milestones added for this project yet. Click &quot;Add Milestone&quot; to set up billing.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {projectPayments.map((py) => {
                        const isPaid = py.status === 'received';
                        const isOverdue =
                          py.status === 'pending' && py.dueDate && py.dueDate < Date.now();

                        return (
                          <div
                            key={py.id}
                            className={`p-3.5 rounded-control border flex items-center justify-between gap-3 ${
                              isPaid
                                ? 'bg-green-50/30 border-green-200'
                                : 'bg-white border-brand-border'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-brand-heading">
                                  {py.title}
                                </span>
                                {isPaid ? (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-green-100 text-green-800">
                                    Paid
                                  </span>
                                ) : isOverdue ? (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-100 text-red-800">
                                    Overdue
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                                    Pending
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-brand-muted mt-0.5 flex items-center gap-3">
                                {py.invoiceNumber && <span>Inv: {py.invoiceNumber}</span>}
                                {py.dueDate && (
                                  <span>Due: {new Date(py.dueDate).toLocaleDateString()}</span>
                                )}
                                {py.notes && <span>Ref: {py.notes}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <div className="text-xs font-bold text-brand-heading">
                                  {formatCurrency(py.amount)}
                                </div>
                              </div>

                              {!isPaid && (
                                <button
                                  type="button"
                                  onClick={() => setRecordPaymentTarget(py)}
                                  className="px-2 py-1 rounded bg-brand-primary text-white text-[11px] font-semibold hover:bg-brand-primary/90 flex items-center gap-1"
                                >
                                  <CheckCircle2 size={12} />
                                  <span>Mark Paid</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeletePayment(py.id)}
                                className="p-1 text-brand-lightGray hover:text-brand-destructive rounded"
                                title="Delete milestone"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Milestone Invoice Modal */}
      {project && (
        <CreatePaymentModal
          isOpen={isCreatePaymentOpen}
          onClose={() => setIsCreatePaymentOpen(false)}
          onSuccess={() => {
            loadProjectPayments();
          }}
          preSelectedProjectId={project.id}
          preSelectedProjectTitle={project.title}
        />
      )}

      {/* Record Payment Receipt Modal */}
      <RecordPaymentModal
        isOpen={Boolean(recordPaymentTarget)}
        onClose={() => setRecordPaymentTarget(null)}
        onSuccess={() => {
          loadProjectPayments();
        }}
        payment={recordPaymentTarget}
      />
    </div>
  );
};
