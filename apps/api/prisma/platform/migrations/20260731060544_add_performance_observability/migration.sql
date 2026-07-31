-- CreateTable
CREATE TABLE "platform_observability"."performance_snapshot" (
    "id" UUID NOT NULL,
    "service_name" VARCHAR(48) NOT NULL,
    "service_instance_id" VARCHAR(96),
    "host_name" VARCHAR(128),
    "release_version" VARCHAR(64),
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rss" BIGINT NOT NULL DEFAULT 0,
    "heap_total" BIGINT NOT NULL DEFAULT 0,
    "heap_used" BIGINT NOT NULL DEFAULT 0,
    "external" BIGINT NOT NULL DEFAULT 0,
    "array_buffers" BIGINT NOT NULL DEFAULT 0,
    "gc_count" INTEGER NOT NULL DEFAULT 0,
    "gc_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "event_loop_delay_p50" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "event_loop_delay_p99" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "event_loop_utilization" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active_handles" INTEGER NOT NULL DEFAULT 0,
    "active_requests" INTEGER NOT NULL DEFAULT 0,
    "cpu_user_micros" BIGINT NOT NULL DEFAULT 0,
    "cpu_system_micros" BIGINT NOT NULL DEFAULT 0,
    "uptime_seconds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_observability"."performance_route_aggregate" (
    "id" UUID NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "window_minutes" INTEGER NOT NULL DEFAULT 5,
    "route_template" VARCHAR(255) NOT NULL,
    "http_method" VARCHAR(10) NOT NULL,
    "module_code" VARCHAR(48),
    "service_name" VARCHAR(48) NOT NULL,
    "release_version" VARCHAR(64),
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "duration_p50" INTEGER NOT NULL DEFAULT 0,
    "duration_p90" INTEGER NOT NULL DEFAULT 0,
    "duration_p95" INTEGER NOT NULL DEFAULT 0,
    "duration_p99" INTEGER NOT NULL DEFAULT 0,
    "duration_max" INTEGER NOT NULL DEFAULT 0,
    "total_duration_ms" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_route_aggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_observability"."performance_anomaly" (
    "id" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "anomaly_type" VARCHAR(32) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "module_code" VARCHAR(48),
    "service_name" VARCHAR(48) NOT NULL,
    "severity" VARCHAR(16) NOT NULL DEFAULT 'WARNING',
    "baseline_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observed_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" VARCHAR(16) NOT NULL DEFAULT 'ms',
    "verdict" VARCHAR(24) NOT NULL DEFAULT 'INSUFFICIENT_EVIDENCE',
    "evidence" JSONB,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "performance_anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_observability"."performance_baseline" (
    "id" UUID NOT NULL,
    "subject_type" VARCHAR(24) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "service_name" VARCHAR(48) NOT NULL,
    "metric" VARCHAR(48) NOT NULL,
    "p50" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p95" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p99" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "computed_from" TIMESTAMPTZ(6) NOT NULL,
    "computed_to" TIMESTAMPTZ(6) NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_baseline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performance_snapshot_service_name_captured_at_idx" ON "platform_observability"."performance_snapshot"("service_name", "captured_at");

-- CreateIndex
CREATE INDEX "performance_snapshot_captured_at_idx" ON "platform_observability"."performance_snapshot"("captured_at");

-- CreateIndex
CREATE INDEX "performance_route_aggregate_window_start_idx" ON "platform_observability"."performance_route_aggregate"("window_start");

-- CreateIndex
CREATE INDEX "performance_route_aggregate_route_template_window_start_idx" ON "platform_observability"."performance_route_aggregate"("route_template", "window_start");

-- CreateIndex
CREATE UNIQUE INDEX "performance_route_aggregate_window_start_route_template_htt_key" ON "platform_observability"."performance_route_aggregate"("window_start", "route_template", "http_method", "service_name");

-- CreateIndex
CREATE INDEX "performance_anomaly_status_last_seen_at_idx" ON "platform_observability"."performance_anomaly"("status", "last_seen_at");

-- CreateIndex
CREATE INDEX "performance_anomaly_anomaly_type_last_seen_at_idx" ON "platform_observability"."performance_anomaly"("anomaly_type", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "performance_anomaly_fingerprint_key" ON "platform_observability"."performance_anomaly"("fingerprint");

-- CreateIndex
CREATE INDEX "performance_baseline_computed_at_idx" ON "platform_observability"."performance_baseline"("computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "performance_baseline_subject_type_subject_service_name_metr_key" ON "platform_observability"."performance_baseline"("subject_type", "subject", "service_name", "metric");
