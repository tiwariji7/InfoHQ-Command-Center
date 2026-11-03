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
  sendPaymentReceiptEmailViaResend,
  handleRazorpayWebhookEvent,
  fetchAndVerifyRazorpayStatus,
  sendTelegramPaymentSuccessAlert,
  autoSyncPendingRazorpayPayments,
} from '../services/billingService.js';
import { generateInvoicePdf } from '../services/invoicePdfGenerator.js';
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

  // Non-blocking auto-sync of pending Razorpay payments
  const keyId = c.env.RAZORPAY_KEY_ID?.replace(/^['"]|['"]$/g, '').trim();
  const keySecret = c.env.RAZORPAY_KEY_SECRET?.replace(/^['"]|['"]$/g, '').trim();
  if (keyId && keySecret && c.executionCtx) {
    c.executionCtx.waitUntil(
      autoSyncPendingRazorpayPayments(c.env.DB, c.env, c.executionCtx)
    );
  }

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
    let payment = await createPayment(c.env.DB, parseResult.data);

    // Auto-generate Razorpay payment link & dispatch Telegram alert if keys are configured
    const keyId = c.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = c.env.RAZORPAY_KEY_SECRET?.trim();
    if (keyId && keySecret) {
      try {
        const invoiceNumber = payment.invoiceNumber || ('INV-2026-' + payment.id.slice(-4).toUpperCase());
        const rzpResult = await createRazorpayPaymentLink(
          {
            amount: payment.amount,
            invoiceNumber,
            description: payment.title || 'InfoHQ Service Milestone',
            paymentDbId: payment.id,
            clientId: payment.clientId || undefined,
            customer: {
              name: payment.clientName || 'Valued Client',
              email: payment.clientEmail,
              contact: payment.clientPhone,
            },
          },
          { keyId, keySecret }
        );

        if (rzpResult) {
          await c.env.DB.prepare(
            'UPDATE payments SET razorpay_payment_link_id = ?, razorpay_payment_link_url = ?, invoice_number = ? WHERE id = ?'
          )
            .bind(rzpResult.id, rzpResult.shortUrl, invoiceNumber, payment.id)
            .run();

          payment.razorpayPaymentLinkId = rzpResult.id;
          payment.razorpayPaymentLinkUrl = rzpResult.shortUrl;
          payment.invoiceNumber = invoiceNumber;

          // Determine project budget if available
          let projectBudget = payment.amount;
          if (payment.projectId) {
            const prRow = await c.env.DB.prepare('SELECT budget FROM projects WHERE id = ?').bind(payment.projectId).first<{ budget: string }>();
            if (prRow?.budget) {
              const parsed = parseFloat(String(prRow.budget).replace(/[^0-9.]/g, ''));
              if (!isNaN(parsed) && parsed > 0) projectBudget = parsed;
            }
          }

          // Send Telegram Alert for instant notification
          c.executionCtx.waitUntil(
            sendTelegramPaymentLinkAlert(
              {
                clientName: payment.clientName || 'Client',
                projectTitle: payment.projectTitle || payment.title || 'Client Project',
                invoiceNumber,
                amount: payment.amount,
                totalBudget: projectBudget,
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
                  projectTitle: payment.projectTitle || 'Website Development',
                  milestoneTitle: payment.title || 'Advance Payment',
                  amount: payment.amount,
                  totalBudget: projectBudget,
                  paymentLinkUrl: rzpResult.shortUrl,
                  dueDateFormatted,
                },
                c.env.RESEND_API_KEY
              )
            );
          }
        }
      } catch (rzpErr) {
        console.warn('[Auto Razorpay Link Generation Skipped]:', rzpErr);
      }
    }

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

    // Auto-update associated lead stage to won and project to in_progress
    if (updated.projectId) {
      const projRow = await c.env.DB.prepare('SELECT lead_id FROM projects WHERE id = ?').bind(updated.projectId).first<{ lead_id: string }>();
      if (projRow?.lead_id) {
        await c.env.DB.prepare("UPDATE leads SET stage = 'won', updated_at = ? WHERE id = ? AND stage != 'won'").bind(Date.now(), projRow.lead_id).run();
      }
    }

    const now = Date.now();
    const timeIST = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(now));

    // Generate Invoice PDF
    let pdfBytes: Uint8Array | undefined = undefined;
    try {
      pdfBytes = await generateInvoicePdf({
        invoiceNumber: updated.invoiceNumber || 'INV-2026',
        clientId: updated.clientId || undefined,
        clientName: updated.clientName || 'Valued Client',
        clientEmail: updated.clientEmail || undefined,
        clientPhone: updated.clientPhone || undefined,
        projectTitle: updated.projectTitle || updated.title || 'Client Project',
        milestoneTitle: updated.title || 'Milestone Delivery',
        amount: updated.amount,
        paymentMode: updated.paymentMethod || parseResult.data.paymentMethod || 'Manual Record',
        transactionRef: updated.razorpayPaymentId || updated.id || 'Manual Record',
        issueDate: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(updated.createdAt || now)),
        paymentDate: timeIST,
        status: 'received',
        notes: updated.notes ? String(updated.notes) : undefined,
      });
    } catch (pdfErr) {
      console.warn('[Record Payment PDF Generation Warning]:', pdfErr);
    }

    // Telegram Alert with PDF attachment
    c.executionCtx.waitUntil(
      sendTelegramPaymentSuccessAlert(
        {
          clientName: updated.clientName || 'Valued Client',
          projectTitle: updated.projectTitle || updated.title || 'Client Project',
          invoiceNumber: updated.invoiceNumber || 'INV-2026',
          milestoneTitle: updated.title || 'Payment',
          amount: updated.amount,
          paymentId: updated.razorpayPaymentId || updated.id || 'Manual Record',
          paymentMethod: updated.paymentMethod || parseResult.data.paymentMethod || 'Manual Record',
          paidAtIST: timeIST,
          pdfBytes,
        },
        c.env
      )
    );

    // Resend Payment Receipt Email with PDF attachment
    if (updated.clientEmail && c.env.RESEND_API_KEY) {
      c.executionCtx.waitUntil(
        sendPaymentReceiptEmailViaResend(
          {
            clientName: updated.clientName || 'Valued Client',
            clientEmail: updated.clientEmail,
            invoiceNumber: updated.invoiceNumber || 'INV-2026',
            projectTitle: updated.projectTitle || updated.title || 'Client Project',
            milestoneTitle: updated.title || 'Payment',
            amount: updated.amount,
            paymentMode: updated.paymentMethod || parseResult.data.paymentMethod || 'Manual Record',
            paymentId: updated.razorpayPaymentId || updated.id || 'Manual Record',
            paidAtFormatted: timeIST,
            pdfBytes,
          },
          c.env.RESEND_API_KEY
        )
      );
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
      paymentDbId: paymentId,
      clientId: payment.clientId || undefined,
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

  let projectBudget = payment.amount;
  if (payment.projectId) {
    const prRow = await c.env.DB.prepare('SELECT budget FROM projects WHERE id = ?').bind(payment.projectId).first<{ budget: string }>();
    if (prRow?.budget) {
      const parsed = parseFloat(String(prRow.budget).replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed > 0) projectBudget = parsed;
    }
  }

  // Send Telegram Alert 1
  c.executionCtx.waitUntil(
    sendTelegramPaymentLinkAlert(
      {
        clientName: payment.clientName || 'Client',
        projectTitle: payment.projectTitle || payment.title || 'Client Project',
        invoiceNumber,
        amount: payment.amount,
        totalBudget: projectBudget,
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
          projectTitle: payment.projectTitle || 'Website Development',
          milestoneTitle: payment.title || 'Advance Payment',
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
  const rzpPaymentId = payment.razorpayPaymentId;
  const keyId = c.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = c.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    return c.json({
      error: 'bad_request',
      message: 'Razorpay API credentials not configured in environment.',
    }, 400);
  }

  if (!linkId && !rzpPaymentId) {
    return c.json({
      error: 'bad_request',
      message: 'No Razorpay payment link or payment ID found on this invoice to sync.',
    }, 400);
  }

  try {
    // DIRECT VERIFICATION WITH RAZORPAY OFFICIAL API
    const verified = await fetchAndVerifyRazorpayStatus(
      { paymentId: rzpPaymentId, linkId },
      { keyId, keySecret }
    );

    if (!verified) {
      return c.json({
        error: 'razorpay_error',
        message: 'Could not fetch status directly from Razorpay servers.',
      }, 502);
    }

    if (verified.isConfirmed) {
      const now = Date.now();
      const timeIST = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(verified.paidAtEpoch || now));

      // 1. Update Payment status to 'received' in CRM DB (resilient with updated_at)
      try {
        await c.env.DB.prepare(`
          UPDATE payments
          SET status = 'received',
              paid_at = ?,
              payment_method = ?,
              razorpay_payment_id = ?,
              updated_at = ?
          WHERE id = ?
        `)
          .bind(verified.paidAtEpoch || now, verified.paymentMethod, verified.paymentId, now, paymentId)
          .run();
      } catch (sqlErr) {
        await c.env.DB.prepare(`
          UPDATE payments
          SET status = 'received',
              paid_at = ?,
              payment_method = ?,
              razorpay_payment_id = ?
          WHERE id = ?
        `)
          .bind(verified.paidAtEpoch || now, verified.paymentMethod, verified.paymentId, paymentId)
          .run();
      }

      // 2. Update Client total_paid in clients table
      const clientId = payment.clientId;
      if (clientId) {
        try {
          await c.env.DB.prepare(`
            UPDATE clients
            SET total_paid = total_paid + ?,
                updated_at = ?
            WHERE id = ?
          `)
            .bind(verified.amountRupees || payment.amount, now, clientId)
            .run();
        } catch {
          await c.env.DB.prepare(`
            UPDATE clients
            SET total_paid = total_paid + ?
            WHERE id = ?
          `)
            .bind(verified.amountRupees || payment.amount, clientId)
            .run();
        }
      }

      // 3. Update associated Project status to 'in_progress' and lead to 'won'
      if (payment.projectId) {
        try {
          await c.env.DB.prepare(`
            UPDATE projects
            SET status = CASE WHEN status = 'planning' THEN 'in_progress' ELSE status END,
                updated_at = ?
            WHERE id = ?
          `)
            .bind(now, payment.projectId)
            .run();
        } catch {
          await c.env.DB.prepare(`
            UPDATE projects
            SET status = CASE WHEN status = 'planning' THEN 'in_progress' ELSE status END
            WHERE id = ?
          `)
            .bind(payment.projectId)
            .run();
        }

        const projRow = await c.env.DB.prepare('SELECT lead_id FROM projects WHERE id = ?').bind(payment.projectId).first<{ lead_id: string }>();
        if (projRow?.lead_id) {
          await c.env.DB.prepare("UPDATE leads SET stage = 'won', updated_at = ? WHERE id = ? AND stage != 'won'").bind(now, projRow.lead_id).run();
        }
      }

      // Generate Invoice PDF
      let pdfBytes: Uint8Array | undefined = undefined;
      try {
        pdfBytes = await generateInvoicePdf({
          invoiceNumber: verified.invoiceNumber || payment.invoiceNumber || 'INV-2026',
          clientId: payment.clientId || undefined,
          clientName: verified.customerName || payment.clientName || 'Valued Client',
          clientEmail: verified.customerEmail || payment.clientEmail || undefined,
          clientPhone: verified.customerContact || payment.clientPhone || undefined,
          projectTitle: payment.projectTitle || payment.title || 'Client Project',
          milestoneTitle: payment.title || 'Milestone Delivery',
          amount: verified.amountRupees || payment.amount,
          paymentMode: verified.paymentMethod || 'UPI / Online',
          transactionRef: verified.paymentId,
          issueDate: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(payment.createdAt || now)),
          paymentDate: timeIST,
          status: 'received',
          notes: payment.notes ? String(payment.notes) : undefined,
        });
      } catch (pdfErr) {
        console.warn('[Sync Razorpay PDF Generation Warning]:', pdfErr);
      }

      // 4. DISPATCH TELEGRAM ALERT WITH INVOICE PDF ATTACHED
      c.executionCtx.waitUntil(
        sendTelegramPaymentSuccessAlert(
          {
            clientName: verified.customerName || payment.clientName || 'Valued Client',
            projectTitle: payment.projectTitle || payment.title || 'Client Project',
            invoiceNumber: verified.invoiceNumber || payment.invoiceNumber || 'INV-2026',
            milestoneTitle: payment.title || 'Advance Payment',
            amount: verified.amountRupees || payment.amount,
            paymentId: verified.paymentId,
            paymentMethod: verified.paymentMethod,
            bankRef: verified.bankRef,
            paidAtIST: timeIST,
            isRazorpayVerified: true,
            pdfBytes,
          },
          c.env
        )
      );

      // 5. DISPATCH RESEND PAYMENT CONFIRMATION RECEIPT WITH PDF ATTACHMENT
      const targetClientEmail = verified.customerEmail || payment.clientEmail;
      if (targetClientEmail && c.env.RESEND_API_KEY) {
        c.executionCtx.waitUntil(
          sendPaymentReceiptEmailViaResend(
            {
              clientName: verified.customerName || payment.clientName || 'Valued Client',
              clientEmail: targetClientEmail,
              invoiceNumber: verified.invoiceNumber || payment.invoiceNumber || 'INV-2026',
              projectTitle: payment.projectTitle || payment.title || 'Client Project',
              milestoneTitle: payment.title || 'Payment',
              amount: verified.amountRupees || payment.amount,
              paymentMode: verified.paymentMethod || 'UPI / Online',
              paymentId: verified.paymentId,
              paidAtFormatted: timeIST,
              pdfBytes,
            },
            c.env.RESEND_API_KEY
          )
        );
      }

      const updatedPayment = await getPaymentById(c.env.DB, paymentId);
      return c.json({
        success: true,
        message: `Payment confirmed directly with Razorpay as PAID (Ref: ${verified.paymentId})!`,
        linkStatus: verified.status,
        payment: updatedPayment,
      });
    }

    return c.json({
      success: true,
      message: `Razorpay official status: ${verified.status.toUpperCase()}`,
      linkStatus: verified.status,
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


// POST /api/payments/auto-sync - Force background sync of all pending Razorpay links
paymentsRouter.post('/auto-sync', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  try {
    const syncedCount = await autoSyncPendingRazorpayPayments(c.env.DB, c.env, c.executionCtx);
    return c.json({ success: true, syncedCount });
  } catch (err) {
    console.error('Error auto-syncing pending payments:', err);
    return c.json({ error: 'internal_error', message: err instanceof Error ? err.message : 'Sync failed' }, 500);
  }
});
