-- Migration 0007: Clients Table, Lead Status History, and Cross-Table Schema Sync
-- InfoHQ Command Center V2

-- 1. Clients Central Master Table
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY, -- Formatted ID: CLT-YYYY-XXXXX (e.g., CLT-2026-00001)
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  address TEXT,
  source_lead_id TEXT REFERENCES leads(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  total_billed REAL DEFAULT 0,
  total_paid REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

-- 2. Lead Status History (Auditable log for stage transitions & lost/junk tracking)
CREATE TABLE IF NOT EXISTS lead_status_history (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason_lost TEXT,
  actor_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id ON lead_status_history(lead_id, created_at DESC);

-- 3. Synchronize leads table with clients
ALTER TABLE leads ADD COLUMN client_id TEXT REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);

-- 4. Synchronize projects table with clients and missing contact/description columns
ALTER TABLE projects ADD COLUMN client_id TEXT REFERENCES clients(id);
ALTER TABLE projects ADD COLUMN client_email TEXT;
ALTER TABLE projects ADD COLUMN client_phone TEXT;
ALTER TABLE projects ADD COLUMN company TEXT;
ALTER TABLE projects ADD COLUMN service_type TEXT;
ALTER TABLE projects ADD COLUMN description TEXT;
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);

-- 5. Synchronize tasks table with priority and description
ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
ALTER TABLE tasks ADD COLUMN description TEXT;
ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);

-- 6. Synchronize payments table with client_id and company
ALTER TABLE payments ADD COLUMN client_id TEXT REFERENCES clients(id);
ALTER TABLE payments ADD COLUMN company TEXT;
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);

