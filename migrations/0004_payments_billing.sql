-- Migration 0004: Payments and Milestone Billing (Mirrors existing Cloudflare D1 Studio schema)
-- InfoHQ Command Center V2

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'failed')),
  invoice_number TEXT,
  paid_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_project_id ON payments(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
