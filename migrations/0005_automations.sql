-- Migration 0005: Automations, Cron Logs, and Active Alerts
-- InfoHQ Command Center V2

-- Automation Logs (Every cron run or scheduled execution log)
CREATE TABLE IF NOT EXISTS automation_logs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  summary TEXT NOT NULL,
  details_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_job_type ON automation_logs(job_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at DESC);

-- Alerts & Notifications (System generated alerts from cron and event triggers)
CREATE TABLE IF NOT EXISTS automation_alerts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('followup_due', 'invoice_overdue', 'invoice_upcoming', 'stale_lead', 'milestone_deadline', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_alerts_is_read ON automation_alerts(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_alerts_type ON automation_alerts(type);
