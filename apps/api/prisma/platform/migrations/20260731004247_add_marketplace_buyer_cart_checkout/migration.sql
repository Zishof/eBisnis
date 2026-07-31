-- DropIndex
DROP INDEX "idx_listing_projection_search";

-- DropIndex
DROP INDEX "idx_listing_projection_title_trgm";

-- CreateTable
CREATE TABLE "marketplace_buyer" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "normalized_email" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(48),
    "password_hash" TEXT,
    "google_sub" VARCHAR(128),
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_verified_at" TIMESTAMPTZ(6),
    "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    "preferred_locale" VARCHAR(12) NOT NULL DEFAULT 'id',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketplace_buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_buyer_address" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "label" VARCHAR(64) NOT NULL,
    "recipient_name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(48) NOT NULL,
    "address_line" TEXT NOT NULL,
    "district" VARCHAR(120),
    "city" VARCHAR(120) NOT NULL,
    "province" VARCHAR(120) NOT NULL,
    "postal_code" VARCHAR(16) NOT NULL,
    "country_code" VARCHAR(4) NOT NULL DEFAULT 'ID',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "notes" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketplace_buyer_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_cart" (
    "id" UUID NOT NULL,
    "buyer_id" UUID,
    "guest_token" VARCHAR(64),
    "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketplace_cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_cart_item" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "listing_projection_id" UUID NOT NULL,
    "variant_ref" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_at_add" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_cart_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_checkout" (
    "id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "address_id" UUID,
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "address_snapshot" JSONB,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "shipping_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "validation_snapshot" JSONB,
    "validated_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketplace_checkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_checkout_group" (
    "id" UUID NOT NULL,
    "checkout_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "shipping_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "shipping_method_code" VARCHAR(48),
    "shipping_eta_text" VARCHAR(120),
    "buyer_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_checkout_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_checkout_line" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "listing_projection_id" UUID NOT NULL,
    "variant_ref" UUID,
    "tenant_id" UUID NOT NULL,
    "tenant_listing_id" UUID NOT NULL,
    "title_snapshot" VARCHAR(200) NOT NULL,
    "sku_snapshot" VARCHAR(64),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "line_total" DECIMAL(19,4) NOT NULL,
    "weight_gram" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_checkout_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_buyer_status_idx" ON "marketplace_buyer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_buyer_normalized_email_key" ON "marketplace_buyer"("normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_buyer_google_sub_key" ON "marketplace_buyer"("google_sub");

-- CreateIndex
CREATE INDEX "marketplace_buyer_address_buyer_id_is_default_idx" ON "marketplace_buyer_address"("buyer_id", "is_default");

-- CreateIndex
CREATE INDEX "marketplace_cart_buyer_id_status_idx" ON "marketplace_cart"("buyer_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_cart_status_expires_at_idx" ON "marketplace_cart"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_cart_guest_token_key" ON "marketplace_cart"("guest_token");

-- CreateIndex
CREATE INDEX "marketplace_cart_item_listing_projection_id_idx" ON "marketplace_cart_item"("listing_projection_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_cart_item_cart_id_listing_projection_id_variant_key" ON "marketplace_cart_item"("cart_id", "listing_projection_id", "variant_ref");

-- CreateIndex
CREATE INDEX "marketplace_checkout_buyer_id_status_idx" ON "marketplace_checkout"("buyer_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_checkout_status_expires_at_idx" ON "marketplace_checkout"("status", "expires_at");

-- CreateIndex
CREATE INDEX "marketplace_checkout_group_seller_id_idx" ON "marketplace_checkout_group"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_checkout_group_checkout_id_seller_id_key" ON "marketplace_checkout_group"("checkout_id", "seller_id");

-- CreateIndex
CREATE INDEX "marketplace_checkout_line_group_id_idx" ON "marketplace_checkout_line"("group_id");

-- CreateIndex
CREATE INDEX "marketplace_checkout_line_listing_projection_id_idx" ON "marketplace_checkout_line"("listing_projection_id");

-- AddForeignKey
ALTER TABLE "marketplace_buyer_address" ADD CONSTRAINT "marketplace_buyer_address_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "marketplace_buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_cart" ADD CONSTRAINT "marketplace_cart_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "marketplace_buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_cart_item" ADD CONSTRAINT "marketplace_cart_item_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "marketplace_cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_cart_item" ADD CONSTRAINT "marketplace_cart_item_listing_projection_id_fkey" FOREIGN KEY ("listing_projection_id") REFERENCES "marketplace_listing_projection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_checkout" ADD CONSTRAINT "marketplace_checkout_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "marketplace_buyer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_checkout" ADD CONSTRAINT "marketplace_checkout_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "marketplace_buyer_address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_checkout_group" ADD CONSTRAINT "marketplace_checkout_group_checkout_id_fkey" FOREIGN KEY ("checkout_id") REFERENCES "marketplace_checkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_checkout_group" ADD CONSTRAINT "marketplace_checkout_group_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "marketplace_seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_checkout_group" ADD CONSTRAINT "marketplace_checkout_group_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "marketplace_store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_checkout_line" ADD CONSTRAINT "marketplace_checkout_line_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "marketplace_checkout_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_checkout_line" ADD CONSTRAINT "marketplace_checkout_line_listing_projection_id_fkey" FOREIGN KEY ("listing_projection_id") REFERENCES "marketplace_listing_projection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
