import { generateInvoicePdf } from './invoicePdfGenerator.js';
import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '../types/env.js';
import type { AutoConvertWonLeadInput, Payment } from '@infohq/shared';
import { createOrGetClient } from './clientService.js';
import { generateInvoiceNumber } from '../utils/idGenerator.js';

export interface RazorpayLinkResult {
  id: string;
  shortUrl: string;
}

// 1. Create Razorpay Payment Link
export async function createRazorpayPaymentLink(
  params: {
    amount: number; // in Rupees
    invoiceNumber: string;
    description: string;
    paymentDbId?: string;
    clientId?: string;
    customer: {
      name: string;
      email?: string | null;
      contact?: string | null;
    };
  },
  keys: { keyId: string; keySecret: string }
): Promise<RazorpayLinkResult | null> {
  const { amount, invoiceNumber, description, paymentDbId, clientId, customer } = params;

  // Clean Indian mobile number if provided
  let contact: string | undefined = undefined;
  if (customer.contact) {
    const digits = customer.contact.replace(/\D/g, '');
    if (digits.length === 10) {
      contact = `+91${digits}`;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      contact = `+91${digits.slice(1)}`;
    } else if (digits.length === 12 && digits.startsWith('91')) {
      contact = `+${digits}`;
    } else if (digits.length >= 10) {
      contact = `+${digits}`;
    }
  }

  // Validate email format loosely to prevent Razorpay 400 validation error
  let email: string | undefined = undefined;
  if (customer.email && customer.email.includes('@') && customer.email.includes('.')) {
    email = customer.email.trim();
  }

  const payload = {
    amount: Math.max(100, Math.round(amount * 100)), // Razorpay accepts paise (minimum 100 paise = ₹1)
    currency: 'INR',
    accept_partial: false,
    reference_id: paymentDbId || invoiceNumber,
    description: `${description} (${invoiceNumber})`,
    customer: {
      name: customer.name,
      email: email || undefined,
      contact: contact || undefined,
    },
    notify: {
      sms: false,
      email: false,
    },
    reminder_enable: true,
    notes: {
      paymentDbId: paymentDbId || '',
      clientId: clientId || '',
      invoiceNumber,
      customerName: customer.name || '',
      platform: 'InfoHQ Command Center',
    },
  };

  const cleanKeyId = keys.keyId.replace(/^['"]|['"]$/g, '').trim();
  const cleanKeySecret = keys.keySecret.replace(/^['"]|['"]$/g, '').trim();
  const authHeader = `Basic ${btoa(`${cleanKeyId}:${cleanKeySecret}`)}`;

  try {
    const res = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Razorpay Link Error]:', res.status, errText);
      return null;
    }

    const data = (await res.json()) as { id: string; short_url: string };
    return {
      id: data.id,
      shortUrl: data.short_url,
    };
  } catch (err) {
    console.error('[Razorpay Link Fetch Exception]:', err);
    return null;
  }
}

export interface RazorpayVerifiedPayment {
  isConfirmed: boolean;
  status: 'captured' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'pending';
  amountRupees: number;
  paymentId: string;
  paymentMethod: string;
  bankRef?: string;
  errorReason?: string;
  customerEmail?: string;
  customerContact?: string;
  customerName?: string;
  paidAtEpoch: number;
  invoiceNumber?: string;
}

export async function fetchAndVerifyRazorpayStatus(
  params: {
    paymentId?: string | null;
    linkId?: string | null;
  },
  keys: { keyId: string; keySecret: string }
): Promise<RazorpayVerifiedPayment | null> {
  const cleanKeyId = keys.keyId.replace(/^['"]|['"]$/g, '').trim();
  const cleanKeySec = keys.keySecret.replace(/^['"]|['"]$/g, '').trim();
  if (!cleanKeyId || !cleanKeySec) return null;
  const authHeader = 'Basic ' + btoa(cleanKeyId + ':' + cleanKeySec);

  let effectivePaymentId = params.paymentId?.trim() || null;
  let linkData: Record<string, unknown> | null = null;

  // 1. If linkId provided, fetch payment link entity
  if (params.linkId) {
    try {
      const linkRes = await fetch('https://api.razorpay.com/v1/payment_links/' + params.linkId.trim(), {
        headers: { Authorization: authHeader },
      });
      if (linkRes.ok) {
        linkData = (await linkRes.json()) as Record<string, unknown>;
        const paymentsList = (linkData.payments as Array<Record<string, unknown>>) || [];
        if (paymentsList.length > 0) {
          const lastPayment = paymentsList[paymentsList.length - 1];
          if (lastPayment && lastPayment.payment_id) {
            effectivePaymentId = String(lastPayment.payment_id);
          }
        }
      }
    } catch (err) {
      console.warn('[fetchAndVerifyRazorpayStatus] Link fetch error:', err);
    }
  }

  // 2. Query Razorpay Payment Entity if paymentId exists
  if (effectivePaymentId) {
    try {
      const payRes = await fetch('https://api.razorpay.com/v1/payments/' + effectivePaymentId, {
        headers: { Authorization: authHeader },
      });
      if (payRes.ok) {
        const payData = (await payRes.json()) as Record<string, unknown>;
        const payStatus = String(payData.status || '').toLowerCase();
        const amountPaise = Number(payData.amount || 0);
        const amountRupees = amountPaise > 0 ? amountPaise / 100 : 0;
        const method = String(payData.method || 'upi').toUpperCase();
        const vpa = payData.vpa ? String(payData.vpa) : '';
        const bank = payData.bank ? String(payData.bank) : '';
        const wallet = payData.wallet ? String(payData.wallet) : '';
        const methodFormatted = vpa ? method + ' (' + vpa + ')' : bank ? method + ' (' + bank + ')' : wallet ? method + ' (' + wallet + ')' : method;

        const acquirer = (payData.acquirer_data as Record<string, unknown>) || {};
        const bankRef = String(
          acquirer.rrn ||
          acquirer.bank_transaction_id ||
          acquirer.upi_transaction_id ||
          acquirer.auth_code ||
          ''
        ).trim() || undefined;

        const errorReason = String(payData.error_description || payData.error_reason || '').trim() || undefined;
        const notes = (payData.notes as Record<string, unknown>) || {};
        const customerName = String(notes.customerName || notes.name || '').trim() || undefined;
        const invoiceNumber = String(notes.invoiceNumber || '').trim() || undefined;
        const paidAtEpoch = payData.created_at ? Number(payData.created_at) * 1000 : Date.now();

        const isConfirmed = payStatus === 'captured' || payStatus === 'authorized';
        return {
          isConfirmed,
          status: isConfirmed ? 'captured' : payStatus === 'failed' ? 'failed' : payStatus === 'refunded' ? 'refunded' : 'pending',
          amountRupees,
          paymentId: effectivePaymentId,
          paymentMethod: methodFormatted,
          bankRef,
          errorReason,
          customerEmail: payData.email ? String(payData.email) : undefined,
          customerContact: payData.contact ? String(payData.contact) : undefined,
          customerName,
          paidAtEpoch,
          invoiceNumber,
        };
      }
    } catch (err) {
      console.warn('[fetchAndVerifyRazorpayStatus] Payment fetch error:', err);
    }
  }

  // 3. Fallback: if only payment link data exists and it is marked paid
  if (linkData) {
    const lStatus = String(linkData.status || '').toLowerCase();
    const lAmountPaise = Number(linkData.amount_paid || linkData.amount || 0);
    const lAmountRupees = lAmountPaise > 0 ? lAmountPaise / 100 : 0;
    const lNotes = (linkData.notes as Record<string, unknown>) || {};
    const lCustomer = (linkData.customer as Record<string, unknown>) || {};

    const isConfirmed = lStatus === 'paid';
    return {
      isConfirmed,
      status: isConfirmed ? 'paid' : (lStatus as any) || 'pending',
      amountRupees: lAmountRupees,
      paymentId: effectivePaymentId || String(params.linkId || ''),
      paymentMethod: 'UPI / Online',
      customerName: String(lCustomer.name || lNotes.customerName || '').trim() || undefined,
      customerEmail: String(lCustomer.email || '').trim() || undefined,
      customerContact: String(lCustomer.contact || '').trim() || undefined,
      invoiceNumber: String(lNotes.invoiceNumber || '').trim() || undefined,
      paidAtEpoch: Date.now(),
    };
  }

  return null;
}


function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

// 2. Send Invoice Email via Resend
export async function sendInvoiceEmailViaResend(
  params: {
    clientName: string;
    clientEmail: string;
    invoiceNumber: string;
    projectTitle: string;
    milestoneTitle?: string;
    amount: number;
    totalBudget?: number;
    paymentLinkUrl?: string;
    dueDateFormatted: string;
  },
  apiKey: string
): Promise<boolean> {
  const {
    clientName,
    clientEmail,
    invoiceNumber,
    projectTitle,
    milestoneTitle,
    amount,
    paymentLinkUrl,
    dueDateFormatted,
  } = params;

  const formattedAmount = '₹' + amount.toLocaleString('en-IN');

  // Format clean payment type / milestone title (e.g., "Advance Payment")
  let cleanMilestone = (milestoneTitle || 'Advance Payment').trim();
  if (cleanMilestone.includes('—')) {
    cleanMilestone = cleanMilestone.split('—')[0].trim();
  } else if (cleanMilestone.includes('-')) {
    cleanMilestone = cleanMilestone.split('-')[0].trim();
  }
  if (!cleanMilestone.toLowerCase().includes('payment') && !cleanMilestone.toLowerCase().includes('milestone')) {
    cleanMilestone = `${cleanMilestone} Payment`;
  }

  // Exact Subject format requested: "Advance Payment for Website Development (INV-2026-653)"
  const subject = `${cleanMilestone} for ${projectTitle} (${invoiceNumber})`;

  const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F8F8FF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #1A085C;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    td {
      vertical-align: middle;
    }
    .email-container {
      max-width: 580px;
      width: 100%;
      margin: 25px auto;
      background-color: #FFFFFF;
      border-radius: 24px;
      border: 1px solid #EAE6F7;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(124, 92, 232, 0.04), 0 2px 6px rgba(15, 9, 38, 0.02);
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        margin: 10px auto !important;
        border-radius: 18px !important;
      }
      .inner-padding {
        padding: 20px 18px !important;
      }
      .amount-display {
        font-size: 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 20px 10px; background-color: #F8F8FF;">
  <div class="email-container" style="max-width: 580px; width: 100%; margin: 25px auto; background-color: #FFFFFF; border-radius: 24px; border: 1px solid #EAE6F7; overflow: hidden;">
    
    <!-- Header -->
    <div style="padding: 28px 32px 20px; border-bottom: 1px solid #EAE6F7;" class="inner-padding">
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.02em; color: #1A085C;">
        Info<span style="color: #7C5CE8;">HQ</span> <span style="font-size: 18px; font-weight: 700; color: #1A085C;">Pvt Ltd</span>
      </h1>
      <div style="font-size: 13px; font-weight: 500; color: #6B7280; margin-top: 3px;">
        Engineering Studio for AI, SaaS &amp; Digital Systems
      </div>
    </div>

    <!-- Body Content -->
    <div style="padding: 28px 32px 0;" class="inner-padding">
      <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800; color: #1A085C; letter-spacing: -0.02em;">
        Hello ${escapeHtml(clientName)},
      </h2>
      <p style="margin: 0 0 24px 0; font-size: 15px; color: #4B5563; line-height: 1.5;">
        Your payment request for <strong style="color: #1A085C;">${escapeHtml(projectTitle)}</strong> is ready.
      </p>

      <!-- Payment Details Box -->
      <div style="background-color: #F8F8FF; border: 1px solid #EAE6F7; border-radius: 16px; padding: 20px 22px; margin-bottom: 24px;">
        <div style="font-size: 15px; font-weight: 800; color: #1A085C; margin-bottom: 16px;">
          Payment Details
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 500; width: 42%; white-space: nowrap;">Payment Type</td>
            <td style="padding: 10px 10px; color: #6B7280; font-size: 14px; width: 14px; text-align: center;">:</td>
            <td style="padding: 10px 0; color: #1A085C; font-size: 14px; font-weight: 700;">${escapeHtml(cleanMilestone)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border-top: 1px solid #EAE6F7; height: 1px; padding: 0;"></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #6B7280; font-size: 14px; font-weight: 500;">Amount Due</td>
            <td style="padding: 12px 10px; color: #6B7280; font-size: 14px; text-align: center;">:</td>
            <td style="padding: 12px 0; color: #5B4CF5; font-size: 22px; font-weight: 900;" class="amount-display">${escapeHtml(formattedAmount)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border-top: 1px solid #EAE6F7; height: 1px; padding: 0;"></td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 500; white-space: nowrap;">Payment Due Date</td>
            <td style="padding: 10px 10px; color: #6B7280; font-size: 14px; text-align: center;">:</td>
            <td style="padding: 10px 0; color: #1A085C; font-size: 14px; font-weight: 700;">${escapeHtml(dueDateFormatted)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border-top: 1px solid #EAE6F7; height: 1px; padding: 0;"></td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 500; white-space: nowrap;">Invoice / Reference</td>
            <td style="padding: 10px 10px; color: #6B7280; font-size: 14px; text-align: center;">:</td>
            <td style="padding: 10px 0; color: #1A085C; font-size: 14px; font-weight: 700; font-family: monospace, Courier, monospace;">${escapeHtml(invoiceNumber)}</td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      ${
        paymentLinkUrl
          ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 10px 0;">
        <tr>
          <td align="center">
            <a href="${paymentLinkUrl}" target="_blank" style="background-color: #5B4CF5; background: linear-gradient(90deg, #5B4CF5 0%, #E85AA0 100%); color: #FFFFFF !important; font-size: 16px; font-weight: 800; text-decoration: none; padding: 14px 44px; border-radius: 9999px; display: inline-block; box-shadow: 0 4px 14px rgba(99, 88, 240, 0.35); text-align: center;">
              Pay Now &rarr;
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top: 12px; font-size: 12px; color: #6B7280;">
            Secure payment powered by <strong style="color: #1A085C;">Razorpay</strong>
          </td>
        </tr>
      </table>
      `
          : ''
      }

      <!-- Reminder Notice -->
      <div style="margin: 24px 0 20px 0; padding: 12px 16px; background-color: #F8F8FF; border: 1px solid #EAE6F7; border-radius: 12px; font-size: 13px; color: #4B5563; line-height: 1.4;">
        If you have already completed the payment, please ignore this email.
      </div>

      <!-- Sign off -->
      <p style="margin: 0 0 28px 0; font-size: 14px; color: #4B5563;">
        Thank you for choosing <strong style="color: #1A085C;">Info<span style="color: #7C5CE8;">HQ</span></strong>.
      </p>
    </div>

    <!-- Footer (Location, email and website omitted as requested) -->
    <div style="border-top: 1px solid #EAE6F7; padding: 22px 32px 28px; text-align: center; background-color: #FAFAFD;" class="inner-padding">
      <div style="font-size: 14px; font-weight: 800; color: #1A085C; letter-spacing: -0.01em;">
        Info<span style="color: #7C5CE8;">HQ</span> Pvt Ltd
      </div>
      <div style="font-size: 12px; color: #6B7280; margin-top: 3px;">
        Engineering Studio for AI, SaaS &amp; Digital Systems
      </div>
      <div style="font-size: 11px; color: #9CA3AF; margin-top: 12px; line-height: 1.4;">
        This is an automatically generated email. Please do not reply directly to this message.
      </div>
    </div>

  </div>
</body>
</html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'InfoHQ Billing <billing@infohq.in>',
        to: [clientEmail],
        reply_to: 'billing@infohq.in',
        subject,
        html,
      }),
    });

    if (!res.ok) {
      console.error('[Resend Invoice Email Failed]:', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Resend Invoice Email Exception]:', err);
    return false;
  }
}

// 3. Telegram Sanitization & Alert Delivery Infrastructure
function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getCleanTelegramCredentials(env: Bindings): { token: string; chatId: string } | null {
  const rawToken = env.TELEGRAM_BOT_TOKEN;
  const rawChatId = env.TELEGRAM_CHAT_ID;
  if (!rawToken || !rawChatId) return null;
  const token = rawToken.replace(/^['"]|['"]$/g, '').trim();
  const chatId = rawChatId.replace(/^['"]|['"]$/g, '').trim();
  if (!token || !chatId) return null;
  return { token, chatId };
}

export async function sendTelegramMessage(text: string, env: Bindings): Promise<boolean> {
  const creds = getCleanTelegramCredentials(env);
  if (!creds) {
    console.warn('[Telegram Alert]: Bot token or Chat ID not configured.');
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout to avoid any hang

  try {
    const res = await fetch(`https://api.telegram.org/bot${creds.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: creds.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn('[Telegram Alert Warning]: HTTP', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    console.error('[Telegram Alert Exception]:', err instanceof Error ? err.message : err);
    return false;
  }
}


// 2.1 Send Payment Receipt Email via Resend with Attached Invoice PDF
export async function sendPaymentReceiptEmailViaResend(
  params: {
    clientName: string;
    clientEmail: string;
    invoiceNumber: string;
    projectTitle: string;
    milestoneTitle?: string;
    amount: number;
    paymentMode?: string;
    paymentId: string;
    paidAtFormatted: string;
    pdfBytes?: Uint8Array;
  },
  apiKey: string
): Promise<boolean> {
  const {
    clientName,
    clientEmail,
    invoiceNumber,
    projectTitle,
    milestoneTitle,
    amount,
    paymentMode,
    paymentId,
    paidAtFormatted,
    pdfBytes,
  } = params;

  const formattedAmount = '₹' + amount.toLocaleString('en-IN');

  let cleanMilestone = (milestoneTitle || 'Advance Payment').trim();
  if (cleanMilestone.includes('—')) cleanMilestone = cleanMilestone.split('—')[0].trim();
  if (cleanMilestone.includes('-')) cleanMilestone = cleanMilestone.split('-')[0].trim();
  if (!cleanMilestone.toLowerCase().includes('payment') && !cleanMilestone.toLowerCase().includes('milestone')) {
    cleanMilestone = `${cleanMilestone} Payment`;
  }

  let mode = (paymentMode || 'UPI / Online').trim();
  if (mode.toLowerCase().includes('upi')) mode = 'UPI';
  else if (mode.toLowerCase().includes('card')) mode = 'Card';
  else if (mode.toLowerCase().includes('bank') || mode.toLowerCase().includes('netbanking')) mode = 'NetBanking';

  const subject = `Payment Confirmation & Receipt — ${cleanMilestone} for ${projectTitle} (${invoiceNumber})`;

  const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F8F8FF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #1A085C;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    td {
      vertical-align: middle;
    }
    .email-container {
      max-width: 580px;
      width: 100%;
      margin: 25px auto;
      background-color: #FFFFFF;
      border-radius: 24px;
      border: 1px solid #EAE6F7;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(124, 92, 232, 0.04), 0 2px 6px rgba(15, 9, 38, 0.02);
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        margin: 10px auto !important;
        border-radius: 18px !important;
      }
      .inner-padding {
        padding: 20px 18px !important;
      }
      .amount-display {
        font-size: 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 20px 10px; background-color: #F8F8FF;">
  <div class="email-container" style="max-width: 580px; width: 100%; margin: 25px auto; background-color: #FFFFFF; border-radius: 24px; border: 1px solid #EAE6F7; overflow: hidden;">
    
    <!-- Header -->
    <div style="padding: 28px 32px 20px; border-bottom: 1px solid #EAE6F7;" class="inner-padding">
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.02em; color: #1A085C;">
        Info<span style="color: #7C5CE8;">HQ</span> <span style="font-size: 18px; font-weight: 700; color: #1A085C;">Pvt Ltd</span>
      </h1>
      <div style="font-size: 13px; font-weight: 500; color: #6B7280; margin-top: 3px;">
        Engineering Studio for AI, SaaS &amp; Digital Systems
      </div>
    </div>

    <!-- Body Content -->
    <div style="padding: 28px 32px 0;" class="inner-padding">
      <div style="display: inline-block; padding: 5px 14px; background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 9999px; color: #16A34A; font-size: 12px; font-weight: 800; margin-bottom: 12px;">
        &#x2705; PAYMENT CONFIRMED &amp; SETTLED
      </div>

      <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800; color: #1A085C; letter-spacing: -0.02em;">
        Hello ${escapeHtml(clientName)},
      </h2>
      <p style="margin: 0 0 24px 0; font-size: 15px; color: #4B5563; line-height: 1.5;">
        Thank you! We have received and confirmed your payment for <strong style="color: #1A085C;">${escapeHtml(projectTitle)}</strong>.
      </p>

      <!-- Receipt Details Box -->
      <div style="background-color: #F8F8FF; border: 1px solid #EAE6F7; border-radius: 16px; padding: 20px 22px; margin-bottom: 24px;">
        <div style="font-size: 15px; font-weight: 800; color: #1A085C; margin-bottom: 16px;">
          Payment Receipt Details
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 500; width: 42%; white-space: nowrap;">Payment Type</td>
            <td style="padding: 10px 10px; color: #6B7280; font-size: 14px; width: 14px; text-align: center;">:</td>
            <td style="padding: 10px 0; color: #1A085C; font-size: 14px; font-weight: 700;">${escapeHtml(cleanMilestone)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border-top: 1px solid #EAE6F7; height: 1px; padding: 0;"></td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #6B7280; font-size: 14px; font-weight: 500;">Amount Received</td>
            <td style="padding: 12px 10px; color: #6B7280; font-size: 14px; text-align: center;">:</td>
            <td style="padding: 12px 0; color: #16A34A; font-size: 22px; font-weight: 900;" class="amount-display">${escapeHtml(formattedAmount)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border-top: 1px solid #EAE6F7; height: 1px; padding: 0;"></td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 500; white-space: nowrap;">Payment Mode</td>
            <td style="padding: 10px 10px; color: #6B7280; font-size: 14px; text-align: center;">:</td>
            <td style="padding: 10px 0; color: #1A085C; font-size: 14px; font-weight: 700;">${escapeHtml(mode)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border-top: 1px solid #EAE6F7; height: 1px; padding: 0;"></td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 500; white-space: nowrap;">Payment ID</td>
            <td style="padding: 10px 10px; color: #6B7280; font-size: 14px; text-align: center;">:</td>
            <td style="padding: 10px 0; color: #1A085C; font-size: 14px; font-weight: 700; font-family: monospace, Courier, monospace;">${escapeHtml(paymentId)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border-top: 1px solid #EAE6F7; height: 1px; padding: 0;"></td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 500; white-space: nowrap;">Paid At</td>
            <td style="padding: 10px 10px; color: #6B7280; font-size: 14px; text-align: center;">:</td>
            <td style="padding: 10px 0; color: #1A085C; font-size: 14px; font-weight: 700;">${escapeHtml(paidAtFormatted)}</td>
          </tr>
          <tr>
            <td colspan="3" style="border-top: 1px solid #EAE6F7; height: 1px; padding: 0;"></td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6B7280; font-size: 14px; font-weight: 500; white-space: nowrap;">Invoice Reference</td>
            <td style="padding: 10px 10px; color: #6B7280; font-size: 14px; text-align: center;">:</td>
            <td style="padding: 10px 0; color: #1A085C; font-size: 14px; font-weight: 700; font-family: monospace, Courier, monospace;">${escapeHtml(invoiceNumber)}</td>
          </tr>
        </table>
      </div>

      <!-- Attachment Notice -->
      <div style="margin: 24px 0 20px 0; padding: 14px 18px; background-color: #F8F8FF; border: 1px solid #EAE6F7; border-radius: 12px; font-size: 13px; color: #4B5563; line-height: 1.5;">
        &#x1F4CE; <strong>Official Invoice Attached:</strong> Your tax invoice is attached as a PDF (<strong>Invoice-${escapeHtml(invoiceNumber)}.pdf</strong>) for your records.
      </div>

      <!-- Sign off -->
      <p style="margin: 0 0 28px 0; font-size: 14px; color: #4B5563;">
        Thank you for choosing <strong style="color: #1A085C;">Info<span style="color: #7C5CE8;">HQ</span></strong>.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #EAE6F7; padding: 22px 32px 28px; text-align: center; background-color: #FAFAFD;" class="inner-padding">
      <div style="font-size: 14px; font-weight: 800; color: #1A085C; letter-spacing: -0.01em;">
        Info<span style="color: #7C5CE8;">HQ</span> Pvt Ltd
      </div>
      <div style="font-size: 12px; color: #6B7280; margin-top: 3px;">
        Engineering Studio for AI, SaaS &amp; Digital Systems
      </div>
      <div style="font-size: 11px; color: #9CA3AF; margin-top: 12px; line-height: 1.4;">
        This is an automatically generated email. Please do not reply directly to this message.
      </div>
    </div>

  </div>
</body>
</html>
  `;

  const payload: Record<string, unknown> = {
    from: 'InfoHQ Billing <billing@infohq.in>',
    to: [clientEmail],
    reply_to: 'billing@infohq.in',
    subject,
    html,
  };

  if (pdfBytes && pdfBytes.length > 0) {
    payload.attachments = [
      {
        filename: `Invoice-${invoiceNumber}.pdf`,
        content: uint8ArrayToBase64(pdfBytes),
      },
    ];
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('[Resend Payment Receipt Email Failed]:', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Resend Payment Receipt Email Exception]:', err);
    return false;
  }
}

// 2.2 Send Document (PDF) via Telegram Bot API
export async function sendTelegramDocument(
  fileBytes: Uint8Array,
  fileName: string,
  caption: string,
  env: Bindings
): Promise<boolean> {
  const creds = getCleanTelegramCredentials(env);
  if (!creds) {
    console.warn('[Telegram Alert Warning]: Telegram bot token or chat ID not set.');
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const formData = new FormData();
    formData.append('chat_id', creds.chatId);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    const docFile = typeof File !== 'undefined'
      ? new File([fileBytes], fileName, { type: 'application/pdf' })
      : new Blob([fileBytes], { type: 'application/pdf' });
    formData.append('document', docFile, fileName);

    const res = await fetch(`https://api.telegram.org/bot${creds.token}/sendDocument`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn('[Telegram sendDocument Warning]: HTTP', res.status, await res.text());
      return await sendTelegramMessage(caption, env);
    }
    return true;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    console.error('[Telegram sendDocument Exception]:', err instanceof Error ? err.message : err);
    return await sendTelegramMessage(caption, env);
  }
}

// 3. Telegram Alert: Advance Payment Link Generated (Message 1)
export async function sendTelegramPaymentLinkAlert(
  params: {
    clientName: string;
    projectTitle: string;
    invoiceNumber: string;
    amount: number;
    totalBudget: number;
    paymentLinkUrl?: string;
  },
  env: Bindings
) {
  const msg =
    `🔗 <b>New Payment Link Generated!</b>\n\n` +
    `👤 <b>Client:</b> ${escapeHtml(params.clientName)}\n` +
    `💼 <b>Project:</b> ${escapeHtml(params.projectTitle)}\n` +
    `🧾 <b>Invoice #:</b> <code>${escapeHtml(params.invoiceNumber)}</code>\n` +
    `💰 <b>Amount Due:</b> ₹${params.amount.toLocaleString('en-IN')}\n` +
    `📊 <b>Total Project Budget:</b> ₹${params.totalBudget.toLocaleString('en-IN')}\n\n` +
    (params.paymentLinkUrl
      ? `🌐 <b>Payment Link:</b>\n${params.paymentLinkUrl}\n\n`
      : `ℹ️ <i>Direct offline settlement recorded.</i>\n\n`) +
    `⚡ <i>Client can settle instantly via UPI, Cards, or NetBanking.</i>`;

  return sendTelegramMessage(msg, env);
}

// 4. Telegram Alert: Payment Success Verified
export async function sendTelegramPaymentSuccessAlert(
  params: {
    clientName: string;
    projectTitle: string;
    invoiceNumber: string;
    milestoneTitle?: string;
    amount: number;
    paymentId: string;
    paymentMethod?: string;
    bankRef?: string;
    paidAtIST: string;
    isRazorpayVerified?: boolean;
    pdfBytes?: Uint8Array;
  },
  env: Bindings
) {
  // Extract clean payment type (e.g. Advance, Part, Final, Full)
  let cleanType = (params.milestoneTitle || 'Advance').trim();
  if (cleanType.includes('—')) cleanType = cleanType.split('—')[0].trim();
  if (cleanType.includes('-')) cleanType = cleanType.split('-')[0].trim();
  if (cleanType.toLowerCase().includes('advance')) cleanType = 'Advance';
  else if (cleanType.toLowerCase().includes('final')) cleanType = 'Final';
  else if (cleanType.toLowerCase().includes('part')) cleanType = 'Part';
  else if (cleanType.toLowerCase().includes('full')) cleanType = 'Full';

  // Clean payment mode: UPI, Card, NetBanking
  let mode = (params.paymentMethod || 'UPI').trim();
  if (mode.toLowerCase().includes('upi')) mode = 'UPI';
  else if (mode.toLowerCase().includes('card')) mode = 'Card';
  else if (mode.toLowerCase().includes('bank') || mode.toLowerCase().includes('netbanking')) mode = 'NetBanking';

  const msg =
    `✅ <b>Payment Confirmed &amp; Verified</b>\n\n` +
    `👤 <b>Client:</b> ${escapeHtml(params.clientName)}\n` +
    `💼 <b>Project:</b> ${escapeHtml(params.projectTitle)}\n` +
    `💳 <b>Payment:</b> ${escapeHtml(cleanType)}\n` +
    `🧾 <b>Invoice No:</b> <code>${escapeHtml(params.invoiceNumber)}</code>\n` +
    `💰 <b>Amount Received:</b> ₹${params.amount.toLocaleString('en-IN')}\n` +
    `⚡ <b>Payment Mode:</b> ${escapeHtml(mode)}\n` +
    `🆔 <b>Payment ID:</b> <code>${escapeHtml(params.paymentId)}</code>\n` +
    `🕒 <b>Paid At:</b> ${escapeHtml(params.paidAtIST)}`;

  if (params.pdfBytes && params.pdfBytes.length > 0) {
    const filename = `Invoice-${params.invoiceNumber}.pdf`;
    return sendTelegramDocument(params.pdfBytes, filename, msg, env);
  }

  return sendTelegramMessage(msg, env);
}

// 4.1 Telegram Alert: Payment Attempt Failed
export async function sendTelegramPaymentFailedAlert(
  params: {
    clientName: string;
    projectTitle: string;
    invoiceNumber: string;
    amount: number;
    paymentId: string;
    errorReason: string;
    failedAtIST: string;
    isRazorpayVerified?: boolean;
  },
  env: Bindings
) {
  const verifiedBadge = params.isRazorpayVerified !== false ? '⚠️ Confirmed Directly with Razorpay Official API' : 'Payment Failed';
  const msg =
    `🔴 <b>PAYMENT ATTEMPT FAILED!</b>\n` +
    `<i>${verifiedBadge}</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Client:</b> ${escapeHtml(params.clientName)}\n` +
    `💼 <b>Project:</b> ${escapeHtml(params.projectTitle)}\n` +
    `🧾 <b>Invoice #:</b> <code>${escapeHtml(params.invoiceNumber)}</code>\n` +
    `💸 <b>Attempted Amount:</b> <b>₹${params.amount.toLocaleString('en-IN')}</b>\n` +
    `❌ <b>Failure Reason:</b> ${escapeHtml(params.errorReason)}\n` +
    `🆔 <b>Payment ID:</b> <code>${escapeHtml(params.paymentId)}</code>\n` +
    `⏱ <b>Failed At (IST):</b> ${escapeHtml(params.failedAtIST)}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔔 <i>Client se contact karein ya CRM se replacement link generate karein.</i>`;

  return sendTelegramMessage(msg, env);
}

// 4.2 Telegram Alert: Refund Processed
export async function sendTelegramRefundProcessedAlert(
  params: {
    clientName: string;
    projectTitle: string;
    invoiceNumber: string;
    refundAmount: number;
    refundId: string;
    paymentId: string;
    processedAtIST: string;
    isRazorpayVerified?: boolean;
  },
  env: Bindings
) {
  const verifiedBadge = params.isRazorpayVerified !== false ? '🔄 Confirmed Directly with Razorpay Official API' : 'Refund Processed';
  const msg =
    `🟡 <b>REFUND PROCESSED!</b>\n` +
    `<i>${verifiedBadge}</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Client:</b> ${escapeHtml(params.clientName)}\n` +
    `💼 <b>Project:</b> ${escapeHtml(params.projectTitle)}\n` +
    `🧾 <b>Invoice #:</b> <code>${escapeHtml(params.invoiceNumber)}</code>\n` +
    `💸 <b>Refunded Amount:</b> <b>₹${params.refundAmount.toLocaleString('en-IN')}</b>\n` +
    `🆔 <b>Refund ID:</b> <code>${escapeHtml(params.refundId)}</code>\n` +
    `💳 <b>Original Payment ID:</b> <code>${escapeHtml(params.paymentId)}</code>\n` +
    `⏱ <b>Processed At (IST):</b> ${escapeHtml(params.processedAtIST)}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `ℹ️ <i>Refund client ke source account / UPI par 5-7 working days me credit reflect hoga.</i>`;

  return sendTelegramMessage(msg, env);
}

// 5. Complete Won Deal to Project & Advance Invoice Auto-Generator
export async function autoConvertWonLeadToProjectAndInvoice(
  db: D1Database,
  leadId: string,
  input: AutoConvertWonLeadInput,
  env: Bindings,
  ctx?: { waitUntil: (p: Promise<unknown>) => void }
): Promise<{
  project: { id: string; title: string; clientName: string; budget: string };
  payment: Payment;
  paymentLinkUrl?: string;
}> {
  // 1. Fetch Lead
  const leadRow = await db
    .prepare('SELECT * FROM leads WHERE id = ?')
    .bind(leadId)
    .first<Record<string, unknown>>();

  if (!leadRow) {
    throw new Error('Lead not found');
  }

  const clientName = String(leadRow.name);
  const clientEmail = leadRow.email ? String(leadRow.email) : null;
  const clientPhone = leadRow.phone ? String(leadRow.phone) : null;
  const company = leadRow.company ? String(leadRow.company) : null;
  const serviceNeeded = leadRow.service_needed ? String(leadRow.service_needed) : 'Engineering & Design';

  const now = Date.now();
  const deadlineDays = input.deadlineDays || 30;
  const deadline = now + deadlineDays * 24 * 60 * 60 * 1000;
  const totalBudget = input.totalBudget;
  const advancePercent = input.advancePercentage || 40;
  const advanceAmount = input.customAdvanceAmount && input.customAdvanceAmount > 0
    ? Math.round(input.customAdvanceAmount)
    : Math.max(1, Math.round((totalBudget * advancePercent) / 100));

  const advanceLabel = input.customAdvanceAmount && input.customAdvanceAmount > 0
    ? `Advance Milestone: ${serviceNeeded}`
    : `${advancePercent}% Advance Milestone: ${serviceNeeded}`;

  // 1.1 Ensure Client Record exists in clients table with formatted CLT-YYYY-XXXXX
  const client = await createOrGetClient(db, {
    name: clientName,
    email: clientEmail,
    phone: clientPhone,
    company: company,
    sourceLeadId: leadId,
  });
  const clientId = client.id;

  // 2. Create Project in projects table
  const projectId = `proj_${crypto.randomUUID()}`;
  const projectTitle = `${clientName} - ${serviceNeeded}`;

  await db
    .prepare(`
      INSERT INTO projects (
        id, client_id, lead_id, title, client_name, client_email, client_phone, company, service_type, description, status, budget, start_date, deadline, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?, ?)
    `)
    .bind(
      projectId,
      clientId,
      leadId,
      projectTitle,
      clientName,
      clientEmail,
      clientPhone,
      company,
      serviceNeeded,
      `Converted from lead ${leadId}. Total budget: ₹${totalBudget.toLocaleString('en-IN')}`,
      `₹${totalBudget.toLocaleString('en-IN')}`,
      now,
      deadline,
      now,
      now
    )
    .run();

  // Create initial project milestone task
  const taskId = `task_${crypto.randomUUID()}`;
  await db
    .prepare(`
      INSERT INTO tasks (id, project_id, title, status, due_date, created_at, updated_at)
      VALUES (?, ?, 'Phase 1: Project kickoff, architecture & UI/UX design', 'in_progress', ?, ?, ?)
    `)
    .bind(taskId, projectId, now + 7 * 24 * 60 * 60 * 1000, now, now)
    .run();

  // 3. Generate Sequential Invoice Number & Line Items
  const invoiceNumber = await generateInvoiceNumber(db);
  const dueDate = now + 3 * 24 * 60 * 60 * 1000; // 3 days due
  const paymentId = `pay_${crypto.randomUUID()}`;

  const lineItems = [
    {
      num: 1,
      desc: `${advanceLabel} Initiation & Architecture`,
      qty: 1,
      rate: advanceAmount,
      amount: advanceAmount,
    },
  ];

  // 4. Create Razorpay Payment Link if keys exist
  let razorpayLinkId: string | null = null;
  let razorpayLinkUrl: string | null = null;

  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;

  if (keyId && keySecret) {
    const rzpResult = await createRazorpayPaymentLink(
      {
        amount: advanceAmount,
        invoiceNumber,
        description: `${advanceLabel}`,
        paymentDbId: paymentId,
        clientId,
        customer: {
          name: clientName,
          email: clientEmail,
          contact: clientPhone,
        },
      },
      { keyId, keySecret }
    );

    if (rzpResult) {
      razorpayLinkId = rzpResult.id;
      razorpayLinkUrl = rzpResult.shortUrl;
    }
  }

  // 5. Insert Invoice into payments table
  await db
    .prepare(`
      INSERT INTO payments (
        id, client_id, project_id, amount, status, invoice_number, paid_at, created_at,
        client_name, client_email, client_phone, company, title, due_date, notes,
        payment_method, razorpay_payment_link_id, razorpay_payment_link_url, items_json
      ) VALUES (?, ?, ?, ?, 'pending', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `)
    .bind(
      paymentId,
      clientId,
      projectId,
      String(advanceAmount),
      invoiceNumber,
      now,
      clientName,
      clientEmail,
      clientPhone,
      company,
      advanceLabel,
      dueDate,
      `Advance milestone billing for ${projectTitle}.`,
      razorpayLinkId,
      razorpayLinkUrl,
      JSON.stringify(lineItems)
    )
    .run();

  // 6. Update Lead stage to 'won' and log activity & history
  await db
    .prepare("UPDATE leads SET stage = 'won', client_id = ?, updated_at = ? WHERE id = ?")
    .bind(clientId, now, leadId)
    .run();

  const historyId = `lsh_${crypto.randomUUID()}`;
  try {
    await db
      .prepare(`
        INSERT INTO lead_status_history (id, lead_id, old_status, new_status, reason_lost, actor_id, created_at)
        VALUES (?, ?, ?, 'won', NULL, 'superadmin', ?)
      `)
      .bind(historyId, leadId, String(leadRow.stage || 'new'), now)
      .run();
  } catch {
    // Graceful fallback
  }

  const activityId = `act_${crypto.randomUUID()}`;
  await db
    .prepare(`
      INSERT INTO lead_activities (
        id, lead_id, actor_clerk_user_id, activity_type, summary, created_at
      ) VALUES (?, ?, 'superadmin', 'deal_won', ?, ?)
    `)
    .bind(
      activityId,
      leadId,
      `Deal won! Converted to client [${clientId}], project "${projectTitle}" with advance invoice ${invoiceNumber} (₹${advanceAmount.toLocaleString('en-IN')}).`,
      now
    )
    .run();

  // Log automation alert for follow-up tracking
  const alertId = `alert_inv_${now}`;
  await db
    .prepare(`
      INSERT INTO automation_alerts (
        id, type, title, message, severity, link, is_read, created_at
      ) VALUES (?, 'invoice_upcoming', ?, ?, 'info', '/billing', 0, ?)
    `)
    .bind(
      alertId,
      `Advance Invoice Generated: ${invoiceNumber}`,
      `₹${advanceAmount.toLocaleString('en-IN')} pending for ${clientName}`,
      now
    )
    .run();

  const dueDateFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dueDate));

  // 7. Background Notifications: Telegram Alert & Resend Email
  const notifyPromise = async () => {
    // A. Telegram Alert (Message 1)
    await sendTelegramPaymentLinkAlert(
      {
        clientName,
        projectTitle,
        invoiceNumber,
        amount: advanceAmount,
        totalBudget,
        paymentLinkUrl: razorpayLinkUrl || undefined,
      },
      env
    );

    // B. Resend Client Email
    if (clientEmail && env.RESEND_API_KEY && input.sendEmail) {
      await sendInvoiceEmailViaResend(
        {
          clientName,
          clientEmail,
          invoiceNumber,
          projectTitle,
          amount: advanceAmount,
          totalBudget,
          paymentLinkUrl: razorpayLinkUrl || undefined,
          dueDateFormatted,
        },
        env.RESEND_API_KEY
      );
    }
  };

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(notifyPromise());
  } else {
    notifyPromise().catch((err) => console.error('[Notification dispatch failed]:', err));
  }

  return {
    project: {
      id: projectId,
      title: projectTitle,
      clientName,
      budget: `₹${totalBudget.toLocaleString('en-IN')}`,
    },
    payment: {
      id: paymentId,
      projectId,
      leadId,
      title: `${advancePercent}% Advance Milestone - ${serviceNeeded}`,
      amount: advanceAmount,
      currency: 'INR',
      status: 'pending',
      paymentMethod: null,
      invoiceNumber,
      dueDate,
      paidAt: null,
      notes: `Advance milestone billing for ${projectTitle}.`,
      createdAt: now,
      projectTitle,
      clientName,
      clientEmail,
      clientPhone,
      company,
      razorpayPaymentLinkId: razorpayLinkId,
      razorpayPaymentLinkUrl: razorpayLinkUrl,
      itemsJson: JSON.stringify(lineItems),
    },
    paymentLinkUrl: razorpayLinkUrl || undefined,
  };
}

// 6. Handle Razorpay Webhook Events (Payment Success, Failed, Refund)
export async function handleRazorpayWebhookEvent(
  eventBody: Record<string, unknown>,
  env: Bindings,
  ctx?: { waitUntil: (p: Promise<unknown>) => void }
): Promise<{ success: boolean; message: string }> {
  const db = env.DB || env.COMMAND_DB;
  if (!db) {
    throw new Error('Database binding missing');
  }

  const eventType = String(eventBody.event || '');
  console.log('[Razorpay Webhook Processing]: eventType =', eventType);

  const payload = (eventBody.payload as Record<string, unknown>) || {};
  const paymentLinkObj = (payload.payment_link as { entity?: Record<string, unknown> })?.entity;
  const paymentObj = (payload.payment as { entity?: Record<string, unknown> })?.entity;
  const refundObj = (payload.refund as { entity?: Record<string, unknown> })?.entity;

  const paymentLinkNotes = (paymentLinkObj?.notes as Record<string, unknown>) || {};
  const paymentNotes = (paymentObj?.notes as Record<string, unknown>) || {};

  const paymentDbIdFromNotes =
    String(paymentLinkNotes.paymentDbId || paymentNotes.paymentDbId || '').trim() || null;
  const clientIdFromNotes =
    String(paymentLinkNotes.clientId || paymentNotes.clientId || '').trim() || null;
  const referenceId =
    String(paymentLinkObj?.reference_id || paymentObj?.reference_id || '').trim() || null;

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

  // Helper for fast non-blocking alert dispatch
  const dispatchAlert = (p: Promise<unknown>) => {
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(p);
    } else {
      p.catch((err) => console.error('[Webhook alert dispatch error]:', err));
    }
  };

  // Extract all possible identifiers
  const paymentLinkId = paymentLinkObj?.id
    ? String(paymentLinkObj.id)
    : paymentObj?.payment_link_id
      ? String(paymentObj.payment_link_id)
      : paymentNotes.paymentLinkId
        ? String(paymentNotes.paymentLinkId)
        : null;

  const razorpayPaymentId = paymentObj?.id
    ? String(paymentObj.id)
    : refundObj?.payment_id
      ? String(refundObj.payment_id)
      : null;

  const paymentMethod = paymentObj?.method
    ? String(paymentObj.method).toUpperCase()
    : 'UPI / Online';

  const amountInPaise = Number(paymentObj?.amount || paymentLinkObj?.amount || 0);
  const amountInRupees = amountInPaise > 0 ? amountInPaise / 100 : 0;

  // Invoice Number Extraction (from notes or description regex)
  let invoiceNumber: string | null = null;
  if (paymentLinkNotes.invoiceNumber) {
    invoiceNumber = String(paymentLinkNotes.invoiceNumber);
  } else if (paymentNotes.invoiceNumber) {
    invoiceNumber = String(paymentNotes.invoiceNumber);
  } else {
    const rawDesc = String(paymentObj?.description || paymentLinkObj?.description || '');
    const match = rawDesc.match(/INV-\d+-\d+/i);
    if (match) {
      invoiceNumber = match[0].toUpperCase();
    }
  }

  // Deep API lookup if identifiers are missing
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    const cleanKeyId = env.RAZORPAY_KEY_ID.replace(/^['"]|['"]$/g, '').trim();
    const cleanKeySec = env.RAZORPAY_KEY_SECRET.replace(/^['"]|['"]$/g, '').trim();
    const authHeader = `Basic ${btoa(`${cleanKeyId}:${cleanKeySec}`)}`;

    if (razorpayPaymentId && (!invoiceNumber || !paymentLinkId)) {
      try {
        const res = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}`, {
          headers: { Authorization: authHeader },
        });
        if (res.ok) {
          const pData = (await res.json()) as Record<string, unknown>;
          if (pData.notes && (pData.notes as Record<string, unknown>).invoiceNumber) {
            invoiceNumber = String((pData.notes as Record<string, unknown>).invoiceNumber);
          }
          if (!invoiceNumber && pData.description) {
            const m = String(pData.description).match(/INV-\d+-\d+/i);
            if (m) invoiceNumber = m[0].toUpperCase();
          }
        }
      } catch (err) {
        console.warn('[Razorpay API Fetch Payment Notes Exception]:', err);
      }
    }

    if (paymentLinkId && !invoiceNumber) {
      try {
        const res = await fetch(`https://api.razorpay.com/v1/payment_links/${paymentLinkId}`, {
          headers: { Authorization: authHeader },
        });
        if (res.ok) {
          const lData = (await res.json()) as Record<string, unknown>;
          if (lData.notes && (lData.notes as Record<string, unknown>).invoiceNumber) {
            invoiceNumber = String((lData.notes as Record<string, unknown>).invoiceNumber);
          }
        }
      } catch (err) {
        console.warn('[Razorpay API Fetch Link Notes Exception]:', err);
      }
    }
  }

  // Helper to find payment row in D1 across multiple search strategies
  async function findMatchingPaymentRow(): Promise<Record<string, unknown> | null> {
    // 0. Highest precision: by direct paymentDbId passed in notes
    if (paymentDbIdFromNotes) {
      const row = await db
        .prepare('SELECT * FROM payments WHERE id = ?')
        .bind(paymentDbIdFromNotes)
        .first<Record<string, unknown>>();
      if (row) return row;
    }

    // 0.1 By reference_id matching payment ID or invoice number
    if (referenceId) {
      const row = await db
        .prepare('SELECT * FROM payments WHERE id = ? OR invoice_number = ?')
        .bind(referenceId, referenceId)
        .first<Record<string, unknown>>();
      if (row) return row;
    }

    // 1. By razorpay_payment_link_id
    if (paymentLinkId) {
      const row = await db
        .prepare('SELECT * FROM payments WHERE razorpay_payment_link_id = ?')
        .bind(paymentLinkId)
        .first<Record<string, unknown>>();
      if (row) return row;
    }

    // 2. By invoice_number
    if (invoiceNumber) {
      const row = await db
        .prepare('SELECT * FROM payments WHERE invoice_number = ?')
        .bind(invoiceNumber)
        .first<Record<string, unknown>>();
      if (row) return row;
    }

    // 3. By razorpay_payment_id if already saved
    if (razorpayPaymentId) {
      const row = await db
        .prepare('SELECT * FROM payments WHERE razorpay_payment_id = ?')
        .bind(razorpayPaymentId)
        .first<Record<string, unknown>>();
      if (row) return row;
    }

    // 4. By amount match for pending invoices
    if (amountInRupees > 0) {
      const row = await db
        .prepare("SELECT * FROM payments WHERE status = 'pending' AND (amount = ? OR amount = ?) ORDER BY created_at DESC")
        .bind(String(amountInRupees), String(Math.round(amountInRupees)))
        .first<Record<string, unknown>>();
      if (row) return row;
    }

    // 5. By invoice number inside notes or title
    if (invoiceNumber) {
      const row = await db
        .prepare("SELECT * FROM payments WHERE notes LIKE '%' || ? || '%' OR title LIKE '%' || ? || '%' ORDER BY created_at DESC")
        .bind(invoiceNumber, invoiceNumber)
        .first<Record<string, unknown>>();
      if (row) return row;
    }

    return null;
  }

  // =========================================================================
  // CASE A: PAYMENT SUCCESS (payment_link.paid, payment.captured, payment.authorized, order.paid)
  // =========================================================================
  if (
    eventType === 'payment_link.paid' ||
    eventType === 'payment.captured' ||
    eventType === 'payment.authorized' ||
    eventType === 'order.paid'
  ) {
    const paymentRow = await findMatchingPaymentRow();

    // Idempotency: Skip duplicate processing if already recorded
    if (paymentRow && paymentRow.status === 'received') {
      console.log(`[Razorpay Webhook]: Payment ${paymentRow.id} (${paymentRow.invoice_number}) is already recorded as 'received'. Skipping duplicate webhook dispatch.`);
      return { success: true, message: `Payment ${paymentRow.invoice_number} was already confirmed.` };
    }

    // 1. Determine verified details directly from Razorpay + CRM fallback
    const effectivePaymentId = razorpayPaymentId || `pay_${now}`;
    const actualAmount = amountInRupees > 0 ? amountInRupees : Number(paymentRow?.amount || 0);
    const invNum = String(invoiceNumber || paymentRow?.invoice_number || 'INV-2026');
    const clientName = String(
      paymentRow?.client_name ||
        (paymentLinkObj?.customer as Record<string, unknown>)?.name ||
        paymentObj?.email ||
        paymentObj?.contact ||
        'Valued Client'
    );
    const projectTitle = String(
      paymentRow?.title ||
        paymentObj?.description ||
        paymentLinkObj?.description ||
        'Client Project'
    );

    // 2. DIRECT RAZORPAY CONFIRMATION & TELEGRAM ALERT DISPATCH
    let bankRef: string | undefined = undefined;
    let verifiedPaymentId = effectivePaymentId;
    let verifiedAmount = actualAmount;
    let verifiedMethod = paymentMethod;
    let isConfirmedDirectly = false;

    const keyId = env.RAZORPAY_KEY_ID?.trim();
    const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
    if (keyId && keySecret) {
      try {
        const verified = await fetchAndVerifyRazorpayStatus(
          { paymentId: razorpayPaymentId, linkId: paymentLinkId },
          { keyId, keySecret }
        );
        if (verified) {
          isConfirmedDirectly = verified.isConfirmed;
          if (verified.amountRupees > 0) verifiedAmount = verified.amountRupees;
          if (verified.paymentId) verifiedPaymentId = verified.paymentId;
          if (verified.paymentMethod) verifiedMethod = verified.paymentMethod;
          if (verified.bankRef) bankRef = verified.bankRef;
        }
      } catch (verErr) {
        console.warn('[Direct Razorpay Verification Warning]:', verErr);
      }
    }

    const effectiveEmail = String(
      paymentRow?.client_email ||
        (paymentLinkObj?.customer as Record<string, unknown>)?.email ||
        paymentObj?.email ||
        ''
    ).trim();

    const effectivePhone = String(
      paymentRow?.client_phone ||
        (paymentLinkObj?.customer as Record<string, unknown>)?.contact ||
        paymentObj?.contact ||
        ''
    ).trim();

    let pdfBytes: Uint8Array | undefined = undefined;
    try {
      pdfBytes = await generateInvoicePdf({
        invoiceNumber: invNum,
        clientId: (paymentRow?.client_id ? String(paymentRow.client_id) : undefined) || clientIdFromNotes || undefined,
        clientName,
        clientEmail: effectiveEmail || undefined,
        clientPhone: effectivePhone || undefined,
        projectTitle,
        milestoneTitle: String(paymentRow?.title || 'Milestone Delivery'),
        amount: verifiedAmount,
        paymentMode: verifiedMethod,
        transactionRef: verifiedPaymentId,
        issueDate: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date((paymentRow?.created_at as number) || now)),
        paymentDate: timeIST,
        status: 'received',
        notes: paymentRow?.notes ? String(paymentRow.notes) : undefined,
      });
    } catch (pdfErr) {
      console.warn('[Invoice PDF Generation Warning]:', pdfErr);
    }

    dispatchAlert(
      sendTelegramPaymentSuccessAlert(
        {
          clientName,
          projectTitle,
          invoiceNumber: invNum,
          milestoneTitle: String(paymentRow?.title || 'Advance Payment'),
          amount: verifiedAmount,
          paymentId: verifiedPaymentId,
          paymentMethod: verifiedMethod,
          bankRef,
          paidAtIST: timeIST,
          isRazorpayVerified: isConfirmedDirectly,
          pdfBytes,
        },
        env
      )
    );

    if (effectiveEmail && env.RESEND_API_KEY) {
      dispatchAlert(
        sendPaymentReceiptEmailViaResend(
          {
            clientName,
            clientEmail: effectiveEmail,
            invoiceNumber: invNum,
            projectTitle,
            milestoneTitle: String(paymentRow?.title || 'Payment'),
            amount: verifiedAmount,
            paymentMode: verifiedMethod,
            paymentId: verifiedPaymentId,
            paidAtFormatted: timeIST,
            pdfBytes,
          },
          env.RESEND_API_KEY
        )
      );
    }

    // 3. Update CRM database if matching row is found
    if (paymentRow) {
      const paymentDbId = String(paymentRow.id);

      // A. Update Payment status to 'received' (resilient against optional updated_at column)
      try {
        await db
          .prepare(`
            UPDATE payments
            SET status = 'received',
                paid_at = ?,
                payment_method = ?,
                razorpay_payment_id = ?,
                updated_at = ?
            WHERE id = ?
          `)
          .bind(now, paymentMethod, effectivePaymentId, now, paymentDbId)
          .run();
      } catch (sqlErr) {
        await db
          .prepare(`
            UPDATE payments
            SET status = 'received',
                paid_at = ?,
                payment_method = ?,
                razorpay_payment_id = ?
            WHERE id = ?
          `)
          .bind(now, paymentMethod, effectivePaymentId, paymentDbId)
          .run();
      }

      // B. Update Client's total_paid in clients table
      const targetClientId = clientIdFromNotes || (paymentRow.client_id ? String(paymentRow.client_id) : null);
      if (targetClientId) {
        await db
          .prepare(`
            UPDATE clients
            SET total_paid = total_paid + ?,
                updated_at = ?
            WHERE id = ?
          `)
          .bind(actualAmount, now, targetClientId)
          .run();
      } else if (clientName && clientName !== 'Valued Client') {
        await db
          .prepare(`
            UPDATE clients
            SET total_paid = total_paid + ?,
                updated_at = ?
            WHERE LOWER(name) = LOWER(?)
          `)
          .bind(actualAmount, now, clientName)
          .run();
      }

      // C. Auto-update associated Project to 'in_progress'
      if (paymentRow.project_id) {
        await db
          .prepare(`
            UPDATE projects
            SET status = CASE WHEN status = 'planning' THEN 'in_progress' ELSE status END,
                updated_at = ?
            WHERE id = ?
          `)
          .bind(now, String(paymentRow.project_id))
          .run();

        // Fetch lead_id from projects table to log activity
        const projRow = await db
          .prepare('SELECT lead_id FROM projects WHERE id = ?')
          .bind(String(paymentRow.project_id))
          .first<{ lead_id: string }>();

        if (projRow?.lead_id) {
          // Auto-update lead stage to won if not already won
          await db
            .prepare("UPDATE leads SET stage = 'won', updated_at = ? WHERE id = ? AND stage != 'won'")
            .bind(now, projRow.lead_id)
            .run();

          const actId = `act_${crypto.randomUUID()}`;
          await db
            .prepare(`
              INSERT INTO lead_activities (
                id, lead_id, actor_clerk_user_id, activity_type, summary, created_at
              ) VALUES (?, ?, 'system_webhook', 'payment_received', ?, ?)
            `)
            .bind(
              actId,
              projRow.lead_id,
              `Payment of ₹${actualAmount.toLocaleString('en-IN')} received via ${paymentMethod} (${effectivePaymentId}).`,
              now
            )
            .run();
        }
      }

      // D. Log alert in CRM
      const alertId = `alert_paid_${now}`;
      await db
        .prepare(`
          INSERT INTO automation_alerts (
            id, type, title, message, severity, link, is_read, created_at
          ) VALUES (?, 'system', ?, ?, 'info', '/billing', 0, ?)
        `)
        .bind(
          alertId,
          `Payment Received: ₹${actualAmount.toLocaleString('en-IN')}`,
          `${clientName} paid invoice ${invNum} via ${paymentMethod}`,
          now
        )
        .run();

      console.log(`[Razorpay Webhook Success]: Verified payment for ${invNum} and updated CRM for ${clientName}.`);
      return { success: true, message: `Payment for ${invNum} marked as received, database synced and Telegram alert dispatched.` };
    } else {
      console.log(`[Razorpay Direct Success]: Verified payment ${effectivePaymentId} on Razorpay, Telegram alert sent.`);
      return { success: true, message: `Payment verified on Razorpay, Telegram alert dispatched.` };
    }
  }

  // =========================================================================
  // CASE B: PAYMENT FAILED (payment.failed)
  // =========================================================================
  else if (eventType === 'payment.failed') {
    const errorDescription = String(
      paymentObj?.error_description ||
        paymentObj?.error_reason ||
        'Transaction declined by bank or user cancelled'
    );
    const effectivePaymentId = razorpayPaymentId || `pay_failed_${now}`;
    const paymentRow = await findMatchingPaymentRow();

    const clientName = String(
      paymentRow?.client_name ||
        paymentNotes.customerName ||
        paymentObj?.email ||
        paymentObj?.contact ||
        'Client'
    );
    const projectTitle = String(
      paymentRow?.title ||
        paymentObj?.description ||
        'Client Project'
    );
    const invNum = String(invoiceNumber || paymentRow?.invoice_number || 'INV');
    const actualAmount = amountInRupees > 0 ? amountInRupees : Number(paymentRow?.amount || 0);

    // Direct confirmation from Razorpay for failure reason
    let verifiedFailureReason = errorDescription;
    const keyId = env.RAZORPAY_KEY_ID?.trim();
    const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
    if (keyId && keySecret) {
      try {
        const verified = await fetchAndVerifyRazorpayStatus(
          { paymentId: razorpayPaymentId, linkId: paymentLinkId },
          { keyId, keySecret }
        );
        if (verified?.errorReason) {
          verifiedFailureReason = verified.errorReason;
        }
      } catch (e) {
        console.warn('Failed status verify warning:', e);
      }
    }

    dispatchAlert(
      sendTelegramPaymentFailedAlert(
        {
          clientName,
          projectTitle,
          invoiceNumber: invNum,
          amount: actualAmount,
          paymentId: effectivePaymentId,
          errorReason: verifiedFailureReason,
          failedAtIST: timeIST,
          isRazorpayVerified: true,
        },
        env
      )
    );

    // Log alert in CRM
    const alertId = `alert_fail_${now}`;
    await db
      .prepare(`
        INSERT INTO automation_alerts (
          id, type, title, message, severity, link, is_read, created_at
        ) VALUES (?, 'system', ?, ?, 'warning', '/billing', 0, ?)
      `)
      .bind(
        alertId,
        `Payment Failed: ${invNum}`,
        `Payment attempt of ₹${actualAmount.toLocaleString('en-IN')} for ${clientName} failed (${errorDescription})`,
        now
      )
      .run();

    console.log(`[Razorpay Webhook Failed]: Dispatched failure alert for ${invNum}. Reason: ${errorDescription}`);
    return { success: true, message: `Payment failure alert dispatched for ${invNum}.` };
  }

  // =========================================================================
  // CASE C: REFUND (refund.processed, refund.created)
  // =========================================================================
  else if (eventType === 'refund.processed' || eventType === 'refund.created') {
    const refundId = String(refundObj?.id || 'rfnd_unknown');
    const refundAmountPaise = Number(refundObj?.amount || 0);
    const refundAmountRupees = refundAmountPaise > 0 ? refundAmountPaise / 100 : 0;
    const paymentRow = await findMatchingPaymentRow();

    const clientName = String(
      paymentRow?.client_name ||
        paymentNotes.customerName ||
        'Client'
    );
    const projectTitle = String(paymentRow?.title || 'Client Project');
    const invNum = String(invoiceNumber || paymentRow?.invoice_number || 'INV');
    const effectivePaymentId = razorpayPaymentId || String(paymentRow?.razorpay_payment_id || 'unknown');

    // Update payment notes in D1 if found (maintaining status constraint valid)
    if (paymentRow) {
      try {
        await db
          .prepare(`
            UPDATE payments
            SET notes = COALESCE(notes, '') || ?,
                updated_at = ?
            WHERE id = ?
          `)
          .bind(`\n[Refund: ₹${refundAmountRupees} processed via ${refundId} at ${timeIST}]`, now, String(paymentRow.id))
          .run();
      } catch {
        await db
          .prepare(`
            UPDATE payments
            SET notes = COALESCE(notes, '') || ?
            WHERE id = ?
          `)
          .bind(`\n[Refund: ₹${refundAmountRupees} processed via ${refundId} at ${timeIST}]`, String(paymentRow.id))
          .run();
      }

      // Decrement client's total_paid in clients table
      const targetClientId = clientIdFromNotes || (paymentRow.client_id ? String(paymentRow.client_id) : null);
      if (targetClientId) {
        await db
          .prepare(`
            UPDATE clients
            SET total_paid = MAX(0, total_paid - ?),
                updated_at = ?
            WHERE id = ?
          `)
          .bind(refundAmountRupees, now, targetClientId)
          .run();
      }
    }

    // Dispatch Telegram Alert: Refund Processed ALWAYS directly from Razorpay
    dispatchAlert(
      sendTelegramRefundProcessedAlert(
        {
          clientName,
          projectTitle,
          invoiceNumber: invNum,
          refundAmount: refundAmountRupees,
          refundId,
          paymentId: effectivePaymentId,
          processedAtIST: timeIST,
        },
        env
      )
    );

    // Log alert in CRM
    const alertId = `alert_rfnd_${now}`;
    await db
      .prepare(`
        INSERT INTO automation_alerts (
          id, type, title, message, severity, link, is_read, created_at
        ) VALUES (?, 'system', ?, ?, 'info', '/billing', 0, ?)
      `)
      .bind(
        alertId,
        `Refund Processed: ₹${refundAmountRupees.toLocaleString('en-IN')}`,
        `Refund ${refundId} of ₹${refundAmountRupees.toLocaleString('en-IN')} issued for ${clientName}`,
        now
      )
      .run();

    console.log(`[Razorpay Webhook Refund]: Dispatched refund alert ${refundId} for ${clientName}.`);
    return { success: true, message: `Refund alert ${refundId} dispatched.` };
  }

  return { success: true, message: `Event ${eventType} acknowledged.` };
}
