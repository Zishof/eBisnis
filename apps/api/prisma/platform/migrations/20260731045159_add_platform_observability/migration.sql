-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "platform_observability";

-- CreateTable
CREATE TABLE "platform_observability"."error_group" (
    "id" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "error_type" VARCHAR(160) NOT NULL,
    "message_normalized" TEXT NOT NULL,
    "module_code" VARCHAR(48),
    "route_template" VARCHAR(255),
    "severity" VARCHAR(16) NOT NULL DEFAULT 'ERROR',
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,
    "affected_tenant_count" INTEGER NOT NULL DEFAULT 0,
    "affected_user_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(24) NOT NULL DEFAULT 'NEW',
    "assigned_to" UUID,
    "assigned_at" TIMESTAMPTZ(6),
    "introduced_release" VARCHAR(64),
    "last_resolved_release" VARCHAR(64),
    "regressed" BOOLEAN NOT NULL DEFAULT false,
    "ignore_reason" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "error_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_observability"."error_log" (
    "id" UUID NOT NULL,
    "error_group_id" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" VARCHAR(16) NOT NULL DEFAULT 'ERROR',
    "error_type" VARCHAR(160) NOT NULL,
    "error_code" VARCHAR(64),
    "message_sanitized" TEXT NOT NULL,
    "stack_sanitized" TEXT,
    "cause_chain_sanitized" TEXT,
    "module_code" VARCHAR(48),
    "resource_code" VARCHAR(64),
    "action_code" VARCHAR(64),
    "route_template" VARCHAR(255),
    "http_method" VARCHAR(10),
    "http_status" INTEGER,
    "request_id" VARCHAR(64),
    "trace_id" VARCHAR(64),
    "correlation_id" VARCHAR(64),
    "tenant_id" UUID,
    "tenant_username_snapshot" VARCHAR(72),
    "user_id" UUID,
    "active_role_id" UUID,
    "session_id_hash" VARCHAR(64),
    "client_type" VARCHAR(24),
    "app_version" VARCHAR(48),
    "release_version" VARCHAR(64),
    "git_commit_sha" VARCHAR(48),
    "service_name" VARCHAR(48),
    "service_instance_id" VARCHAR(96),
    "host_name" VARCHAR(128),
    "worker_name" VARCHAR(64),
    "job_id" VARCHAR(96),
    "queue_name" VARCHAR(64),
    "browser" VARCHAR(64),
    "operating_system" VARCHAR(64),
    "device_type" VARCHAR(24),
    "ip_masked" VARCHAR(64),
    "request_headers_sanitized" JSONB,
    "request_query_sanitized" JSONB,
    "is_handled" BOOLEAN NOT NULL DEFAULT true,
    "is_fatal" BOOLEAN NOT NULL DEFAULT false,
    "is_retryable" BOOLEAN NOT NULL DEFAULT false,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(24) NOT NULL DEFAULT 'API',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_observability"."observability_access_log" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_username" VARCHAR(160) NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "subject_type" VARCHAR(32) NOT NULL,
    "subject_id" UUID,
    "reason" TEXT,
    "affected_tenant_id" UUID,
    "request_id" VARCHAR(64),
    "ip_masked" VARCHAR(64),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observability_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_observability"."observability_retention_policy" (
    "id" UUID NOT NULL,
    "data_type" VARCHAR(48) NOT NULL,
    "hot_days" INTEGER NOT NULL DEFAULT 30,
    "warm_days" INTEGER NOT NULL DEFAULT 90,
    "cold_days" INTEGER NOT NULL DEFAULT 365,
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,
    "last_purged_at" TIMESTAMPTZ(6),
    "last_purged_count" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "observability_retention_policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "error_group_status_last_seen_at_idx" ON "platform_observability"."error_group"("status", "last_seen_at");

-- CreateIndex
CREATE INDEX "error_group_last_seen_at_idx" ON "platform_observability"."error_group"("last_seen_at");

-- CreateIndex
CREATE INDEX "error_group_module_code_status_idx" ON "platform_observability"."error_group"("module_code", "status");

-- CreateIndex
CREATE UNIQUE INDEX "error_group_fingerprint_key" ON "platform_observability"."error_group"("fingerprint");

-- CreateIndex
CREATE INDEX "error_log_error_group_id_occurred_at_idx" ON "platform_observability"."error_log"("error_group_id", "occurred_at");

-- CreateIndex
CREATE INDEX "error_log_occurred_at_idx" ON "platform_observability"."error_log"("occurred_at");

-- CreateIndex
CREATE INDEX "error_log_tenant_id_occurred_at_idx" ON "platform_observability"."error_log"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "error_log_fingerprint_occurred_at_idx" ON "platform_observability"."error_log"("fingerprint", "occurred_at");

-- CreateIndex
CREATE INDEX "observability_access_log_actor_user_id_occurred_at_idx" ON "platform_observability"."observability_access_log"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "observability_access_log_action_occurred_at_idx" ON "platform_observability"."observability_access_log"("action", "occurred_at");

-- CreateIndex
CREATE INDEX "observability_access_log_occurred_at_idx" ON "platform_observability"."observability_access_log"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "observability_retention_policy_data_type_key" ON "platform_observability"."observability_retention_policy"("data_type");

-- AddForeignKey
ALTER TABLE "platform_observability"."error_log" ADD CONSTRAINT "error_log_error_group_id_fkey" FOREIGN KEY ("error_group_id") REFERENCES "platform_observability"."error_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
