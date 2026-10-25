import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../src/index.js';

// Mock @clerk/backend verifyToken to authenticate as Superadmin
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from '@clerk/backend';

describe('InfoHQ API - Leads Core (Step 2)', () => {
  const superadminId = 'user_superadmin_123';
  const mockEnv = {
    CLERK_SECRET_KEY: 'sk_test_mock',
    CLERK_PUBLISHABLE_KEY: 'pk_test_mock',
    SUPERADMIN_CLERK_USER_ID: superadminId,
    DB: {} as any,
  };

  const authHeaders = {
    Authorization: 'Bearer valid_superadmin_token',
    'Content-Type': 'application/json',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyToken).mockResolvedValue({
      sub: superadminId,
      email: 'admin@infohq.in',
    } as any);
  });

  describe('POST /api/leads validation', () => {
    it('returns 400 when name is missing', async () => {
      mockEnv.DB = { prepare: vi.fn() };
      const res = await app.request(
        '/api/leads',
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ email: 'test@infohq.in' }),
        },
        mockEnv
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json.error).toBe('validation_error');
    });

    it('returns 400 when both email and phone are absent', async () => {
      mockEnv.DB = { prepare: vi.fn() };
      const res = await app.request(
        '/api/leads',
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ name: 'Rahul Sharma' }),
        },
        mockEnv
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json.error).toBe('validation_error');
    });

    it('creates lead with atomic batch write when valid', async () => {
      const mockBatch = vi.fn().mockResolvedValue([{ success: true }, { success: true }]);
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        return {
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        };
      });

      mockEnv.DB = {
        prepare: mockPrepare,
        batch: mockBatch,
      };

      const res = await app.request(
        '/api/leads',
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            name: 'Rahul Sharma',
            phone: '+919876543210',
            source: 'whatsapp_click',
            serviceNeeded: 'Web Development',
            budget: '50000',
          }),
        },
        mockEnv
      );

      expect(res.status).toBe(201);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Rahul Sharma');
      expect(json.data.source).toBe('whatsapp_click');
      expect(json.data.stage).toBe('new');

      // Verify atomic batching was called for both lead and activity
      expect(mockBatch).toHaveBeenCalledTimes(1);
    });

    it('detects potential duplicate and returns 409', async () => {
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, name, email, phone, stage FROM leads')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [
                  {
                    id: 'lead_existing_123',
                    name: 'Rahul Sharma',
                    email: 'rahul@example.com',
                    phone: '+919876543210',
                    stage: 'contacted',
                  },
                ],
              }),
            }),
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        };
      });

      mockEnv.DB = { prepare: mockPrepare };

      const res = await app.request(
        '/api/leads',
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            name: 'Rahul Duplicate',
            phone: '+919876543210',
            confirmDuplicate: false,
          }),
        },
        mockEnv
      );

      expect(res.status).toBe(409);
      const json = (await res.json()) as any;
      expect(json.error).toBe('duplicate_lead');
      expect(json.matches.length).toBe(1);
      expect(json.matches[0].id).toBe('lead_existing_123');
    });
  });

  describe('GET /api/leads listing & pagination', () => {
    it('returns paginated results structure', async () => {
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ total: 1 }),
            }),
          };
        }
        if (sql.includes('SELECT * FROM leads')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [
                  {
                    id: 'lead_1',
                    name: 'John Doe',
                    email: 'john@example.com',
                    phone: '1234567890',
                    service_needed: 'SEO',
                    budget: '25000',
                    message: null,
                    source: 'referral',
                    stage: 'new',
                    lost_reason: null,
                    next_follow_up_at: null,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                  },
                ],
              }),
            }),
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        };
      });

      mockEnv.DB = { prepare: mockPrepare };

      const res = await app.request(
        '/api/leads?page=1&pageSize=10&stage=new',
        {
          headers: authHeaders,
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.pagination.total).toBe(1);
      expect(json.pagination.page).toBe(1);
      expect(json.data.length).toBe(1);
      expect(json.data[0].name).toBe('John Doe');
      expect(json.data[0].source).toBe('referral');
    });
  });

  describe('PATCH /api/leads/:id/stage', () => {
    it('returns 400 when invalid stage provided', async () => {
      mockEnv.DB = { prepare: vi.fn() };
      const res = await app.request(
        '/api/leads/lead_123/stage',
        {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ stage: 'invalid_stage' }),
        },
        mockEnv
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json.error).toBe('validation_error');
    });

    it('returns 404 when lead does not exist', async () => {
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
          }),
        };
      });

      mockEnv.DB = { prepare: mockPrepare };

      const res = await app.request(
        '/api/leads/lead_nonexistent/stage',
        {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ stage: 'contacted' }),
        },
        mockEnv
      );

      expect(res.status).toBe(404);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json.error).toBe('not_found');
    });

    it('updates stage atomically and writes activity log', async () => {
      const mockBatch = vi.fn().mockResolvedValue([{ success: true }, { success: true }]);
      const mockPrepare = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM leads WHERE id = ?')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 'lead_123',
                name: 'Rahul Sharma',
                email: 'rahul@example.com',
                phone: '+919876543210',
                company: 'Acme Corp',
                service_needed: 'Web App',
                budget: '50000',
                timeline: '2 weeks',
                preferred_contact: 'WhatsApp',
                message: null,
                source: 'website_contact',
                stage: 'new',
                lost_reason: null,
                next_follow_up_at: null,
                created_at: 1000,
                updated_at: 1000,
              }),
            }),
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        };
      });

      mockEnv.DB = {
        prepare: mockPrepare,
        batch: mockBatch,
      };

      const res = await app.request(
        '/api/leads/lead_123/stage',
        {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ stage: 'contacted' }),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.id).toBe('lead_123');
      expect(json.data.stage).toBe('contacted');
      expect(mockBatch).toHaveBeenCalledTimes(1);
    });
  });
});
