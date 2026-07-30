-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "platform__audit";

-- CreateEnum
CREATE TYPE "PlatformUserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED');

-- CreateEnum
CREATE TYPE "PlatformRoleType" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'BILLING', 'AUDITOR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "SupportAccessMode" AS ENUM ('READ_ONLY', 'READ_WRITE');

-- CreateEnum
CREATE TYPE "StepUpPurpose" AS ENUM ('SUPPORT_WRITE', 'HARD_DELETE', 'PRICE_CHANGE', 'TENANT_SUSPEND', 'PAYMENT_REPLAY', 'SEED_CLEANUP');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('DRAFT', 'VALIDATING', 'USERNAME_RESERVED', 'PROVISIONING', 'READY', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PENDING', 'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'FAILED');

-- CreateEnum
CREATE TYPE "TenantSchemaStatus" AS ENUM ('RESERVED', 'PROVISIONING', 'READY', 'MIGRATING', 'SUSPENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProvisioningStage" AS ENUM ('REQUESTED', 'VALIDATING', 'RESERVED', 'CREATING_SCHEMAS', 'APPLYING_MIGRATIONS', 'INSTALLING_AUDIT', 'SEEDING', 'CREATING_OWNER', 'VERIFYING', 'READY', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ProvisioningStepStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "LocaleDirection" AS ENUM ('LTR', 'RTL');

-- CreateEnum
CREATE TYPE "TranslationReviewStatus" AS ENUM ('DRAFT', 'TRANSLATED', 'REVIEWED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ModuleCategory" AS ENUM ('CORE', 'OPERATIONS', 'FINANCE', 'PEOPLE', 'PLATFORM');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED', 'RETIRED');

-- CreateEnum
CREATE TYPE "FeatureType" AS ENUM ('BOOLEAN', 'LIMIT', 'QUOTA', 'TOGGLE');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "PlanVersionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "FutureModulePolicy" AS ENUM ('SNAPSHOT_AT_VERSION', 'INCLUDE_FUTURE_MODULES');

-- CreateEnum
CREATE TYPE "EntitlementScope" AS ENUM ('TENANT_WIDE', 'LEGAL_ENTITY', 'BRAND', 'OUTLET', 'DEVICE', 'USER');

-- CreateEnum
CREATE TYPE "BillingMetric" AS ENUM ('PER_POS_DEVICE', 'PER_ACTIVE_DEVICE', 'PER_OUTLET', 'PER_LEGAL_ENTITY', 'PER_USER', 'PER_TRANSACTION', 'PER_STORAGE_GB', 'FLAT_TENANT', 'ONE_TIME', 'USAGE_BASED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "AssignmentScope" AS ENUM ('TENANT', 'LEGAL_ENTITY', 'BRAND', 'OUTLET', 'DEVICE');

-- CreateEnum
CREATE TYPE "PackageMode" AS ENUM ('UNIFORM_TENANT_PACKAGE', 'PACKAGE_PER_OUTLET', 'PACKAGE_PER_DEVICE', 'MIXED_PACKAGE', 'CUSTOM_CONTRACT');

-- CreateEnum
CREATE TYPE "TenantWidePolicy" AS ENUM ('ANY_ACTIVE_ITEM', 'MINIMUM_PAID_QUANTITY', 'ALL_DEVICES_REQUIRED', 'EXPLICIT_CONTRACT');

-- CreateEnum
CREATE TYPE "PriceOverrideType" AS ENUM ('REPLACE_BASE_PRICE', 'DISCOUNT_FROM_BASE', 'FIXED_PACKAGE_TOTAL', 'CUSTOM_FORMULA_STRUCTURED');

-- CreateEnum
CREATE TYPE "PlanConstraintType" AS ENUM ('MIN_DEVICES', 'MAX_DEVICES', 'MIN_OUTLETS', 'MAX_OUTLETS', 'MAX_USERS', 'MAX_STORAGE_GB', 'MAX_TRANSACTIONS');

-- CreateEnum
CREATE TYPE "DiscountStackPolicy" AS ENUM ('EXCLUSIVE', 'BEST_PRICE', 'STACKABLE');

-- CreateEnum
CREATE TYPE "DiscountConditionField" AS ENUM ('SELECTED_DEVICE_COUNT', 'ACTIVE_DEVICE_COUNT', 'BILLING_INTERVAL', 'BILLING_INTERVAL_COUNT', 'TENANT_ID', 'TENANT_AGE_DAYS', 'PLAN_CODE', 'CURRENCY_CODE', 'REGISTRATION_SOURCE', 'FIRST_SUBSCRIPTION', 'RENEWAL', 'PAYMENT_MODE', 'QUOTE_SUBTOTAL', 'PROMOTION_CODE', 'CURRENT_DATE');

-- CreateEnum
CREATE TYPE "DiscountOperator" AS ENUM ('EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'NOT_IN', 'BETWEEN', 'IS_TRUE', 'IS_FALSE');

-- CreateEnum
CREATE TYPE "DiscountBenefitType" AS ENUM ('PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'UNIT_PRICE_OVERRIDE', 'FREE_DEVICE_COUNT', 'FREE_BILLING_PERIOD', 'WAIVE_ADMIN_FEE');

-- CreateEnum
CREATE TYPE "ConditionGroupOperator" AS ENUM ('AND', 'OR');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'CALCULATED', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentMode" AS ENUM ('PER_DEVICE', 'SELECTED_DEVICES', 'CONSOLIDATED_ALL_DEVICES');

-- CreateEnum
CREATE TYPE "PosDeviceStatus" AS ENUM ('REGISTERED', 'ACTIVE', 'INACTIVE', 'REVOKED', 'REPLACED');

-- CreateEnum
CREATE TYPE "DeviceEntitlementStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('DRAFT', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceLineType" AS ENUM ('PACKAGE', 'ADD_ON', 'ADMIN_FEE', 'TAX', 'DISCOUNT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentProviderStatus" AS ENUM ('DISABLED', 'SANDBOX', 'ENABLED');

-- CreateEnum
CREATE TYPE "AdminFeeType" AS ENUM ('FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('DRAFT', 'CREATING', 'WAITING_PAYMENT', 'PAID', 'EXPIRED', 'FAILED', 'CANCELLED', 'REPLACED');

-- CreateEnum
CREATE TYPE "PaymentAttemptType" AS ENUM ('CREATE_ORDER', 'INQUIRY', 'RETRY', 'CANCEL');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "NormalizedPaymentStatus" AS ENUM ('UNKNOWN', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CallbackProcessingStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'PROCESSED', 'DUPLICATE', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentInquirySource" AS ENUM ('MANUAL_SINGLE', 'MANUAL_BATCH', 'SCHEDULED_RECONCILIATION', 'CALLBACK_RECOVERY', 'SUPPORT_REPLAY');

-- CreateEnum
CREATE TYPE "BatchRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReconciliationOutcome" AS ENUM ('MATCHED', 'PROVIDER_PAID_LOCAL_UNPAID', 'LOCAL_PAID_PROVIDER_UNPAID', 'AMOUNT_MISMATCH', 'NOT_FOUND', 'ERROR');

-- CreateEnum
CREATE TYPE "CmsStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CmsPageType" AS ENUM ('LANDING', 'STANDARD', 'LEGAL', 'PRICING', 'CONTACT', 'NEWS_INDEX', 'FAQ');

-- CreateEnum
CREATE TYPE "CmsNavigationLocation" AS ENUM ('HEADER', 'FOOTER', 'MOBILE', 'TOPBAR');

-- CreateEnum
CREATE TYPE "AnnouncementSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('PUBLIC', 'TENANT', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "ContactMessageStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESPONDED', 'CLOSED', 'SPAM');

-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "DemoSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "platform__audit"."AuditResult" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateEnum
CREATE TYPE "platform__audit"."AuditOperation" AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "HardDeletePolicy" AS ENUM ('NEVER_PURGE', 'PURGE_IF_UNREFERENCED', 'PURGE_SAMPLE_ONLY', 'PURGE_AFTER_RETENTION', 'PLATFORM_SUPER_ADMIN_ONLY');

-- CreateTable
CREATE TABLE "platform__audit"."audit_event" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" UUID,
    "tenant_schema" VARCHAR(64),
    "request_id" VARCHAR(64),
    "correlation_id" VARCHAR(64),
    "actor_user_id" UUID,
    "actor_username" VARCHAR(64),
    "actor_role_codes" JSONB,
    "session_id" UUID,
    "support_session_id" UUID,
    "device_id" UUID,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "module_code" VARCHAR(48) NOT NULL,
    "action_code" VARCHAR(48) NOT NULL,
    "entity_type" VARCHAR(96),
    "entity_id" VARCHAR(96),
    "document_number" VARCHAR(96),
    "result" "platform__audit"."AuditResult" NOT NULL DEFAULT 'SUCCESS',
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform__audit"."audit_row_change" (
    "id" UUID NOT NULL,
    "audit_event_id" UUID NOT NULL,
    "table_schema" VARCHAR(64) NOT NULL,
    "table_name" VARCHAR(96) NOT NULL,
    "row_pk" JSONB NOT NULL,
    "operation" "platform__audit"."AuditOperation" NOT NULL,
    "old_data" JSONB,
    "new_data" JSONB,
    "changed_columns" JSONB,
    "transaction_id" BIGINT,
    "statement_timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_row_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform__audit"."audit_security_event" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_code" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(16) NOT NULL DEFAULT 'INFO',
    "actor_user_id" UUID,
    "actor_username" VARCHAR(64),
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "request_id" VARCHAR(64),
    "result" "platform__audit"."AuditResult" NOT NULL DEFAULT 'FAILURE',
    "detail" JSONB,

    CONSTRAINT "audit_security_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform__audit"."audit_export_event" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "tenant_id" UUID,
    "resource_code" VARCHAR(64) NOT NULL,
    "filter_snapshot" JSONB,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "format" VARCHAR(16) NOT NULL DEFAULT 'CSV',
    "request_id" VARCHAR(64),

    CONSTRAINT "audit_export_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform__audit"."audit_permission_change" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "target_type" VARCHAR(48) NOT NULL,
    "target_id" VARCHAR(96) NOT NULL,
    "tenant_id" UUID,
    "before_snapshot" JSONB,
    "after_snapshot" JSONB,
    "reason" TEXT,
    "request_id" VARCHAR(64),

    CONSTRAINT "audit_permission_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform__audit"."audit_schema_migration" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schema_name" VARCHAR(64) NOT NULL,
    "migration_version" VARCHAR(16) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "actor_user_id" UUID,
    "error_message" TEXT,

    CONSTRAINT "audit_schema_migration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_quote" (
    "id" UUID NOT NULL,
    "quote_number" VARCHAR(48) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "payment_mode" "SubscriptionPaymentMode" NOT NULL DEFAULT 'CONSOLIDATED_ALL_DEVICES',
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "billing_interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "admin_fee_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "promo_code" VARCHAR(48),
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "calculation_trace" JSONB NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "accepted_by" UUID,
    "idempotency_key" VARCHAR(96),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pricing_quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_quote_line" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "device_id" UUID,
    "scope_type" "AssignmentScope" NOT NULL DEFAULT 'DEVICE',
    "scope_id" UUID,
    "description" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "base_price" DECIMAL(19,4) NOT NULL,
    "effective_unit_price" DECIMAL(19,4) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_quote_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_adjustment" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "source_type" VARCHAR(48) NOT NULL,
    "source_id" UUID,
    "label" VARCHAR(255) NOT NULL,
    "label_key" VARCHAR(160),
    "amount" DECIMAL(19,4) NOT NULL,
    "rule_snapshot" JSONB NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_device" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "outlet_id" UUID,
    "outlet_code" VARCHAR(64),
    "code" VARCHAR(48) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "fingerprint_hash" VARCHAR(128),
    "status" "PosDeviceStatus" NOT NULL DEFAULT 'REGISTERED',
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "trial_started_at" TIMESTAMPTZ(6),
    "trial_ends_at" TIMESTAMPTZ(6),
    "activated_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_device_id" UUID,
    "last_seen_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pos_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_activation" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "activation_code" VARCHAR(64) NOT NULL,
    "fingerprint_hash" VARCHAR(128),
    "activated_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_activation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_entitlement" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "module_code" VARCHAR(48) NOT NULL,
    "feature_code" VARCHAR(64),
    "status" "DeviceEntitlementStatus" NOT NULL DEFAULT 'TRIAL',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "grace_ends_at" TIMESTAMPTZ(6),
    "source_type" VARCHAR(48) NOT NULL,
    "source_id" UUID,
    "source_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "device_entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" UUID NOT NULL,
    "subscription_number" VARCHAR(48) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_mode" "SubscriptionPaymentMode" NOT NULL DEFAULT 'CONSOLIDATED_ALL_DEVICES',
    "billing_interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "current_period_start" TIMESTAMPTZ(6),
    "current_period_end" TIMESTAMPTZ(6),
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_item" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "item_type" VARCHAR(32) NOT NULL DEFAULT 'PACKAGE',
    "device_id" UUID,
    "add_on_version_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "entitlement_scope" "EntitlementScope" NOT NULL DEFAULT 'DEVICE',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_change" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "change_type" VARCHAR(48) NOT NULL,
    "payload" JSONB NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "subscription_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoice" (
    "id" UUID NOT NULL,
    "invoice_number" VARCHAR(48) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID,
    "quote_id" UUID,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "issue_date" TIMESTAMPTZ(6) NOT NULL,
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "admin_fee_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "paid_total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMPTZ(6),
    "issued_at" TIMESTAMPTZ(6),
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" TEXT,
    "locale_snapshot" VARCHAR(16) NOT NULL DEFAULT 'id',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "billing_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoice_line" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_type" "InvoiceLineType" NOT NULL DEFAULT 'PACKAGE',
    "device_id" UUID,
    "module_code" VARCHAR(48),
    "feature_code" VARCHAR(64),
    "description" VARCHAR(255) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "discount_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(19,4) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payment_allocation" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "invoice_line_id" UUID,
    "callback_event_id" UUID,
    "payment_order_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL,
    "allocated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" VARCHAR(96) NOT NULL,

    CONSTRAINT "billing_payment_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_credit_note" (
    "id" UUID NOT NULL,
    "credit_note_number" VARCHAR(48) NOT NULL,
    "invoice_id" UUID NOT NULL,
    "issue_date" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'ISSUED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "billing_credit_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_receipt" (
    "id" UUID NOT NULL,
    "receipt_number" VARCHAR(48) NOT NULL,
    "invoice_id" UUID NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "channel_code" VARCHAR(48),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_record" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "idempotency_key" VARCHAR(96) NOT NULL,
    "operation" VARCHAR(96) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB,
    "resource_type" VARCHAR(64),
    "resource_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "primary_domain" VARCHAR(255) NOT NULL,
    "default_locale_code" VARCHAR(16) NOT NULL DEFAULT 'id',
    "theme_code" VARCHAR(48) NOT NULL DEFAULT 'default',
    "logo_asset_id" UUID,
    "favicon_asset_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_domain" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "ssl_required" BOOLEAN NOT NULL DEFAULT true,
    "redirect_to_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "website_domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "parent_id" UUID,
    "slug" VARCHAR(160) NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "page_type" "CmsPageType" NOT NULL DEFAULT 'STANDARD',
    "template_code" VARCHAR(48) NOT NULL DEFAULT 'default',
    "status" "CmsStatus" NOT NULL DEFAULT 'DRAFT',
    "published_version_id" UUID,
    "show_in_navigation" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cms_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_version" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "seo_title" VARCHAR(255),
    "seo_description" TEXT,
    "seo_keywords" VARCHAR(500),
    "og_image_asset_id" UUID,
    "status" "CmsStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cms_page_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_translation" (
    "id" UUID NOT NULL,
    "page_version_id" UUID NOT NULL,
    "locale_code" VARCHAR(16) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "seo_title" VARCHAR(255),
    "seo_description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cms_page_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_block" (
    "id" UUID NOT NULL,
    "page_version_id" UUID NOT NULL,
    "parent_block_id" UUID,
    "block_type" VARCHAR(48) NOT NULL,
    "block_key" VARCHAR(64) NOT NULL,
    "layout" VARCHAR(48) NOT NULL DEFAULT 'default',
    "settings" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cms_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_block_translation" (
    "id" UUID NOT NULL,
    "block_id" UUID NOT NULL,
    "locale_code" VARCHAR(16) NOT NULL,
    "eyebrow" VARCHAR(255),
    "heading" VARCHAR(500),
    "subheading" TEXT,
    "body" TEXT,
    "button_label" VARCHAR(160),
    "button_url" VARCHAR(500),
    "content_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cms_block_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_navigation" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "location" "CmsNavigationLocation" NOT NULL DEFAULT 'HEADER',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cms_navigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_navigation_item" (
    "id" UUID NOT NULL,
    "navigation_id" UUID NOT NULL,
    "parent_id" UUID,
    "label_key" VARCHAR(160) NOT NULL,
    "default_label" VARCHAR(160) NOT NULL,
    "page_id" UUID,
    "external_url" VARCHAR(500),
    "anchor" VARCHAR(96),
    "icon" VARCHAR(64),
    "target" VARCHAR(16) NOT NULL DEFAULT '_self',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cms_navigation_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_footer_section" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "title_key" VARCHAR(160) NOT NULL,
    "default_title" VARCHAR(160) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cms_footer_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_footer_item" (
    "id" UUID NOT NULL,
    "footer_section_id" UUID NOT NULL,
    "label_key" VARCHAR(160) NOT NULL,
    "default_label" VARCHAR(160) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "icon" VARCHAR(64),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cms_footer_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_category" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(48) NOT NULL,
    "name_key" VARCHAR(160) NOT NULL,
    "default_name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(96) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "news_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_article" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "author_user_id" UUID,
    "slug" VARCHAR(160) NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "status" "CmsStatus" NOT NULL DEFAULT 'DRAFT',
    "featured_image_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "expired_at" TIMESTAMPTZ(6),
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_version_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "news_article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_article_version" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "status" "CmsStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "news_article_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_article_translation" (
    "id" UUID NOT NULL,
    "article_version_id" UUID NOT NULL,
    "locale_code" VARCHAR(16) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "seo_title" VARCHAR(255),
    "seo_description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "news_article_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_tag" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name_key" VARCHAR(160) NOT NULL,
    "default_name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(96) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "news_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_article_tag" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_article_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "title_key" VARCHAR(160) NOT NULL,
    "default_title" VARCHAR(255) NOT NULL,
    "body_key" VARCHAR(160) NOT NULL,
    "default_body" TEXT NOT NULL,
    "severity" "AnnouncementSeverity" NOT NULL DEFAULT 'INFO',
    "audience_type" "AnnouncementAudience" NOT NULL DEFAULT 'PUBLIC',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "is_dismissible" BOOLEAN NOT NULL DEFAULT true,
    "link_url" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hero_slide" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "eyebrow_key" VARCHAR(160),
    "default_eyebrow" VARCHAR(255),
    "title_key" VARCHAR(160) NOT NULL,
    "default_title" VARCHAR(500) NOT NULL,
    "subtitle_key" VARCHAR(160),
    "default_subtitle" TEXT,
    "background_asset_id" UUID,
    "primary_cta_label_key" VARCHAR(160),
    "primary_cta_label" VARCHAR(160),
    "primary_cta_url" VARCHAR(500),
    "secondary_cta_label_key" VARCHAR(160),
    "secondary_cta_label" VARCHAR(160),
    "secondary_cta_url" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "hero_slide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_feature" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "module_id" UUID,
    "module_code" VARCHAR(48),
    "title_key" VARCHAR(160) NOT NULL,
    "default_title" VARCHAR(255) NOT NULL,
    "description_key" VARCHAR(160),
    "default_description" TEXT,
    "icon" VARCHAR(64),
    "image_asset_id" UUID,
    "group" VARCHAR(32) NOT NULL DEFAULT 'FEATURE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "marketing_feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_category" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name_key" VARCHAR(160) NOT NULL,
    "default_name" VARCHAR(160) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "faq_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_item" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "question_key" VARCHAR(160) NOT NULL,
    "default_question" VARCHAR(500) NOT NULL,
    "answer_key" VARCHAR(160) NOT NULL,
    "default_answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "faq_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonial" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "person_name" VARCHAR(160) NOT NULL,
    "organization" VARCHAR(160),
    "role_title" VARCHAR(160),
    "quote_key" VARCHAR(160) NOT NULL,
    "default_quote" TEXT NOT NULL,
    "avatar_asset_id" UUID,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_logo" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "website_url" VARCHAR(500),
    "logo_asset_id" UUID,
    "logo_url" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "partner_logo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_display_section" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "title_key" VARCHAR(160) NOT NULL,
    "default_title" VARCHAR(255) NOT NULL,
    "description_key" VARCHAR(160),
    "default_description" TEXT,
    "display_mode" VARCHAR(24) NOT NULL DEFAULT 'CARDS',
    "footnote_key" VARCHAR(160),
    "default_footnote" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "pricing_display_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_to_action" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "title_key" VARCHAR(160) NOT NULL,
    "default_title" VARCHAR(255) NOT NULL,
    "body_key" VARCHAR(160),
    "default_body" TEXT,
    "button_key" VARCHAR(160) NOT NULL,
    "default_button" VARCHAR(160) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "style" VARCHAR(32) NOT NULL DEFAULT 'primary',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "call_to_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_office" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "address" TEXT NOT NULL,
    "phone" VARCHAR(64),
    "email" VARCHAR(160),
    "map_url" VARCHAR(500),
    "opening_hours" VARCHAR(255),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "contact_office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_message" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(64),
    "subject" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactMessageStatus" NOT NULL DEFAULT 'NEW',
    "assigned_to_id" UUID,
    "responded_at" TIMESTAMPTZ(6),
    "locale_code" VARCHAR(16) NOT NULL DEFAULT 'id',
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "contact_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscriber" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "locale_code" VARCHAR(16) NOT NULL DEFAULT 'id',
    "status" "NewsletterStatus" NOT NULL DEFAULT 'PENDING',
    "subscribed_at" TIMESTAMPTZ(6),
    "unsubscribed_at" TIMESTAMPTZ(6),
    "confirm_token" VARCHAR(96),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "newsletter_subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_folder" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "path" VARCHAR(512) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "media_folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" UUID NOT NULL,
    "folder_id" UUID,
    "code" VARCHAR(96) NOT NULL,
    "storage_key" VARCHAR(512) NOT NULL,
    "public_url" VARCHAR(500),
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "checksum" VARCHAR(64),
    "width" INTEGER,
    "height" INTEGER,
    "alt_key" VARCHAR(160),
    "default_alt" VARCHAR(255),
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirect_rule" (
    "id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "source_path" VARCHAR(500) NOT NULL,
    "target_url" VARCHAR(500) NOT NULL,
    "http_status" INTEGER NOT NULL DEFAULT 301,
    "valid_from" TIMESTAMPTZ(6),
    "valid_until" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "redirect_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_publication_workflow" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(48) NOT NULL,
    "entity_id" UUID NOT NULL,
    "status" "CmsStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "published_by_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_publication_workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_preview_token" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(48) NOT NULL,
    "entity_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by_id" UUID,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cms_preview_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_structured_data" (
    "id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "schema_type" VARCHAR(64) NOT NULL,
    "json_data" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "seo_structured_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_program" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "name_key" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "stack_policy" "DiscountStackPolicy" NOT NULL DEFAULT 'EXCLUSIVE',
    "max_discount_amount" DECIMAL(19,4),
    "max_redemptions" INTEGER,
    "max_per_tenant" INTEGER,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "requires_promo_code" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "discount_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_rule" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "discount_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_condition_group" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "parent_group_id" UUID,
    "operator" "ConditionGroupOperator" NOT NULL DEFAULT 'AND',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "discount_condition_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_condition" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "field" "DiscountConditionField" NOT NULL,
    "operator" "DiscountOperator" NOT NULL,
    "value_json" JSONB NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "discount_condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_benefit" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "benefit_type" "DiscountBenefitType" NOT NULL,
    "numeric_value" DECIMAL(19,4) NOT NULL,
    "currency_code" VARCHAR(8),
    "max_amount" DECIMAL(19,4),
    "label_key" VARCHAR(160),
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "discount_benefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_tenant_eligibility" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_tenant_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_plan_eligibility" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_plan_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "max_redemptions" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "per_tenant_limit" INTEGER,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "promo_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_redemption" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "promo_code_id" UUID,
    "tenant_id" UUID NOT NULL,
    "quote_id" UUID,
    "invoice_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL,
    "idempotency_key" VARCHAR(96) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_approval" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),

    CONSTRAINT "discount_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locale" (
    "id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(96) NOT NULL,
    "native_name" VARCHAR(96) NOT NULL,
    "direction" "LocaleDirection" NOT NULL DEFAULT 'LTR',
    "fallback_code" VARCHAR(16),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "number_format" VARCHAR(32) NOT NULL DEFAULT 'id-ID',
    "date_format" VARCHAR(32) NOT NULL DEFAULT 'dd/MM/yyyy',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "locale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_namespace" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "translation_namespace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_key" (
    "id" UUID NOT NULL,
    "namespace_id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "default_text" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "translation_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_value" (
    "id" UUID NOT NULL,
    "key_id" UUID NOT NULL,
    "locale_code" VARCHAR(16) NOT NULL,
    "value" TEXT NOT NULL,
    "review_status" "TranslationReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "translation_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_translation_override" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key_id" UUID NOT NULL,
    "locale_code" VARCHAR(16) NOT NULL,
    "value" TEXT NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_translation_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_import_run" (
    "id" UUID NOT NULL,
    "direction" VARCHAR(16) NOT NULL,
    "locale_code" VARCHAR(16),
    "file_name" VARCHAR(255),
    "total_keys" INTEGER NOT NULL DEFAULT 0,
    "created_keys" INTEGER NOT NULL DEFAULT 0,
    "updated_keys" INTEGER NOT NULL DEFAULT 0,
    "skipped_keys" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(24) NOT NULL DEFAULT 'RUNNING',
    "error_message" TEXT,
    "executed_by_id" UUID,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "translation_import_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_user" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "normalized_username" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255),
    "normalized_email" VARCHAR(255),
    "phone" VARCHAR(32),
    "display_name" VARCHAR(160) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "PlatformUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "is_platform_staff" BOOLEAN NOT NULL DEFAULT false,
    "preferred_locale_code" VARCHAR(16),
    "last_login_at" TIMESTAMPTZ(6),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "platform_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_user_profile" (
    "id" UUID NOT NULL,
    "platform_user_id" UUID NOT NULL,
    "full_name" VARCHAR(160),
    "avatar_url" TEXT,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
    "date_format" VARCHAR(32) NOT NULL DEFAULT 'dd/MM/yyyy',
    "number_format" VARCHAR(32) NOT NULL DEFAULT 'id-ID',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "platform_user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_role" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "name_key" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "role_type" "PlatformRoleType" NOT NULL DEFAULT 'CUSTOM',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "platform_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_permission" (
    "id" UUID NOT NULL,
    "code" VARCHAR(96) NOT NULL,
    "module_code" VARCHAR(48) NOT NULL,
    "action_code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "name_key" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "platform_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_role_permission" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "platform_role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_user_role" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "platform_user_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_family_id" UUID NOT NULL,
    "tenant_id" UUID,
    "schema_name" VARCHAR(64),
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" VARCHAR(96),
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMPTZ(6),

    CONSTRAINT "platform_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_refresh_token" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "parent_token_id" UUID,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "platform_refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_login_attempt" (
    "id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "user_id" UUID,
    "success" BOOLEAN NOT NULL,
    "failure_code" VARCHAR(64),
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_login_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_step_up_challenge" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "StepUpPurpose" NOT NULL,
    "challenge_hash" VARCHAR(128) NOT NULL,
    "reason" TEXT,
    "target_type" VARCHAR(64),
    "target_id" VARCHAR(64),
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "consumed_at" TIMESTAMPTZ(6),

    CONSTRAINT "platform_step_up_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admin_saved_view" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "resource_code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "definition" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "platform_admin_saved_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_setting" (
    "id" UUID NOT NULL,
    "key" VARCHAR(96) NOT NULL,
    "value_type" VARCHAR(24) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "platform_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_provider" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "environment" VARCHAR(24) NOT NULL DEFAULT 'SANDBOX',
    "status" "PaymentProviderStatus" NOT NULL DEFAULT 'DISABLED',
    "base_url" VARCHAR(255),
    "create_order_path" VARCHAR(160) NOT NULL DEFAULT 'api/payment/create-order',
    "inquiry_order_path" VARCHAR(160) NOT NULL DEFAULT 'api/payment/inquiry-order/',
    "callback_url" VARCHAR(255),
    "success_redirect_url" VARCHAR(255),
    "failed_redirect_url" VARCHAR(255),
    "secret_reference" VARCHAR(160),
    "allowed_ips" TEXT,
    "trust_proxy" BOOLEAN NOT NULL DEFAULT false,
    "ack_success" VARCHAR(32) NOT NULL DEFAULT 'OK',
    "ack_error" VARCHAR(32) NOT NULL DEFAULT 'ERROR',
    "raw_payload_retention_days" INTEGER NOT NULL DEFAULT 90,
    "default_channel_codes" VARCHAR(255),
    "status_mapping" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payment_provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_channel" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "label_key" VARCHAR(160) NOT NULL,
    "admin_fee_type" "AdminFeeType" NOT NULL DEFAULT 'FIXED',
    "admin_fee_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "expiry_options" JSONB,
    "secret_reference" VARCHAR(160),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payment_channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_channel_legacy_config" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "raw_config" TEXT NOT NULL,
    "parsed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "parsed_result" JSONB,
    "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imported_by" UUID,

    CONSTRAINT "payment_channel_legacy_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_order" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "selected_channel_id" UUID,
    "order_number" VARCHAR(64) NOT NULL,
    "provider_order_id" VARCHAR(96),
    "provider_transaction_id" VARCHAR(96),
    "payment_url" TEXT,
    "virtual_account" VARCHAR(64),
    "amount" DECIMAL(19,4) NOT NULL,
    "admin_fee" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "expires_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "request_snapshot" JSONB,
    "response_snapshot" JSONB,
    "idempotency_key" VARCHAR(96) NOT NULL,
    "replaced_by_order_id" UUID,
    "failure_code" VARCHAR(64),
    "failure_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payment_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempt" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "attempt_type" "PaymentAttemptType" NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(96),
    "request_payload_masked" JSONB,
    "response_payload_masked" JSONB,
    "http_status" INTEGER,
    "provider_code" VARCHAR(32),
    "provider_message" TEXT,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_callback_event" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "order_id" UUID,
    "provider_transaction_id" VARCHAR(96) NOT NULL,
    "provider_order_id" VARCHAR(96),
    "raw_status" VARCHAR(48) NOT NULL,
    "normalized_status" "NormalizedPaymentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "amount" DECIMAL(19,4),
    "transaction_time" TIMESTAMPTZ(6),
    "payload_masked" JSONB NOT NULL,
    "payload_checksum" VARCHAR(64) NOT NULL,
    "processing_status" "CallbackProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "processing_message" TEXT,
    "remote_ip" VARCHAR(64),
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "ack_body" VARCHAR(64),

    CONSTRAINT "payment_callback_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_inquiry_attempt" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "source" "PaymentInquirySource" NOT NULL DEFAULT 'MANUAL_SINGLE',
    "batch_id" UUID,
    "request_url_masked" TEXT,
    "response_payload_masked" JSONB,
    "raw_status" VARCHAR(48),
    "normalized_status" "NormalizedPaymentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "http_status" INTEGER,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "actor_user_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_inquiry_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_check_batch" (
    "id" UUID NOT NULL,
    "batch_number" VARCHAR(48) NOT NULL,
    "source" "PaymentInquirySource" NOT NULL DEFAULT 'MANUAL_BATCH',
    "requested_by_id" UUID,
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "processed_items" INTEGER NOT NULL DEFAULT 0,
    "success_items" INTEGER NOT NULL DEFAULT 0,
    "failure_items" INTEGER NOT NULL DEFAULT 0,
    "status" "BatchRunStatus" NOT NULL DEFAULT 'PENDING',
    "concurrency" INTEGER NOT NULL DEFAULT 4,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payment_check_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_check_batch_item" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "BatchRunStatus" NOT NULL DEFAULT 'PENDING',
    "result_code" VARCHAR(48),
    "result_message" TEXT,
    "normalized_status" "NormalizedPaymentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "payment_check_batch_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_status_transition" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "PaymentOrderStatus" NOT NULL,
    "to_status" "PaymentOrderStatus" NOT NULL,
    "source_type" VARCHAR(48) NOT NULL,
    "source_id" UUID,
    "reason" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_status_transition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_to_host_log" (
    "id" UUID NOT NULL,
    "provider_id" UUID,
    "direction" VARCHAR(16) NOT NULL DEFAULT 'INBOUND',
    "endpoint" VARCHAR(160) NOT NULL,
    "remote_ip" VARCHAR(64),
    "headers_masked" JSONB,
    "payload_masked" TEXT,
    "order_number" VARCHAR(64),
    "provider_transaction_id" VARCHAR(96),
    "amount" DECIMAL(19,4),
    "result" VARCHAR(24) NOT NULL DEFAULT 'OK',
    "result_detail" TEXT,
    "stack_trace" TEXT,
    "http_status" INTEGER,
    "duration_ms" INTEGER,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_to_host_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reconciliation_run" (
    "id" UUID NOT NULL,
    "run_number" VARCHAR(48) NOT NULL,
    "provider_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "status" "BatchRunStatus" NOT NULL DEFAULT 'PENDING',
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "matched_count" INTEGER NOT NULL DEFAULT 0,
    "discrepancy_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reconciliation_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reconciliation_item" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider_status" VARCHAR(48),
    "local_status" "PaymentOrderStatus" NOT NULL,
    "outcome" "ReconciliationOutcome" NOT NULL DEFAULT 'MATCHED',
    "discrepancy_note" TEXT,
    "action_taken" VARCHAR(96),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reconciliation_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_dead_letter" (
    "id" UUID NOT NULL,
    "callback_event_id" UUID,
    "reason" TEXT NOT NULL,
    "payload_masked" JSONB,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_retry_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_dead_letter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_rate_limit_state" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "throttled_until" TIMESTAMPTZ(6),
    "backoff_ms" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "provider_rate_limit_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_catalog" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(160) NOT NULL,
    "description_key" VARCHAR(160),
    "description" TEXT,
    "category" "ModuleCategory" NOT NULL DEFAULT 'OPERATIONS',
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "icon" VARCHAR(64),
    "depends_on" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "module_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_catalog" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "feature_type" "FeatureType" NOT NULL DEFAULT 'BOOLEAN',
    "default_limit" INTEGER,
    "unit" VARCHAR(32),
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "feature_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_product" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(160) NOT NULL,
    "product_type" VARCHAR(32) NOT NULL DEFAULT 'LICENSE',
    "default_trial_days" INTEGER NOT NULL DEFAULT 30,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(160) NOT NULL,
    "description_key" VARCHAR(160),
    "market_segment" VARCHAR(48) NOT NULL DEFAULT 'GENERAL',
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan_version" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "PlanVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_until" TIMESTAMPTZ(6),
    "future_module_policy" "FutureModulePolicy" NOT NULL DEFAULT 'SNAPSHOT_AT_VERSION',
    "tenant_wide_policy" "TenantWidePolicy" NOT NULL DEFAULT 'ANY_ACTIVE_ITEM',
    "trial_days" INTEGER NOT NULL DEFAULT 30,
    "grace_period_days" INTEGER NOT NULL DEFAULT 7,
    "change_note" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "published_by" UUID,
    "retired_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_plan_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan_module" (
    "id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "entitlement_scope" "EntitlementScope" NOT NULL DEFAULT 'DEVICE',
    "included" BOOLEAN NOT NULL DEFAULT true,
    "is_add_on_only" BOOLEAN NOT NULL DEFAULT false,
    "usage_policy" VARCHAR(48),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_plan_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan_feature" (
    "id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "feature_id" UUID NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "limit_value" INTEGER,
    "unit" VARCHAR(32),
    "entitlement_scope" "EntitlementScope" NOT NULL DEFAULT 'TENANT_WIDE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_plan_feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan_price" (
    "id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "billing_metric" "BillingMetric" NOT NULL DEFAULT 'PER_POS_DEVICE',
    "billing_interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "minimum_qty" INTEGER NOT NULL DEFAULT 1,
    "tax_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_plan_price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan_price_tier" (
    "id" UUID NOT NULL,
    "price_id" UUID NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "max_quantity" INTEGER,
    "unit_price" DECIMAL(19,4),
    "flat_amount" DECIMAL(19,4),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_plan_price_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plan_constraint" (
    "id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "constraint_type" "PlanConstraintType" NOT NULL,
    "numeric_value" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_plan_constraint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_add_on" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(160) NOT NULL,
    "description_key" VARCHAR(160),
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_add_on_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_add_on_version" (
    "id" UUID NOT NULL,
    "add_on_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "PlanVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_add_on_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_add_on_module" (
    "id" UUID NOT NULL,
    "add_on_version_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "entitlement_scope" "EntitlementScope" NOT NULL DEFAULT 'TENANT_WIDE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_add_on_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_add_on_price" (
    "id" UUID NOT NULL,
    "add_on_version_id" UUID NOT NULL,
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "billing_metric" "BillingMetric" NOT NULL DEFAULT 'FLAT_TENANT',
    "billing_interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_add_on_price_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_plan_contract" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "contract_number" VARCHAR(48) NOT NULL,
    "package_mode" "PackageMode" NOT NULL DEFAULT 'UNIFORM_TENANT_PACKAGE',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_plan_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_plan_module_override" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "entitlement_scope" "EntitlementScope" NOT NULL DEFAULT 'TENANT_WIDE',
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_plan_module_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_plan_feature_override" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "feature_id" UUID NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "limit_value" INTEGER,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_plan_feature_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_price_override" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_version_id" UUID,
    "override_type" "PriceOverrideType" NOT NULL DEFAULT 'REPLACE_BASE_PRICE',
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "amount" DECIMAL(19,4),
    "percent" DECIMAL(9,4),
    "structured_formula" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMPTZ(6),
    "reason" TEXT NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_price_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_assignment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scope_type" "AssignmentScope" NOT NULL DEFAULT 'TENANT',
    "scope_id" UUID,
    "plan_version_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "package_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_snapshot" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_type" VARCHAR(48) NOT NULL,
    "source_id" UUID,
    "scope_type" "EntitlementScope" NOT NULL DEFAULT 'TENANT_WIDE',
    "scope_id" UUID,
    "modules" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(6),
    "checksum" VARCHAR(64) NOT NULL,

    CONSTRAINT "entitlement_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration" (
    "id" UUID NOT NULL,
    "registration_code" VARCHAR(32) NOT NULL,
    "business_name" VARCHAR(255) NOT NULL,
    "business_type" VARCHAR(255),
    "country" VARCHAR(100) NOT NULL DEFAULT 'Indonesia',
    "province" VARCHAR(100),
    "city_regency" VARCHAR(100),
    "district" VARCHAR(100),
    "address" VARCHAR(255),
    "contact_person" VARCHAR(255),
    "contact_phone" VARCHAR(50),
    "business_phone" VARCHAR(50),
    "email" VARCHAR(255) NOT NULL,
    "desired_username" VARCHAR(64) NOT NULL,
    "normalized_username" VARCHAR(64) NOT NULL,
    "generate_password" BOOLEAN NOT NULL DEFAULT true,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'DRAFT',
    "source" VARCHAR(48) NOT NULL DEFAULT 'PUBLIC_WEB',
    "locale_code" VARCHAR(16) NOT NULL DEFAULT 'id',
    "terms_accepted_at" TIMESTAMPTZ(6),
    "privacy_accepted_at" TIMESTAMPTZ(6),
    "failure_code" VARCHAR(64),
    "failure_message" TEXT,
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_credential_delivery" (
    "id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "channel" VARCHAR(48) NOT NULL DEFAULT 'API_RESPONSE',
    "delivered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(6),
    "fingerprint" VARCHAR(64) NOT NULL,

    CONSTRAINT "registration_credential_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_name_reservation" (
    "id" UUID NOT NULL,
    "normalized_name" VARCHAR(64) NOT NULL,
    "audit_name" VARCHAR(72) NOT NULL,
    "registration_id" UUID,
    "reserved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "released_at" TIMESTAMPTZ(6),

    CONSTRAINT "schema_name_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "registration_id" UUID,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'PENDING',
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "locale_code" VARCHAR(16) NOT NULL DEFAULT 'id',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
    "currency_code" VARCHAR(8) NOT NULL DEFAULT 'IDR',
    "trial_ends_at" TIMESTAMPTZ(6),
    "activated_at" TIMESTAMPTZ(6),
    "suspended_at" TIMESTAMPTZ(6),
    "suspend_reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_schema_registry" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "schema_name" VARCHAR(64) NOT NULL,
    "audit_schema_name" VARCHAR(72) NOT NULL,
    "schema_version" VARCHAR(16) NOT NULL DEFAULT 'V000',
    "status" "TenantSchemaStatus" NOT NULL DEFAULT 'RESERVED',
    "provisioned_at" TIMESTAMPTZ(6),
    "last_migrated_at" TIMESTAMPTZ(6),
    "last_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_schema_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_membership" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "platform_user_id" UUID NOT NULL,
    "tenant_subject_id" UUID,
    "is_owner" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    "invited_at" TIMESTAMPTZ(6),
    "joined_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provisioning_job" (
    "id" UUID NOT NULL,
    "registration_id" UUID,
    "tenant_id" UUID,
    "schema_name" VARCHAR(64) NOT NULL,
    "status" "ProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "current_stage" "ProvisioningStage" NOT NULL DEFAULT 'REQUESTED',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "error_code" VARCHAR(64),
    "error_message" TEXT,
    "retry_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "provisioning_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provisioning_step" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "stage" "ProvisioningStage" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "ProvisioningStepStatus" NOT NULL DEFAULT 'PENDING',
    "checksum" VARCHAR(64),
    "detail" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provisioning_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_migration_catalog" (
    "id" UUID NOT NULL,
    "version" VARCHAR(16) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "script_path" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "released_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "schema_migration_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_schema_migration_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "schema_name" VARCHAR(64) NOT NULL,
    "migration_version" VARCHAR(16) NOT NULL,
    "catalog_id" UUID,
    "checksum" VARCHAR(64) NOT NULL,
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(24) NOT NULL DEFAULT 'SUCCEEDED',
    "error_message" TEXT,

    CONSTRAINT "tenant_schema_migration_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_support_session" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "schema_name_snapshot" VARCHAR(64) NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "access_mode" "SupportAccessMode" NOT NULL DEFAULT 'READ_ONLY',
    "step_up_verified_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "read_count" INTEGER NOT NULL DEFAULT 0,
    "write_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "platform_support_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_tenant_action" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "action_code" VARCHAR(48) NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "reason" TEXT,
    "parameters" JSONB,
    "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_tenant_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_session" (
    "id" UUID NOT NULL,
    "session_token" VARCHAR(128) NOT NULL,
    "schema_name" VARCHAR(64) NOT NULL DEFAULT 'demo',
    "status" "DemoSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "locale_code" VARCHAR(16) NOT NULL DEFAULT 'id',
    "reset_generation" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "demo_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_reset_run" (
    "id" UUID NOT NULL,
    "generation" INTEGER NOT NULL,
    "triggered_by" VARCHAR(48) NOT NULL DEFAULT 'SCHEDULER',
    "triggered_by_id" UUID,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "status" VARCHAR(24) NOT NULL DEFAULT 'RUNNING',
    "tables_truncated" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "demo_reset_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_permission_action" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "action_type" VARCHAR(24) NOT NULL DEFAULT 'STANDARD',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "global_permission_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_menu_template" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(64) NOT NULL,
    "translation_key" VARCHAR(160) NOT NULL,
    "default_label" VARCHAR(160) NOT NULL,
    "route" VARCHAR(160),
    "icon" VARCHAR(64),
    "module_code" VARCHAR(48),
    "platform_target" VARCHAR(24) NOT NULL DEFAULT 'WEB',
    "level" INTEGER NOT NULL DEFAULT 0,
    "path" VARCHAR(512) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_coming_soon" BOOLEAN NOT NULL DEFAULT false,
    "action_codes" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "global_menu_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_role_template" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "role_type" VARCHAR(24) NOT NULL DEFAULT 'TENANT',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "sample_batch_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    "deactivated_at" TIMESTAMPTZ(6),
    "deactivated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "delete_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "global_role_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_event_occurred_at_idx" ON "platform__audit"."audit_event"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_event_actor_user_id_occurred_at_idx" ON "platform__audit"."audit_event"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_event_tenant_id_occurred_at_idx" ON "platform__audit"."audit_event"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_event_module_code_action_code_occurred_at_idx" ON "platform__audit"."audit_event"("module_code", "action_code", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_event_entity_type_entity_id_idx" ON "platform__audit"."audit_event"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_event_request_id_idx" ON "platform__audit"."audit_event"("request_id");

-- CreateIndex
CREATE INDEX "audit_row_change_audit_event_id_idx" ON "platform__audit"."audit_row_change"("audit_event_id");

-- CreateIndex
CREATE INDEX "audit_row_change_table_schema_table_name_statement_timestam_idx" ON "platform__audit"."audit_row_change"("table_schema", "table_name", "statement_timestamp");

-- CreateIndex
CREATE INDEX "audit_security_event_occurred_at_idx" ON "platform__audit"."audit_security_event"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_security_event_event_code_occurred_at_idx" ON "platform__audit"."audit_security_event"("event_code", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_security_event_actor_user_id_occurred_at_idx" ON "platform__audit"."audit_security_event"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_export_event_occurred_at_idx" ON "platform__audit"."audit_export_event"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_export_event_actor_user_id_occurred_at_idx" ON "platform__audit"."audit_export_event"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_permission_change_occurred_at_idx" ON "platform__audit"."audit_permission_change"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_permission_change_target_type_target_id_idx" ON "platform__audit"."audit_permission_change"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_schema_migration_schema_name_occurred_at_idx" ON "platform__audit"."audit_schema_migration"("schema_name", "occurred_at");

-- CreateIndex
CREATE INDEX "pricing_quote_tenant_id_status_idx" ON "pricing_quote"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "pricing_quote_expires_at_idx" ON "pricing_quote"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_quote_quote_number_key" ON "pricing_quote"("quote_number");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_quote_idempotency_key_key" ON "pricing_quote"("idempotency_key");

-- CreateIndex
CREATE INDEX "pricing_quote_line_quote_id_sort_order_idx" ON "pricing_quote_line"("quote_id", "sort_order");

-- CreateIndex
CREATE INDEX "pricing_quote_line_device_id_idx" ON "pricing_quote_line"("device_id");

-- CreateIndex
CREATE INDEX "pricing_adjustment_quote_id_sequence_idx" ON "pricing_adjustment"("quote_id", "sequence");

-- CreateIndex
CREATE INDEX "pos_device_tenant_id_status_is_billable_idx" ON "pos_device"("tenant_id", "status", "is_billable");

-- CreateIndex
CREATE INDEX "pos_device_is_active_deleted_at_idx" ON "pos_device"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "pos_device_is_sample_sample_batch_id_idx" ON "pos_device"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_device_tenant_id_code_key" ON "pos_device"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "device_activation_device_id_revoked_at_idx" ON "device_activation"("device_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_activation_activation_code_key" ON "device_activation"("activation_code");

-- CreateIndex
CREATE INDEX "device_entitlement_device_id_status_idx" ON "device_entitlement"("device_id", "status");

-- CreateIndex
CREATE INDEX "device_entitlement_ends_at_idx" ON "device_entitlement"("ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_entitlement_device_id_module_code_feature_code_start_key" ON "device_entitlement"("device_id", "module_code", "feature_code", "starts_at");

-- CreateIndex
CREATE INDEX "subscription_tenant_id_status_idx" ON "subscription"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "subscription_current_period_end_idx" ON "subscription"("current_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_subscription_number_key" ON "subscription"("subscription_number");

-- CreateIndex
CREATE INDEX "subscription_item_subscription_id_status_idx" ON "subscription_item"("subscription_id", "status");

-- CreateIndex
CREATE INDEX "subscription_item_device_id_idx" ON "subscription_item"("device_id");

-- CreateIndex
CREATE INDEX "subscription_change_subscription_id_effective_at_idx" ON "subscription_change"("subscription_id", "effective_at");

-- CreateIndex
CREATE INDEX "billing_invoice_tenant_id_status_idx" ON "billing_invoice"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "billing_invoice_due_date_status_idx" ON "billing_invoice"("due_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoice_invoice_number_key" ON "billing_invoice"("invoice_number");

-- CreateIndex
CREATE INDEX "billing_invoice_line_invoice_id_sort_order_idx" ON "billing_invoice_line"("invoice_id", "sort_order");

-- CreateIndex
CREATE INDEX "billing_invoice_line_device_id_idx" ON "billing_invoice_line"("device_id");

-- CreateIndex
CREATE INDEX "billing_payment_allocation_invoice_id_idx" ON "billing_payment_allocation"("invoice_id");

-- CreateIndex
CREATE INDEX "billing_payment_allocation_payment_order_id_idx" ON "billing_payment_allocation"("payment_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payment_allocation_idempotency_key_key" ON "billing_payment_allocation"("idempotency_key");

-- CreateIndex
CREATE INDEX "billing_credit_note_invoice_id_idx" ON "billing_credit_note"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_credit_note_credit_note_number_key" ON "billing_credit_note"("credit_note_number");

-- CreateIndex
CREATE INDEX "billing_receipt_invoice_id_idx" ON "billing_receipt"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_receipt_receipt_number_key" ON "billing_receipt"("receipt_number");

-- CreateIndex
CREATE INDEX "idempotency_record_expires_at_idx" ON "idempotency_record"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_record_idempotency_key_operation_key" ON "idempotency_record"("idempotency_key", "operation");

-- CreateIndex
CREATE INDEX "website_is_active_deleted_at_idx" ON "website"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "website_is_sample_sample_batch_id_idx" ON "website"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_code_key" ON "website"("code");

-- CreateIndex
CREATE INDEX "website_domain_website_id_is_primary_idx" ON "website_domain"("website_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "website_domain_domain_key" ON "website_domain"("domain");

-- CreateIndex
CREATE INDEX "cms_page_status_is_active_deleted_at_idx" ON "cms_page"("status", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "cms_page_parent_id_sort_order_idx" ON "cms_page"("parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "cms_page_is_sample_sample_batch_id_idx" ON "cms_page"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "cms_page_website_id_slug_key" ON "cms_page"("website_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_page_website_id_code_key" ON "cms_page"("website_id", "code");

-- CreateIndex
CREATE INDEX "cms_page_version_status_scheduled_at_idx" ON "cms_page_version"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "cms_page_version_page_id_version_number_key" ON "cms_page_version"("page_id", "version_number");

-- CreateIndex
CREATE INDEX "cms_page_translation_locale_code_idx" ON "cms_page_translation"("locale_code");

-- CreateIndex
CREATE UNIQUE INDEX "cms_page_translation_page_version_id_locale_code_key" ON "cms_page_translation"("page_version_id", "locale_code");

-- CreateIndex
CREATE INDEX "cms_block_page_version_id_sort_order_idx" ON "cms_block"("page_version_id", "sort_order");

-- CreateIndex
CREATE INDEX "cms_block_parent_block_id_idx" ON "cms_block"("parent_block_id");

-- CreateIndex
CREATE UNIQUE INDEX "cms_block_page_version_id_block_key_key" ON "cms_block"("page_version_id", "block_key");

-- CreateIndex
CREATE INDEX "cms_block_translation_locale_code_idx" ON "cms_block_translation"("locale_code");

-- CreateIndex
CREATE UNIQUE INDEX "cms_block_translation_block_id_locale_code_key" ON "cms_block_translation"("block_id", "locale_code");

-- CreateIndex
CREATE INDEX "cms_navigation_location_is_active_idx" ON "cms_navigation"("location", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cms_navigation_website_id_code_key" ON "cms_navigation"("website_id", "code");

-- CreateIndex
CREATE INDEX "cms_navigation_item_navigation_id_sort_order_idx" ON "cms_navigation_item"("navigation_id", "sort_order");

-- CreateIndex
CREATE INDEX "cms_navigation_item_parent_id_idx" ON "cms_navigation_item"("parent_id");

-- CreateIndex
CREATE INDEX "cms_footer_section_sort_order_idx" ON "cms_footer_section"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "cms_footer_section_website_id_code_key" ON "cms_footer_section"("website_id", "code");

-- CreateIndex
CREATE INDEX "cms_footer_item_footer_section_id_sort_order_idx" ON "cms_footer_item"("footer_section_id", "sort_order");

-- CreateIndex
CREATE INDEX "news_category_is_active_deleted_at_idx" ON "news_category"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "news_category_is_sample_sample_batch_id_idx" ON "news_category"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_category_code_key" ON "news_category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "news_category_slug_key" ON "news_category"("slug");

-- CreateIndex
CREATE INDEX "news_article_status_published_at_idx" ON "news_article"("status", "published_at");

-- CreateIndex
CREATE INDEX "news_article_category_id_status_idx" ON "news_article"("category_id", "status");

-- CreateIndex
CREATE INDEX "news_article_is_active_deleted_at_idx" ON "news_article"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "news_article_is_sample_sample_batch_id_idx" ON "news_article"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_article_slug_key" ON "news_article"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "news_article_code_key" ON "news_article"("code");

-- CreateIndex
CREATE INDEX "news_article_version_status_idx" ON "news_article_version"("status");

-- CreateIndex
CREATE UNIQUE INDEX "news_article_version_article_id_version_number_key" ON "news_article_version"("article_id", "version_number");

-- CreateIndex
CREATE INDEX "news_article_translation_locale_code_idx" ON "news_article_translation"("locale_code");

-- CreateIndex
CREATE UNIQUE INDEX "news_article_translation_article_version_id_locale_code_key" ON "news_article_translation"("article_version_id", "locale_code");

-- CreateIndex
CREATE INDEX "news_tag_is_active_deleted_at_idx" ON "news_tag"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "news_tag_is_sample_sample_batch_id_idx" ON "news_tag"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_tag_code_key" ON "news_tag"("code");

-- CreateIndex
CREATE UNIQUE INDEX "news_tag_slug_key" ON "news_tag"("slug");

-- CreateIndex
CREATE INDEX "news_article_tag_tag_id_idx" ON "news_article_tag"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_article_tag_article_id_tag_id_key" ON "news_article_tag"("article_id", "tag_id");

-- CreateIndex
CREATE INDEX "announcement_audience_type_is_active_starts_at_idx" ON "announcement"("audience_type", "is_active", "starts_at");

-- CreateIndex
CREATE INDEX "announcement_is_sample_sample_batch_id_idx" ON "announcement"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_code_key" ON "announcement"("code");

-- CreateIndex
CREATE INDEX "hero_slide_is_active_sort_order_idx" ON "hero_slide"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "hero_slide_is_sample_sample_batch_id_idx" ON "hero_slide"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "hero_slide_website_id_code_key" ON "hero_slide"("website_id", "code");

-- CreateIndex
CREATE INDEX "marketing_feature_group_is_active_sort_order_idx" ON "marketing_feature"("group", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "marketing_feature_is_sample_sample_batch_id_idx" ON "marketing_feature"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_feature_code_key" ON "marketing_feature"("code");

-- CreateIndex
CREATE INDEX "faq_category_is_active_sort_order_idx" ON "faq_category"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "faq_category_is_sample_sample_batch_id_idx" ON "faq_category"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "faq_category_code_key" ON "faq_category"("code");

-- CreateIndex
CREATE INDEX "faq_item_category_id_sort_order_idx" ON "faq_item"("category_id", "sort_order");

-- CreateIndex
CREATE INDEX "faq_item_is_active_deleted_at_idx" ON "faq_item"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "faq_item_is_sample_sample_batch_id_idx" ON "faq_item"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "faq_item_code_key" ON "faq_item"("code");

-- CreateIndex
CREATE INDEX "testimonial_is_active_sort_order_idx" ON "testimonial"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "testimonial_is_sample_sample_batch_id_idx" ON "testimonial"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "testimonial_code_key" ON "testimonial"("code");

-- CreateIndex
CREATE INDEX "partner_logo_is_active_sort_order_idx" ON "partner_logo"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "partner_logo_is_sample_sample_batch_id_idx" ON "partner_logo"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_logo_code_key" ON "partner_logo"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_display_section_website_id_code_key" ON "pricing_display_section"("website_id", "code");

-- CreateIndex
CREATE INDEX "call_to_action_is_active_sort_order_idx" ON "call_to_action"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "call_to_action_is_sample_sample_batch_id_idx" ON "call_to_action"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_to_action_code_key" ON "call_to_action"("code");

-- CreateIndex
CREATE INDEX "contact_office_is_active_sort_order_idx" ON "contact_office"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "contact_office_is_sample_sample_batch_id_idx" ON "contact_office"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_office_code_key" ON "contact_office"("code");

-- CreateIndex
CREATE INDEX "contact_message_status_created_at_idx" ON "contact_message"("status", "created_at");

-- CreateIndex
CREATE INDEX "contact_message_email_idx" ON "contact_message"("email");

-- CreateIndex
CREATE INDEX "newsletter_subscriber_status_idx" ON "newsletter_subscriber"("status");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriber_email_key" ON "newsletter_subscriber"("email");

-- CreateIndex
CREATE INDEX "media_folder_parent_id_sort_order_idx" ON "media_folder"("parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "media_folder_is_active_deleted_at_idx" ON "media_folder"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "media_folder_is_sample_sample_batch_id_idx" ON "media_folder"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_folder_code_key" ON "media_folder"("code");

-- CreateIndex
CREATE INDEX "media_asset_folder_id_sort_order_idx" ON "media_asset"("folder_id", "sort_order");

-- CreateIndex
CREATE INDEX "media_asset_is_active_deleted_at_idx" ON "media_asset"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "media_asset_is_sample_sample_batch_id_idx" ON "media_asset"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_code_key" ON "media_asset"("code");

-- CreateIndex
CREATE UNIQUE INDEX "redirect_rule_website_id_source_path_key" ON "redirect_rule"("website_id", "source_path");

-- CreateIndex
CREATE INDEX "cms_publication_workflow_entity_type_entity_id_created_at_idx" ON "cms_publication_workflow"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "cms_preview_token_entity_type_entity_id_idx" ON "cms_preview_token"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "cms_preview_token_expires_at_idx" ON "cms_preview_token"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "cms_preview_token_token_hash_key" ON "cms_preview_token"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "seo_structured_data_page_id_schema_type_key" ON "seo_structured_data"("page_id", "schema_type");

-- CreateIndex
CREATE INDEX "discount_program_status_is_active_valid_from_idx" ON "discount_program"("status", "is_active", "valid_from");

-- CreateIndex
CREATE INDEX "discount_program_is_active_deleted_at_idx" ON "discount_program"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "discount_program_is_sample_sample_batch_id_idx" ON "discount_program"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_program_code_key" ON "discount_program"("code");

-- CreateIndex
CREATE INDEX "discount_rule_program_id_sequence_idx" ON "discount_rule"("program_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "discount_rule_program_id_code_key" ON "discount_rule"("program_id", "code");

-- CreateIndex
CREATE INDEX "discount_condition_group_rule_id_sequence_idx" ON "discount_condition_group"("rule_id", "sequence");

-- CreateIndex
CREATE INDEX "discount_condition_group_parent_group_id_idx" ON "discount_condition_group"("parent_group_id");

-- CreateIndex
CREATE INDEX "discount_condition_group_id_sequence_idx" ON "discount_condition"("group_id", "sequence");

-- CreateIndex
CREATE INDEX "discount_benefit_rule_id_sequence_idx" ON "discount_benefit"("rule_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "discount_tenant_eligibility_program_id_tenant_id_key" ON "discount_tenant_eligibility"("program_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "discount_plan_eligibility_program_id_plan_id_key" ON "discount_plan_eligibility"("program_id", "plan_id");

-- CreateIndex
CREATE INDEX "promo_code_program_id_is_active_idx" ON "promo_code"("program_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "promo_code_code_key" ON "promo_code"("code");

-- CreateIndex
CREATE INDEX "discount_redemption_program_id_tenant_id_idx" ON "discount_redemption"("program_id", "tenant_id");

-- CreateIndex
CREATE INDEX "discount_redemption_occurred_at_idx" ON "discount_redemption"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "discount_redemption_idempotency_key_key" ON "discount_redemption"("idempotency_key");

-- CreateIndex
CREATE INDEX "discount_approval_program_id_status_idx" ON "discount_approval"("program_id", "status");

-- CreateIndex
CREATE INDEX "locale_enabled_sort_order_idx" ON "locale"("enabled", "sort_order");

-- CreateIndex
CREATE INDEX "locale_is_active_deleted_at_idx" ON "locale"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "locale_is_sample_sample_batch_id_idx" ON "locale"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "locale_code_key" ON "locale"("code");

-- CreateIndex
CREATE INDEX "translation_namespace_is_active_deleted_at_idx" ON "translation_namespace"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "translation_namespace_is_sample_sample_batch_id_idx" ON "translation_namespace"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "translation_namespace_code_key" ON "translation_namespace"("code");

-- CreateIndex
CREATE INDEX "translation_key_key_idx" ON "translation_key"("key");

-- CreateIndex
CREATE INDEX "translation_key_is_sample_sample_batch_id_idx" ON "translation_key"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "translation_key_namespace_id_key_key" ON "translation_key"("namespace_id", "key");

-- CreateIndex
CREATE INDEX "translation_value_locale_code_idx" ON "translation_value"("locale_code");

-- CreateIndex
CREATE UNIQUE INDEX "translation_value_key_id_locale_code_key" ON "translation_value"("key_id", "locale_code");

-- CreateIndex
CREATE INDEX "tenant_translation_override_tenant_id_locale_code_idx" ON "tenant_translation_override"("tenant_id", "locale_code");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_translation_override_tenant_id_key_id_locale_code_key" ON "tenant_translation_override"("tenant_id", "key_id", "locale_code");

-- CreateIndex
CREATE INDEX "translation_import_run_started_at_idx" ON "translation_import_run"("started_at");

-- CreateIndex
CREATE INDEX "platform_user_status_is_active_deleted_at_idx" ON "platform_user"("status", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "platform_user_created_at_idx" ON "platform_user"("created_at");

-- CreateIndex
CREATE INDEX "platform_user_updated_at_idx" ON "platform_user"("updated_at");

-- CreateIndex
CREATE INDEX "platform_user_is_sample_sample_batch_id_idx" ON "platform_user"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_normalized_username_key" ON "platform_user"("normalized_username");

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_normalized_email_key" ON "platform_user"("normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_profile_platform_user_id_key" ON "platform_user_profile"("platform_user_id");

-- CreateIndex
CREATE INDEX "platform_role_is_active_deleted_at_idx" ON "platform_role"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "platform_role_created_at_idx" ON "platform_role"("created_at");

-- CreateIndex
CREATE INDEX "platform_role_updated_at_idx" ON "platform_role"("updated_at");

-- CreateIndex
CREATE INDEX "platform_role_is_sample_sample_batch_id_idx" ON "platform_role"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_role_code_key" ON "platform_role"("code");

-- CreateIndex
CREATE INDEX "platform_permission_module_code_idx" ON "platform_permission"("module_code");

-- CreateIndex
CREATE INDEX "platform_permission_is_active_deleted_at_idx" ON "platform_permission"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "platform_permission_is_sample_sample_batch_id_idx" ON "platform_permission"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_permission_code_key" ON "platform_permission"("code");

-- CreateIndex
CREATE INDEX "platform_role_permission_permission_id_idx" ON "platform_role_permission"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_role_permission_role_id_permission_id_key" ON "platform_role_permission"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "platform_user_role_role_id_idx" ON "platform_user_role"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_role_user_id_role_id_key" ON "platform_user_role"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "platform_session_user_id_revoked_at_idx" ON "platform_session"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "platform_session_token_family_id_idx" ON "platform_session"("token_family_id");

-- CreateIndex
CREATE INDEX "platform_session_expires_at_idx" ON "platform_session"("expires_at");

-- CreateIndex
CREATE INDEX "platform_refresh_token_session_id_revoked_at_idx" ON "platform_refresh_token"("session_id", "revoked_at");

-- CreateIndex
CREATE INDEX "platform_refresh_token_expires_at_idx" ON "platform_refresh_token"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_refresh_token_token_hash_key" ON "platform_refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "platform_login_attempt_username_occurred_at_idx" ON "platform_login_attempt"("username", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_login_attempt_ip_address_occurred_at_idx" ON "platform_login_attempt"("ip_address", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_step_up_challenge_user_id_purpose_expires_at_idx" ON "platform_step_up_challenge"("user_id", "purpose", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admin_saved_view_user_id_resource_code_name_key" ON "platform_admin_saved_view"("user_id", "resource_code", "name");

-- CreateIndex
CREATE UNIQUE INDEX "platform_setting_key_key" ON "platform_setting"("key");

-- CreateIndex
CREATE INDEX "payment_provider_is_active_deleted_at_idx" ON "payment_provider"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "payment_provider_is_sample_sample_batch_id_idx" ON "payment_provider"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_code_key" ON "payment_provider"("code");

-- CreateIndex
CREATE INDEX "payment_channel_is_active_deleted_at_idx" ON "payment_channel"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "payment_channel_is_sample_sample_batch_id_idx" ON "payment_channel"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_channel_provider_id_code_key" ON "payment_channel"("provider_id", "code");

-- CreateIndex
CREATE INDEX "payment_channel_legacy_config_provider_id_imported_at_idx" ON "payment_channel_legacy_config"("provider_id", "imported_at");

-- CreateIndex
CREATE INDEX "payment_order_invoice_id_status_idx" ON "payment_order"("invoice_id", "status");

-- CreateIndex
CREATE INDEX "payment_order_status_expires_at_idx" ON "payment_order"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_order_order_number_key" ON "payment_order"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "payment_order_idempotency_key_key" ON "payment_order"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payment_order_provider_id_provider_transaction_id_key" ON "payment_order"("provider_id", "provider_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_order_provider_id_provider_order_id_key" ON "payment_order"("provider_id", "provider_order_id");

-- CreateIndex
CREATE INDEX "payment_attempt_order_id_attempt_type_occurred_at_idx" ON "payment_attempt"("order_id", "attempt_type", "occurred_at");

-- CreateIndex
CREATE INDEX "payment_callback_event_order_id_processing_status_idx" ON "payment_callback_event"("order_id", "processing_status");

-- CreateIndex
CREATE INDEX "payment_callback_event_received_at_idx" ON "payment_callback_event"("received_at");

-- CreateIndex
CREATE INDEX "payment_callback_event_provider_transaction_id_idx" ON "payment_callback_event"("provider_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_callback_event_provider_id_provider_transaction_id__key" ON "payment_callback_event"("provider_id", "provider_transaction_id", "payload_checksum");

-- CreateIndex
CREATE INDEX "payment_inquiry_attempt_order_id_occurred_at_idx" ON "payment_inquiry_attempt"("order_id", "occurred_at");

-- CreateIndex
CREATE INDEX "payment_inquiry_attempt_batch_id_idx" ON "payment_inquiry_attempt"("batch_id");

-- CreateIndex
CREATE INDEX "payment_check_batch_status_created_at_idx" ON "payment_check_batch"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_check_batch_batch_number_key" ON "payment_check_batch"("batch_number");

-- CreateIndex
CREATE INDEX "payment_check_batch_item_batch_id_status_idx" ON "payment_check_batch_item"("batch_id", "status");

-- CreateIndex
CREATE INDEX "payment_check_batch_item_batch_id_sequence_idx" ON "payment_check_batch_item"("batch_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "payment_check_batch_item_batch_id_order_id_key" ON "payment_check_batch_item"("batch_id", "order_id");

-- CreateIndex
CREATE INDEX "payment_status_transition_order_id_occurred_at_idx" ON "payment_status_transition"("order_id", "occurred_at");

-- CreateIndex
CREATE INDEX "host_to_host_log_occurred_at_idx" ON "host_to_host_log"("occurred_at");

-- CreateIndex
CREATE INDEX "host_to_host_log_remote_ip_occurred_at_idx" ON "host_to_host_log"("remote_ip", "occurred_at");

-- CreateIndex
CREATE INDEX "host_to_host_log_order_number_idx" ON "host_to_host_log"("order_number");

-- CreateIndex
CREATE INDEX "payment_reconciliation_run_provider_id_period_start_idx" ON "payment_reconciliation_run"("provider_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reconciliation_run_run_number_key" ON "payment_reconciliation_run"("run_number");

-- CreateIndex
CREATE INDEX "payment_reconciliation_item_run_id_outcome_idx" ON "payment_reconciliation_item"("run_id", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reconciliation_item_run_id_order_id_key" ON "payment_reconciliation_item"("run_id", "order_id");

-- CreateIndex
CREATE INDEX "payment_dead_letter_resolved_at_created_at_idx" ON "payment_dead_letter"("resolved_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "provider_rate_limit_state_provider_id_window_start_key" ON "provider_rate_limit_state"("provider_id", "window_start");

-- CreateIndex
CREATE INDEX "module_catalog_category_sort_order_idx" ON "module_catalog"("category", "sort_order");

-- CreateIndex
CREATE INDEX "module_catalog_is_active_deleted_at_idx" ON "module_catalog"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "module_catalog_is_sample_sample_batch_id_idx" ON "module_catalog"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_catalog_code_key" ON "module_catalog"("code");

-- CreateIndex
CREATE INDEX "feature_catalog_module_id_sort_order_idx" ON "feature_catalog"("module_id", "sort_order");

-- CreateIndex
CREATE INDEX "feature_catalog_is_active_deleted_at_idx" ON "feature_catalog"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "feature_catalog_is_sample_sample_batch_id_idx" ON "feature_catalog"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "feature_catalog_code_key" ON "feature_catalog"("code");

-- CreateIndex
CREATE INDEX "subscription_product_is_active_deleted_at_idx" ON "subscription_product"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "subscription_product_is_sample_sample_batch_id_idx" ON "subscription_product"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_product_code_key" ON "subscription_product"("code");

-- CreateIndex
CREATE INDEX "subscription_plan_status_is_public_sort_order_idx" ON "subscription_plan"("status", "is_public", "sort_order");

-- CreateIndex
CREATE INDEX "subscription_plan_is_active_deleted_at_idx" ON "subscription_plan"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "subscription_plan_is_sample_sample_batch_id_idx" ON "subscription_plan"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_code_key" ON "subscription_plan"("code");

-- CreateIndex
CREATE INDEX "subscription_plan_version_status_effective_from_idx" ON "subscription_plan_version"("status", "effective_from");

-- CreateIndex
CREATE INDEX "subscription_plan_version_plan_id_status_idx" ON "subscription_plan_version"("plan_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_version_plan_id_version_number_key" ON "subscription_plan_version"("plan_id", "version_number");

-- CreateIndex
CREATE INDEX "subscription_plan_module_module_id_idx" ON "subscription_plan_module"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_module_plan_version_id_module_id_key" ON "subscription_plan_module"("plan_version_id", "module_id");

-- CreateIndex
CREATE INDEX "subscription_plan_feature_feature_id_idx" ON "subscription_plan_feature"("feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_feature_plan_version_id_feature_id_key" ON "subscription_plan_feature"("plan_version_id", "feature_id");

-- CreateIndex
CREATE INDEX "subscription_plan_price_plan_version_id_is_active_idx" ON "subscription_plan_price"("plan_version_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_price_plan_version_id_currency_code_billi_key" ON "subscription_plan_price"("plan_version_id", "currency_code", "billing_metric", "billing_interval", "interval_count", "effective_from");

-- CreateIndex
CREATE INDEX "subscription_plan_price_tier_price_id_sort_order_idx" ON "subscription_plan_price_tier"("price_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_price_tier_price_id_min_quantity_key" ON "subscription_plan_price_tier"("price_id", "min_quantity");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plan_constraint_plan_version_id_constraint_typ_key" ON "subscription_plan_constraint"("plan_version_id", "constraint_type");

-- CreateIndex
CREATE INDEX "subscription_add_on_is_active_deleted_at_idx" ON "subscription_add_on"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "subscription_add_on_is_sample_sample_batch_id_idx" ON "subscription_add_on"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_add_on_code_key" ON "subscription_add_on"("code");

-- CreateIndex
CREATE INDEX "subscription_add_on_version_status_effective_from_idx" ON "subscription_add_on_version"("status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_add_on_version_add_on_id_version_number_key" ON "subscription_add_on_version"("add_on_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_add_on_module_add_on_version_id_module_id_key" ON "subscription_add_on_module"("add_on_version_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_add_on_price_add_on_version_id_currency_code_b_key" ON "subscription_add_on_price"("add_on_version_id", "currency_code", "billing_interval", "interval_count", "effective_from");

-- CreateIndex
CREATE INDEX "tenant_plan_contract_tenant_id_status_idx" ON "tenant_plan_contract"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_plan_contract_contract_number_key" ON "tenant_plan_contract"("contract_number");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_plan_module_override_contract_id_module_id_key" ON "tenant_plan_module_override"("contract_id", "module_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_plan_feature_override_contract_id_feature_id_key" ON "tenant_plan_feature_override"("contract_id", "feature_id");

-- CreateIndex
CREATE INDEX "tenant_price_override_tenant_id_is_active_effective_from_idx" ON "tenant_price_override"("tenant_id", "is_active", "effective_from");

-- CreateIndex
CREATE INDEX "tenant_price_override_plan_version_id_idx" ON "tenant_price_override"("plan_version_id");

-- CreateIndex
CREATE INDEX "package_assignment_tenant_id_scope_type_scope_id_idx" ON "package_assignment"("tenant_id", "scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "package_assignment_plan_version_id_idx" ON "package_assignment"("plan_version_id");

-- CreateIndex
CREATE INDEX "entitlement_snapshot_tenant_id_scope_type_scope_id_generate_idx" ON "entitlement_snapshot"("tenant_id", "scope_type", "scope_id", "generated_at");

-- CreateIndex
CREATE INDEX "registration_normalized_username_idx" ON "registration"("normalized_username");

-- CreateIndex
CREATE INDEX "registration_status_created_at_idx" ON "registration"("status", "created_at");

-- CreateIndex
CREATE INDEX "registration_email_idx" ON "registration"("email");

-- CreateIndex
CREATE UNIQUE INDEX "registration_registration_code_key" ON "registration"("registration_code");

-- CreateIndex
CREATE INDEX "registration_credential_delivery_registration_id_idx" ON "registration_credential_delivery"("registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "schema_name_reservation_registration_id_key" ON "schema_name_reservation"("registration_id");

-- CreateIndex
CREATE INDEX "schema_name_reservation_expires_at_idx" ON "schema_name_reservation"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "schema_name_reservation_normalized_name_key" ON "schema_name_reservation"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_registration_id_key" ON "tenant"("registration_id");

-- CreateIndex
CREATE INDEX "tenant_status_is_active_deleted_at_idx" ON "tenant"("status", "is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "tenant_created_at_idx" ON "tenant"("created_at");

-- CreateIndex
CREATE INDEX "tenant_is_sample_sample_batch_id_idx" ON "tenant"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_code_key" ON "tenant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_schema_registry_tenant_id_key" ON "tenant_schema_registry"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_schema_registry_status_idx" ON "tenant_schema_registry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_schema_registry_schema_name_key" ON "tenant_schema_registry"("schema_name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_schema_registry_audit_schema_name_key" ON "tenant_schema_registry"("audit_schema_name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_schema_registry_username_key" ON "tenant_schema_registry"("username");

-- CreateIndex
CREATE INDEX "tenant_membership_platform_user_id_idx" ON "tenant_membership"("platform_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_membership_tenant_id_platform_user_id_key" ON "tenant_membership"("tenant_id", "platform_user_id");

-- CreateIndex
CREATE INDEX "provisioning_job_status_retry_at_idx" ON "provisioning_job"("status", "retry_at");

-- CreateIndex
CREATE INDEX "provisioning_job_schema_name_idx" ON "provisioning_job"("schema_name");

-- CreateIndex
CREATE INDEX "provisioning_job_tenant_id_idx" ON "provisioning_job"("tenant_id");

-- CreateIndex
CREATE INDEX "provisioning_step_job_id_status_idx" ON "provisioning_step"("job_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_step_job_id_sequence_key" ON "provisioning_step"("job_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "schema_migration_catalog_version_key" ON "schema_migration_catalog"("version");

-- CreateIndex
CREATE UNIQUE INDEX "schema_migration_catalog_sequence_key" ON "schema_migration_catalog"("sequence");

-- CreateIndex
CREATE INDEX "tenant_schema_migration_history_tenant_id_idx" ON "tenant_schema_migration_history"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_schema_migration_history_applied_at_idx" ON "tenant_schema_migration_history"("applied_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_schema_migration_history_schema_name_migration_versi_key" ON "tenant_schema_migration_history"("schema_name", "migration_version");

-- CreateIndex
CREATE INDEX "platform_support_session_tenant_id_expires_at_idx" ON "platform_support_session"("tenant_id", "expires_at");

-- CreateIndex
CREATE INDEX "platform_support_session_requested_by_id_idx" ON "platform_support_session"("requested_by_id");

-- CreateIndex
CREATE INDEX "platform_tenant_action_tenant_id_action_code_idx" ON "platform_tenant_action"("tenant_id", "action_code");

-- CreateIndex
CREATE INDEX "platform_tenant_action_status_idx" ON "platform_tenant_action"("status");

-- CreateIndex
CREATE INDEX "demo_session_status_expires_at_idx" ON "demo_session"("status", "expires_at");

-- CreateIndex
CREATE INDEX "demo_session_ip_address_started_at_idx" ON "demo_session"("ip_address", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "demo_session_session_token_key" ON "demo_session"("session_token");

-- CreateIndex
CREATE INDEX "demo_reset_run_started_at_idx" ON "demo_reset_run"("started_at");

-- CreateIndex
CREATE INDEX "global_permission_action_is_active_deleted_at_idx" ON "global_permission_action"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "global_permission_action_is_sample_sample_batch_id_idx" ON "global_permission_action"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_permission_action_code_key" ON "global_permission_action"("code");

-- CreateIndex
CREATE INDEX "global_menu_template_parent_id_sort_order_idx" ON "global_menu_template"("parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "global_menu_template_is_active_deleted_at_idx" ON "global_menu_template"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "global_menu_template_is_sample_sample_batch_id_idx" ON "global_menu_template"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_menu_template_code_key" ON "global_menu_template"("code");

-- CreateIndex
CREATE INDEX "global_role_template_is_active_deleted_at_idx" ON "global_role_template"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "global_role_template_is_sample_sample_batch_id_idx" ON "global_role_template"("is_sample", "sample_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_role_template_code_key" ON "global_role_template"("code");

-- AddForeignKey
ALTER TABLE "platform__audit"."audit_row_change" ADD CONSTRAINT "audit_row_change_audit_event_id_fkey" FOREIGN KEY ("audit_event_id") REFERENCES "platform__audit"."audit_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quote" ADD CONSTRAINT "pricing_quote_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quote" ADD CONSTRAINT "pricing_quote_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "subscription_plan_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quote_line" ADD CONSTRAINT "pricing_quote_line_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "pricing_quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_quote_line" ADD CONSTRAINT "pricing_quote_line_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_adjustment" ADD CONSTRAINT "pricing_adjustment_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "pricing_quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_device" ADD CONSTRAINT "pos_device_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_activation" ADD CONSTRAINT "device_activation_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_entitlement" ADD CONSTRAINT "device_entitlement_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "subscription_plan_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_item" ADD CONSTRAINT "subscription_item_add_on_version_id_fkey" FOREIGN KEY ("add_on_version_id") REFERENCES "subscription_add_on_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_change" ADD CONSTRAINT "subscription_change_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice" ADD CONSTRAINT "billing_invoice_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "pricing_quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_line" ADD CONSTRAINT "billing_invoice_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_line" ADD CONSTRAINT "billing_invoice_line_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment_allocation" ADD CONSTRAINT "billing_payment_allocation_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment_allocation" ADD CONSTRAINT "billing_payment_allocation_invoice_line_id_fkey" FOREIGN KEY ("invoice_line_id") REFERENCES "billing_invoice_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment_allocation" ADD CONSTRAINT "billing_payment_allocation_callback_event_id_fkey" FOREIGN KEY ("callback_event_id") REFERENCES "payment_callback_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment_allocation" ADD CONSTRAINT "billing_payment_allocation_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_credit_note" ADD CONSTRAINT "billing_credit_note_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_receipt" ADD CONSTRAINT "billing_receipt_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_domain" ADD CONSTRAINT "website_domain_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page" ADD CONSTRAINT "cms_page_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page" ADD CONSTRAINT "cms_page_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "cms_page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_version" ADD CONSTRAINT "cms_page_version_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "cms_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_translation" ADD CONSTRAINT "cms_page_translation_page_version_id_fkey" FOREIGN KEY ("page_version_id") REFERENCES "cms_page_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_translation" ADD CONSTRAINT "cms_page_translation_locale_code_fkey" FOREIGN KEY ("locale_code") REFERENCES "locale"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_block" ADD CONSTRAINT "cms_block_page_version_id_fkey" FOREIGN KEY ("page_version_id") REFERENCES "cms_page_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_block" ADD CONSTRAINT "cms_block_parent_block_id_fkey" FOREIGN KEY ("parent_block_id") REFERENCES "cms_block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_block_translation" ADD CONSTRAINT "cms_block_translation_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "cms_block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_block_translation" ADD CONSTRAINT "cms_block_translation_locale_code_fkey" FOREIGN KEY ("locale_code") REFERENCES "locale"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_navigation" ADD CONSTRAINT "cms_navigation_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_navigation_item" ADD CONSTRAINT "cms_navigation_item_navigation_id_fkey" FOREIGN KEY ("navigation_id") REFERENCES "cms_navigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_navigation_item" ADD CONSTRAINT "cms_navigation_item_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "cms_navigation_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_navigation_item" ADD CONSTRAINT "cms_navigation_item_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "cms_page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_footer_section" ADD CONSTRAINT "cms_footer_section_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_footer_item" ADD CONSTRAINT "cms_footer_item_footer_section_id_fkey" FOREIGN KEY ("footer_section_id") REFERENCES "cms_footer_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_category" ADD CONSTRAINT "news_category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "news_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article" ADD CONSTRAINT "news_article_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "news_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article" ADD CONSTRAINT "news_article_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "platform_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article" ADD CONSTRAINT "news_article_featured_image_id_fkey" FOREIGN KEY ("featured_image_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_version" ADD CONSTRAINT "news_article_version_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_translation" ADD CONSTRAINT "news_article_translation_article_version_id_fkey" FOREIGN KEY ("article_version_id") REFERENCES "news_article_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_translation" ADD CONSTRAINT "news_article_translation_locale_code_fkey" FOREIGN KEY ("locale_code") REFERENCES "locale"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_tag" ADD CONSTRAINT "news_article_tag_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_tag" ADD CONSTRAINT "news_article_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "news_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hero_slide" ADD CONSTRAINT "hero_slide_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hero_slide" ADD CONSTRAINT "hero_slide_background_asset_id_fkey" FOREIGN KEY ("background_asset_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_feature" ADD CONSTRAINT "marketing_feature_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "module_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_feature" ADD CONSTRAINT "marketing_feature_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_item" ADD CONSTRAINT "faq_item_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "faq_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_logo" ADD CONSTRAINT "partner_logo_logo_asset_id_fkey" FOREIGN KEY ("logo_asset_id") REFERENCES "media_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_display_section" ADD CONSTRAINT "pricing_display_section_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_folder" ADD CONSTRAINT "media_folder_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "media_folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "media_folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redirect_rule" ADD CONSTRAINT "redirect_rule_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_structured_data" ADD CONSTRAINT "seo_structured_data_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "cms_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_rule" ADD CONSTRAINT "discount_rule_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "discount_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_condition_group" ADD CONSTRAINT "discount_condition_group_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "discount_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_condition_group" ADD CONSTRAINT "discount_condition_group_parent_group_id_fkey" FOREIGN KEY ("parent_group_id") REFERENCES "discount_condition_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_condition" ADD CONSTRAINT "discount_condition_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "discount_condition_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_benefit" ADD CONSTRAINT "discount_benefit_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "discount_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_tenant_eligibility" ADD CONSTRAINT "discount_tenant_eligibility_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "discount_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_tenant_eligibility" ADD CONSTRAINT "discount_tenant_eligibility_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_plan_eligibility" ADD CONSTRAINT "discount_plan_eligibility_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "discount_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_plan_eligibility" ADD CONSTRAINT "discount_plan_eligibility_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "discount_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_redemption" ADD CONSTRAINT "discount_redemption_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "discount_program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_redemption" ADD CONSTRAINT "discount_redemption_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_redemption" ADD CONSTRAINT "discount_redemption_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_approval" ADD CONSTRAINT "discount_approval_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "discount_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_key" ADD CONSTRAINT "translation_key_namespace_id_fkey" FOREIGN KEY ("namespace_id") REFERENCES "translation_namespace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_value" ADD CONSTRAINT "translation_value_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "translation_key"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_value" ADD CONSTRAINT "translation_value_locale_code_fkey" FOREIGN KEY ("locale_code") REFERENCES "locale"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_translation_override" ADD CONSTRAINT "tenant_translation_override_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_translation_override" ADD CONSTRAINT "tenant_translation_override_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "translation_key"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_translation_override" ADD CONSTRAINT "tenant_translation_override_locale_code_fkey" FOREIGN KEY ("locale_code") REFERENCES "locale"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user" ADD CONSTRAINT "platform_user_preferred_locale_code_fkey" FOREIGN KEY ("preferred_locale_code") REFERENCES "locale"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_profile" ADD CONSTRAINT "platform_user_profile_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_permission" ADD CONSTRAINT "platform_role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_permission" ADD CONSTRAINT "platform_role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "platform_permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_role" ADD CONSTRAINT "platform_user_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_role" ADD CONSTRAINT "platform_user_role_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_session" ADD CONSTRAINT "platform_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_refresh_token" ADD CONSTRAINT "platform_refresh_token_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "platform_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_step_up_challenge" ADD CONSTRAINT "platform_step_up_challenge_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_admin_saved_view" ADD CONSTRAINT "platform_admin_saved_view_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_channel" ADD CONSTRAINT "payment_channel_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "payment_provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_channel_legacy_config" ADD CONSTRAINT "payment_channel_legacy_config_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "payment_provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_order" ADD CONSTRAINT "payment_order_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "payment_provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_order" ADD CONSTRAINT "payment_order_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_order" ADD CONSTRAINT "payment_order_selected_channel_id_fkey" FOREIGN KEY ("selected_channel_id") REFERENCES "payment_channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempt" ADD CONSTRAINT "payment_attempt_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "payment_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_callback_event" ADD CONSTRAINT "payment_callback_event_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "payment_provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_callback_event" ADD CONSTRAINT "payment_callback_event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "payment_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_inquiry_attempt" ADD CONSTRAINT "payment_inquiry_attempt_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "payment_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_check_batch_item" ADD CONSTRAINT "payment_check_batch_item_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "payment_check_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_check_batch_item" ADD CONSTRAINT "payment_check_batch_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "payment_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_status_transition" ADD CONSTRAINT "payment_status_transition_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "payment_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_to_host_log" ADD CONSTRAINT "host_to_host_log_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "payment_provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliation_run" ADD CONSTRAINT "payment_reconciliation_run_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "payment_provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliation_item" ADD CONSTRAINT "payment_reconciliation_item_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payment_reconciliation_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliation_item" ADD CONSTRAINT "payment_reconciliation_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "payment_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_dead_letter" ADD CONSTRAINT "payment_dead_letter_callback_event_id_fkey" FOREIGN KEY ("callback_event_id") REFERENCES "payment_callback_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rate_limit_state" ADD CONSTRAINT "provider_rate_limit_state_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "payment_provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_catalog" ADD CONSTRAINT "feature_catalog_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "module_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan" ADD CONSTRAINT "subscription_plan_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "subscription_product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_version" ADD CONSTRAINT "subscription_plan_version_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_module" ADD CONSTRAINT "subscription_plan_module_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "subscription_plan_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_module" ADD CONSTRAINT "subscription_plan_module_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "module_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_feature" ADD CONSTRAINT "subscription_plan_feature_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "subscription_plan_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_feature" ADD CONSTRAINT "subscription_plan_feature_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "feature_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_price" ADD CONSTRAINT "subscription_plan_price_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "subscription_plan_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_price_tier" ADD CONSTRAINT "subscription_plan_price_tier_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "subscription_plan_price"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_plan_constraint" ADD CONSTRAINT "subscription_plan_constraint_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "subscription_plan_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_add_on_version" ADD CONSTRAINT "subscription_add_on_version_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "subscription_add_on"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_add_on_module" ADD CONSTRAINT "subscription_add_on_module_add_on_version_id_fkey" FOREIGN KEY ("add_on_version_id") REFERENCES "subscription_add_on_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_add_on_module" ADD CONSTRAINT "subscription_add_on_module_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "module_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_add_on_price" ADD CONSTRAINT "subscription_add_on_price_add_on_version_id_fkey" FOREIGN KEY ("add_on_version_id") REFERENCES "subscription_add_on_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_plan_contract" ADD CONSTRAINT "tenant_plan_contract_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_plan_contract" ADD CONSTRAINT "tenant_plan_contract_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "subscription_plan_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_plan_module_override" ADD CONSTRAINT "tenant_plan_module_override_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "tenant_plan_contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_plan_module_override" ADD CONSTRAINT "tenant_plan_module_override_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "module_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_plan_feature_override" ADD CONSTRAINT "tenant_plan_feature_override_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "tenant_plan_contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_plan_feature_override" ADD CONSTRAINT "tenant_plan_feature_override_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "feature_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_price_override" ADD CONSTRAINT "tenant_price_override_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_price_override" ADD CONSTRAINT "tenant_price_override_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "subscription_plan_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_assignment" ADD CONSTRAINT "package_assignment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_assignment" ADD CONSTRAINT "package_assignment_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "subscription_plan_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_snapshot" ADD CONSTRAINT "entitlement_snapshot_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_credential_delivery" ADD CONSTRAINT "registration_credential_delivery_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schema_name_reservation" ADD CONSTRAINT "schema_name_reservation_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_schema_registry" ADD CONSTRAINT "tenant_schema_registry_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_membership" ADD CONSTRAINT "tenant_membership_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_membership" ADD CONSTRAINT "tenant_membership_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_job" ADD CONSTRAINT "provisioning_job_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_job" ADD CONSTRAINT "provisioning_job_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_step" ADD CONSTRAINT "provisioning_step_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "provisioning_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_schema_migration_history" ADD CONSTRAINT "tenant_schema_migration_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_schema_migration_history" ADD CONSTRAINT "tenant_schema_migration_history_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "schema_migration_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_support_session" ADD CONSTRAINT "platform_support_session_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_support_session" ADD CONSTRAINT "platform_support_session_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "platform_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_tenant_action" ADD CONSTRAINT "platform_tenant_action_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_menu_template" ADD CONSTRAINT "global_menu_template_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "global_menu_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
