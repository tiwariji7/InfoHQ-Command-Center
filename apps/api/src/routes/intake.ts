import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../types/env.js';
import { LeadSourceSchema } from '@infohq/shared';

export const intakeRouter = new Hono<AppContext>();

// Flexible schema supporting both InfoHQ website Astro form and standard CRM intake
export const InboundLeadIntakeSchema = z
  .object({
    name: z.string().trim().optional(),
    fullName: z.string().trim().optional(),
    email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().trim().optional().or(z.literal('')),
    company: z.string().trim().optional(),
    serviceNeeded: z.string().trim().optional(),
    serviceType: z.string().trim().optional(),
    budget: z.string().trim().optional(),
    timeline: z.string().trim().optional(),
    preferredContact: z.string().trim().optional(),
    message: z.string().trim().optional(),
    projectBrief: z.string().trim().optional(),
    website: z.string().trim().optional(), // Honeypot anti-spam field
    source: LeadSourceSchema.default('website_contact'),
  })
  .refine(
    (data) => {
      const hasName = (data.fullName && data.fullName.trim().length > 0) || (data.name && data.name.trim().length > 0);
      return hasName;
    },
    {
      message: 'Full Name is required',
      path: ['fullName'],
    }
  )
  .refine(
    (data) => (data.email && data.email.length > 0) || (data.phone && data.phone.length > 0),
    {
      message: 'Either email or phone number is required',
      path: ['phone'],
    }
  );

