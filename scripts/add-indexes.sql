-- Additional performance indexes for the chaoqun-sign database.
--
-- All statements use CREATE INDEX IF NOT EXISTS so the script is safe
-- to re-run at any time without errors.
--
-- Run via: psql $DATABASE_URL -f scripts/add-indexes.sql
-- ---------------------------------------------------------------------------

-- delivery_order: look up orders by driver + date (driver dashboard queries)
CREATE INDEX IF NOT EXISTS idx_delivery_order_driver_date
    ON delivery_order (driver_id, delivery_date DESC);

-- delivery_order: filter by status + date (admin list / batch status changes)
CREATE INDEX IF NOT EXISTS idx_delivery_order_status_date
    ON delivery_order (status, delivery_date DESC);

-- delivery_order: customer history sorted by date
CREATE INDEX IF NOT EXISTS idx_delivery_order_customer_date
    ON delivery_order (customer_id, delivery_date DESC);

-- delivery_order: token expiry — speeds up the cleanup job and token lookups
CREATE INDEX IF NOT EXISTS idx_delivery_order_sign_token_expiry
    ON delivery_order (sign_token_expiry)
    WHERE sign_token_expiry IS NOT NULL;

-- sign_record: sort / filter by when a delivery was signed
CREATE INDEX IF NOT EXISTS idx_sign_record_signed_at
    ON sign_record (signed_at DESC);

-- print_job: admin print-queue polling (status + age)
CREATE INDEX IF NOT EXISTS idx_print_job_status_created_at
    ON print_job (status, created_at DESC);

-- audit_log: user activity report (user_id + time range)
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created_at
    ON audit_log (user_id, created_at DESC);
