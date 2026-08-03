# H-0 · Kontrak Integrasi

Delapan port yang diminta perintah §8, ditambah kontrak lintas-vertical dan
adapter luar. Dokumen ini menetapkan **bentuk** kontraknya; implementasinya H-1.

---

## Aturan umum

1. Modul kesehatan **tidak pernah** mengimpor kelas layanan Core secara
   langsung. Ia mengimpor antarmuka port.
2. Port berada di `modules/emedik/ports/`; adapternya di
   `modules/emedik/adapters/`.
3. Adapter boleh mengimpor layanan Core. Itulah gunanya — satu tempat yang tahu
   bentuk Core, sehingga perubahan pada Core menyentuh satu berkas.
4. Setiap port punya adapter tiruan untuk pengujian. Pengujian kesehatan tidak
   boleh menuntut mesin akuntansi yang hidup.

---

## Delapan port

### `IdentityPort`

```ts
interface IdentityPort {
  /** Identitas tenant dari identitas control plane. */
  subjectId(schema: string, platformUserId: string): Promise<string>;
  /** Hak akses yang belum dimiliki, dari daftar yang diminta. */
  missingPermissions(schema: string, userId: string, required: string[],
                     opts: { activeRoleId: string | null; isDemo: boolean }): Promise<string[]>;
  /** Cakupan data pengguna — fasilitas dan unit yang boleh diaksesnya. */
  scopes(schema: string, userId: string): Promise<Array<{ level: string; value: string }>>;
}
```

Catatan: `scopes` mengembalikan cakupan mentah. Penerjemahan ke "fasilitas mana"
adalah urusan kesehatan, bukan Core.

### `AuditPort`

```ts
interface AuditPort {
  record(event: {
    moduleCode: string; actionCode: string;
    entityType?: string; entityId?: string;
    reason?: string; metadata?: Record<string, unknown>;
  }): Promise<void>;

  /**
   * Pencatatan PEMBACAAN rekam medis. Tidak ada padanannya di Core, karena
   * perdagangan tidak mencatat siapa membaca apa. Kesehatan wajib.
   */
  recordAccess(event: {
    patientId: string; purposeOfUse: PurposeOfUse;
    entityType: string; entityId: string;
    breakGlass?: boolean; breakGlassReason?: string;
  }): Promise<void>;
}

type PurposeOfUse =
  | 'TREATMENT' | 'PAYMENT' | 'OPERATIONS'
  | 'QUALITY' | 'RESEARCH' | 'PATIENT_REQUEST' | 'LEGAL';
```

`recordAccess` kemungkinan besar memerlukan tabel baru di sisi kesehatan
(`health_access_log`), bukan perluasan `audit_event` milik Core — karena
volumenya jauh lebih besar dan retensinya berbeda.

### `InventoryPort`

```ts
interface InventoryPort {
  availability(schema: string, req: {
    warehouseId: string; itemId: string; lotId?: string | null;
  }): Promise<{ onHand: number; reserved: number; available: number } | null>;

  reserve(schema: string, req: {
    warehouseId: string; itemId: string; quantity: number;
    sourceType: string; sourceId: string; lotId?: string | null;
  }, userId: string): Promise<{ reservationId: string }>;

  release(schema: string, sourceId: string, reason: string): Promise<number>;

  issue(schema: string, req: {
    warehouseId: string; itemId: string; quantity: number;
    lotId?: string | null; unitCost: number;
    referenceType: string; referenceId: string; idempotencyKey: string;
  }, userId: string): Promise<{ movementId: string; totalCost: number }>;
}
```

**Aturan farmasi tetap di sisi kesehatan.** Port ini hanya memindahkan angka.
Yang memeriksa kedaluwarsa, golongan terkendali, dan penarikan sediaan adalah
`PharmacyService`, sebelum ia memanggil `issue`.

### `AccountingEventPort`

```ts
interface AccountingEventPort {
  publish(schema: string, event: {
    eventCode: string;              // HEALTH_*
    sourceType: string; sourceId: string; sourceNumber?: string;
    amounts: Record<string, number>;
    currencyCode: string;
    idempotencyKey: string;
  }, userId: string): Promise<void>;
}
```

Kode peristiwa kesehatan (`HEALTH_SERVICE_REVENUE`, `HEALTH_PATIENT_PAYMENT`,
`HEALTH_CLAIM_RECEIVABLE`, `HEALTH_PHARMACY_COGS`, …) harus didaftarkan pada
mesin posting Core beserta `REQUIRED_AMOUNTS`-nya. Itu menyentuh berkas Core →
**integration request tersendiri pada H-4**, bukan sekarang.

Sesi Core sudah menetapkan polanya: uji kelengkapan memaksa setiap kode punya
aturan posting, sehingga kode tanpa aturan gagal saat diuji, bukan diam-diam
menghasilkan jurnal kosong.

### `NotificationPort`

```ts
interface NotificationPort {
  notify(schema: string, msg: {
    templateCode: string;
    targetUserId?: string; targetRoleCode?: string;
    payload: Record<string, unknown>;
    slaMinutes?: number;
    groupKey?: string;
  }): Promise<{ notificationId: string }>;
}
```

Dipakai untuk pengingat janji temu, hasil kritis, permintaan persetujuan, dan
peringatan break-glass.

