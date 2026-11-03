-- Migration 0009: Add expires_at column to payments table
-- InfoHQ Command Center V2

ALTER TABLE payments ADD COLUMN expires_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_payments_expires_at ON payments(expires_at);

