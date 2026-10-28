import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import { requireSuperadmin } from '../middleware/auth.js';
import {
  CreateLeadSchema,
  LeadListQuerySchema,
  UpdateLeadStageSchema,
  CreateLeadNoteSchema,
  SetFollowUpSchema,
  AutoConvertWonLeadSchema,
} from '@infohq/shared';
import { autoConvertWonLeadToProjectAndInvoice } from '../services/billingService.js';
import {
  getLeads,
  createLead,
  checkDuplicate,
  getLeadById,
  updateLeadStage,
  addLeadNote,
  setLeadFollowUp,
  DuplicateLeadError,
} from '../services/leadService.js';

export const leadsRouter = new Hono<AppContext>();

// Require Superadmin authentication on all leads routes
leadsRouter.use('*', requireSuperadmin);

// GET /api/leads - Paginated and filtered lead list
leadsRouter.get('/', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const queryParams = c.req.query();
  const parseResult = LeadListQuerySchema.safeParse(queryParams);

  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid query parameters.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  try {
    const result = await getLeads(c.env.DB, parseResult.data);
    return c.json(result);
  } catch (err: unknown) {
    console.error('Error fetching leads:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to retrieve leads.' }, 500);
  }
});

// GET /api/leads/check-duplicate - Check for existing lead by email or phone
leadsRouter.get('/check-duplicate', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const email = c.req.query('email');
  const phone = c.req.query('phone');
  const excludeLeadId = c.req.query('excludeLeadId');

  try {
    const result = await checkDuplicate(c.env.DB, { email, phone, excludeLeadId });
    return c.json(result);
  } catch (err: unknown) {
    console.error('Error checking duplicate:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Duplicate check failed.' }, 500);
  }
});

// POST /api/leads - Create lead manually (Superadmin)
leadsRouter.post('/', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'bad_request', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = CreateLeadSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Validation failed for lead input.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  const user = c.get('user');

  try {
    const created = await createLead(c.env.DB, parseResult.data, user.clerkUserId);
    return c.json({ success: true, data: created }, 201);
  } catch (err: unknown) {
    if (err instanceof DuplicateLeadError) {
      return c.json(
        {
          error: 'duplicate_lead',
          message: 'Potential duplicate lead detected.',
          matches: err.matches,
        },
        409
      );
    }

    console.error('Error creating lead:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to create lead.' }, 500);
  }
});

// GET /api/leads/:id - Detail view with activities and notes
leadsRouter.get('/:id', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const leadId = c.req.param('id');
  try {
    const leadDetail = await getLeadById(c.env.DB, leadId);
    if (!leadDetail) {
      return c.json({ error: 'not_found', message: 'Lead not found.' }, 404);
    }
    return c.json(leadDetail);
  } catch (err: unknown) {
    console.error('Error getting lead details:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to retrieve lead details.' }, 500);
  }
});

// PATCH /api/leads/:id/stage - Update lead stage and log activity
leadsRouter.patch('/:id/stage', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const leadId = c.req.param('id');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'bad_request', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = UpdateLeadStageSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Validation failed for stage update.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  const user = c.get('user');

  try {
    const updatedLead = await updateLeadStage(c.env.DB, leadId, parseResult.data, user.clerkUserId);
    if (!updatedLead) {
      return c.json({ error: 'not_found', message: 'Lead not found.' }, 404);
    }
    return c.json({ success: true, data: updatedLead });
  } catch (err: unknown) {
    console.error('Error updating lead stage:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to update lead stage.' }, 500);
  }
});

// POST /api/leads/:id/notes - Add authored internal note
leadsRouter.post('/:id/notes', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const leadId = c.req.param('id');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'bad_request', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = CreateLeadNoteSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid note content.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  const user = c.get('user');

  try {
    const note = await addLeadNote(c.env.DB, leadId, parseResult.data.body, user.clerkUserId);
    if (!note) {
      return c.json({ error: 'not_found', message: 'Lead not found.' }, 404);
    }
    return c.json({ success: true, data: note }, 201);
  } catch (err: unknown) {
    console.error('Error adding lead note:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to add note.' }, 500);
  }
});

// PATCH /api/leads/:id/follow-up - Schedule or clear follow-up
leadsRouter.patch('/:id/follow-up', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const leadId = c.req.param('id');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'bad_request', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = SetFollowUpSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid follow-up timestamp.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  const user = c.get('user');

  try {
    const updatedLead = await setLeadFollowUp(c.env.DB, leadId, parseResult.data.nextFollowUpAt, user.clerkUserId);
    if (!updatedLead) {
      return c.json({ error: 'not_found', message: 'Lead not found.' }, 404);
    }
    return c.json({ success: true, data: updatedLead });
  } catch (err: unknown) {
    console.error('Error scheduling follow-up:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to schedule follow-up.' }, 500);
  }
});

// POST /api/leads/:id/auto-convert - Convert won deal to project, generate 40% advance invoice, Razorpay link, Telegram alert & Resend email
leadsRouter.post('/:id/auto-convert', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const leadId = c.req.param('id');
  let body: unknown = {};
  try {
    body = await c.req.json();
  } catch {
    // empty body fallback
  }

  const parseResult = AutoConvertWonLeadSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid budget or advance percentage provided.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  try {
    const result = await autoConvertWonLeadToProjectAndInvoice(
      c.env.DB,
      leadId,
      parseResult.data,
      c.env,
      c.executionCtx
    );
    return c.json({ success: true, ...result });
  } catch (err: unknown) {
    console.error('Error auto-converting lead:', err instanceof Error ? err.message : err);
    return c.json(
      { error: 'internal_error', message: err instanceof Error ? err.message : 'Failed to auto-convert lead.' },
      500
    );
  }
});

