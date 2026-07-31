-- CreateTable
CREATE TABLE "marketplace_voucher" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "funded_by" VARCHAR(16) NOT NULL,
    "seller_id" UUID,
    "benefit_type" VARCHAR(16) NOT NULL,
    "benefit_value" DECIMAL(19,4) NOT NULL,
    "max_discount_amount" DECIMAL(19,4),
    "minimum_spend" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "budget_amount" DECIMAL(19,4),
    "budget_used" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "max_redemptions" INTEGER,
    "max_per_buyer" INTEGER NOT NULL DEFAULT 1,
    "redemption_count" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketplace_voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_voucher_redemption" (
    "id" UUID NOT NULL,
    "voucher_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'APPLIED',
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketplace_voucher_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_review" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "listing_projection_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(160),
    "body" TEXT,
    "display_name" VARCHAR(80) NOT NULL,
    "moderation_status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    "moderation_note" TEXT,
    "moderated_at" TIMESTAMPTZ(6),
    "moderated_by" UUID,
    "seller_reply" TEXT,
    "seller_replied_at" TIMESTAMPTZ(6),
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketplace_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_conversation" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "order_id" UUID,
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_preview" VARCHAR(200),
    "buyer_unread_count" INTEGER NOT NULL DEFAULT 0,
    "seller_unread_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_conversation_message" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_type" VARCHAR(16) NOT NULL,
    "sender_id" UUID,
    "body" TEXT NOT NULL,
    "attachment_reference" VARCHAR(512),
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" VARCHAR(120),
    "read_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_conversation_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_voucher_seller_id_status_idx" ON "marketplace_voucher"("seller_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_voucher_status_valid_until_idx" ON "marketplace_voucher"("status", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_voucher_code_key" ON "marketplace_voucher"("code");

-- CreateIndex
CREATE INDEX "marketplace_voucher_redemption_buyer_id_voucher_id_idx" ON "marketplace_voucher_redemption"("buyer_id", "voucher_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_voucher_redemption_voucher_id_order_id_key" ON "marketplace_voucher_redemption"("voucher_id", "order_id");

-- CreateIndex
CREATE INDEX "marketplace_review_listing_projection_id_moderation_status_idx" ON "marketplace_review"("listing_projection_id", "moderation_status");

-- CreateIndex
CREATE INDEX "marketplace_review_seller_id_created_at_idx" ON "marketplace_review"("seller_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_review_order_id_listing_projection_id_key" ON "marketplace_review"("order_id", "listing_projection_id");

-- CreateIndex
CREATE INDEX "marketplace_conversation_store_id_last_message_at_idx" ON "marketplace_conversation"("store_id", "last_message_at");

-- CreateIndex
CREATE INDEX "marketplace_conversation_buyer_id_last_message_at_idx" ON "marketplace_conversation"("buyer_id", "last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_conversation_buyer_id_store_id_key" ON "marketplace_conversation"("buyer_id", "store_id");

-- CreateIndex
CREATE INDEX "marketplace_conversation_message_conversation_id_sent_at_idx" ON "marketplace_conversation_message"("conversation_id", "sent_at");

-- CreateIndex
CREATE INDEX "marketplace_conversation_message_flagged_sent_at_idx" ON "marketplace_conversation_message"("flagged", "sent_at");

-- AddForeignKey
ALTER TABLE "marketplace_voucher" ADD CONSTRAINT "marketplace_voucher_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "marketplace_seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_voucher_redemption" ADD CONSTRAINT "marketplace_voucher_redemption_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "marketplace_voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_voucher_redemption" ADD CONSTRAINT "marketplace_voucher_redemption_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_review" ADD CONSTRAINT "marketplace_review_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_review" ADD CONSTRAINT "marketplace_review_listing_projection_id_fkey" FOREIGN KEY ("listing_projection_id") REFERENCES "marketplace_listing_projection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_conversation" ADD CONSTRAINT "marketplace_conversation_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "marketplace_store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_conversation_message" ADD CONSTRAINT "marketplace_conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "marketplace_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
