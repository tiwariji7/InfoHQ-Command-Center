import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { AuthUser } from '@infohq/shared';

export interface Bindings {
  DB: D1Database;
  FILES?: R2Bucket;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  SUPERADMIN_CLERK_USER_ID: string;
  INTAKE_SECRET?: string;
}

export interface Variables {
  user: AuthUser;
}

export interface AppContext {
  Bindings: Bindings;
  Variables: Variables;
}
