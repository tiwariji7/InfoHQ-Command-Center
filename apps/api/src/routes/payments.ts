import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import { requireSuperadmin } from '../middleware/auth.js';
import {
  CreatePaymentSchema,
  UpdatePaymentSchema,
  RecordPaymentSchema,
} from '@infohq/shared';
import {
  createRazorpayPaymentLink,
  sendTelegramPaymentLinkAlert,
  sendInvoiceEmailViaResend,
  handleRazorpayWebhookEvent,
} from '../services/billingService.js';
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

// POST /api/payments/:id/generate-payment-link - Generate a live Razorpay link for this invoice
paymentsRouter.post('/:id/generate-payment-link', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const paymentId = c.req.param('id');
  const payment = await getPaymentById(c.env.DB, paymentId);
  if (!payment) {
    return c.json({ error: 'not_found', message: 'Payment record not found.' }, 404);
  }

  const keyId = c.env.RAZORPAY_KEY_ID;
  const keySecret = c.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return c.json({ error: 'config_missing', message: 'Razorpay keys not configured.' }, 500);
  }

  const invoiceNumber = payment.invoiceNumber || `INV-2026-${paymentId.slice(-3).toUpperCase()}`;
  const rzpResult = await createRazorpayPaymentLink(
    {
      amount: payment.amount,
      invoiceNumber,
      description: payment.title || 'InfoHQ Service Milestone',
      customer: {
        name: payment.clientName || 'Valued Client',
        email: payment.clientEmail,
        contact: payment.clientPhone,
      },
    },
    { keyId, keySecret }
  );

  if (!rzpResult) {
    return c.json({ error: 'razorpay_error', message: 'Failed to create payment link on Razorpay.' }, 502);
  }

  await c.env.DB.prepare(`
    UPDATE payments
    SET razorpay_payment_link_id = ?,
        razorpay_payment_link_url = ?,
        invoice_number = ?
    WHERE id = ?
  `)
    .bind(rzpResult.id, rzpResult.shortUrl, invoiceNumber, paymentId)
    .run();

  // Send Telegram Alert 1
  c.executionCtx.waitUntil(
    sendTelegramPaymentLinkAlert(
      {
        clientName: payment.clientName || 'Client',
        projectTitle: payment.projectTitle || payment.title || 'Client Project',
        invoiceNumber,
        amount: payment.amount,
        totalBudget: payment.amount,
        paymentLinkUrl: rzpResult.shortUrl,
      },
      c.env
    )
  );

  // Send Resend Email if email is available
  if (payment.clientEmail && c.env.RESEND_API_KEY) {
    const dueDateFormatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(payment.dueDate || Date.now() + 3 * 24 * 60 * 60 * 1000));

    c.executionCtx.waitUntil(
      sendInvoiceEmailViaResend(
        {
          clientName: payment.clientName || 'Valued Client',
          clientEmail: payment.clientEmail,
          invoiceNumber,
          projectTitle: payment.projectTitle || payment.title || 'Milestone Delivery',
          amount: payment.amount,
          totalBudget: payment.amount,
          paymentLinkUrl: rzpResult.shortUrl,
          dueDateFormatted,
        },
        c.env.RESEND_API_KEY
      )
    );
  }

  return c.json({ success: true, paymentLinkUrl: rzpResult.shortUrl });
});

// POST /api/payments/:id/sync-razorpay - Verify & sync payment status directly from Razorpay
paymentsRouter.post('/:id/sync-razorpay', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const paymentId = c.req.param('id');
  const payment = await getPaymentById(c.env.DB, paymentId);
  if (!payment) {
    return c.json({ error: 'not_found', message: 'Payment record not found.' }, 404);
  }

  const linkId = payment.razorpayPaymentLinkId;
  const keyId = c.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = c.env.RAZORPAY_KEY_SECRET?.trim();

  if (!linkId || !keyId || !keySecret) {
    return c.json({
      error: 'bad_request',
      message: 'No Razorpay payment link or API credentials associated with this invoice.',
    }, 400);
  }

  try {
    const authHeader = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
    const res = await fetch(`https://api.razorpay.com/v1/payment_links/${linkId}`, {
      headers: { Authorization: authHeader },
    });

    if (!res.ok) {
      return c.json({
        error: 'razorpay_error',
        message: `Razorpay API returned HTTP ${res.status}`,
      }, 502);
    }

    const linkData = (await res.json()) as Record<string, unknown>;
    const linkStatus = String(linkData.status || '').toLowerCase();

    if (linkStatus === 'paid') {
      const mockEvent = {
        event: 'payment_link.paid',
        payload: {
          payment_link: {
            entity: linkData,
          },
        },
      };

      await handleRazorpayWebhookEvent(mockEvent, c.env);
      const updatedPayment = await getPaymentById(c.env.DB, paymentId);
      return c.json({
        success: true,
        message: 'Payment synchronized from Razorpay as PAID!',
        linkStatus,
        payment: updatedPayment,
      });
    }

    return c.json({
      success: true,
      message: `Razorpay reports link status as: ${linkStatus}`,
      linkStatus,
      payment,
    });
  } catch (err) {
    console.error('Error syncing Razorpay status:', err);
    return c.json({
      error: 'internal_error',
      message: err instanceof Error ? err.message : 'Sync failed.',
    }, 500);
  }
});

