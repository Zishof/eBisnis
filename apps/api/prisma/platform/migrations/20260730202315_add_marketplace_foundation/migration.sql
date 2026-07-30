-- CreateEnum
CREATE TYPE "MarketplaceSellerStatus" AS ENUM ('PROSPECT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MarketplaceEnrollmentStatus" AS ENUM ('DRAFT', 'PROFILE_INCOMPLETE', 'PAYMENT_ACCOUNT_REQUIRED', 'ACTIVATION_TICKET_REQUIRED', 'ACTIVATION_TICKET_OPENED', 'WAITING_PROVIDER', 'CREDENTIAL_RECEIVED', 'CREDENTIAL_CONFIGURED', 'PAYMENT_TESTING', 'UNDER_REVIEW', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MarketplaceStoreStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'PUBLISHED', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MarketplaceStorePolicyType" AS ENUM ('SHIPPING', 'RETURN', 'WARRANTY', 'PRIVACY', 'TERMS');

-- CreateTable
CREATE TABLE "marketplace_program" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "public_host" VARCHAR(255) NOT NULL,
    "store_path_prefix" VARCHAR(48) NOT NULL DEFAULT 'toko',
    "description" TEXT,
    "requires_payment_account" BOOLEAN NOT NULL DEFAULT true,
    "requires_store_profile" BOOLEAN NOT NULL DEFAULT true,
    "requires_shipping_origin" BOOLEAN NOT NULL DEFAULT true,
    "requires_return_policy" BOOLEAN NOT NULL DEFAULT true,
    "minimum_listing_images" INTEGER NOT NULL DEFAULT 3,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "marketplace_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_seller" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "seller_code" VARCHAR(48) NOT NULL,
    "status" "MarketplaceSellerStatus" NOT NULL DEFAULT 'PROSPECT',
    "seller_type" VARCHAR(32) NOT NULL DEFAULT 'BUSINESS',
    "display_name" VARCHAR(160) NOT NULL,
    "support_email" VARCHAR(255),
    "support_phone" VARCHAR(48),
    "approved_at" TIMESTAMPTZ(6),
    "approved_by" UUID,
    "suspended_at" TIMESTAMPTZ(6),
    "suspended_by" UUID,
    "suspend_reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "marketplace_seller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_seller_enrollment" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "MarketplaceEnrollmentStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ(6),
    "submitted_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "decided_by" UUID,
    "decision_note" TEXT,
    "readiness_snapshot" JSONB,
    "readiness_checked_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "marketplace_seller_enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_enrollment_transition" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "from_status" "MarketplaceEnrollmentStatus",
    "to_status" "MarketplaceEnrollmentStatus" NOT NULL,
    "reason" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "request_id" VARCHAR(64),

    CONSTRAINT "marketplace_enrollment_transition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_store" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "store_slug" VARCHAR(96) NOT NULL,
    "store_name" VARCHAR(160) NOT NULL,
    "tagline" VARCHAR(255),
    "description" TEXT,
    "status" "MarketplaceStoreStatus" NOT NULL DEFAULT 'DRAFT',
    "verified_at" TIMESTAMPTZ(6),
    "verified_by" UUID,
    "suspended_at" TIMESTAMPTZ(6),
    "suspended_by" UUID,
    "suspend_reason" TEXT,
    "shipping_origin_ref" UUID,
    "return_address_ref" UUID,
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

    CONSTRAINT "marketplace_store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_store_policy" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "policy_type" "MarketplaceStorePolicyType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(160) NOT NULL,
    "body_html" TEXT NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "marketplace_store_policy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_program_is_active_deleted_at_idx" ON "marketplace_program"("is_active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_program_code_key" ON "marketplace_program"("code");

-- CreateIndex
CREATE INDEX "marketplace_seller_status_deleted_at_idx" ON "marketplace_seller"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "marketplace_seller_tenant_id_idx" ON "marketplace_seller"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_seller_program_id_tenant_id_key" ON "marketplace_seller"("program_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_seller_seller_code_key" ON "marketplace_seller"("seller_code");

-- CreateIndex
CREATE INDEX "marketplace_seller_enrollment_seller_id_created_at_idx" ON "marketplace_seller_enrollment"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_seller_enrollment_status_idx" ON "marketplace_seller_enrollment"("status");

-- CreateIndex
CREATE INDEX "marketplace_enrollment_transition_enrollment_id_occurred_at_idx" ON "marketplace_enrollment_transition"("enrollment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "marketplace_store_seller_id_status_idx" ON "marketplace_store"("seller_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_store_status_verified_at_idx" ON "marketplace_store"("status", "verified_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_store_store_slug_key" ON "marketplace_store"("store_slug");

-- CreateIndex
CREATE INDEX "marketplace_store_policy_store_id_policy_type_published_at_idx" ON "marketplace_store_policy"("store_id", "policy_type", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_store_policy_store_id_policy_type_version_key" ON "marketplace_store_policy"("store_id", "policy_type", "version");

-- AddForeignKey
ALTER TABLE "marketplace_seller" ADD CONSTRAINT "marketplace_seller_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "marketplace_program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_seller" ADD CONSTRAINT "marketplace_seller_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_seller_enrollment" ADD CONSTRAINT "marketplace_seller_enrollment_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "marketplace_seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_enrollment_transition" ADD CONSTRAINT "marketplace_enrollment_transition_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "marketplace_seller_enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_store" ADD CONSTRAINT "marketplace_store_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "marketplace_seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_store_policy" ADD CONSTRAINT "marketplace_store_policy_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "marketplace_store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
