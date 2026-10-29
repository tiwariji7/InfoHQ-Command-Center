import { Hono } from 'hono';
import type { AppContext, Bindings } from '../types/env.js';
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

/**
 * Server-to-server direct fallback verification with Razorpay Official API
 */
async function verifyWithRazorpayApi(
  paymentId: string,
  env: Bindings
): Promise<boolean> {
  if (!paymentId || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return false;
  }
  try {
    const authHeader = `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`;
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: authHeader },
    });
    if (!res.ok) {
      console.warn('[Razorpay API Verification Failed]: HTTP', res.status);
      return false;
    }
    const data = (await res.json()) as { id?: string; status?: string };
    const isValid = data.id === paymentId;
    if (isValid) {
      console.log('[Razorpay API Direct Verification]: Validated payment', paymentId, 'status:', data.status);
    }
    return isValid;
  } catch (err) {
    console.error('[Razorpay API Verification Exception]:', err);
    return false;
  }
}

// POST /api/webhooks/razorpay - Public Razorpay webhook listener
webhooksRouter.post('/razorpay', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('x-razorpay-signature');
  const webhookSecret = c.env.RAZORPAY_WEBHOOK_SECRET;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'bad_request', message: 'Malformed JSON payload.' }, 400);
  }

  const eventType = String(body.event || '');
  console.log('[Razorpay Webhook Request Received]: event =', eventType);

  let isVerified = false;

  // 1. Try HMAC signature verification if secret is provided
  if (webhookSecret && webhookSecret.trim().length > 0 && signature) {
    isVerified = await verifyRazorpaySignature(rawBody, signature, webhookSecret.trim());
    if (!isVerified) {
      isVerified = await verifyRazorpaySignature(rawBody, signature, webhookSecret);
    }
  }

  // 2. Fallback: If HMAC verification didn't match, verify directly with Razorpay API
  if (!isVerified) {
    const payload = body.payload as Record<string, unknown> | undefined;
    const paymentObj = (payload?.payment as { entity?: Record<string, unknown> })?.entity;
    const refundObj = (payload?.refund as { entity?: Record<string, unknown> })?.entity;
    const paymentId = paymentObj?.id
      ? String(paymentObj.id)
      : refundObj?.payment_id
        ? String(refundObj.payment_id)
        : null;

    if (paymentId) {
      isVerified = await verifyWithRazorpayApi(paymentId, c.env);
    }
  }

  // If secret is set AND neither HMAC nor Direct API could verify, reject
  if (webhookSecret && webhookSecret.trim().length > 0 && !isVerified) {
    console.warn('[Razorpay Webhook]: Rejected unverified webhook request. Event:', eventType);
    return c.json({ error: 'unauthorized', message: 'Invalid webhook signature.' }, 401);
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
