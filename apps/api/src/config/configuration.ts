function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export const appConfig = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: int(process.env.PORT, 3000),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  appName: process.env.APP_NAME ?? 'eBisnis.id',
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  webUrl: process.env.WEB_URL ?? 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL ?? 'debug',
  corsOrigins: list(process.env.CORS_ORIGINS),

  database: {
    url: process.env.DATABASE_URL ?? '',
    adminUrl: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL ?? '',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },

  schema: {
    platform: process.env.PLATFORM_SCHEMA ?? 'platform',
    platformAudit: process.env.PLATFORM_AUDIT_SCHEMA ?? 'platform__audit',
    demo: process.env.DEMO_SCHEMA ?? 'demo',
    demoAudit: process.env.DEMO_AUDIT_SCHEMA ?? 'demo__audit',
    auditSuffix: process.env.TENANT_SCHEMA_SUFFIX_AUDIT ?? '__audit',
    baseMaxLength: int(process.env.TENANT_SCHEMA_BASE_MAX_LENGTH, 48),
  },

  tenantClient: {
    cacheMax: int(process.env.TENANT_CLIENT_CACHE_MAX, 50),
    idleTtlSeconds: int(process.env.TENANT_CLIENT_IDLE_TTL_SECONDS, 900),
  },

  demo: {
    resetCron: process.env.DEMO_RESET_CRON ?? '0 */6 * * *',
    resetEnabled: bool(process.env.DEMO_RESET_ENABLED, false),
    sessionTtlMinutes: int(process.env.DEMO_SESSION_TTL_MINUTES, 120),
    // Pembuatan sesi demo per menit per alamat IP.
    sessionRateLimit: int(process.env.DEMO_SESSION_RATE_LIMIT, 20),
  },

  /**
   * Batas rate global per menit per alamat IP. Naikkan hanya pada environment
   * pengembangan dan pengujian otomatis; nilai bawaan untuk trafik produksi.
   */
  throttle: {
    defaultLimit: int(process.env.THROTTLE_DEFAULT_LIMIT, 300),
    authLimit: int(process.env.THROTTLE_AUTH_LIMIT, 10),
  },

  bootstrap: {
    superAdminUsername: process.env.BOOTSTRAP_SUPER_ADMIN_USERNAME ?? 'admin',
    superAdminPassword: process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD ?? '',
    forcePasswordChange: bool(process.env.BOOTSTRAP_SUPER_ADMIN_FORCE_PASSWORD_CHANGE, true),
  },

  i18n: {
    defaultLocale: process.env.DEFAULT_LOCALE ?? 'id',
    supportedLocales: list(process.env.SUPPORTED_LOCALES).length
      ? list(process.env.SUPPORTED_LOCALES)
      : ['id', 'en', 'ar', 'zh-CN'],
  },

  pricing: {
    defaultPosMonthlyPriceIdr: int(process.env.DEFAULT_POS_MONTHLY_PRICE_IDR, 250000),
    defaultPosTrialDays: int(process.env.DEFAULT_POS_TRIAL_DAYS, 30),
  },

  esmartlink: {
    enabled: bool(process.env.ESMARTLINK_ENABLED, false),
    baseUrl: process.env.ESMARTLINK_BASE_URL ?? '',
    merchantId: process.env.ESMARTLINK_MERCHANT_ID ?? '',
    clientId: process.env.ESMARTLINK_CLIENT_ID ?? '',
    clientSecret: process.env.ESMARTLINK_CLIENT_SECRET ?? '',
    callbackUrl:
      process.env.ESMARTLINK_CALLBACK_URL ??
      'http://localhost:3000/api/v1/payments/esmartlink/callback',
    allowedIps: list(process.env.ESMARTLINK_ALLOWED_IPS),
    trustProxy: bool(process.env.ESMARTLINK_TRUST_PROXY, false),
    ackSuccess: process.env.ESMARTLINK_CALLBACK_ACK_SUCCESS ?? 'OK',
    ackError: process.env.ESMARTLINK_CALLBACK_ACK_ERROR ?? 'ERROR',
    rawPayloadRetentionDays: int(process.env.ESMARTLINK_RAW_PAYLOAD_RETENTION_DAYS, 90),
    checkBatchMax: int(process.env.ESMARTLINK_CHECK_BATCH_MAX, 300),
    checkConcurrency: int(process.env.ESMARTLINK_CHECK_CONCURRENCY, 4),
  },
});

export type AppConfig = ReturnType<typeof appConfig>;
