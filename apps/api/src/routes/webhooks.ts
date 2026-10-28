import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import { handleRazorpayWebhookEvent } from '../services/billingService.js';

export const webhooksRouter = new Hono<AppContext>();

/**
 * Verify Razorpay Webhook HMAC-SHA256 signature using native Web Crypto API
 */
async function verifyRazorpaySignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string
): Promise<boolean> {
  if (!signature) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const hexSig = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hexSig.toLowerCase() === signature.trim().toLowerCase();
  } catch (err) {
    console.error('[Razorpay Signature Verification Exception]:', err);
    return false;
  }
}

// POST /api/webhooks/razorpay - Public Razorpay webhook listener
webhooksRouter.post('/razorpay', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('x-razorpay-signature');
  const webhookSecret = c.env.RAZORPAY_WEBHOOK_SECRET;

  // If RAZORPAY_WEBHOOK_SECRET is set in worker environment, strictly enforce signature verification
  if (webhookSecret && webhookSecret.trim().length > 0) {
    const isValid = await verifyRazorpaySignature(rawBody, signature, webhookSecret.trim());
    if (!isValid) {
      console.warn('[Razorpay Webhook]: Rejected request due to invalid HMAC signature.');
      return c.json({ error: 'unauthorized', message: 'Invalid webhook signature.' }, 401);
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
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
