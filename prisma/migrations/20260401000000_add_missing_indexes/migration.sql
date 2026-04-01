-- 添加 rejectReason 字段到 delivery_order
ALTER TABLE "delivery_order" ADD COLUMN "reject_reason" TEXT;

-- kd_bill_id 改为唯一约束（供 upsert 使用）
ALTER TABLE "delivery_order" ADD CONSTRAINT "delivery_order_kd_bill_id_key" UNIQUE ("kd_bill_id");

-- DeliveryOrder 缺失索引
CREATE INDEX "delivery_order_customer_id_idx" ON "delivery_order"("customer_id");
CREATE INDEX "delivery_order_driver_id_idx" ON "delivery_order"("driver_id");
CREATE INDEX "delivery_order_status_delivery_date_idx" ON "delivery_order"("status", "delivery_date");

-- DeliveryItem 缺失索引
CREATE INDEX "delivery_item_order_id_idx" ON "delivery_item"("order_id");

-- PrintJob 缺失索引
CREATE INDEX "print_job_order_id_idx" ON "print_job"("order_id");
CREATE INDEX "print_job_status_created_at_idx" ON "print_job"("status", "createdAt");

-- AuditLog 缺失索引
CREATE INDEX "audit_log_target_idx" ON "audit_log"("target");
CREATE INDEX "audit_log_user_id_created_at_idx" ON "audit_log"("user_id", "createdAt");
