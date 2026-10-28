import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const UserRoleSchema = z.enum(['superadmin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(['active', 'suspended']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  clerkUserId: z.string(),
  email: z.string().nullable().optional(),
  role: UserRoleSchema,
  status: UserStatusSchema,
});

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const MeResponseSchema = z.object({
  authenticated: z.literal(true),
  user: AuthUserSchema,
});

export type MeResponse = z.infer<typeof MeResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// --- Leads Core Data Models ---

export const LeadStageSchema = z.enum([
  'new',
  'contacted',
  'proposal_sent',
  'won',
  'lost',
]);
export type LeadStage = z.infer<typeof LeadStageSchema>;

export const LeadSourceSchema = z.enum([
  'website_contact',
  'whatsapp_click',
  'linkedin',
  'referral',
  'phone_call',
  'other',
]);
export type LeadSource = z.infer<typeof LeadSourceSchema>;

export const LeadSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  serviceNeeded: z.string().nullable().optional(),
  budget: z.string().nullable().optional(),
  timeline: z.string().nullable().optional(),
  preferredContact: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  source: LeadSourceSchema,
  stage: LeadStageSchema,
  lostReason: z.string().nullable().optional(),
  nextFollowUpAt: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Lead = z.infer<typeof LeadSchema>;

export const CreateLeadSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().trim().optional().or(z.literal('')),
    company: z.string().trim().optional(),
    serviceNeeded: z.string().trim().optional(),
    budget: z.string().trim().optional(),
    timeline: z.string().trim().optional(),
    preferredContact: z.string().trim().optional(),
    message: z.string().trim().optional(),
    source: LeadSourceSchema.default('other'),
    stage: LeadStageSchema.default('new'),
    nextFollowUpAt: z.number().nullable().optional(),
    confirmDuplicate: z.boolean().default(false),
  })
  .refine(
    (data) => Boolean((data.email && data.email.length > 0) || (data.phone && data.phone.length > 0)),
    {
      message: 'At least one of Email or Phone is required.',
      path: ['email'],
    }
  );

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadStageSchema = z.object({
  stage: LeadStageSchema,
  lostReason: z.string().trim().optional(),
});

export type UpdateLeadStageInput = z.infer<typeof UpdateLeadStageSchema>;

export const CreateLeadNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note content cannot be empty'),
});

export type CreateLeadNoteInput = z.infer<typeof CreateLeadNoteSchema>;

export const SetFollowUpSchema = z.object({
  nextFollowUpAt: z.number().nullable(),
});

export type SetFollowUpInput = z.infer<typeof SetFollowUpSchema>;

export interface LeadDetailResponse {
  lead: Lead;
  activities: LeadActivity[];
  notes: LeadNote[];
}

export const LeadActivitySchema = z.object({
  id: z.string(),
  leadId: z.string(),
  actorClerkUserId: z.string(),
  activityType: z.string(),
  summary: z.string(),
  beforeJson: z.string().nullable().optional(),
  afterJson: z.string().nullable().optional(),
  createdAt: z.number(),
});

export type LeadActivity = z.infer<typeof LeadActivitySchema>;

export const LeadNoteSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  body: z.string().min(1),
  createdByClerkUserId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type LeadNote = z.infer<typeof LeadNoteSchema>;

export const LeadListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  stage: LeadStageSchema.optional(),
  source: LeadSourceSchema.optional(),
  search: z.string().trim().optional(),
});

export type LeadListQuery = z.infer<typeof LeadListQuerySchema>;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  matches: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    stage: LeadStage;
  }>;
}

// --- Projects & Tasks Data Models ---

