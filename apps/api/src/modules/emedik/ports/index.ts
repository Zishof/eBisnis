/**
 * Port menuju kemampuan bersama.
 *
 * Perintah eMedik §8 menutup daftar dependensinya dengan satu kalimat: *"Jangan
 * menyalin engine shared ke modul health."* Berkas ini adalah cara menaatinya.
 *
 * Modul kesehatan mengimpor **antarmuka** dari sini, tidak pernah layanan Core
 * secara langsung. Adapternya yang mengenal bentuk Core, dan adapter itu satu
 * berkas per port — sehingga ketika Core berubah, yang harus disesuaikan satu
 * tempat, bukan tersebar di seluruh modul kesehatan.
 *
 * Alasan kedua yang sama pentingnya: pengujian kesehatan tidak boleh menuntut
 * mesin akuntansi yang hidup. Setiap port punya tiruan.
 */

// --- Identitas ---------------------------------------------------------------

export interface IdentityPort {
  /** Identitas tenant dari identitas control plane. */
  subjectId(schema: string, platformUserId: string): Promise<string>;

  /** Hak akses yang BELUM dimiliki, dari daftar yang diminta. */
  missingPermissions(
    schema: string,
    userId: string,
    required: string[],
    opts: { activeRoleId: string | null; isDemo: boolean },
  ): Promise<string[]>;

  /** Cakupan data pengguna, apa adanya. Penerjemahannya urusan kesehatan. */
  scopes(schema: string, userId: string): Promise<Array<{ level: string; value: string }>>;
}

// --- Audit -------------------------------------------------------------------

/**
 * Tujuan penggunaan.
 *
 * WAJIB pada setiap pembacaan rekam medis, dan inilah yang membuat jejaknya
 * berguna: "siapa membaca apa" tanpa "untuk apa" tidak dapat dinilai wajar
 * atau tidak.
 */
export type PurposeOfUse =
  | 'TREATMENT'
  | 'PAYMENT'
  | 'OPERATIONS'
  | 'QUALITY'
  | 'RESEARCH'
  | 'PATIENT_REQUEST'
  | 'LEGAL'
  | 'EMERGENCY';

