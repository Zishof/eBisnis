-- CreateTable
CREATE TABLE "marketplace_order_group" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "checkout_id" UUID NOT NULL,
    "group_number" VARCHAR(32) NOT NULL,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "shipping_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "address_snapshot" JSONB NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "placed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_order_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_order" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "order_number" VARCHAR(32) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tenant_schema" VARCHAR(72) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "shipping_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "shipping_method_code" VARCHAR(48),
    "shipping_eta_text" VARCHAR(120),
    "address_snapshot" JSONB NOT NULL,
    "buyer_note" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_order_line" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "tenant_listing_id" UUID NOT NULL,
    "variant_ref" UUID,
    "title_snapshot" VARCHAR(200) NOT NULL,
    "sku_snapshot" VARCHAR(64),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "line_total" DECIMAL(19,4) NOT NULL,
    "weight_gram" INTEGER NOT NULL DEFAULT 0,
    "shipped_quantity" INTEGER NOT NULL DEFAULT 0,
    "returned_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_stock_reservation" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tenant_schema" VARCHAR(72) NOT NULL,
    "tenant_listing_id" UUID NOT NULL,
    "variant_ref" UUID,
    "quantity" DECIMAL(19,6) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'HELD',
    "idempotency_key" VARCHAR(128) NOT NULL,
    "held_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "committed_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),
    "release_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_stock_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" VARCHAR(32),
    "to_status" VARCHAR(32) NOT NULL,
    "reason" TEXT,
    "actor_type" VARCHAR(16) NOT NULL,
    "actor_id" UUID,
    "request_id" VARCHAR(64),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_order_group_buyer_id_placed_at_idx" ON "marketplace_order_group"("buyer_id", "placed_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_order_group_group_number_key" ON "marketplace_order_group"("group_number");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_order_group_checkout_id_key" ON "marketplace_order_group"("checkout_id");

-- CreateIndex
CREATE INDEX "marketplace_order_seller_id_status_idx" ON "marketplace_order"("seller_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_order_buyer_id_created_at_idx" ON "marketplace_order"("buyer_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_order_status_created_at_idx" ON "marketplace_order"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_order_order_number_key" ON "marketplace_order"("order_number");

-- CreateIndex
CREATE INDEX "marketplace_order_line_order_id_idx" ON "marketplace_order_line"("order_id");

-- CreateIndex
CREATE INDEX "marketplace_order_line_tenant_listing_id_idx" ON "marketplace_order_line"("tenant_listing_id");

-- CreateIndex
CREATE INDEX "marketplace_stock_reservation_status_expires_at_idx" ON "marketplace_stock_reservation"("status", "expires_at");

-- CreateIndex
CREATE INDEX "marketplace_stock_reservation_tenant_id_tenant_listing_id_s_idx" ON "marketplace_stock_reservation"("tenant_id", "tenant_listing_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_stock_reservation_order_id_idx" ON "marketplace_stock_reservation"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_stock_reservation_idempotency_key_key" ON "marketplace_stock_reservation"("idempotency_key");

-- CreateIndex
CREATE INDEX "marketplace_order_status_history_order_id_occurred_at_idx" ON "marketplace_order_status_history"("order_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "marketplace_order" ADD CONSTRAINT "marketplace_order_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "marketplace_order_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_order" ADD CONSTRAINT "marketplace_order_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "marketplace_seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_order" ADD CONSTRAINT "marketplace_order_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "marketplace_store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_order_line" ADD CONSTRAINT "marketplace_order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_stock_reservation" ADD CONSTRAINT "marketplace_stock_reservation_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_order_status_history" ADD CONSTRAINT "marketplace_order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