export const ProjectStatusSchema = z.enum([
  'planning',
  'in_progress',
  'review',
  'completed',
  'on_hold',
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const TaskStatusSchema = z.enum([
  'todo',
  'in_progress',
  'done',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum([
  'low',
  'medium',
  'high',
  'urgent',
]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const ProjectTaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema.optional(),
  dueDate: z.number().nullable().optional(),
  completedAt: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ProjectTask = z.infer<typeof ProjectTaskSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  leadId: z.string().nullable().optional(),
  title: z.string().min(1),
  clientName: z.string().min(1),
  clientEmail: z.string().nullable().optional(),
  clientPhone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  serviceType: z.string().optional(),
  budget: z.string().nullable().optional(),
  status: ProjectStatusSchema,
  startDate: z.number().nullable().optional(),
  targetDate: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  totalTasks: z.number().optional(),
  completedTasks: z.number().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = z.object({
  leadId: z.string().trim().optional(),
  title: z.string().trim().min(1, 'Project title is required'),
  clientName: z.string().trim().min(1, 'Client name is required'),
  clientEmail: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  clientPhone: z.string().trim().optional().or(z.literal('')),
  company: z.string().trim().optional(),
  serviceType: z.string().trim().optional(),
  budget: z.string().trim().optional(),
  status: ProjectStatusSchema.default('in_progress'),
  startDate: z.number().nullable().optional(),
  targetDate: z.number().nullable().optional(),
  description: z.string().trim().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  title: z.string().trim().min(1).optional(),
  clientName: z.string().trim().min(1).optional(),
  clientEmail: z.string().trim().email().optional().or(z.literal('')),
  clientPhone: z.string().trim().optional().or(z.literal('')),
  company: z.string().trim().optional(),
  serviceType: z.string().trim().optional(),
  budget: z.string().trim().optional(),
  status: ProjectStatusSchema.optional(),
  startDate: z.number().nullable().optional(),
  targetDate: z.number().nullable().optional(),
  description: z.string().trim().optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required'),
  description: z.string().trim().optional(),
  status: TaskStatusSchema.default('todo'),
  priority: TaskPrioritySchema.default('medium').optional(),
  dueDate: z.number().nullable().optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  dueDate: z.number().nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export interface ProjectDetailResponse {
  project: Project;
  tasks: ProjectTask[];
}

// --- Payments & Milestone Billing Data Models ---

export const PaymentStatusSchema = z.enum([
  'pending',
  'received',
  'failed',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PaymentMethodSchema = z.enum([
  'bank_transfer',
  'upi',
  'stripe',
  'cash',
  'other',
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  leadId: z.string().nullable().optional(),
  title: z.string().optional(),
  amount: z.number(),
  currency: z.string().default('INR'),
  status: PaymentStatusSchema,
  paymentMethod: PaymentMethodSchema.nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  dueDate: z.number().nullable().optional(),
  paidAt: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
  // Joined details for list display
  projectTitle: z.string().optional(),
  clientName: z.string().optional(),
  company: z.string().nullable().optional(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const CreatePaymentSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  title: z.string().trim().optional(),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  currency: z.string().trim().default('INR'),
  invoiceNumber: z.string().trim().optional(),
  dueDate: z.number().nullable().optional(),
  notes: z.string().trim().optional(),
});
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

export const UpdatePaymentSchema = z.object({
  title: z.string().trim().optional(),
  amount: z.coerce.number().positive().optional(),
  currency: z.string().trim().optional(),
  status: PaymentStatusSchema.optional(),
  invoiceNumber: z.string().trim().optional(),
  dueDate: z.number().nullable().optional(),
  notes: z.string().trim().optional(),
});
export type UpdatePaymentInput = z.infer<typeof UpdatePaymentSchema>;

export const RecordPaymentSchema = z.object({
  paymentMethod: PaymentMethodSchema.default('bank_transfer').optional(),
  notes: z.string().trim().optional(),
  paidAt: z.number().default(() => Date.now()),
});
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

export interface PaymentSummary {
  totalInvoiced: number;
  totalCollected: number;
  totalPending: number;
  overdueCount: number;
}

export interface PaymentListResponse {
  payments: Payment[];
  summary: PaymentSummary;
}

// --- Dashboard & Analytics Models ---

export interface DashboardMetrics {
  totalLeads: number;
  newLeadsThisWeek: number;
  leadsByStage: {
    new: number;
    contacted: number;
    proposal_sent: number;
    won: number;
    lost: number;
  };
  followUpsDueTodayCount: number;
  activeProjectsCount: number;
  completedProjectsCount: number;
  totalInvoiced: number;
  totalCollected: number;
  totalPending: number;
}

export interface UrgentFollowUpItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: LeadStage;
  nextFollowUpAt: number;
}

export interface RecentProjectItem {
  id: string;
  title: string;
  clientName: string;
  status: ProjectStatus;
  budget: string | null;
  deadline: number | null;
  totalTasks: number;
  completedTasks: number;
}

export interface RecentPaymentItem {
  id: string;
  projectId: string;
  title: string;
  amount: number;
  status: PaymentStatus;
  invoiceNumber: string | null;
  clientName: string | null;
  createdAt: number;
}

export interface DashboardOverviewResponse {
  metrics: DashboardMetrics;
  urgentFollowUps: UrgentFollowUpItem[];
  recentProjects: RecentProjectItem[];
  recentPayments: RecentPaymentItem[];
}




// --- Automations, Cron & Alert Models ---

export const AutomationJobTypeSchema = z.enum([
  'daily_briefing',
  'lead_followup_check',
  'overdue_invoice_check',
  'stale_lead_check',
  'system',
]);
export type AutomationJobType = z.infer<typeof AutomationJobTypeSchema>;

export const AlertTypeSchema = z.enum([
  'followup_due',
  'invoice_overdue',
  'invoice_upcoming',
  'stale_lead',
  'milestone_deadline',
  'system',
]);
export type AlertType = z.infer<typeof AlertTypeSchema>;

export const AlertSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

export interface AutomationLog {
  id: string;
  jobType: AutomationJobType;
  status: 'success' | 'partial' | 'failed';
  summary: string;
  detailsJson?: string | null;
  createdAt: number;
}

export interface AutomationAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  link?: string | null;
  isRead: boolean;
  metadataJson?: string | null;
  createdAt: number;
}

export interface MorningBriefingDigest {
  generatedAt: number;
  greeting: string;
  summary: {
    newLeads24h: number;
    dueFollowUpsCount: number;
    staleLeadsCount: number;
    overdueInvoicesCount: number;
    overdueInvoicesTotal: number;
    pendingInvoicesTotal: number;
    upcomingDeadlinesCount: number;
  };
  dueFollowUps: Array<{
    leadId: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    serviceNeeded?: string | null;
    nextFollowUpAt: number;
    isOverdue: boolean;
  }>;
  overdueInvoices: Array<{
    paymentId: string;
    invoiceNumber: string | null;
    clientName: string;
    amount: number;
    dueDate?: number | null;
  }>;
  upcomingDeadlines: Array<{
    projectId: string;
    title: string;
    clientName: string;
    deadline: number;
  }>;
  recentAlerts: AutomationAlert[];
  latestCronLog?: AutomationLog | null;
}
