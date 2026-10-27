import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../src/index.js';

// Mock @clerk/backend verifyToken function
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from '@clerk/backend';

describe('InfoHQ API - Step 1 Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('returns 200 OK with safe status and version without leaking secrets', async () => {
      const res = await app.request('/api/health');
      expect(res.status).toBe(200);

      const json = await res.json() as Record<string, unknown>;
      expect(json.status).toBe('ok');
      expect(json.version).toBe('0.1.0');
      expect(typeof json.timestamp).toBe('string');

      // Verify no sensitive keys leaked
      expect(json.secretKey).toBeUndefined();
      expect(json.database).toBeUndefined();
      expect(json.env).toBeUndefined();
    });
  });

  describe('GET /api/auth/config', () => {
    it('returns client-safe publishableKey from environment and never leaks secret key', async () => {
      const mockEnv = {
        CLERK_PUBLISHABLE_KEY: 'pk_test_mock_key_123',
        CLERK_SECRET_KEY: 'sk_test_super_secret_never_leak',
      };

      const res = await app.request('/api/auth/config', undefined, mockEnv);
      expect(res.status).toBe(200);

      const json = await res.json() as Record<string, unknown>;
      expect(json.publishableKey).toBe('pk_test_mock_key_123');
      expect((json as any).CLERK_SECRET_KEY).toBeUndefined();
      expect((json as any).secretKey).toBeUndefined();
    });
  });

  describe('404 Not Found Handling', () => {
    it('returns 404 with typed error structure', async () => {
      const res = await app.request('/api/non-existent-endpoint');
      expect(res.status).toBe(404);

      const json = await res.json() as Record<string, unknown>;
      expect(json.error).toBe('not_found');
      expect(typeof json.message).toBe('string');
    });
  });

  describe('Protected Route: GET /api/me', () => {
    const mockEnv = {
      CLERK_SECRET_KEY: 'sk_test_mock_secret_key',
      CLERK_PUBLISHABLE_KEY: 'pk_test_mock_key',
      SUPERADMIN_CLERK_USER_ID: 'user_superadmin_123',
    };

    it('returns 401 when Authorization header is missing', async () => {
      const res = await app.request('/api/me', {}, mockEnv);
      expect(res.status).toBe(401);

      const json = await res.json() as Record<string, unknown>;
      expect(json.error).toBe('unauthorized');
    });

    it('returns 401 when token verification fails', async () => {
      vi.mocked(verifyToken).mockRejectedValueOnce(new Error('Invalid token'));

      const res = await app.request(
        '/api/me',
        {
          headers: {
            Authorization: 'Bearer invalid_jwt_token',
          },
        },
        mockEnv
      );

      expect(res.status).toBe(401);
      const json = await res.json() as Record<string, unknown>;
      expect(json.error).toBe('unauthorized');
    });

    it('returns 403 Forbidden when Clerk user is authenticated but not the Superadmin', async () => {
      vi.mocked(verifyToken).mockResolvedValueOnce({
        sub: 'user_unauthorized_attacker_999',
        email: 'other@example.com',
      } as any);

      const res = await app.request(
        '/api/me',
        {
          headers: {
            Authorization: 'Bearer valid_clerk_token_for_unapproved_user',
          },
        },
        mockEnv
      );

      expect(res.status).toBe(403);
      const json = await res.json() as Record<string, unknown>;
      expect(json.error).toBe('forbidden');
      expect(json.message).toContain('Superadmin');
    });

    it('returns 200 OK when Clerk user matches the allowlisted Superadmin', async () => {
      vi.mocked(verifyToken).mockResolvedValueOnce({
        sub: 'user_superadmin_123',
        email: 'superadmin@infohq.in',
      } as any);

      const res = await app.request(
        '/api/me',
        {
          headers: {
            Authorization: 'Bearer valid_clerk_token_for_superadmin',
          },
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const json = await res.json() as Record<string, unknown>;
      expect(json.authenticated).toBe(true);
      expect(json.user).toEqual({
        id: 'user_superadmin_123',
        clerkUserId: 'user_superadmin_123',
        email: 'superadmin@infohq.in',
        role: 'superadmin',
        status: 'active',
      });
    });
  });

  describe('GET /api/overview', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.request('/api/overview');
      expect(res.status).toBe(401);
    });

    it('returns dashboard overview metrics for authenticated superadmin', async () => {
      const mockEnv = {
        CLERK_SECRET_KEY: 'sk_test_super_secret',
        SUPERADMIN_CLERK_USER_ID: 'user_superadmin_123',
        DB: {
          prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              total_leads: 5,
              new_this_week: 2,
              stage_new: 1,
              stage_contacted: 2,
              stage_proposal_sent: 1,
              stage_won: 1,
              stage_lost: 0,
              follow_ups_due: 1,
              total_projects: 2,
              active_projects: 2,
              completed_projects: 0,
            }),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        },
      };

      vi.mocked(verifyToken).mockResolvedValue({
        sub: 'user_superadmin_123',
        email: 'superadmin@infohq.in',
      } as any);

      const res = await app.request(
        '/api/overview',
        {
          headers: {
            Authorization: 'Bearer valid_clerk_token_for_superadmin',
          },
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const json = await res.json() as Record<string, unknown>;
      expect(json.metrics).toBeDefined();
      expect(json.urgentFollowUps).toBeDefined();
      expect(json.recentProjects).toBeDefined();
      expect(json.recentPayments).toBeDefined();
    });
  });
});
