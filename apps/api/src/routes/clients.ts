import { Hono } from 'hono';
import type { AppContext } from '../types/env.js';
import { requireSuperadmin } from '../middleware/auth.js';
import { CreateClientSchema, UpdateClientSchema } from '@infohq/shared';
import {
  getClients,
  getClientByIdOrName,
  createOrGetClient,
} from '../services/clientService.js';

export const clientsRouter = new Hono<AppContext>();

// Require authentication for all client management routes
clientsRouter.use('*', requireSuperadmin);

// GET /api/clients - List all clients with aggregated financial and project stats
clientsRouter.get('/', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const search = c.req.query('search');

  try {
    const clients = await getClients(c.env.DB, { search });
    return c.json({ data: clients });
  } catch (err: unknown) {
    console.error('Error fetching clients:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to fetch clients.' }, 500);
  }
});

// GET /api/clients/:idOrName - Get client detail with linked projects and invoices
clientsRouter.get('/:idOrName', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  const idOrName = c.req.param('idOrName');

  try {
    const clientDetail = await getClientByIdOrName(c.env.DB, idOrName);
    if (!clientDetail) {
      return c.json({ error: 'not_found', message: 'Client not found.' }, 404);
    }
    return c.json(clientDetail);
  } catch (err: unknown) {
    console.error('Error retrieving client detail:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to retrieve client.' }, 500);
  }
});

// POST /api/clients - Register or create a client with unique CLT-YYYY-XXXXX
clientsRouter.post('/', async (c) => {
  if (!c.env.DB) {
    return c.json({ error: 'service_unavailable', message: 'Database binding not configured.' }, 503);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'bad_request', message: 'Malformed JSON payload.' }, 400);
  }

  const parseResult = CreateClientSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      {
        error: 'validation_error',
        message: 'Invalid client input.',
        details: parseResult.error.format(),
      },
      400
    );
  }

  try {
    const client = await createOrGetClient(c.env.DB, parseResult.data);
    return c.json({ success: true, data: client }, 201);
  } catch (err: unknown) {
    console.error('Error creating client:', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal_error', message: 'Failed to create client.' }, 500);
  }
});

