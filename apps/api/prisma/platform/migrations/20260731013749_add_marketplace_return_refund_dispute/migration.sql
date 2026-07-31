-- CreateTable
CREATE TABLE "marketplace_return_request" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "return_number" VARCHAR(32) NOT NULL,
    "reason_code" VARCHAR(32) NOT NULL,
    "reason_note" TEXT,
    "requested_resolution" VARCHAR(16) NOT NULL DEFAULT 'REFUND',
    "status" VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
    "requested_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "approved_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_return_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_return_line" (
    "id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "quantity" DECIMAL(19,6) NOT NULL,
    "received_quantity" DECIMAL(19,6) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "line_total" DECIMAL(19,4) NOT NULL,
    "inspection_result" VARCHAR(24),
    "inspection_note" TEXT,
    "inspected_at" TIMESTAMPTZ(6),
    "disposition" VARCHAR(16),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_return_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_refund" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "return_id" UUID,
    "refund_number" VARCHAR(32) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "method" VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
    "status" VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
    "proof_reference" VARCHAR(255),
    "proof_note" TEXT,
    "provider_refund_id" VARCHAR(96),
    "failure_reason" TEXT,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "completed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_dispute" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "return_id" UUID,
    "buyer_id" UUID NOT NULL,
    "dispute_number" VARCHAR(32) NOT NULL,
    "opened_by" VARCHAR(16) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "summary" TEXT NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    "decision_favor" VARCHAR(16),
    "decision_reason" TEXT,
    "decision_amount" DECIMAL(19,4),
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),
    "decided_by" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_dispute_evidence" (
    "id" UUID NOT NULL,
    "dispute_id" UUID NOT NULL,
    "submitted_by_type" VARCHAR(16) NOT NULL,
    "submitted_by_id" UUID,
    "evidence_type" VARCHAR(24) NOT NULL,
    "description" TEXT NOT NULL,
    "file_reference" VARCHAR(512),
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_dispute_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_return_request_order_id_idx" ON "marketplace_return_request"("order_id");

-- CreateIndex
CREATE INDEX "marketplace_return_request_buyer_id_requested_at_idx" ON "marketplace_return_request"("buyer_id", "requested_at");

-- CreateIndex
CREATE INDEX "marketplace_return_request_status_requested_at_idx" ON "marketplace_return_request"("status", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_return_request_return_number_key" ON "marketplace_return_request"("return_number");

-- CreateIndex
CREATE INDEX "marketplace_return_line_return_id_idx" ON "marketplace_return_line"("return_id");

-- CreateIndex
CREATE INDEX "marketplace_refund_order_id_idx" ON "marketplace_refund"("order_id");

-- CreateIndex
CREATE INDEX "marketplace_refund_status_requested_at_idx" ON "marketplace_refund"("status", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_refund_refund_number_key" ON "marketplace_refund"("refund_number");

-- CreateIndex
CREATE INDEX "marketplace_dispute_order_id_idx" ON "marketplace_dispute"("order_id");

-- CreateIndex
CREATE INDEX "marketplace_dispute_status_opened_at_idx" ON "marketplace_dispute"("status", "opened_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_dispute_dispute_number_key" ON "marketplace_dispute"("dispute_number");

-- CreateIndex
CREATE INDEX "marketplace_dispute_evidence_dispute_id_submitted_at_idx" ON "marketplace_dispute_evidence"("dispute_id", "submitted_at");

-- AddForeignKey
ALTER TABLE "marketplace_return_request" ADD CONSTRAINT "marketplace_return_request_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_return_line" ADD CONSTRAINT "marketplace_return_line_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "marketplace_return_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_refund" ADD CONSTRAINT "marketplace_refund_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_refund" ADD CONSTRAINT "marketplace_refund_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "marketplace_return_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_dispute" ADD CONSTRAINT "marketplace_dispute_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_dispute" ADD CONSTRAINT "marketplace_dispute_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "marketplace_return_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_dispute_evidence" ADD CONSTRAINT "marketplace_dispute_evidence_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "marketplace_dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
