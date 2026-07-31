-- CreateTable
CREATE TABLE "marketplace_fee_schedule" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "seller_id" UUID,
    "category_id" UUID,
    "fee_type" VARCHAR(24) NOT NULL,
    "fee_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "max_fee_per_order" DECIMAL(19,4),
    "min_fee_per_order" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketplace_fee_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_fee_accrual" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "base_amount" DECIMAL(19,4) NOT NULL,
    "fee_amount" DECIMAL(19,4) NOT NULL,
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "rate_snapshot" JSONB NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACCRUED',
    "invoice_id" UUID,
    "adjustment_reason" TEXT,
    "accrued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiced_at" TIMESTAMPTZ(6),
    "adjusted_at" TIMESTAMPTZ(6),
    "adjusted_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_fee_accrual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_product_policy" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "policy_type" VARCHAR(16) NOT NULL,
    "description" TEXT NOT NULL,
    "required_docs" TEXT,
    "keyword_patterns" TEXT[],
    "category_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketplace_product_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_violation" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "policy_id" UUID,
    "violation_number" VARCHAR(32) NOT NULL,
    "subject_type" VARCHAR(24) NOT NULL,
    "subject_id" UUID,
    "severity" VARCHAR(16) NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "penalty" VARCHAR(24) NOT NULL DEFAULT 'NONE',
    "status" VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    "appeal_submitted_at" TIMESTAMPTZ(6),
    "appeal_reason" TEXT,
    "appeal_decided_at" TIMESTAMPTZ(6),
    "appeal_decided_by" UUID,
    "appeal_decision" TEXT,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_violation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_moderation_task" (
    "id" UUID NOT NULL,
    "subject_type" VARCHAR(24) NOT NULL,
    "subject_id" UUID NOT NULL,
    "seller_id" UUID,
    "trigger_type" VARCHAR(16) NOT NULL,
    "trigger_note" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "assigned_to" UUID,
    "assigned_at" TIMESTAMPTZ(6),
    "decision" VARCHAR(24),
    "decision_reason" TEXT,
    "decided_at" TIMESTAMPTZ(6),
    "decided_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_moderation_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_fee_schedule_seller_id_status_idx" ON "marketplace_fee_schedule"("seller_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_fee_schedule_status_effective_from_idx" ON "marketplace_fee_schedule"("status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_fee_schedule_code_version_key" ON "marketplace_fee_schedule"("code", "version");

-- CreateIndex
CREATE INDEX "marketplace_fee_accrual_seller_id_status_idx" ON "marketplace_fee_accrual"("seller_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_fee_accrual_status_accrued_at_idx" ON "marketplace_fee_accrual"("status", "accrued_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_fee_accrual_order_id_key" ON "marketplace_fee_accrual"("order_id");

-- CreateIndex
CREATE INDEX "marketplace_product_policy_policy_type_is_active_idx" ON "marketplace_product_policy"("policy_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_product_policy_code_key" ON "marketplace_product_policy"("code");

-- CreateIndex
CREATE INDEX "marketplace_violation_seller_id_status_idx" ON "marketplace_violation"("seller_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_violation_status_recorded_at_idx" ON "marketplace_violation"("status", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_violation_violation_number_key" ON "marketplace_violation"("violation_number");

-- CreateIndex
CREATE INDEX "marketplace_moderation_task_subject_type_subject_id_status_idx" ON "marketplace_moderation_task"("subject_type", "subject_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_moderation_task_status_priority_created_at_idx" ON "marketplace_moderation_task"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_moderation_task_assigned_to_status_idx" ON "marketplace_moderation_task"("assigned_to", "status");

-- AddForeignKey
ALTER TABLE "marketplace_fee_schedule" ADD CONSTRAINT "marketplace_fee_schedule_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "marketplace_seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_fee_accrual" ADD CONSTRAINT "marketplace_fee_accrual_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_fee_accrual" ADD CONSTRAINT "marketplace_fee_accrual_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "marketplace_fee_schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_violation" ADD CONSTRAINT "marketplace_violation_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "marketplace_seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_violation" ADD CONSTRAINT "marketplace_violation_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "marketplace_product_policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
