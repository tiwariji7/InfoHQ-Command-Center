-- Migration 0006: Invoices Enhancement and Razorpay Integration
-- InfoHQ Command Center V2

ALTER TABLE payments ADD COLUMN client_name TEXT;
ALTER TABLE payments ADD COLUMN client_email TEXT;
ALTER TABLE payments ADD COLUMN client_phone TEXT;
ALTER TABLE payments ADD COLUMN title TEXT;
ALTER TABLE payments ADD COLUMN due_date INTEGER;
ALTER TABLE payments ADD COLUMN notes TEXT;
ALTER TABLE payments ADD COLUMN payment_method TEXT;
ALTER TABLE payments ADD COLUMN razorpay_payment_link_id TEXT;
ALTER TABLE payments ADD COLUMN razorpay_payment_link_url TEXT;
ALTER TABLE payments ADD COLUMN razorpay_payment_id TEXT;
ALTER TABLE payments ADD COLUMN items_json TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_link_id ON payments(razorpay_payment_link_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON payments(razorpay_payment_id);
