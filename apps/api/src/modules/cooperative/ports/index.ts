/**
 * Port yang dibutuhkan modul koperasi dari Core.
 *
 * **Koperasi yang mendefinisikan, bukan Core.** Itulah yang membuatnya port dan
 * bukan sekadar antarmuka: bentuknya ditentukan oleh yang memakai, sehingga
 * koperasi tidak perlu menunggu Core merancangkan sesuatu yang belum
 * dibutuhkan siapa pun.
 *
 * Audit K-0 mencatat bahwa sembilan port yang disebut perintah eKoperasi §7
 * belum ada satu pun di `common/` maupun `infrastructure/`. Bila kelak eMedik
 * dan info-desa memerlukan yang sama, sesi Core dapat mengangkatnya menjadi
 * milik bersama — dan mengangkat antarmuka yang sudah terbukti dipakai dua
 * vertikal jauh lebih aman daripada merancangnya di muka.
 *
 * Adapter yang memenuhi port ini ada di `../adapters/`. Hanya adapter yang
 * boleh menyentuh layanan Core; layanan koperasi selalu lewat port.
 */

// ------------------------------------------------------------------ Identitas

export interface PartyRef {
  partyId: string;
  name: string;
  identityNumber: string | null;
}

export interface IdentityPort {
  /** Menemukan atau membuat `party` bagi seseorang. */
  ensureParty(
    schemaName: string,
    input: { name: string; identityNumber?: string | null; phone?: string | null; email?: string | null },
  ): Promise<PartyRef>;

  /** Identitas tenant dari identitas control plane. */
  subjectId(schemaName: string, platformUserId: string): Promise<string>;
}

// ------------------------------------------------------------------ Akuntansi

export interface AccountingEventInput {
  eventCode: string;
  sourceType: string;
  sourceId: string;
  sourceNumber?: string | null;
  amounts: Record<string, number>;
  currencyCode: string;
  occurredAt?: Date;
  idempotencyKey: string;
}

export interface AccountingEventPort {
  /**
   * Menerbitkan peristiwa akuntansi.
   *
   * Mengembalikan `posted: false` bila kode peristiwanya belum dikenal mesin
   * Core — keadaan yang berlaku sampai IR-003 disetujui. Peristiwanya tetap
   * tercatat; yang belum terbentuk adalah jurnalnya. Pemanggil **wajib**
   * memperlakukan itu sebagai keadaan yang perlu dilaporkan, bukan sebagai
   * keberhasilan diam-diam.
   */
  publish(
    schemaName: string,
    event: AccountingEventInput,
  ): Promise<{ eventId: string; posted: boolean; reason?: string }>;

  /** Akun yang dipetakan untuk sebuah kode pemetaan pada tanggal tertentu. */
  resolveAccount(
    schemaName: string,
    cooperativeId: string,
    mappingCode: string,
    onDate: string,
  ): Promise<string | null>;
}

// ------------------------------------------------------------------ Penomoran

export interface NumberingPort {
  /**
   * Nomor dokumen berikutnya, dijamin tidak kembar bahkan di bawah permintaan
   * bersamaan. Memakai pola yang sudah terbukti pada tata kelola surat.
   */
  next(
    schemaName: string,
    documentType: string,
    scope?: { scopeType?: string; scopeId?: string },
  ): Promise<string>;
}

// --------------------------------------------------------------- Pemberitahuan

export interface NotificationPort {
  send(
    schemaName: string,
    input: {
      templateCode: string;
      recipientSubjectIds?: string[];
      recipientRoleCodes?: string[];
      payload: Record<string, unknown>;
      groupKey?: string | null;
    },
  ): Promise<{ notificationId: string; delivered: number }>;
}

// ---------------------------------------------------------------------- Berkas

export interface FileStoragePort {
  attach(
    schemaName: string,
    input: { entityType: string; entityId: string; fileId: string; note?: string },
  ): Promise<void>;

  exists(schemaName: string, fileId: string): Promise<boolean>;
}

// -------------------------------------------------------------------- Langganan

export interface SubscriptionPort {
  /** Paket berjalan bagi tenant ini, untuk memeriksa batas pemakaian. */
  currentPlan(tenantId: string): Promise<{ planCode: string; status: string } | null>;
}

// -------------------------------------------------------------------------- POS

export interface OutletRef {
  outletId: string;
  code: string;
  name: string;
}

export interface SaleSummary {
  saleId: string;
  outletId: string;
  customerId: string | null;
  businessDate: string;
  grandTotal: string;
  status: string;
}

/**
 * Koperasi **membaca** dari POS; ia tidak menjual lewat POS.
 *
 * Perhatikan apa yang tidak ada di sini: tidak ada `createSale`, `addPayment`,
 * maupun `completeSale`. Kasir unit toko memakai layar kasir Core, dan koperasi
 * hanya membaca hasilnya untuk menghitung patronage.
 */
export interface PosPort {
  outletsOfUnit(schemaName: string, unitBusinessId: string): Promise<OutletRef[]>;

  completedSales(
    schemaName: string,
    filter: { outletIds: string[]; from: string; to: string; customerIds?: string[] },
  ): Promise<SaleSummary[]>;
}

// -------------------------------------------------------------------- Peristiwa

export interface EventPort {
  /** Menerbitkan peristiwa domain `cooperative.*` lewat outbox. */
  emit(
    schemaName: string,
    input: { eventType: string; entityType: string; entityId: string; payload: Record<string, unknown> },
  ): Promise<void>;
}

// ------------------------------------------------------------------------ Token

export const COOPERATIVE_PORTS = {
  Identity: Symbol('CooperativeIdentityPort'),
  AccountingEvent: Symbol('CooperativeAccountingEventPort'),
  Numbering: Symbol('CooperativeNumberingPort'),
  Notification: Symbol('CooperativeNotificationPort'),
  FileStorage: Symbol('CooperativeFileStoragePort'),
  Subscription: Symbol('CooperativeSubscriptionPort'),
  Pos: Symbol('CooperativePosPort'),
  Event: Symbol('CooperativeEventPort'),
} as const;
