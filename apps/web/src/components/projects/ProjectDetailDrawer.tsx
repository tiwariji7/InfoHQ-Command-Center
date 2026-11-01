import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Clock,
  Briefcase,
  Receipt,
  Building2,
  User,
  Users,
  ChevronDown,
  GripHorizontal,
} from 'lucide-react';
import { useDraggable } from '../../lib/useDraggable.js';
import { CreatePaymentModal } from '../payments/CreatePaymentModal.js';
import { RecordPaymentModal } from '../payments/RecordPaymentModal.js';

interface ProjectDetailDrawerProps {
  projectId: string | null;
  onClose: () => void;
  onProjectUpdated: (project: Project) => void;
}

type TabType = 'overview' | 'tasks' | 'invoices' | 'team';
type TaskFilter = 'all' | 'active' | 'completed';

export const ProjectDetailDrawer: React.FC<ProjectDetailDrawerProps> = ({
  projectId,
  onClose,
  onProjectUpdated,
}) => {
  const { getToken } = useAuth();

  const [projectData, setProjectData] = useState<ProjectDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drawer Tabs: Overview, Tasks, Invoices, Team
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { position, handlePointerDown, resetPosition } = useDraggable('project_detail_drawer');

  // Tasks state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');

  // Billing & Payments state
  const [projectPayments, setProjectPayments] = useState<Payment[]>([]);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);
  const [isCreatePaymentOpen, setIsCreatePaymentOpen] = useState(false);
  const [recordPaymentTarget, setRecordPaymentTarget] = useState<Payment | null>(null);

  // Status updating state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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

  // Derived values (Always declared unconditionally before any early return)
  const project = projectData?.project;
  const tasks = useMemo(() => projectData?.tasks || [], [projectData]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'active') return tasks.filter((t) => t.status !== 'done');
    if (taskFilter === 'completed') return tasks.filter((t) => t.status === 'done');
    return tasks;
  }, [tasks, taskFilter]);

  const totalTasksCount = tasks.length;
  const completedTasksCount = useMemo(
    () => tasks.filter((t) => t.status === 'done').length,
    [tasks]
  );
  const progressPercent =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Financial summary
  const { totalInvoiced, totalCollected, pendingBalance } = useMemo(() => {
    let inv = 0;
    let col = 0;
    for (const py of projectPayments) {
      if (py.status !== 'failed') inv += py.amount;
      if (py.status === 'received') col += py.amount;
    }
    return {
      totalInvoiced: inv,
      totalCollected: col,
      pendingBalance: inv - col,
    };
  }, [projectPayments]);

  // Early return if no project is selected
  if (!projectId) return null;

  const getMonogram = (name?: string) => {
    if (!name) return 'HQ';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

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

  // Status text indicator - NO PILL CONTAINER
  const renderStatusText = (status?: Project['status']) => {
    switch (status) {
      case 'in_progress':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#16A34A]">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            <span>In Progress</span>
          </div>
        );
      case 'review':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#D97706]">
            <span className="w-2 h-2 rounded-full bg-[#D97706]" />
            <span>QA &amp; Review</span>
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#16A34A]">
            <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
            <span>Completed</span>
          </div>
        );
      case 'on_hold':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E11D48]">
            <span className="w-2 h-2 rounded-full bg-[#E11D48]" />
            <span>On Hold</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5B4CF5]">
            <span className="w-2 h-2 rounded-full bg-[#5B4CF5]" />
            <span>Planning</span>
          </div>
        );
    }
  };

  // Status update handler
  const handleStatusChange = async (newStatus: Project['status']) => {
    if (!project || isUpdatingStatus) return;
    const previousStatus = project.status;
    setIsUpdatingStatus(true);

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
    } finally {
      setIsUpdatingStatus(false);
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
        `Hi ${project?.clientName || 'there'}, regarding your ${project?.serviceType || 'engineering'} project with InfoHQ...`
      )}`
    : null;

  const mailtoUrl = project?.clientEmail
    ? `mailto:${project.clientEmail}?subject=${encodeURIComponent(
        `[InfoHQ Project] ${project?.title || 'Project Update'}`
      )}`
    : null;

  return (
    <>
      {/* Outer Modal Container (Matches Payment page Client Profile size exactly, rounded-3xl, centered/right-docked) */}
      <div
        className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end items-center sm:pr-5 p-3 transition-opacity animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        data-lenis-prevent="true"
        onClick={onClose}
      >
        {/* Floating Popup Card (Compact popup feel, rounded-3xl, not full page height, draggable anywhere) */}
        <div
          className="popup-card w-full sm:w-[420px] max-w-[420px] h-[calc(100vh-2.5rem)] max-h-[820px] bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(26,8,92,0.30)] border border-[#E5E1F0] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
          style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
          data-lenis-prevent="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ========================================================= */}
          {/* 1. TOP TITLE BAR (Pinned at top & Draggable Handle)       */}
          {/* ========================================================= */}
          <div
            onPointerDown={handlePointerDown}
            onDoubleClick={resetPosition}
            className="px-4 py-3 border-b border-[#E5E1F0] flex items-center justify-between bg-white shrink-0 z-20 cursor-grab active:cursor-grabbing select-none"
            title="Click and drag to move card anywhere • Double-click to reset position"
          >
            <div className="flex items-center gap-2 text-[#1A085C]">
              <button
                onClick={onClose}
                data-no-drag="true"
                className="p-1 -ml-1 text-[#6B7280] hover:text-[#1A085C] rounded-md transition-colors cursor-pointer"
                title="Back"
              >
                <Briefcase size={15} className="text-[#5B4CF5]" />
              </button>
              <h2 className="text-xs font-bold text-[#1A085C] tracking-tight">Project Details</h2>
            </div>

            {/* Drag Handle Indicator */}
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F3F0FF]/80 text-[#7C5CE8] text-[10px] font-semibold"
              title="Drag to move card"
            >
              <GripHorizontal size={14} />
              <span className="hidden sm:inline">Move</span>
            </div>

            <button
              onClick={onClose}
              data-no-drag="true"
              className="w-7 h-7 rounded-lg text-[#6B7280] hover:text-[#1A085C] hover:bg-[#F3F0FF] flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* ========================================================= */}
          {/* SCROLLABLE BODY (Scrollable on cursor hover across card)   */}
          {/* ========================================================= */}
          <div
            className="flex-1 min-h-0 overflow-y-auto popup-scroll flex flex-col focus:outline-none"
            data-lenis-prevent="true"
            tabIndex={0}
          >
          {/* 2. PROFILE HERO HEADER (Avatar, Title, Contact Pills)     */}
          <div className="p-4 bg-gradient-to-b from-[#FBFBFE] to-white border-b border-[#E5E1F0] shrink-0">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5B4CF5] to-[#7C5CE8] text-white font-black text-sm flex items-center justify-center shadow-md shrink-0">
                {getMonogram(project?.clientName || project?.title)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-[#1A085C] tracking-tight truncate">
                    {project?.clientName || project?.title || 'Project Dossier'}
                  </h3>
                  {renderStatusText(project?.status)}
                </div>

                <div className="text-[11px] text-[#6B7280] font-medium truncate mt-0.5">
                  {project?.title}
                </div>

                <div className="text-[11px] text-[#6B7280] flex items-center gap-2 mt-0.5 truncate">
                  {project?.clientEmail && <span className="truncate">{project.clientEmail}</span>}
                  {project?.clientPhone && <span>{project.clientPhone}</span>}
                </div>
              </div>
            </div>

            {/* Quick Action Contact Pills (Call, WhatsApp, Email - strictly 3 pills, NO 3-dots) */}
            <div className="grid grid-cols-3 gap-2 mt-3.5">
              {project?.clientPhone ? (
                <a
                  href={`tel:${project.clientPhone}`}
                  className="h-9 px-3 rounded-full bg-white hover:bg-purple-50 border border-[#E5E1F0] hover:border-[#5B4CF5] text-[#1A085C] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                >
                  <Phone size={13} className="text-[#5B4CF5] group-hover:scale-110 transition-transform" />
                  <span>Call</span>
                </a>
              ) : (
                <div className="h-9 px-3 rounded-full bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#E5E1F0]">
                  <Phone size={13} />
                  <span>Call</span>
                </div>
              )}

              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-3 rounded-full bg-white hover:bg-emerald-50 border border-[#E5E1F0] hover:border-emerald-500 text-[#1A085C] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                >
                  <MessageCircle size={13} className="text-[#10B981] group-hover:scale-110 transition-transform" />
                  <span>WhatsApp</span>
                </a>
              ) : (
                <div className="h-9 px-3 rounded-full bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#E5E1F0]">
                  <MessageCircle size={13} />
                  <span>WhatsApp</span>
                </div>
              )}

              {mailtoUrl ? (
                <a
                  href={mailtoUrl}
                  className="h-9 px-3 rounded-full bg-white hover:bg-blue-50 border border-[#E5E1F0] hover:border-blue-500 text-[#1A085C] text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer group"
                >
                  <Mail size={13} className="text-[#3B82F6] group-hover:scale-110 transition-transform" />
                  <span>Email</span>
                </a>
              ) : (
                <div className="h-9 px-3 rounded-full bg-[#FAF9FD] text-[#9CA3AF] text-xs font-medium flex items-center justify-center gap-1.5 border border-[#E5E1F0]">
                  <Mail size={13} />
                  <span>No Email</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. TABS BAR (Sticky at top when scrolling) */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-xs z-10 px-4 pt-2 border-b border-[#E5E1F0]">
            <div className="flex items-center justify-between text-xs">
              {(['overview', 'tasks', 'invoices', 'team'] as const).map((tab) => {
                const isActive = activeTab === tab;
                const labels: Record<TabType, string> = {
                  overview: 'Overview',
                  tasks: `Tasks (${totalTasksCount})`,
                  invoices: `Invoices (${projectPayments.length})`,
                  team: 'Team',
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 px-1 text-xs font-semibold capitalize transition-all cursor-pointer border-b-2 ${
                      isActive
                        ? 'border-[#5B4CF5] text-[#5B4CF5] font-bold'
                        : 'border-transparent text-[#6B7280] hover:text-[#1A085C]'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. SCROLLABLE TAB PANELS CONTENT */}
          <div className="p-4 space-y-3.5 text-xs flex-1">
          {isLoading && !project && (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-[#6B7280]">
              <Loader2 size={24} className="animate-spin text-[#5B4CF5]" />
              <span className="font-semibold text-xs">Loading project details...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-rose-600 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {project && (
            <>
              {/* ========================================================= */}
              {/* TAB 1: OVERVIEW                                           */}
              {/* ========================================================= */}
              {activeTab === 'overview' && (
                <>
                  {/* Card 1: Project Information */}
                  <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2.5">
                    <div className="text-xs font-bold text-[#1A085C] flex items-center gap-1.5">
                      <Briefcase size={13} className="text-[#5B4CF5]" />
                      <span>Project Information</span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-[#F0EDF9]">
                        <span className="text-[#6B7280] flex items-center gap-1.5">
                          <User size={12} className="text-[#9CA3AF]" />
                          <span>Client</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#1A085C] truncate max-w-[150px]">
                            {project.clientName}
                          </span>
                          {project.clientId && (
                            <span className="font-mono text-[9.5px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                              {project.clientId}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-[#F0EDF9]">
                        <span className="text-[#6B7280] flex items-center gap-1.5">
                          <Building2 size={12} className="text-[#9CA3AF]" />
                          <span>Company</span>
                        </span>
                        <span className="font-semibold text-[#1A085C] truncate max-w-[200px]">
                          {project.company || 'Direct Client'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-[#F0EDF9]">
                        <span className="text-[#6B7280] flex items-center gap-1.5">
                          <Briefcase size={12} className="text-[#9CA3AF]" />
                          <span>Service</span>
                        </span>
                        <span className="font-semibold text-[#5B4CF5]">
                          {project.serviceType || 'Engineering'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-[#F0EDF9]">
                        <span className="text-[#6B7280] flex items-center gap-1.5">
                          <Calendar size={12} className="text-[#9CA3AF]" />
                          <span>Target Delivery</span>
                        </span>
                        <span className="font-semibold text-[#1A085C]">
                          {formatISTDate(project.targetDate)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#6B7280] flex items-center gap-1.5">
                          <Receipt size={12} className="text-[#9CA3AF]" />
                          <span>Project ID</span>
                        </span>
                        <span className="font-mono font-bold text-[#1A085C]">
                          PRJ-{project.id.slice(-4).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Performance & Financial Overview */}
                  <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2.5">
                    <div className="text-xs font-bold text-[#1A085C]">
                      Performance Overview
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-white border border-[#E5E1F0]">
                        <span className="text-[10px] text-[#6B7280] block font-medium">Invoiced</span>
                        <span className="text-sm font-black text-[#1A085C] tabular-nums mt-0.5 block">
                          {formatCurrency(totalInvoiced)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-[#E5E1F0]">
                        <span className="text-[10px] text-[#6B7280] block font-medium">Collected</span>
                        <span className="text-sm font-black text-[#16A34A] tabular-nums mt-0.5 block">
                          {formatCurrency(totalCollected)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-[#E5E1F0]">
                        <span className="text-[10px] text-[#6B7280] block font-medium">Outstanding</span>
                        <span className="text-sm font-black text-[#D97706] tabular-nums mt-0.5 block">
                          {formatCurrency(pendingBalance)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-[#E5E1F0]">
                        <span className="text-[10px] text-[#6B7280] block font-medium">Tasks Done</span>
                        <span className="text-sm font-black text-[#5B4CF5] tabular-nums mt-0.5 block">
                          {completedTasksCount} / {totalTasksCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Sprint Execution Progress Bar */}
                  <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#1A085C]">Execution Progress</span>
                      <span className="font-black text-[#5B4CF5] tabular-nums">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-[#E5E1F0]">
                      <div
                        className="h-full bg-gradient-to-r from-[#5B4CF5] to-[#7C5CE8] transition-all duration-300 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Card 4: Scope / Brief (if any) */}
                  {project.description && (
                    <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-1.5">
                      <div className="text-xs font-bold text-[#1A085C]">Scope of Work &amp; Brief</div>
                      <div className="text-xs text-[#4B5563] leading-relaxed whitespace-pre-wrap">
                        {project.description}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ========================================================= */}
              {/* TAB 2: TASKS                                              */}
              {/* ========================================================= */}
              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  {/* Task Filter Chips */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
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
                      type="button"
                      onClick={() => setTaskFilter('active')}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                        taskFilter === 'active'
                          ? 'bg-[#5B4CF5] text-white'
                          : 'bg-[#FAF9FD] text-[#6B7280] border border-[#E5E1F0] hover:text-[#1A085C]'
                      }`}
                    >
                      Active ({totalTasksCount - completedTasksCount})
                    </button>
                    <button
                      type="button"
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

                  {/* Add Task Form */}
                  <form onSubmit={handleAddTask} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      required
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Add sprint task..."
                      className="flex-1 h-8 px-2.5 text-xs border border-[#E5E1F0] bg-white rounded-xl focus:border-[#5B4CF5] focus:outline-none"
                    />
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                      className="h-8 px-1.5 text-xs border border-[#E5E1F0] rounded-xl bg-white text-[#1A085C] focus:border-[#5B4CF5] focus:outline-none font-semibold cursor-pointer"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isAddingTask || !newTaskTitle.trim()}
                      className="h-8 px-3 rounded-xl bg-[#5B4CF5] hover:bg-[#4C3DE0] text-white text-xs font-bold flex items-center gap-1 shrink-0 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                      {isAddingTask ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Plus size={12} className="stroke-[2.5]" />
                      )}
                      <span>Add</span>
                    </button>
                  </form>

                  {/* Task Items List */}
                  <div className="space-y-2">
                    {filteredTasks.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#6B7280] border border-dashed border-[#E5E1F0] rounded-xl bg-[#FAF9FD]">
                        No deliverables in this view.
                      </div>
                    ) : (
                      filteredTasks.map((task) => {
                        const isDone = task.status === 'done';
                        return (
                          <div
                            key={task.id}
                            className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2.5 ${
                              isDone
                                ? 'bg-[#FAF9FD] border-[#E5E1F0] text-[#9CA3AF] opacity-80'
                                : 'bg-white border-[#E5E1F0] hover:border-[#5B4CF5]/40 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-start gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleTaskStatus(task)}
                                className={`mt-0.5 transition-colors cursor-pointer ${
                                  isDone ? 'text-green-600' : 'text-[#9CA3AF] hover:text-[#5B4CF5]'
                                }`}
                                aria-label={isDone ? 'Mark as todo' : 'Mark as done'}
                              >
                                {isDone ? (
                                  <CheckCircle2 size={15} className="fill-green-100" />
                                ) : (
                                  <Circle size={15} />
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
                                <div className="flex items-center gap-2 mt-0.5">
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
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 3: INVOICES (Milestone Payments)                      */}
              {/* ========================================================= */}
              {activeTab === 'invoices' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1A085C]">
                      Milestone Invoices ({projectPayments.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatePaymentOpen(true)}
                      className="text-xs py-1 px-3 rounded-full font-bold bg-[#5B4CF5] hover:bg-[#4C3DE0] text-white flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Plus size={12} className="stroke-[2.5]" />
                      <span>Create Invoice</span>
                    </button>
                  </div>

                  {isPaymentsLoading ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 size={18} className="animate-spin text-[#5B4CF5]" />
                    </div>
                  ) : projectPayments.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#6B7280] border border-dashed border-[#E5E1F0] rounded-xl bg-[#FAF9FD]">
                      No invoices recorded yet. Click &quot;Create Invoice&quot; to add one.
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
                            className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 ${
                              isPaid
                                ? 'bg-[#F0FDF4] border-green-200'
                                : 'bg-white border-[#E5E1F0] shadow-2xs'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-[#1A085C] truncate">
                                  {py.title}
                                </span>
                                {isPaid ? (
                                  <div className="flex items-center gap-1 text-[10px] font-semibold text-[#16A34A]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                                    <span>Received</span>
                                  </div>
                                ) : isOverdue ? (
                                  <div className="flex items-center gap-1 text-[10px] font-semibold text-[#E11D48]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48]" />
                                    <span>Overdue</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-[10px] font-semibold text-[#D97706]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                                    <span>Pending</span>
                                  </div>
                                )}
                              </div>

                              <div className="text-[10px] text-[#6B7280] mt-0.5 flex items-center gap-2">
                                {py.invoiceNumber && <span>{py.invoiceNumber}</span>}
                                {py.dueDate && (
                                  <span>Due: {new Date(py.dueDate).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-black text-[#1A085C] tabular-nums">
                                {formatCurrency(py.amount)}
                              </span>

                              {!isPaid && (
                                <button
                                  type="button"
                                  onClick={() => setRecordPaymentTarget(py)}
                                  className="px-2 py-0.5 rounded-lg bg-[#5B4CF5] text-white text-[10.5px] font-bold hover:bg-[#4C3DE0] flex items-center gap-1 cursor-pointer shadow-2xs"
                                >
                                  <CheckCircle2 size={11} />
                                  <span>Paid</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeletePayment(py.id)}
                                className="p-1 text-[#9CA3AF] hover:text-rose-600 rounded-lg cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 4: TEAM & REPOSITORY                                  */}
              {/* ========================================================= */}
              {activeTab === 'team' && (
                <div className="space-y-3">
                  <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2.5">
                    <div className="text-xs font-bold text-[#1A085C] flex items-center gap-1.5">
                      <Users size={13} className="text-[#5B4CF5]" />
                      <span>Assigned Engineering Squad</span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E5E1F0]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#5B4CF5]/10 text-[#5B4CF5] font-bold text-[10px] flex items-center justify-center">
                            AK
                          </div>
                          <div>
                            <span className="font-semibold text-[#1A085C] block">Ankit Tiwari</span>
                            <span className="text-[10px] text-[#6B7280]">Lead Solutions Architect</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-[#16A34A]">Active</span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E5E1F0]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#7C5CE8]/10 text-[#7C5CE8] font-bold text-[10px] flex items-center justify-center">
                            SK
                          </div>
                          <div>
                            <span className="font-semibold text-[#1A085C] block">Shivam Kumar</span>
                            <span className="text-[10px] text-[#6B7280]">Full-Stack Developer</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-[#16A34A]">Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#FBFBFE] rounded-xl p-3.5 border border-[#E5E1F0] space-y-2">
                    <div className="text-xs font-bold text-[#1A085C]">Delivery Milestones</div>
                    <div className="text-[11px] text-[#6B7280] leading-relaxed">
                      Continuous delivery pipeline active with Cloudflare Pages automated branch deployment.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        </div>

        {/* ========================================================= */}
        {/* 4. BOTTOM ACTION BAR: STATUS CHANGER SELECT               */}
        {/* ========================================================= */}
        <div className="p-3.5 bg-white border-t border-[#E5E1F0] shrink-0 flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={project?.status || 'planning'}
              disabled={isUpdatingStatus || !project}
              onChange={(e) => handleStatusChange(e.target.value as Project['status'])}
              className="w-full h-10 pl-3 pr-8 rounded-full border border-[#E5E1F0] bg-[#FAF9FD] hover:bg-white text-xs font-bold text-[#1A085C] focus:border-[#5B4CF5] focus:outline-none appearance-none cursor-pointer transition-colors disabled:opacity-60"
            >
              <option value="planning">Change Status: Planning Phase</option>
              <option value="in_progress">Change Status: In Progress</option>
              <option value="review">Change Status: QA &amp; Review</option>
              <option value="completed">Change Status: Completed</option>
              <option value="on_hold">Change Status: On Hold</option>
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none"
            />
          </div>

          <button
            onClick={onClose}
            className="h-10 px-4 rounded-full bg-[#FAF9FD] hover:bg-[#F3F0FF] text-[#1A085C] border border-[#E5E1F0] text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            Done
          </button>
        </div>
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
