-- CreateTable
CREATE TABLE "ai_model" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL DEFAULT 'ollama',
    "name" VARCHAR(160) NOT NULL,
    "family" VARCHAR(64),
    "parameter_size" VARCHAR(32),
    "quantization" VARCHAR(32),
    "size_bytes" BIGINT,
    "supports_chat" BOOLEAN NOT NULL DEFAULT false,
    "supports_embedding" BOOLEAN NOT NULL DEFAULT false,
    "supports_structured" BOOLEAN NOT NULL DEFAULT false,
    "context_length" INTEGER,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_probed_at" TIMESTAMPTZ(6),
    "missing_since" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_health" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL DEFAULT 'ollama',
    "status" VARCHAR(16) NOT NULL,
    "latency_ms" INTEGER,
    "version" VARCHAR(32),
    "model_count" INTEGER,
    "note" TEXT,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_invocation" (
    "id" UUID NOT NULL,
    "use_case_code" VARCHAR(64) NOT NULL,
    "model_id" UUID,
    "model_name" VARCHAR(160) NOT NULL,
    "tenant_id" UUID,
    "tenant_schema" VARCHAR(64),
    "actor_user_id" UUID,
    "actor_username" VARCHAR(64),
    "active_role_code" VARCHAR(64),
    "session_id" UUID,
    "request_id" VARCHAR(64),
    "status" VARCHAR(16) NOT NULL,
    "error_message" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "duration_ms" INTEGER,
    "input_fingerprint" VARCHAR(64),
    "prompt_redacted" TEXT,
    "output_redacted" TEXT,
    "evidence_count" INTEGER,
    "schema_valid" BOOLEAN,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_invocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedback" (
    "id" UUID NOT NULL,
    "invocation_id" UUID NOT NULL,
    "verdict" VARCHAR(16) NOT NULL,
    "reason" TEXT,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_model_is_enabled_supports_chat_idx" ON "ai_model"("is_enabled", "supports_chat");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_provider_name_key" ON "ai_model"("provider", "name");

-- CreateIndex
CREATE INDEX "ai_provider_health_provider_checked_at_idx" ON "ai_provider_health"("provider", "checked_at");

-- CreateIndex
CREATE INDEX "ai_invocation_use_case_code_occurred_at_idx" ON "ai_invocation"("use_case_code", "occurred_at");

-- CreateIndex
CREATE INDEX "ai_invocation_tenant_id_occurred_at_idx" ON "ai_invocation"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "ai_invocation_actor_user_id_occurred_at_idx" ON "ai_invocation"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "ai_invocation_status_occurred_at_idx" ON "ai_invocation"("status", "occurred_at");

-- CreateIndex
CREATE INDEX "ai_feedback_invocation_id_idx" ON "ai_feedback"("invocation_id");

-- CreateIndex
CREATE INDEX "ai_feedback_verdict_created_at_idx" ON "ai_feedback"("verdict", "created_at");

-- AddForeignKey
ALTER TABLE "ai_invocation" ADD CONSTRAINT "ai_invocation_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_invocation_id_fkey" FOREIGN KEY ("invocation_id") REFERENCES "ai_invocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
