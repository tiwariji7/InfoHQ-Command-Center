import type { D1Database } from '@cloudflare/workers-types';
import type { Bindings } from '../types/env.js';
import type { AutoConvertWonLeadInput, Payment } from '@infohq/shared';

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
    customer: {
      name: string;
      email?: string | null;
      contact?: string | null;
    };
  },
  keys: { keyId: string; keySecret: string }
): Promise<RazorpayLinkResult | null> {
  const { amount, invoiceNumber, description, customer } = params;

  // Clean Indian mobile number if provided
  let contact = customer.contact ? customer.contact.replace(/[^\d+]/g, '') : undefined;
  if (contact && !contact.startsWith('+') && contact.length === 10) {
    contact = `+91${contact}`;
  }

  const payload = {
    amount: Math.round(amount * 100), // Razorpay accepts paise
    currency: 'INR',
    accept_partial: false,
    description: `${description} (${invoiceNumber})`,
    customer: {
      name: customer.name,
      email: customer.email || undefined,
      contact: contact || undefined,
    },
    notify: {
      sms: false,
      email: false,
    },
    reminder_enable: true,
    notes: {
      invoiceNumber,
      platform: 'InfoHQ Command Center',
    },
  };

  const authHeader = `Basic ${btoa(`${keys.keyId}:${keys.keySecret}`)}`;

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

// 2. Send Invoice Email via Resend
export async function sendInvoiceEmailViaResend(
  params: {
    clientName: string;
    clientEmail: string;
    invoiceNumber: string;
    projectTitle: string;
    amount: number;
    totalBudget: number;
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
    amount,
    totalBudget,
    paymentLinkUrl,
    dueDateFormatted,
  } = params;

  const formattedAmount = '₹' + amount.toLocaleString('en-IN');
  const formattedBudget = totalBudget > 0 ? '₹' + totalBudget.toLocaleString('en-IN') : formattedAmount;

  const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNumber} from InfoHQ Pvt Ltd</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; }
    .wrapper { max-width: 620px; margin: 30px auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.06); }
    .header { padding: 32px 36px 24px; border-bottom: 1px solid #F1F5F9; }
    .brand-title { font-size: 26px; font-weight: 900; color: #0F172A; margin: 0; letter-spacing: -0.5px; }
    .brand-blue { color: #2563EB; }
    .brand-sub { font-size: 13px; font-weight: 600; color: #64748B; margin-top: 2px; }
    .brand-desc { font-size: 11px; color: #94A3B8; margin-top: 6px; line-height: 1.4; }
    .badge { display: inline-block; padding: 5px 12px; border-radius: 9999px; font-size: 11px; font-weight: 800; background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; text-transform: uppercase; letter-spacing: 0.5px; }
    .content { padding: 28px 36px; }
    .cards-table { width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 24px; }
    .card-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 16px; vertical-align: top; }
    .card-label { font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
    .card-value { font-size: 13px; font-weight: 700; color: #0F172A; margin-bottom: 2px; }
    .card-detail { font-size: 12px; color: #64748B; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; }
    .items-table th { background: #F8FAFC; padding: 10px 14px; font-size: 10px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #E2E8F0; text-align: left; }
    .items-table td { padding: 14px; font-size: 12px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    .summary-box { margin-top: 20px; padding: 16px; background: #EFF6FF; border: 1px solid #DBEAFE; border-radius: 12px; }
    .summary-row { display: flex; justify-content: space-between; font-size: 13px; color: #1E293B; margin-bottom: 6px; }
    .summary-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; color: #1D4ED8; padding-top: 8px; border-top: 1px dashed #BFDBFE; }
    .btn { display: block; box-sizing: border-box; text-align: center; padding: 14px 24px; border-radius: 12px; background: #2563EB; color: #FFFFFF !important; font-size: 14px; font-weight: 800; text-decoration: none; box-shadow: 0 4px 14px rgba(37,99,235,0.3); margin: 24px 0 10px; }
    .footer { background: #F8FAFC; padding: 22px 36px; text-align: center; font-size: 11px; color: #64748B; border-top: 1px solid #E2E8F0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="top">
            <h1 class="brand-title">Info<span class="brand-blue">HQ</span></h1>
            <div class="brand-sub">Pvt Ltd</div>
            <div class="brand-desc">
              Engineering Studio for AI, SaaS &amp; Digital Systems<br>
              Prayagraj, Uttar Pradesh, India • billing@infohq.in
            </div>
          </td>
          <td align="right" valign="top">
            <span class="badge">PAYMENT DUE</span>
            <div style="font-size: 18px; font-weight: 900; color: #0F172A; margin-top: 8px; letter-spacing: 0.5px;">INVOICE</div>
            <div style="font-size: 12px; font-family: monospace; font-weight: 700; color: #1D4ED8; margin-top: 4px;">${invoiceNumber}</div>
            <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Due Date: <strong>${dueDateFormatted}</strong></div>
          </td>
        </tr>
      </table>
    </div>

    <div class="content">
      <table class="cards-table" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td class="card-box" width="50%">
            <div class="card-label">BILL TO</div>
            <div class="card-value">${clientName}</div>
            <div class="card-detail">${clientEmail}</div>
          </td>
          <td class="card-box" width="50%">
            <div class="card-label">PROJECT DELIVERABLE</div>
            <div class="card-value">${projectTitle}</div>
            <div class="card-detail">Milestone Payment</div>
          </td>
        </tr>
      </table>

      <table class="items-table" cellpadding="0" cellspacing="0" border="0">
        <thead>
          <tr>
            <th width="40">#</th>
            <th>DESCRIPTION</th>
            <th width="50" style="text-align: center;">QTY</th>
            <th width="100" style="text-align: right;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="color: #94A3B8; font-family: monospace;">1</td>
            <td><strong>${projectTitle}</strong><br><span style="color: #64748B; font-size: 11px;">Milestone kickoff &amp; system architecture deliverables</span></td>
            <td style="text-align: center; color: #64748B;">1</td>
            <td style="text-align: right; font-weight: 800; color: #0F172A;">${formattedAmount}</td>
          </tr>
        </tbody>
      </table>

      <table width="100%" style="margin-top: 20px;" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="top" style="font-size: 11px; color: #64748B; line-height: 1.5; padding-right: 20px;">
            <strong style="color: #475569; text-transform: uppercase; font-size: 10px;">Payment Terms &amp; Notes</strong><br>
            Online settlement via UPI, Debit/Credit Card, or NetBanking powered by secure Razorpay checkout.
          </td>
          <td width="220" valign="top">
            <div class="summary-box">
              <table width="100%" style="font-size: 12px; color: #475569;" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>Subtotal:</td>
                  <td align="right" style="font-weight: 600; color: #0F172A;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding-top: 4px;">Tax / GST:</td>
                  <td align="right" style="padding-top: 4px; font-weight: 600; color: #0F172A;">Nil / Exempt</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 8px; border-top: 1px dashed #BFDBFE;"></td>
                </tr>
                <tr style="font-size: 14px; font-weight: 900; color: #1D4ED8;">
                  <td>Balance Due:</td>
                  <td align="right">${formattedAmount}</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
      </table>

      ${
        paymentLinkUrl
          ? `<a href="${paymentLinkUrl}" class="btn" target="_blank">Click Here to Pay ${formattedAmount} Online</a>`
          : ''
      }
    </div>

    <div class="footer">
      <strong>InfoHQ Pvt Ltd</strong> • Prayagraj, India<br>
      This is a computer-generated tax invoice. For queries, contact <a href="mailto:billing@infohq.in" style="color: #2563EB; text-decoration: none;">billing@infohq.in</a>.
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
        from: 'InfoHQ Billing <hello@infohq.in>',
        to: [clientEmail],
        reply_to: 'billing@infohq.in',
        subject: `[InfoHQ Invoice] Advance Payment for ${projectTitle} (${invoiceNumber})`,
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

// 3. Telegram Alert: Payment Link Generated
function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const msg =
    `💳 <b>New Invoice & Razorpay Payment Link Generated!</b>\n\n` +
    `👤 <b>Client:</b> ${escapeHtml(params.clientName)}\n` +
    `💼 <b>Project:</b> ${escapeHtml(params.projectTitle)}\n` +
    `🧾 <b>Invoice #:</b> <code>${escapeHtml(params.invoiceNumber)}</code>\n` +
    `💰 <b>Advance Milestone:</b> ₹${params.amount.toLocaleString('en-IN')}\n` +
    `📊 <b>Total Contract Value:</b> ₹${params.totalBudget.toLocaleString('en-IN')}\n\n` +
    `🔗 <b>Payment Link:</b> ${params.paymentLinkUrl || 'Direct settlement'}`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      console.warn('[Telegram Link Alert Warning]: HTTP', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Telegram Link Alert Failed]:', err);
  }
}

// 4. Telegram Alert: Payment Success Verified
export async function sendTelegramPaymentSuccessAlert(
  params: {
    clientName: string;
    projectTitle: string;
    invoiceNumber: string;
    amount: number;
    paymentId: string;
    paymentMethod?: string;
    paidAtIST: string;
  },
  env: Bindings
) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const msg =
    `✅ <b>Payment Received &amp; Verified!</b>\n\n` +
    `👤 <b>Client:</b> ${escapeHtml(params.clientName)}\n` +
    `💼 <b>Project:</b> ${escapeHtml(params.projectTitle)}\n` +
    `🧾 <b>Invoice #:</b> <code>${escapeHtml(params.invoiceNumber)}</code>\n` +
    `💰 <b>Amount Paid:</b> ₹${params.amount.toLocaleString('en-IN')}\n` +
    `💳 <b>Razorpay ID:</b> <code>${escapeHtml(params.paymentId)}</code>\n` +
    `🏦 <b>Method:</b> ${escapeHtml(params.paymentMethod || 'UPI / Online')}\n` +
    `📅 <b>Settled At:</b> ${escapeHtml(params.paidAtIST)}\n\n` +
    `🚀 <b>CRM Action:</b> Invoice marked as PAID &amp; Receipt logged.`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      console.warn('[Telegram Success Alert Warning]: HTTP', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Telegram Success Alert Failed]:', err);
  }
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
  },
  env: Bindings
) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const msg =
    `⚠️ <b>Payment Attempt Failed Alert!</b>\n\n` +
    `👤 <b>Client:</b> ${escapeHtml(params.clientName)}\n` +
    `💼 <b>Project:</b> ${escapeHtml(params.projectTitle)}\n` +
    `🧾 <b>Invoice #:</b> <code>${escapeHtml(params.invoiceNumber)}</code>\n` +
    `💰 <b>Amount:</b> ₹${params.amount.toLocaleString('en-IN')}\n` +
    `❌ <b>Reason:</b> ${escapeHtml(params.errorReason)}\n` +
    `🆔 <b>Payment ID:</b> <code>${escapeHtml(params.paymentId)}</code>\n` +
    `⏱ <b>Failed At:</b> ${escapeHtml(params.failedAtIST)}\n\n` +
    `ℹ️ Client se contact karein ya link dobara verify karein.`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      console.warn('[Telegram Payment Failed Alert Warning]: HTTP', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Telegram Payment Failed Alert Exception]:', err);
  }
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
  },
  env: Bindings
) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const msg =
    `🔄 <b>Refund Processed Alert</b>\n\n` +
    `👤 <b>Client:</b> ${escapeHtml(params.clientName)}\n` +
    `💼 <b>Project:</b> ${escapeHtml(params.projectTitle)}\n` +
    `🧾 <b>Invoice #:</b> <code>${escapeHtml(params.invoiceNumber)}</code>\n` +
    `💸 <b>Refunded Amount:</b> ₹${params.refundAmount.toLocaleString('en-IN')}\n` +
    `🆔 <b>Refund ID:</b> <code>${escapeHtml(params.refundId)}</code>\n` +
    `💳 <b>Original Payment ID:</b> <code>${escapeHtml(params.paymentId)}</code>\n` +
    `⏱ <b>Processed At:</b> ${escapeHtml(params.processedAtIST)}\n\n` +
    `ℹ️ Refund client ke original payment method par 5-7 din me settle hoga.`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      console.warn('[Telegram Refund Alert Warning]: HTTP', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Telegram Refund Alert Exception]:', err);
  }
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

  // 2. Create Project in projects table
  const projectId = `proj_${crypto.randomUUID()}`;
  const projectTitle = `${clientName} - ${serviceNeeded}`;

  await db
    .prepare(`
      INSERT INTO projects (
        id, lead_id, title, client_name, status, budget, start_date, deadline, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'planning', ?, ?, ?, ?, ?)
    `)
    .bind(
      projectId,
      leadId,
      projectTitle,
      clientName,
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

  // 3. Generate Invoice Number & Line Items
  const invoiceSuffix = Math.floor(100 + Math.random() * 900);
  const invoiceNumber = `INV-2026-${invoiceSuffix}`;
  const dueDate = now + 3 * 24 * 60 * 60 * 1000; // 3 days due

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
  const paymentId = `pay_${crypto.randomUUID()}`;
  await db
    .prepare(`
      INSERT INTO payments (
        id, project_id, amount, status, invoice_number, paid_at, created_at,
        client_name, client_email, client_phone, title, due_date, notes,
        payment_method, razorpay_payment_link_id, razorpay_payment_link_url, items_json
      ) VALUES (?, ?, ?, 'pending', ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `)
    .bind(
      paymentId,
      projectId,
      String(advanceAmount),
      invoiceNumber,
      now,
      clientName,
      clientEmail,
      clientPhone,
      advanceLabel,
      dueDate,
      `Advance milestone billing for ${projectTitle}.`,
      razorpayLinkId,
      razorpayLinkUrl,
      JSON.stringify(lineItems)
    )
    .run();

  // 6. Update Lead stage to 'won' and log activity
  await db
    .prepare("UPDATE leads SET stage = 'won', updated_at = ? WHERE id = ?")
    .bind(now, leadId)
    .run();

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
      `Deal won! Converted to project "${projectTitle}" with advance invoice ${invoiceNumber} (₹${advanceAmount.toLocaleString('en-IN')}).`,
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
  env: Bindings
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

  // Extract all possible identifiers
  const paymentLinkId = paymentLinkObj?.id
    ? String(paymentLinkObj.id)
    : paymentObj?.payment_link_id
      ? String(paymentObj.payment_link_id)
      : (paymentObj?.notes as Record<string, unknown>)?.paymentLinkId
        ? String((paymentObj?.notes as Record<string, unknown>).paymentLinkId)
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
  if (paymentLinkObj?.notes && (paymentLinkObj.notes as Record<string, unknown>).invoiceNumber) {
    invoiceNumber = String((paymentLinkObj.notes as Record<string, unknown>).invoiceNumber);
  } else if (paymentObj?.notes && (paymentObj.notes as Record<string, unknown>).invoiceNumber) {
    invoiceNumber = String((paymentObj.notes as Record<string, unknown>).invoiceNumber);
  } else {
    const rawDesc = String(paymentObj?.description || paymentLinkObj?.description || '');
    const match = rawDesc.match(/INV-\d+-\d+/i);
    if (match) {
      invoiceNumber = match[0].toUpperCase();
    }
  }

  // Deep API lookup if identifiers are missing
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    const authHeader = `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`;
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

    // 6. Fallback: by amount for recent invoices (created within 48h)
    if (amountInRupees > 0) {
      const row = await db
        .prepare("SELECT * FROM payments WHERE (amount = ? OR amount = ?) ORDER BY created_at DESC")
        .bind(String(amountInRupees), String(Math.round(amountInRupees)))
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

    // 2. DISPATCH TELEGRAM ALERT DIRECTLY FROM RAZORPAY CONFIRMATION (Independent of CRM match)
    await sendTelegramPaymentSuccessAlert(
      {
        clientName,
        projectTitle,
        invoiceNumber: invNum,
        amount: actualAmount,
        paymentId: effectivePaymentId,
        paymentMethod,
        paidAtIST: timeIST,
      },
      env
    );

    // 3. Update CRM database if matching row is found
    if (paymentRow) {
      const paymentDbId = String(paymentRow.id);

      // A. Update Payment status to 'received'
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

      // B. Auto-update associated Project to 'in_progress'
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

      // C. Log alert in CRM
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
      return { success: true, message: `Payment for ${invNum} marked as received and Telegram alert dispatched.` };
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
        (paymentObj?.notes as Record<string, unknown>)?.customerName ||
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

    // Dispatch Telegram Alert: Payment Failed ALWAYS directly from Razorpay
    await sendTelegramPaymentFailedAlert(
      {
        clientName,
        projectTitle,
        invoiceNumber: invNum,
        amount: actualAmount,
        paymentId: effectivePaymentId,
        errorReason: errorDescription,
        failedAtIST: timeIST,
      },
      env
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
        (paymentObj?.notes as Record<string, unknown>)?.customerName ||
        'Client'
    );
    const projectTitle = String(paymentRow?.title || 'Client Project');
    const invNum = String(invoiceNumber || paymentRow?.invoice_number || 'INV');
    const effectivePaymentId = razorpayPaymentId || String(paymentRow?.razorpay_payment_id || 'unknown');

    // Update payment status in D1 if found
    if (paymentRow) {
      await db
        .prepare(`
          UPDATE payments
          SET status = 'refunded',
              notes = COALESCE(notes, '') || ?
          WHERE id = ?
        `)
        .bind(`\n[Refund: ₹${refundAmountRupees} processed via ${refundId} at ${timeIST}]`, String(paymentRow.id))
        .run();
    }

    // Dispatch Telegram Alert: Refund Processed ALWAYS directly from Razorpay
    await sendTelegramRefundProcessedAlert(
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
