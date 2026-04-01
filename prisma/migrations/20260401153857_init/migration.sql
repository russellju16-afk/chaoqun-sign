-- CreateEnum
CREATE TYPE "SignMode" AS ENUM ('DIGITAL', 'PAPER', 'BOTH');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'DELIVERED', 'SIGNED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrintStatus" AS ENUM ('QUEUED', 'PRINTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DRIVER', 'VIEWER');

-- CreateTable
CREATE TABLE "driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_config" (
    "id" TEXT NOT NULL,
    "kd_customer_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "sign_mode" "SignMode" NOT NULL DEFAULT 'DIGITAL',
    "contact_phone" TEXT,
    "contact_name" TEXT,
    "require_photo" BOOLEAN NOT NULL DEFAULT false,
    "auto_print" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_order" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "kd_bill_id" TEXT,
    "kd_bill_no" TEXT,
    "customer_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "customer_address" TEXT,
    "driver_id" TEXT,
    "total_amount" BIGINT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "sign_token" TEXT,
    "sign_token_expiry" TIMESTAMP(3),
    "delivery_date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_item" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "kd_material_id" TEXT,
    "product_name" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "remark" TEXT,

    CONSTRAINT "delivery_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_record" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "signer_name" TEXT NOT NULL,
    "signer_phone" TEXT,
    "signature_url" TEXT NOT NULL,
    "photo_urls" TEXT[],
    "remark" TEXT,
    "signed_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_job" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "printer_name" TEXT NOT NULL,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "status" "PrintStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "detail" TEXT,
    "ip_address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_phone_key" ON "driver"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customer_config_kd_customer_id_key" ON "customer_config"("kd_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_order_order_no_key" ON "delivery_order"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_order_sign_token_key" ON "delivery_order"("sign_token");

-- CreateIndex
CREATE INDEX "delivery_order_kd_bill_no_idx" ON "delivery_order"("kd_bill_no");

-- CreateIndex
CREATE INDEX "delivery_order_status_idx" ON "delivery_order"("status");

-- CreateIndex
CREATE INDEX "delivery_order_delivery_date_idx" ON "delivery_order"("delivery_date");

-- CreateIndex
CREATE UNIQUE INDEX "sign_record_order_id_key" ON "sign_record"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_username_key" ON "admin_user"("username");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "delivery_order" ADD CONSTRAINT "delivery_order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_order" ADD CONSTRAINT "delivery_order_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_item" ADD CONSTRAINT "delivery_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "delivery_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_record" ADD CONSTRAINT "sign_record_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "delivery_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_job" ADD CONSTRAINT "print_job_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "delivery_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
