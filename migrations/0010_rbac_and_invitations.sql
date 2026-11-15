-- Migration 0010: Multi-user RBAC, Invitations, and Granular Permissions
-- InfoHQ Command Center V2

ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN permissions_json TEXT;
ALTER TABLE users ADD COLUMN invited_by TEXT;
ALTER TABLE users ADD COLUMN last_active_at INTEGER;

-- Invitations table for strict Superadmin-only invite gate
CREATE TABLE IF NOT EXISTS user_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  permissions_json TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON user_invitations(status);
