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
  serviceNeeded: z.string().nullable().optional(),
  budget: z.string().nullable().optional(),
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
    serviceNeeded: z.string().trim().optional(),
    budget: z.string().trim().optional(),
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
  pageSize: z.coerce.number().int().positive().max(50).default(20),
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
