import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import type { ClientPortalData, PaymentStatus, ProjectStatus } from '@infohq/shared';

export const portalRouter = new Hono<AppContext>();

// GET /api/portal/access - Public magic-link access gate for verified clients
portalRouter.get('/access', async (c) => {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const token = c.req.query('token');
  if (!token || token.trim().length < 8) {
    return c.json(
      { error: 'unauthorized', message: 'Valid client portal access token required.' },
      401
    );
  }

  try {
    const clientRow = await db
      .prepare('SELECT id, name, company, email, phone, portal_enabled FROM clients WHERE portal_token = ?')
      .bind(token.trim())
      .first<{
        id: string;
        name: string;
        company: string | null;
        email: string | null;
        phone: string | null;
        portal_enabled: number | null;
      }>();

    if (!clientRow || clientRow.portal_enabled === 0) {
      return c.json(
        { error: 'not_found', message: 'Portal access link is invalid, expired, or deactivated by admin.' },
        404
      );
    }

    const clientId = clientRow.id;
    const clientName = clientRow.name;

    // Fetch projects (Strict authorization: match clientId directly, or unassigned legacy records with matching clientName)
    const projectsRes = await db
      .prepare(`
        SELECT p.id, p.title, p.status, p.start_date, p.deadline, p.description,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as total_tasks,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as completed_tasks
        FROM projects p
        WHERE p.client_id = ? OR (p.client_id IS NULL AND LOWER(p.client_name) = LOWER(?))
        ORDER BY p.created_at DESC
      `)
      .bind(clientId, clientName)
      .all<Record<string, unknown>>();

    const projects = (projectsRes.results || []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      status: row.status as ProjectStatus,
      startDate: row.start_date ? Number(row.start_date) : null,
      targetDate: row.deadline ? Number(row.deadline) : null,
      totalTasks: Number(row.total_tasks || 0),
      completedTasks: Number(row.completed_tasks || 0),
      description: row.description ? String(row.description) : null,
    }));

    // Fetch invoices / payments (Strict authorization boundary: match clientId or unassigned legacy name-only)
    const paymentsRes = await db
      .prepare(`
        SELECT id, title, invoice_number, amount, status, due_date, paid_at, created_at, razorpay_payment_link_url
        FROM payments
        WHERE client_id = ? OR (client_id IS NULL AND LOWER(client_name) = LOWER(?))
        ORDER BY created_at DESC
      `)
      .bind(clientId, clientName)
      .all<Record<string, unknown>>();

    const invoices = (paymentsRes.results || []).map((row) => ({
      id: String(row.id),
      title: row.title ? String(row.title) : 'Milestone Invoice',
      invoiceNumber: row.invoice_number ? String(row.invoice_number) : null,
      amount: Number(row.amount || 0),
      status: row.status as PaymentStatus,
      dueDate: row.due_date ? Number(row.due_date) : null,
      paidAt: row.paid_at ? Number(row.paid_at) : null,
      createdAt: Number(row.created_at),
      razorpayPaymentLinkUrl: row.razorpay_payment_link_url ? String(row.razorpay_payment_link_url) : null,
    }));

    const totalBilled = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalPaid = invoices.filter((i) => i.status === 'received').reduce((sum, i) => sum + i.amount, 0);
    const totalPending = Math.max(0, totalBilled - totalPaid);
    const activeProjectsCount = projects.filter((p) => p.status !== 'completed').length;

    const portalData: ClientPortalData = {
      client: {
        id: clientRow.id,
        name: clientRow.name,
        company: clientRow.company,
        email: clientRow.email,
        phone: clientRow.phone,
      },
      overview: {
        totalBilled,
        totalPaid,
        totalPending,
        activeProjectsCount,
      },
      projects,
      invoices,
    };

    return c.json({ success: true, data: portalData });
  } catch (err: unknown) {
    console.error('Failed to load client portal:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to retrieve client portal data.' }, 500);
  }
});
