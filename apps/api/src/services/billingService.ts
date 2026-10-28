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
    callback_url: 'https://commandcenter.infohq.in/billing',
    callback_method: 'get',
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

  const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice from InfoHQ Pvt Ltd</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8F7FC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1A085C; }
    .container { max-width: 600px; margin: 30px auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #EDE8F5; overflow: hidden; box-shadow: 0 10px 30px rgba(26,8,92,0.06); }
    .header { background: #FFFFFF; padding: 32px 36px 20px; border-bottom: 1px solid #EDE8F5; }
    .brand { font-size: 26px; font-weight: 800; background: linear-gradient(90deg, #7C5CE8, #6366F1, #5B4CF5); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #FAF5FF; color: #6B21A8; border: 1px solid #F3E8FF; }
    .content { padding: 32px 36px; }
    .title { font-size: 22px; font-weight: 800; margin: 0 0 8px; color: #1A085C; }
    .meta-box { background: #FAF9FD; border-radius: 12px; border: 1px solid #EDE8F5; padding: 18px 22px; margin: 24px 0; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; border-bottom: 1px solid #EDE8F5; }
    .row:last-child { border-bottom: none; font-weight: 800; font-size: 15px; color: #7C3AED; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; text-align: center; padding: 15px 20px; border-radius: 12px; background: linear-gradient(90deg, #7C3AED, #8B5CF6); color: #FFFFFF !important; font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 15px rgba(124,58,237,0.3); margin-top: 10px; }
    .footer { background: #FAF9FD; padding: 24px 36px; text-align: center; font-size: 11px; color: #6B7280; border-top: 1px solid #EDE8F5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <table width="100%">
        <tr>
          <td><span class="brand">InfoHQ</span></td>
          <td align="right"><span class="badge">Milestone Invoice</span></td>
        </tr>
      </table>
    </div>
    <div class="content">
      <h1 class="title">Advance Payment Invoice</h1>
      <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0;">
        Hello <strong>${clientName}</strong>, thank you for choosing InfoHQ! Your milestone advance invoice has been generated for <strong>${projectTitle}</strong>.
      </p>

      <div class="meta-box">
        <div class="row"><span>Invoice Number:</span><span><strong>${invoiceNumber}</strong></span></div>
        <div class="row"><span>Due Date:</span><span>${dueDateFormatted}</span></div>
        <div class="row"><span>Total Project Value:</span><span>₹${totalBudget.toLocaleString('en-IN')}</span></div>
        <div class="row"><span>40% Advance Due:</span><span>₹${amount.toLocaleString('en-IN')}</span></div>
      </div>

      ${
        paymentLinkUrl
          ? `<a href="${paymentLinkUrl}" class="btn" target="_blank">Pay ₹${amount.toLocaleString('en-IN')} via UPI / Card (Razorpay)</a>`
          : ''
      }

      <p style="font-size: 12px; color: #6B7280; margin-top: 24px; text-align: center;">
        Direct Bank Transfer (NEFT/IMPS) or UPI available on the secure payment link above.
      </p>
    </div>
    <div class="footer">
      <strong>InfoHQ Pvt Ltd</strong> • Prayagraj, India<br>
      For any inquiries, contact <a href="mailto:billing@infohq.in" style="color: #7C3AED;">billing@infohq.in</a>
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
    `💳 *New Invoice & Razorpay Payment Link Generated!*\n\n` +
    `👤 *Client:* ${params.clientName}\n` +
    `💼 *Project:* ${params.projectTitle}\n` +
    `🧾 *Invoice #:* \`${params.invoiceNumber}\`\n` +
    `💰 *Advance Due (40%):* ₹${params.amount.toLocaleString('en-IN')}\n` +
    `📊 *Total Contract Value:* ₹${params.totalBudget.toLocaleString('en-IN')}\n\n` +
    `🔗 *Payment Link:* ${params.paymentLinkUrl || 'Direct settlement'}\n\n` +
    `⚡️ [Open Billing in Command Center](https://commandcenter.infohq.in/billing)`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown',
      }),
    });
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
    `✅ *Payment Received & Verified!*\n\n` +
    `👤 *Client:* ${params.clientName}\n` +
    `💼 *Project:* ${params.projectTitle}\n` +
    `🧾 *Invoice #:* \`${params.invoiceNumber}\`\n` +
    `💰 *Amount Paid:* ₹${params.amount.toLocaleString('en-IN')}\n` +
    `💳 *Razorpay ID:* \`${params.paymentId}\`\n` +
    `🏦 *Method:* ${params.paymentMethod || 'UPI / Online'}\n` +
    `📅 *Settled At:* ${params.paidAtIST}\n\n` +
    `🚀 *CRM Action:* Invoice marked as PAID & Receipt logged.\n` +
    `⚡️ [View Receipt in Command Center](https://commandcenter.infohq.in/billing)`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('[Telegram Success Alert Failed]:', err);
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
  const advanceAmount = Math.round((totalBudget * advancePercent) / 100);

  // 2. Create Project in projects table
  const projectId = `proj_${crypto.randomUUID()}`;
  const projectTitle = `${clientName} - ${serviceNeeded}`;

  await db
    .prepare(`
      INSERT INTO projects (
        id, lead_id, title, client_name, status, budget, start_date, deadline, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, ?)
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
      desc: `${advancePercent}% Advance Milestone: ${serviceNeeded} Initiation & Architecture`,
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
        description: `${advancePercent}% Advance: ${serviceNeeded}`,
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
      `${advancePercent}% Advance Milestone - ${serviceNeeded}`,
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
      `Deal won! Converted to project "${projectTitle}" with 40% advance invoice ${invoiceNumber} (₹${advanceAmount.toLocaleString('en-IN')}).`,
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

// 6. Handle Razorpay Webhook Event for Payment Success
export async function handleRazorpayWebhookEvent(
  eventBody: Record<string, unknown>,
  env: Bindings
): Promise<{ success: boolean; message: string }> {
  const db = env.DB || env.COMMAND_DB;
  if (!db) {
    throw new Error('Database binding missing');
  }

  const eventType = String(eventBody.event || '');
  console.log('[Razorpay Webhook Received]:', eventType);

  // We handle payment_link.paid, payment.captured, or order.paid
  if (eventType === 'payment_link.paid' || eventType === 'payment.captured') {
    const payload = eventBody.payload as Record<string, unknown>;
    const paymentLinkObj = (payload?.payment_link as { entity?: Record<string, unknown> })?.entity;
    const paymentObj = (payload?.payment as { entity?: Record<string, unknown> })?.entity;

    const paymentLinkId = paymentLinkObj?.id ? String(paymentLinkObj.id) : null;
    const razorpayPaymentId = paymentObj?.id ? String(paymentObj.id) : `pay_${Date.now()}`;
    const paymentMethod = paymentObj?.method ? String(paymentObj.method).toUpperCase() : 'UPI / Online';
    const amountInPaise = Number(paymentObj?.amount || paymentLinkObj?.amount || 0);
    const amountInRupees = amountInPaise > 0 ? amountInPaise / 100 : 0;
    const now = Date.now();

    // Find payment record in D1
    let paymentRow: Record<string, unknown> | null = null;
    if (paymentLinkId) {
      paymentRow = await db
        .prepare('SELECT * FROM payments WHERE razorpay_payment_link_id = ?')
        .bind(paymentLinkId)
        .first<Record<string, unknown>>();
    }

    if (!paymentRow && paymentLinkObj?.notes) {
      const invoiceNum = (paymentLinkObj.notes as Record<string, unknown>)?.invoiceNumber;
      if (invoiceNum) {
        paymentRow = await db
          .prepare('SELECT * FROM payments WHERE invoice_number = ?')
          .bind(String(invoiceNum))
          .first<Record<string, unknown>>();
      }
    }

    if (paymentRow) {
      const paymentDbId = String(paymentRow.id);
      const invoiceNumber = String(paymentRow.invoice_number || 'INV-2026');
      const clientName = String(paymentRow.client_name || 'Client');
      const actualAmount = amountInRupees > 0 ? amountInRupees : Number(paymentRow.amount);

      // Update payment to 'received'
      await db
        .prepare(`
          UPDATE payments
          SET status = 'received',
              paid_at = ?,
              payment_method = ?,
              razorpay_payment_id = ?
          WHERE id = ?
        `)
        .bind(now, paymentMethod, razorpayPaymentId, paymentDbId)
        .run();

      const timeIST = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(now));

      // Dispatch Telegram Message 2: Payment Success Verified
      await sendTelegramPaymentSuccessAlert(
        {
          clientName,
          projectTitle: String(paymentRow.title || 'Client Project'),
          invoiceNumber,
          amount: actualAmount,
          paymentId: razorpayPaymentId,
          paymentMethod,
          paidAtIST: timeIST,
        },
        env
      );

      // Log alert in CRM
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
          `${clientName} paid invoice ${invoiceNumber} via ${paymentMethod}`,
          now
        )
        .run();

      return { success: true, message: `Payment for ${invoiceNumber} marked as received.` };
    }
  }

  return { success: true, message: 'Event acknowledged.' };
}
