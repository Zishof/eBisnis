-- CreateEnum
CREATE TYPE "ProviderEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "TenantPaymentAccountStatus" AS ENUM ('DRAFT', 'AWAITING_CREDENTIAL', 'CREDENTIAL_SET', 'TESTING', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProviderHealthCheckStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SupportTicketType" AS ENUM ('ESMARTLINK_ACCOUNT_ACTIVATION', 'MARKETPLACE_ENROLLMENT', 'TECHNICAL', 'BILLING', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'WAITING_PROVIDER', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "tenant_payment_provider_account" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "environment" "ProviderEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "account_code" VARCHAR(64) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "merchant_id" VARCHAR(96),
    "status" "TenantPaymentAccountStatus" NOT NULL DEFAULT 'DRAFT',
    "callback_url" VARCHAR(255),
    "allowed_ips" TEXT,
    "activated_at" TIMESTAMPTZ(6),
    "activated_by" UUID,
    "suspended_at" TIMESTAMPTZ(6),
    "suspended_by" UUID,
    "suspend_reason" TEXT,
    "last_health_check_at" TIMESTAMPTZ(6),
    "last_health_check_status" VARCHAR(24),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_payment_provider_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_provider_credential_version" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "field_code" VARCHAR(48) NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "key_id" VARCHAR(32) NOT NULL,
    "hint" VARCHAR(16) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "activated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retired_at" TIMESTAMPTZ(6),
    "retired_by" UUID,
    "retire_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "payment_provider_credential_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_credential_access_log" (
    "id" UUID NOT NULL,
    "credential_version_id" UUID NOT NULL,
    "purpose" VARCHAR(48) NOT NULL,
    "actor_id" UUID,
    "request_id" VARCHAR(64),
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_credential_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_provider_capability" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "capability_code" VARCHAR(48) NOT NULL,
    "is_supported" BOOLEAN NOT NULL DEFAULT false,
    "evidence" VARCHAR(24) NOT NULL DEFAULT 'ASSUMED',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "payment_provider_capability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_provider_health_check" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "check_type" VARCHAR(32) NOT NULL,
    "status" "ProviderHealthCheckStatus" NOT NULL DEFAULT 'PENDING',
    "request_summary" JSONB,
    "response_summary" JSONB,
    "http_status" INTEGER,
    "duration_ms" INTEGER,
    "message" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "actor_id" UUID,
    "request_id" VARCHAR(64),

    CONSTRAINT "payment_provider_health_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_provider_activation_ticket_link" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "payment_provider_activation_ticket_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket" (
    "id" UUID NOT NULL,
    "ticket_number" VARCHAR(32) NOT NULL,
    "tenant_id" UUID,
    "ticketType" "SupportTicketType" NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "subject" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "requested_by" UUID NOT NULL,
    "assigned_to" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by" UUID,
    "close_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "support_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_message" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "author_id" UUID NOT NULL,
    "author_is_staff" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_transition" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "from_status" "SupportTicketStatus",
    "to_status" "SupportTicketStatus" NOT NULL,
    "reason" TEXT,
    "actor_id" UUID,
    "request_id" VARCHAR(64),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_transition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_payment_provider_account_status_deleted_at_idx" ON "tenant_payment_provider_account"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "tenant_payment_provider_account_provider_id_status_idx" ON "tenant_payment_provider_account"("provider_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_payment_provider_account_tenant_id_provider_id_envir_key" ON "tenant_payment_provider_account"("tenant_id", "provider_id", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_payment_provider_account_account_code_key" ON "tenant_payment_provider_account"("account_code");

-- CreateIndex
CREATE INDEX "payment_provider_credential_version_account_id_field_code_i_idx" ON "payment_provider_credential_version"("account_id", "field_code", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_credential_version_account_id_field_code_v_key" ON "payment_provider_credential_version"("account_id", "field_code", "version");

-- CreateIndex
CREATE INDEX "payment_credential_access_log_credential_version_id_occurre_idx" ON "payment_credential_access_log"("credential_version_id", "occurred_at");

-- CreateIndex
CREATE INDEX "payment_credential_access_log_occurred_at_idx" ON "payment_credential_access_log"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_capability_account_id_capability_code_key" ON "payment_provider_capability"("account_id", "capability_code");

-- CreateIndex
CREATE INDEX "payment_provider_health_check_account_id_check_type_started_idx" ON "payment_provider_health_check"("account_id", "check_type", "started_at");

-- CreateIndex
CREATE INDEX "payment_provider_activation_ticket_link_account_id_idx" ON "payment_provider_activation_ticket_link"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_activation_ticket_link_ticket_id_account_i_key" ON "payment_provider_activation_ticket_link"("ticket_id", "account_id");

-- CreateIndex
CREATE INDEX "support_ticket_tenant_id_status_idx" ON "support_ticket"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "support_ticket_ticketType_status_idx" ON "support_ticket"("ticketType", "status");

-- CreateIndex
CREATE INDEX "support_ticket_assigned_to_status_idx" ON "support_ticket"("assigned_to", "status");

-- CreateIndex
CREATE UNIQUE INDEX "support_ticket_ticket_number_key" ON "support_ticket"("ticket_number");

-- CreateIndex
CREATE INDEX "support_ticket_message_ticket_id_created_at_idx" ON "support_ticket_message"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "support_ticket_transition_ticket_id_occurred_at_idx" ON "support_ticket_transition"("ticket_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "tenant_payment_provider_account" ADD CONSTRAINT "tenant_payment_provider_account_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_payment_provider_account" ADD CONSTRAINT "tenant_payment_provider_account_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "payment_provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_credential_version" ADD CONSTRAINT "payment_provider_credential_version_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "tenant_payment_provider_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_credential_access_log" ADD CONSTRAINT "payment_credential_access_log_credential_version_id_fkey" FOREIGN KEY ("credential_version_id") REFERENCES "payment_provider_credential_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_capability" ADD CONSTRAINT "payment_provider_capability_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "tenant_payment_provider_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_health_check" ADD CONSTRAINT "payment_provider_health_check_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "tenant_payment_provider_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_activation_ticket_link" ADD CONSTRAINT "payment_provider_activation_ticket_link_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_activation_ticket_link" ADD CONSTRAINT "payment_provider_activation_ticket_link_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "tenant_payment_provider_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_message" ADD CONSTRAINT "support_ticket_message_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_transition" ADD CONSTRAINT "support_ticket_transition_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
