-- Migration 0008: Add updated_at column to payments table
ALTER TABLE payments ADD COLUMN updated_at INTEGER;

