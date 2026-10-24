-- Migration 0001: Initial users / Superadmin allowlist table
-- InfoHQ Command Center V2

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('superadmin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users (clerk_user_id);
