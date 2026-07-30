-- CreateEnum
CREATE TYPE "MarketplaceDomainType" AS ENUM ('MARKETPLACE_PATH', 'PLATFORM_SUBDOMAIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MarketplaceDomainStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE', 'FAILED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MarketplaceDomainVerificationMethod" AS ENUM ('DNS_TXT', 'HTTP_FILE');

-- CreateTable
CREATE TABLE "marketplace_store_domain" (
    "id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "domain_type" "MarketplaceDomainType" NOT NULL DEFAULT 'CUSTOM',
    "status" "MarketplaceDomainStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verification_token" VARCHAR(96) NOT NULL,
    "verification_method" "MarketplaceDomainVerificationMethod" NOT NULL DEFAULT 'DNS_TXT',
    "verified_at" TIMESTAMPTZ(6),
    "verified_by" UUID,
    "last_checked_at" TIMESTAMPTZ(6),
    "last_check_error" TEXT,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,
    "revoke_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "marketplace_store_domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_domain_verification_attempt" (
    "id" UUID NOT NULL,
    "domain_id" UUID NOT NULL,
    "method" "MarketplaceDomainVerificationMethod" NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "found_value" TEXT,
    "message" TEXT,
    "actor_id" UUID,
    "request_id" VARCHAR(64),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_domain_verification_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_store_domain_store_id_status_idx" ON "marketplace_store_domain"("store_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_store_domain_status_verified_at_idx" ON "marketplace_store_domain"("status", "verified_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_store_domain_host_key" ON "marketplace_store_domain"("host");

-- CreateIndex
CREATE INDEX "marketplace_domain_verification_attempt_domain_id_occurred__idx" ON "marketplace_domain_verification_attempt"("domain_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "marketplace_store_domain" ADD CONSTRAINT "marketplace_store_domain_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "marketplace_store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_domain_verification_attempt" ADD CONSTRAINT "marketplace_domain_verification_attempt_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "marketplace_store_domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
