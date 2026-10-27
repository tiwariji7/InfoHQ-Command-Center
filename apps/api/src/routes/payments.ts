import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import { requireSuperadmin } from '../middleware/auth.js';
import {
  CreatePaymentSchema,
  UpdatePaymentSchema,
  RecordPaymentSchema,
} from '@infohq/shared';
import {
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  recordPaymentReceived,
  deletePayment,
} from '../services/paymentService.js';

export const paymentsRouter = new Hono<AppContext>();

// Require Superadmin authentication on all payment routes
paymentsRouter.use('*', requireSuperadmin);

// GET /api/payments - List payments with summary metrics & filters
paymentsRouter.get('/', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const projectId = c.req.query('projectId');
  const status = c.req.query('status');
  const search = c.req.query('search');

  try {
    const data = await getPayments(c.env.DB, { projectId, status, search });
    return c.json(data);
  } catch (err: unknown) {
    console.error('Error fetching payments:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to retrieve payments.' }, 500);
  }
});

// POST /api/payments - Create a new payment milestone / invoice
paymentsRouter.post('/', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = CreatePaymentSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid payment payload.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  try {
    const payment = await createPayment(c.env.DB, parseResult.data);
    return c.json({ payment }, 201);
  } catch (err: unknown) {
    console.error('Error creating payment:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to create payment milestone.' }, 500);
  }
});

// GET /api/payments/:id - Get single payment details
paymentsRouter.get('/:id', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const paymentId = c.req.param('id');
  try {
    const payment = await getPaymentById(c.env.DB, paymentId);
    if (!payment) {
      return c.json({ error: 'not_found', message: 'Payment record not found.' }, 404);
    }
    return c.json({ payment });
  } catch (err: unknown) {
    console.error('Error fetching payment:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to retrieve payment.' }, 500);
  }
});

// POST /api/payments/:id/record-payment - Mark payment as received
paymentsRouter.post('/:id/record-payment', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const paymentId = c.req.param('id');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = RecordPaymentSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid record payment payload.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  try {
    const updated = await recordPaymentReceived(c.env.DB, paymentId, parseResult.data);
    if (!updated) {
      return c.json({ error: 'not_found', message: 'Payment record not found.' }, 404);
    }
    return c.json({ payment: updated });
  } catch (err: unknown) {
    console.error('Error recording payment:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to record payment.' }, 500);
  }
});

// PATCH /api/payments/:id - Update payment milestone
paymentsRouter.patch('/:id', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const paymentId = c.req.param('id');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = UpdatePaymentSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid update payload.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  try {
    const updated = await updatePayment(c.env.DB, paymentId, parseResult.data);
    if (!updated) {
      return c.json({ error: 'not_found', message: 'Payment record not found.' }, 404);
    }
    return c.json({ payment: updated });
  } catch (err: unknown) {
    console.error('Error updating payment:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to update payment.' }, 500);
  }
});

// DELETE /api/payments/:id - Delete payment record
paymentsRouter.delete('/:id', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const paymentId = c.req.param('id');
  try {
    const success = await deletePayment(c.env.DB, paymentId);
    return c.json({ success });
  } catch (err: unknown) {
    console.error('Error deleting payment:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to delete payment.' }, 500);
  }
});
