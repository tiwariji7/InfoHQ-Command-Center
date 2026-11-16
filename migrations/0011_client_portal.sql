-- Migration 0011: Client Portal Tokens and Access Keys
-- InfoHQ Command Center V2

ALTER TABLE clients ADD COLUMN portal_token TEXT;
ALTER TABLE clients ADD COLUMN portal_enabled INTEGER DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_portal_token ON clients(portal_token);