export interface AuditPort {
  /** Jejak PERUBAHAN — memakai mesin audit Core apa adanya. */
  record(event: {
    moduleCode: string;
    actionCode: string;
    entityType?: string;
    entityId?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  /**
   * Jejak PEMBACAAN rekam medis.
   *
   * Tidak ada padanannya di Core, dan tidak boleh ada: perdagangan tidak
   * mencatat siapa membaca data pelanggan mana. Kesehatan wajib, karena
   * ancaman tersering bukan peretasan dari luar melainkan tenaga kesehatan
   * yang membuka rekam medis orang yang tidak dirawatnya.
   */
  recordAccess(
    schema: string,
    event: {
      patientId: string;
      facilityId?: string | null;
      actorUserId?: string | null;
      activeRoleId?: string | null;
      providerId?: string | null;
      purposeOfUse: PurposeOfUse;
      entityType: string;
      entityId?: string | null;
      action?: 'READ' | 'SEARCH' | 'EXPORT' | 'PRINT';
      breakGlass?: boolean;
      breakGlassReason?: string | null;
      ipAddress?: string | null;
      requestId?: string | null;
    },
  ): Promise<void>;
}

// --- Persediaan --------------------------------------------------------------

export interface StokTersedia {
  onHand: number;
  reserved: number;
  available: number;
}

/**
 * Persediaan.
 *
 * Aturan farmasi TIDAK ada di sini. Port ini hanya memindahkan angka; yang
 * memeriksa kedaluwarsa, golongan terkendali, dan penarikan sediaan adalah
 * layanan farmasi, sebelum ia memanggil `issue`.
 *
 * Sebabnya: obat punya aturan yang barang dagangan tidak punya. Menaruh aturan
 * itu di mesin persediaan bersama akan membuatnya berlaku pada kaus dan kopi;
 * tidak menaruhnya di mana pun berarti obat kedaluwarsa dapat diserahkan.
 */
export interface InventoryPort {
  availability(
    schema: string,
    req: { warehouseId: string; itemId: string; lotId?: string | null },
  ): Promise<StokTersedia | null>;

  reserve(
    schema: string,
    req: {
      warehouseId: string;
      itemId: string;
      quantity: number;
      sourceType: string;
      sourceId: string;
      lotId?: string | null;
    },
    userId: string,
  ): Promise<{ reservationId: string }>;

  release(schema: string, sourceId: string, reason: string): Promise<number>;

  issue(
    schema: string,
    req: {
      warehouseId: string;
      itemId: string;
      quantity: number;
      lotId?: string | null;
      unitCost: number;
      referenceType: string;
      referenceId: string;
      idempotencyKey: string;
    },
    userId: string,
  ): Promise<{ movementId: string; totalCost: number }>;
}

// --- Akuntansi ---------------------------------------------------------------

/**
 * Peristiwa akuntansi.
 *
 * Kesehatan TIDAK PERNAH menulis jurnal. Ia menerbitkan peristiwa, dan
 * `accounting_posting_rule` memetakannya ke akun. Menulis jurnal langsung
 * berarti ada dua tempat yang menentukan debit dan kredit — dan keduanya akan
 * berbeda.
 */
export interface AccountingEventPort {
  publish(
    schema: string,
    event: {
      eventCode: string;
      sourceType: string;
      sourceId: string;
      sourceNumber?: string | null;
      amounts: Record<string, number>;
      currencyCode: string;
      idempotencyKey: string;
    },
    userId: string,
  ): Promise<void>;
}

// --- Pembayaran --------------------------------------------------------------

export interface PaymentPort {
  capabilities(schema: string): Promise<{ online: boolean; methods: string[] }>;

  /**
   * Membuat maksud pembayaran.
   *
   * Aturan yang diwarisi V9 dan tetap berlaku: **`paymentUrl` bukan bukti
   * pembayaran.** Tagihan pasien hanya lunas setelah callback terverifikasi.
   */
  createPaymentIntent(
    schema: string,
    req: {
      amount: number;
      currencyCode: string;
      referenceType: string;
      referenceId: string;
      idempotencyKey: string;
    },
  ): Promise<{ paymentUrl?: string; providerRef: string; status: string }>;
}

// --- Notifikasi --------------------------------------------------------------

export interface NotificationPort {
  notify(
    schema: string,
    msg: {
      templateCode: string;
      targetUserId?: string | null;
      targetRoleCode?: string | null;
      payload: Record<string, unknown>;
      slaMinutes?: number;
      groupKey?: string;
    },
  ): Promise<{ notificationId: string | null }>;
}

// --- Berkas ------------------------------------------------------------------

export interface FileStoragePort {
  register(
    schema: string,
    file: { fileName: string; mimeType: string; sizeBytes: number; storageKey: string },
    userId: string,
  ): Promise<{ fileId: string }>;

  attach(
    schema: string,
    link: { fileId: string; entityType: string; entityId: string },
  ): Promise<void>;

  /** Tautan BERBATAS WAKTU. Tidak pernah tautan tetap yang dapat ditebak. */
  signedUrl(schema: string, fileId: string, ttlSeconds: number): Promise<string>;
}

// --- AI ----------------------------------------------------------------------

/**
 * Gerbang AI.
 *
 * Batas kewenangan AI di kesehatan lebih ketat daripada di perdagangan. Selain
 * larangan yang sudah berlaku (tidak memposting, tidak menyetujui, tidak
 * membayar, tidak menghapus), ditambahkan:
 *
 *     AI tidak mendiagnosis.
 *     AI tidak meresepkan.
 *     AI tidak menentukan dosis.
 *     AI tidak menetapkan triase.
 *     AI tidak memverifikasi hasil.
 *
 * Ditegakkan pada registri keperluan AI kesehatan, bukan pada niat baik.
 */
export interface AiGatewayPort {
  run(
    schema: string,
    req: { useCaseCode: string; context: Record<string, unknown>; userId: string },
  ): Promise<{ output: unknown; evidence: unknown[]; redacted: string[] }>;
}

// --- Token injeksi -----------------------------------------------------------

export const IDENTITY_PORT = Symbol('IdentityPort');
export const AUDIT_PORT = Symbol('AuditPort');
export const INVENTORY_PORT = Symbol('InventoryPort');
export const ACCOUNTING_EVENT_PORT = Symbol('AccountingEventPort');
export const PAYMENT_PORT = Symbol('PaymentPort');
export const NOTIFICATION_PORT = Symbol('NotificationPort');
export const FILE_STORAGE_PORT = Symbol('FileStoragePort');
export const AI_GATEWAY_PORT = Symbol('AiGatewayPort');