// Handler shared across /lead and /contact
async function handleInboundLead(c: Context<AppContext>) {
  const db = c.env.DB || c.env.COMMAND_DB;
  if (!db) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  // Parse request JSON
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'bad_request', message: 'Malformed JSON payload.' }, 400);
  }

  // Validate schema
  const parseResult = InboundLeadIntakeSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid inquiry data submitted.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  const data = parseResult.data;

  // Anti-Spam Honeypot check: If hidden 'website' input was filled by a spam bot, ignore silently
  if (data.website && data.website.trim().length > 0) {
    console.warn('[Honeypot Triggered] Spam bot submission ignored.');
    return c.json(
      {
        success: true,
        message: 'Free Consultation Booked! We will review your idea and get back to you within 1 business day.',
        targetEmail: 'contact@infohq.in',
      },
      200
    );
  }

  const clientName = (data.fullName || data.name || 'Website Inquiry').trim();
  const serviceNeeded = (data.serviceType || data.serviceNeeded || 'General Inquiry').trim();
  const clientMessage = (data.projectBrief || data.message || '').trim();
  const normalizedEmail = data.email && data.email.trim().length > 0 ? data.email.trim().toLowerCase() : null;
  const normalizedPhone = data.phone && data.phone.trim().length > 0 ? data.phone.trim() : null;
  const now = Date.now();

  try {
    // 1. Check if lead already exists by email or phone
    let existingLeadId: string | null = null;
    let isRepeatLead = false;

    if (normalizedEmail || normalizedPhone) {
      const matchConditions: string[] = [];
      const matchBindings: unknown[] = [];

      if (normalizedEmail) {
        matchConditions.push('LOWER(email) = LOWER(?)');
        matchBindings.push(normalizedEmail);
      }
      if (normalizedPhone) {
        matchConditions.push('phone = ?');
        matchBindings.push(normalizedPhone);
      }

      const dupSql = `SELECT id, name FROM leads WHERE ${matchConditions.join(' OR ')} LIMIT 1`;
      const existing = await db.prepare(dupSql).bind(...matchBindings).first<{ id: string; name: string }>();

      if (existing) {
        existingLeadId = existing.id;
        isRepeatLead = true;
      }
    }

    let finalLeadId = existingLeadId;

    if (isRepeatLead && existingLeadId) {
      // Append inquiry as a high-priority note and activity to existing lead
      const noteId = `note_${crypto.randomUUID()}`;
      const noteBody = `[New Inbound Website Consultation]\nService: ${serviceNeeded}\nBudget: ${data.budget || 'Not specified'}\nTimeline: ${data.timeline || 'Not specified'}\nPreferred Contact: ${data.preferredContact || 'Email/Phone'}\nMessage: "${clientMessage || 'No brief provided'}"`;

      await db
        .prepare(`
          INSERT INTO lead_notes (id, lead_id, body, created_by_clerk_user_id, created_at, updated_at)
          VALUES (?, ?, ?, 'system_webhook', ?, ?)
        `)
        .bind(noteId, existingLeadId, noteBody, now, now)
        .run();

      const actId = `act_${crypto.randomUUID()}`;
      await db
        .prepare(`
          INSERT INTO lead_activities (id, lead_id, actor_clerk_user_id, activity_type, summary, created_at)
          VALUES (?, ?, 'system_webhook', 'inbound_inquiry', 'Repeat website consultation request received', ?)
        `)
        .bind(actId, existingLeadId, now)
        .run();

      // Update lead timestamp
      await db
        .prepare('UPDATE leads SET updated_at = ? WHERE id = ?')
        .bind(now, existingLeadId)
        .run();
    } else {
      // 2. Create brand-new Lead record
      const leadId = `lead_${crypto.randomUUID()}`;
      finalLeadId = leadId;

      await db
        .prepare(`
          INSERT INTO leads (
            id, name, email, phone, company, service_needed, budget, timeline,
            preferred_contact, message, source, stage, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
        `)
        .bind(
          leadId,
          clientName,
          normalizedEmail,
          normalizedPhone,
          data.company?.trim() || null,
          serviceNeeded,
          data.budget?.trim() || null,
          data.timeline?.trim() || null,
          data.preferredContact?.trim() || null,
          clientMessage || null,
          data.source || 'website_contact',
          now,
          now
        )
        .run();

      // Log creation activity
      const actId = `act_${crypto.randomUUID()}`;
      await db
        .prepare(`
          INSERT INTO lead_activities (id, lead_id, actor_clerk_user_id, activity_type, summary, created_at)
          VALUES (?, ?, 'system_webhook', 'lead_created', 'Inbound consultation request received from website form', ?)
        `)
        .bind(actId, leadId, now)
        .run();

      // Create action alert in CRM
      const alertId = `alert_lead_${now}`;
      await db
        .prepare(`
          INSERT INTO automation_alerts (id, type, title, message, severity, link, is_read, created_at)
          VALUES (?, 'followup_due', ?, ?, 'info', '/leads', 0, ?)
        `)
        .bind(
          alertId,
          `New Inbound Lead: ${clientName}`,
          `${serviceNeeded} from ${normalizedPhone || normalizedEmail || 'Direct'}`,
          now
        )
        .run();
    }

    // 3. Dispatch Real-time Telegram Alert (Fire & Forget via waitUntil)
    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    const chatId = c.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const tgHeader = isRepeatLead
        ? '⚡️ *Repeat Inbound Inquiry (Existing Client)*'
        : '🔥 *New Consultation Booked on Website!*';

      const tgMessage =
        `${tgHeader}\n\n` +
        `👤 *Client Name:* ${clientName}\n` +
        `💼 *Service:* ${serviceNeeded}\n` +
        `💰 *Budget:* ${data.budget || 'Not specified'}\n` +
        `⏱ *Timeline:* ${data.timeline || 'Not specified'}\n` +
        `📞 *Phone / WhatsApp:* ${normalizedPhone || 'N/A'}\n` +
        `✉️ *Work Email:* ${normalizedEmail || 'N/A'}\n` +
        `🏢 *Company:* ${data.company?.trim() || 'N/A'}\n` +
        `🎯 *Preferred Connect:* ${data.preferredContact || 'Any'}\n\n` +
        `📝 *Project Brief:*\n_"${(clientMessage || 'No brief provided').slice(0, 300)}"_\n\n` +
        `⚡️ [Open Lead in Command Center](https://commandcenter.infohq.in)`;

      c.executionCtx.waitUntil(
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: tgMessage,
            parse_mode: 'Markdown',
          }),
        })
          .then((r) => r.json())
          .then((res) => console.log('[Telegram Intake] Alert sent:', res))
          .catch((err) => console.error('[Telegram Intake] Error sending alert:', err))
      );
    }

    return c.json(
      {
        success: true,
        message: 'Free Consultation Booked! We will review your idea and get back to you within 1 business day.',
        targetEmail: 'contact@infohq.in',
        leadId: finalLeadId,
        isRepeatLead,
      },
      201
    );
  } catch (err: unknown) {
    console.error('[Lead Intake Error]:', err);
    return c.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred while processing the inquiry.',
      },
      500
    );
  }
}

// Support both /api/intake/lead and /api/intake/contact
intakeRouter.post('/lead', handleInboundLead);
intakeRouter.post('/contact', handleInboundLead);
