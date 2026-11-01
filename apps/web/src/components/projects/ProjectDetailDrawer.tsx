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
  Building2,
  Sparkles,
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

  const getMonogram = (name?: string) => {
    if (!name) return 'HQ';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

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
        `Hi ${project?.clientName}, regarding your ${project?.serviceType || 'engineering'} project with InfoHQ...`
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

  const getStatusBadge = (status?: Project['status']) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-blue-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
            <span>In Progress</span>
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-orange-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
            <span>QA &amp; Review</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDF4] text-[#15803D] border border-green-200 shadow-2xs whitespace-nowrap">
            <CheckCircle2 size={11} />
            <span>Completed</span>
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap">
            <Clock size={11} />
            <span>On Hold</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FAF5FF] text-[#5B4CF5] border border-purple-200 shadow-2xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5B4CF5]" />
            <span>Planning</span>
          </span>
        );
    }
  };

  return (
    <>
      {/* Dim Smooth Backdrop */}
      <div
        className="fixed inset-0 bg-[#1A085C]/25 backdrop-blur-[2px] z-50 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Floating Side Drawer Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[520px] max-w-full bg-white z-50 shadow-[-12px_0_40px_rgba(26,8,92,0.18)] border-l border-[#E5E1F0] flex flex-col animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header with Cut (X) button */}
        <div className="relative p-5 pb-4 border-b border-[#E5E1F0] bg-gradient-to-b from-[#FAF9FD] to-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#5B4CF5] animate-ping" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B4CF5]">
                Client &amp; Project Dossier
              </span>
            </div>

            {/* CUT / CLOSE BUTTON */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#FAF5FF] hover:bg-[#F3F0FF] text-[#1A085C] hover:text-rose-600 border border-purple-100 flex items-center justify-center transition-all cursor-pointer shadow-2xs group"
              title="Cut / Close details (Esc)"
            >
              <X size={15} className="group-hover:rotate-90 transition-transform duration-200" />
            </button>
          </div>

          {/* Project Title Banner */}
          <div className="mt-3">
            <h2 className="text-base sm:text-lg font-black text-[#1A085C] tracking-tight leading-snug truncate">
              {project?.title || 'Loading Project...'}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {getStatusBadge(project?.status)}
              {project?.serviceType && (
                <span className="text-[10.5px] font-bold text-[#5B4CF5] bg-[#F3F0FF] px-2 py-0.5 rounded-full border border-purple-100">
                  {project.serviceType}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {isLoading && !project && (
            <div className="flex flex-col items-center justify-center py-24 gap-2 text-[#6B7280]">
              <Loader2 size={26} className="animate-spin text-[#5B4CF5]" />
              <span className="font-semibold text-xs">Loading client &amp; project information...</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-rose-600 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {project && (
            <>
              {/* ========================================================= */}
              {/* 1. EXECUTIVE CLIENT PROFILE HERO CARD                      */}
              {/* ========================================================= */}
              <div className="bg-white rounded-2xl p-4 border border-[#E5E1F0] shadow-2xs space-y-3.5">
                <div className="flex items-start gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#5B4CF5] to-[#E85AA0] text-white font-black text-lg flex items-center justify-center shadow-[0_6px_20px_rgba(91,76,245,0.30)] ring-4 ring-purple-50 shrink-0">
                    {getMonogram(project.clientName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B4CF5]">
                      Client Profile
                    </div>
                    <h3 className="text-base font-black text-[#1A085C] tracking-tight leading-snug truncate">
                      {project.clientName}
                    </h3>
                    {project.company && (
                      <div className="text-xs font-semibold text-[#6B7280] flex items-center gap-1 truncate mt-0.5">
                        <Building2 size={12} className="text-[#5B4CF5] shrink-0" />
                        <span className="truncate">{project.company}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#FAF9FD]">
                  {project.clientPhone ? (
                    <a
                      href={`tel:${project.clientPhone}`}
                      style={{
                        background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                        boxShadow: '0 4px 12px rgba(99, 88, 240, 0.25)',
                      }}
                      className="p-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-105 active:scale-95 transition-all"
                    >
                      <Phone size={13} className="stroke-[2.5]" />
                      <span>Call Client</span>
                    </a>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1 border border-[#E5E1F0]">
                      <Phone size={13} />
                      <span>No Phone</span>
                    </div>
                  )}

                  {waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-xl bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#15803D] text-xs font-bold flex items-center justify-center gap-1.5 border border-green-200 transition-colors shadow-2xs"
                    >
                      <MessageCircle size={13} className="stroke-[2.2]" />
                      <span>WhatsApp</span>
                    </a>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1 border border-[#E5E1F0]">
                      <MessageCircle size={13} />
                      <span>WhatsApp</span>
                    </div>
                  )}

                  {mailtoUrl ? (
                    <a
                      href={mailtoUrl}
                      className="p-2.5 rounded-xl bg-white hover:bg-[#F3F0FF] text-[#1A085C] hover:text-[#5B4CF5] text-xs font-bold flex items-center justify-center gap-1.5 border border-[#E5E1F0] transition-colors shadow-2xs"
                    >
                      <Mail size={13} className="stroke-[2.2]" />
                      <span>Email</span>
                    </a>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1 border border-[#E5E1F0]">
                      <Mail size={13} />
                      <span>No Email</span>
                    </div>
                  )}
                </div>

                {/* Important Client Details Matrix */}
                <div className="space-y-2 pt-2 border-t border-[#FAF9FD]">
                  <div className="flex items-center justify-between text-xs py-1 border-b border-[#FAF9FD]">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <Phone size={12} className="text-[#5B4CF5]" />
                      <span>Direct Phone</span>
                    </span>
                    <span className="font-semibold text-[#1A085C]">
                      {project.clientPhone || 'Not Provided'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1 border-b border-[#FAF9FD]">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <Mail size={12} className="text-[#5B4CF5]" />
                      <span>Direct Email</span>
                    </span>
                    <span className="font-semibold text-[#1A085C] truncate max-w-[220px]">
                      {project.clientEmail || 'Not Provided'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-[#6B7280] flex items-center gap-1.5">
                      <Briefcase size={12} className="text-[#5B4CF5]" />
                      <span>Engagement Type</span>
                    </span>
                    <span className="font-bold text-[#5B4CF5]">
                      {project.serviceType || 'Modern Engineering'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* 2. IMPORTANT PROJECT DETAILS & FINANCIAL SNAPSHOT          */}
              {/* ========================================================= */}
              <div className="bg-[#FAF9FD] rounded-2xl p-4 border border-[#E5E1F0] space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold text-[#1A085C] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={12} className="text-[#5B4CF5]" />
                    <span>Project Deliverable Status</span>
                  </span>
                  <span className="text-[10px] text-[#6B7280]">Real-time Sync</span>
                </div>

                {/* Status Changer Select */}
                <select
                  value={project.status}
                  onChange={(e) => handleStatusChange(e.target.value as Project['status'])}
                  className="w-full h-9 px-3 rounded-xl border border-[#E5E1F0] bg-white text-xs font-bold text-[#1A085C] focus:border-[#5B4CF5] focus:outline-none cursor-pointer shadow-2xs"
                >
                  <option value="planning">Status: Planning Phase</option>
                  <option value="in_progress">Status: Active Development (In Progress)</option>
                  <option value="review">Status: QA &amp; Client Review</option>
                  <option value="completed">Status: Completed &amp; Handed Over</option>
                  <option value="on_hold">Status: On Hold</option>
                </select>

                {/* 4-Stat Financial & Timeline Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Budget */}
                  <div className="bg-white p-3 rounded-xl border border-[#E5E1F0] shadow-2xs">
                    <span className="text-[10px] font-semibold text-[#6B7280] block">
                      Contract Budget
                    </span>
                    <div className="text-xs sm:text-sm font-black text-[#10B981] tabular-nums mt-0.5 flex items-center gap-0.5">
                      <IndianRupee size={12} />
                      <span>{project.budget || 'TBD'}</span>
                    </div>
                  </div>

                  {/* Invoiced */}
                  <div className="bg-white p-3 rounded-xl border border-[#E5E1F0] shadow-2xs">
                    <span className="text-[10px] font-semibold text-[#6B7280] block">
                      Invoiced
                    </span>
                    <div className="text-xs sm:text-sm font-black text-[#1A085C] tabular-nums mt-0.5">
                      {formatCurrency(totalProjectInvoiced)}
                    </div>
                  </div>

                  {/* Collected */}
                  <div className="bg-white p-3 rounded-xl border border-[#E5E1F0] shadow-2xs">
                    <span className="text-[10px] font-semibold text-[#15803D] block">
                      Collected
                    </span>
                    <div className="text-xs sm:text-sm font-black text-[#15803D] tabular-nums mt-0.5">
                      {formatCurrency(totalProjectCollected)}
                    </div>
                  </div>

                  {/* Pending */}
                  <div className="bg-white p-3 rounded-xl border border-[#E5E1F0] shadow-2xs">
                    <span className="text-[10px] font-semibold text-[#C2410C] block">
                      Pending
                    </span>
                    <div className="text-xs sm:text-sm font-black text-[#C2410C] tabular-nums mt-0.5">
                      {formatCurrency(projectPendingBalance)}
                    </div>
                  </div>
                </div>

                {/* Target Delivery Due Date */}
                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#E5E1F0]">
                  <span className="text-[#6B7280] flex items-center gap-1.5 text-xs">
                    <Calendar size={13} className="text-[#5B4CF5]" />
                    <span>Target Delivery Date:</span>
                  </span>
                  <span className="font-bold text-[#1A085C] text-xs">
                    {formatISTDate(project.targetDate)}
                  </span>
                </div>

                {/* Project Scope / Description */}
                {project.description && (
                  <div className="bg-white p-3.5 rounded-xl border border-[#E5E1F0] space-y-1.5">
                    <span className="text-[10px] font-bold text-[#1A085C] uppercase tracking-wider block">
                      Scope of Work &amp; Brief
                    </span>
                    <div className="text-xs text-[#4B5563] leading-relaxed whitespace-pre-wrap">
                      {project.description}
                    </div>
                  </div>
                )}
              </div>

              {/* ========================================================= */}
              {/* 3. TABS: DELIVERABLES & TASKS vs MILESTONE BILLING        */}
              {/* ========================================================= */}
              <div className="space-y-3 pt-1">
                {/* Progress Bar Summary */}
                <div className="bg-white rounded-xl p-3 border border-[#E5E1F0] space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1A085C]">Sprint Execution Progress</span>
                    <span className="font-bold text-[#5B4CF5] tabular-nums">
                      {completedTasksCount} / {totalTasksCount} tasks ({progressPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#FAF9FD] rounded-full overflow-hidden border border-[#E5E1F0]">
                    <div
                      className="h-full bg-gradient-to-r from-[#5B4CF5] to-[#E85AA0] transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Tab Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveDrawerTab('tasks')}
                    style={
                      activeDrawerTab === 'tasks'
                        ? {
                            background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                            color: '#FFFFFF',
                            boxShadow: '0 2px 10px rgba(91,76,245,0.25)',
                          }
                        : undefined
                    }
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeDrawerTab === 'tasks'
                        ? 'text-white'
                        : 'bg-white border border-[#E5E1F0] text-[#6B7280] hover:text-[#5B4CF5]'
                    }`}
                  >
                    <CheckSquare size={13} />
                    <span>Tasks &amp; Milestones ({totalTasksCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveDrawerTab('billing')}
                    style={
                      activeDrawerTab === 'billing'
                        ? {
                            background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                            color: '#FFFFFF',
                            boxShadow: '0 2px 10px rgba(91,76,245,0.25)',
                          }
                        : undefined
                    }
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeDrawerTab === 'billing'
                        ? 'text-white'
                        : 'bg-white border border-[#E5E1F0] text-[#6B7280] hover:text-[#5B4CF5]'
                    }`}
                  >
                    <Receipt size={13} />
                    <span>Billing Invoices ({projectPayments.length})</span>
                  </button>
                </div>

                {/* TAB 1: Tasks Management */}
                {activeDrawerTab === 'tasks' ? (
                  <div className="space-y-3 pt-1">
                    {/* Task Filter Chips */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <button
                        onClick={() => setTaskFilter('all')}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                          taskFilter === 'all'
                            ? 'bg-[#5B4CF5] text-white'
                            : 'bg-[#FAF9FD] text-[#6B7280] border border-[#E5E1F0] hover:text-[#1A085C]'
                        }`}
                      >
                        All ({totalTasksCount})
                      </button>
                      <button
                        onClick={() => setTaskFilter('active')}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                          taskFilter === 'active'
                            ? 'bg-[#5B4CF5] text-white'
                            : 'bg-[#FAF9FD] text-[#6B7280] border border-[#E5E1F0] hover:text-[#1A085C]'
                        }`}
                      >
                        In Progress ({totalTasksCount - completedTasksCount})
                      </button>
                      <button
                        onClick={() => setTaskFilter('completed')}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                          taskFilter === 'completed'
                            ? 'bg-[#5B4CF5] text-white'
                            : 'bg-[#FAF9FD] text-[#6B7280] border border-[#E5E1F0] hover:text-[#1A085C]'
                        }`}
                      >
                        Completed ({completedTasksCount})
                      </button>
                    </div>

                    {/* Inline Add Task Form */}
                    <form onSubmit={handleAddTask} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Add engineering task or deliverable..."
                        className="flex-1 h-9 px-3 text-xs border border-[#E5E1F0] bg-white rounded-xl focus:border-[#5B4CF5] focus:outline-none"
                      />
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                        className="h-9 px-2 text-xs border border-[#E5E1F0] rounded-xl bg-white text-[#1A085C] focus:border-[#5B4CF5] focus:outline-none capitalize font-semibold cursor-pointer"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                      <button
                        type="submit"
                        disabled={isAddingTask || !newTaskTitle.trim()}
                        className="h-9 px-3.5 rounded-xl bg-[#5B4CF5] hover:bg-[#4C3DE0] text-white text-xs font-bold flex items-center gap-1 shrink-0 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        {isAddingTask ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Plus size={13} className="stroke-[2.5]" />
                        )}
                        <span>Add</span>
                      </button>
                    </form>

                    {/* Task List */}
                    <div className="space-y-2 mt-2">
                      {filteredTasks.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[#6B7280] border border-dashed border-[#E5E1F0] rounded-2xl bg-[#FAF9FD]">
                          No deliverables found in this view. Add a task above to track execution.
                        </div>
                      ) : (
                        filteredTasks.map((task) => {
                          const isDone = task.status === 'done';
                          return (
                            <div
                              key={task.id}
                              className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                                isDone
                                  ? 'bg-[#FAF9FD] border-[#E5E1F0] text-[#9CA3AF] opacity-80'
                                  : 'bg-white border-[#E5E1F0] hover:border-[#5B4CF5]/40 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleTaskStatus(task)}
                                  className={`mt-0.5 transition-colors cursor-pointer ${
                                    isDone ? 'text-green-600' : 'text-[#9CA3AF] hover:text-[#5B4CF5]'
                                  }`}
                                  aria-label={isDone ? 'Mark as todo' : 'Mark as done'}
                                >
                                  {isDone ? (
                                    <CheckCircle2 size={16} className="fill-green-100" />
                                  ) : (
                                    <Circle size={16} />
                                  )}
                                </button>
                                <div className="min-w-0">
                                  <span
                                    className={`text-xs font-semibold block break-words ${
                                      isDone ? 'line-through text-[#9CA3AF]' : 'text-[#1A085C]'
                                    }`}
                                  >
                                    {task.title}
                                  </span>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span
                                      className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-md uppercase border ${
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
                                      <span className="text-[10px] text-[#9CA3AF] flex items-center gap-0.5">
                                        <Clock size={10} />
                                        <span>Done {new Date(task.completedAt).toLocaleDateString()}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-[#9CA3AF] hover:text-rose-600 p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
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
                  /* TAB 2: Milestone Billing */
                  <div className="space-y-3 pt-1">
                    {/* Add Milestone Invoice Button */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1A085C]">
                        Milestone Invoices
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCreatePaymentOpen(true)}
                        style={{
                          background: 'linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%)',
                          boxShadow: '0 2px 8px rgba(91,76,245,0.25)',
                          color: '#FFFFFF',
                        }}
                        className="text-xs py-1 px-3 rounded-full font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} className="stroke-[2.5]" />
                        <span>Add Milestone</span>
                      </button>
                    </div>

                    {/* Milestone List */}
                    {isPaymentsLoading ? (
                      <div className="py-8 flex justify-center">
                        <Loader2 size={20} className="animate-spin text-[#5B4CF5]" />
                      </div>
                    ) : projectPayments.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#6B7280] border border-dashed border-[#E5E1F0] rounded-2xl bg-[#FAF9FD]">
                        No milestone payments added yet. Click &quot;Add Milestone&quot; to set up billing.
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
                              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                                isPaid
                                  ? 'bg-[#F0FDF4] border-green-200'
                                  : 'bg-white border-[#E5E1F0] shadow-2xs'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-[#1A085C]">
                                    {py.title}
                                  </span>
                                  {isPaid ? (
                                    <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-green-100 text-green-800">
                                      Paid
                                    </span>
                                  ) : isOverdue ? (
                                    <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-red-100 text-red-800">
                                      Overdue
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-100 text-amber-800">
                                      Pending
                                    </span>
                                  )}
                                </div>

                                <div className="text-[10.5px] text-[#6B7280] mt-0.5 flex items-center gap-3">
                                  {py.invoiceNumber && <span>Inv: {py.invoiceNumber}</span>}
                                  {py.dueDate && (
                                    <span>Due: {new Date(py.dueDate).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                  <div className="text-xs font-black text-[#1A085C] tabular-nums">
                                    {formatCurrency(py.amount)}
                                  </div>
                                </div>

                                {!isPaid && (
                                  <button
                                    type="button"
                                    onClick={() => setRecordPaymentTarget(py)}
                                    className="px-2.5 py-1 rounded-lg bg-[#5B4CF5] text-white text-[11px] font-bold hover:bg-[#4C3DE0] flex items-center gap-1 cursor-pointer shadow-2xs"
                                  >
                                    <CheckCircle2 size={12} />
                                    <span>Mark Paid</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(py.id)}
                                  className="p-1 text-[#9CA3AF] hover:text-rose-600 rounded-lg cursor-pointer"
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
              </div>
            </>
          )}
        </div>

        {/* Bottom Drawer Footer */}
        <div className="p-4 border-t border-[#E5E1F0] bg-[#FAF9FD] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#6B7280]">
            Project ID: <strong className="text-[#1A085C] font-mono">{projectId.slice(0, 10)}...</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white border border-[#E5E1F0] hover:bg-[#F3F0FF] text-[#1A085C] hover:text-[#5B4CF5] text-xs font-bold transition-colors cursor-pointer shadow-2xs"
          >
            Close Workspace
          </button>
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
    </>
  );
};
