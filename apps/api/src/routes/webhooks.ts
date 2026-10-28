import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import { handleRazorpayWebhookEvent } from '../services/billingService.js';

export const webhooksRouter = new Hono<AppContext>();

// POST /api/webhooks/razorpay - Public Razorpay webhook listener
webhooksRouter.post('/razorpay', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'bad_request', message: 'Malformed JSON payload.' }, 400);
  }

  try {
    const result = await handleRazorpayWebhookEvent(body, c.env);
    return c.json(result);
  } catch (err: unknown) {
    console.error('[Razorpay Webhook Error]:', err);
    return c.json(
      {
        error: 'internal_error',
        message: err instanceof Error ? err.message : 'Webhook processing failed.',
      },
      500
    );
  }
});
