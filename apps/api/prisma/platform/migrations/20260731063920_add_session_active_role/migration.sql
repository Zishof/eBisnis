-- AlterTable
ALTER TABLE "platform_session" ADD COLUMN     "active_role_code" VARCHAR(64),
ADD COLUMN     "active_role_id" UUID,
ADD COLUMN     "device_fingerprint" VARCHAR(64),
ADD COLUMN     "device_label" VARCHAR(128);

-- CreateTable
CREATE TABLE "platform_role_switch_log" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "tenant_id" UUID,
    "schema_name" VARCHAR(64),
    "from_role_id" UUID,
    "from_role_code" VARCHAR(64),
    "to_role_id" UUID,
    "to_role_code" VARCHAR(64),
    "permissions_before" INTEGER NOT NULL,
    "permissions_after" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "ip_address" VARCHAR(64),
    "request_id" VARCHAR(64),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_role_switch_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_role_switch_log_user_id_occurred_at_idx" ON "platform_role_switch_log"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_role_switch_log_session_id_idx" ON "platform_role_switch_log"("session_id");

-- CreateIndex
CREATE INDEX "platform_role_switch_log_tenant_id_occurred_at_idx" ON "platform_role_switch_log"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_session_user_id_device_fingerprint_idx" ON "platform_session"("user_id", "device_fingerprint");
