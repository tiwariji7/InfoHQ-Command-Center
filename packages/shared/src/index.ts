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