### `PaymentPort`

```ts
interface PaymentPort {
  capabilities(schema: string): Promise<{ online: boolean; methods: string[] }>;
  createPaymentIntent(schema: string, req: {
    amount: number; currencyCode: string;
    referenceType: string; referenceId: string; idempotencyKey: string;
  }): Promise<{ paymentUrl?: string; providerRef: string; status: string }>;
}
```

Aturan yang diwarisi dari V9 dan tetap berlaku: **`paymentUrl` bukan bukti
pembayaran.** Tagihan pasien hanya lunas setelah callback terverifikasi.

### `FileStoragePort`

```ts
interface FileStoragePort {
  register(schema: string, file: {
    fileName: string; mimeType: string; sizeBytes: number; storageKey: string;
  }): Promise<{ fileId: string }>;
  attach(schema: string, link: {
    fileId: string; entityType: string; entityId: string;
  }): Promise<void>;
  /** Tautan berbatas waktu. TIDAK PERNAH tautan tetap yang dapat ditebak. */
  signedUrl(schema: string, fileId: string, ttlSeconds: number): Promise<string>;
}
```

### `AiGatewayPort`

```ts
interface AiGatewayPort {
  run(schema: string, req: {
    useCaseCode: string;
    context: Record<string, unknown>;
    userId: string;
  }): Promise<{ output: unknown; evidence: unknown[]; redacted: string[] }>;
}
```

**Batas kewenangan AI di kesehatan lebih ketat daripada di perdagangan.** Selain
larangan yang sudah ada (tidak memposting, tidak menyetujui, tidak membayar),
ditambahkan:

```
AI tidak mendiagnosis.
AI tidak meresepkan.
AI tidak menentukan dosis.
AI tidak menetapkan triase.
AI tidak memverifikasi hasil.
```

Keluarannya ringkasan, konsep dokumen, dan penandaan anomali — seluruhnya wajib
ditelaah manusia berwenang. Ditegakkan pada registri keperluan AI kesehatan,
bukan pada niat baik.

---

## Kontrak lintas-vertical

Panduan §6 melarang saling membaca tabel internal. Yang diperlukan kesehatan:

| Kebutuhan | Cara yang benar |
|---|---|
| Data kependudukan untuk mengisi pasien | Tautan eksplisit `patient_external_link` dengan persetujuan, tujuan, dan audit. **Bukan** membaca `village.penduduk` |
| Laporan kesehatan untuk desa | Kesehatan menerbitkan **agregat** lewat peristiwa `health.*`. Bukan akses baris |
| Tagihan anggota untuk koperasi | Peristiwa terbatas; tidak ada diagnosis di dalamnya |

Peristiwa yang diterbitkan kesehatan (nama sementara, ditetapkan H-10):

```
health.patient.registered      — tanpa diagnosis
health.encounter.completed     — tanpa isi klinis
health.bill.issued
health.bill.paid
health.immunization.recorded   — untuk program desa; agregat
```

Tidak ada peristiwa yang membawa diagnosis, hasil laboratorium, atau catatan
klinis keluar dari konteks kesehatan.

---

## Adapter luar

Perintah §25 menyebut sembilan. Statusnya hari ini:

| Adapter | Status | Catatan |
|---|---|---|
| SATUSEHAT / FHIR | **BELUM ADA KREDENSIAL** | Kontrak dan kredensial belum tersedia. Tidak boleh dikarang — dibangun sebagai antarmuka dengan implementasi tiruan sampai kredensial resmi ada |
| BPJS | **BELUM ADA KREDENSIAL** | Sama |
| Alat laboratorium | **BELUM ADA** | Protokol bergantung merek alat |
| PACS / DICOM | **BELUM ADA** | Perlu arsitektur penyimpanan lebih dahulu |
| Pembayaran | **ADA** | eSmartlink lewat `PaymentPort` |
| Surel / WhatsApp / push | **SEBAGIAN** | Hub notifikasi ada; kredensial kanal belum |
| Identitas, akuntansi, persediaan | **ADA** | Lewat port di atas |
| HR / payroll | **SEBAGIAN** | `employee` ada; penggajian belum |

Empat yang `BELUM ADA KREDENSIAL` dicatat sebagai terhalang **sejak sekarang**,
bukan ditemukan pada H-10. Perintah §25 menegaskan: *"Jangan mengarang endpoint
atau credential provider."*

---

## Risiko yang perlu diketahui sejak awal

**Basis data pengembangan dipakai bersama.** Worktree Core, eMedik, eKoperasi,
dan info-desa menunjuk basis data yang sama, dan migrasi diterapkan ke skema
tenant yang sama.

Akibatnya:
- Migrasi eMedik akan terlihat oleh worktree Core.
- Migrasi Core (V024–V029, POS Web) sudah diterapkan ke skema yang sama.
- Menjalankan `migrate:tenants` dari worktree mana pun menerapkan migrasi
  **seluruh** vertical yang ada di manifest worktree itu.

Ini bukan cacat, tetapi harus disadari: **jangan menganggap basis data
pengembangan mencerminkan branch yang sedang dikerjakan.** Verifikasi migrasi
yang sesungguhnya dilakukan Core/Integrator pada basis data bersih.
