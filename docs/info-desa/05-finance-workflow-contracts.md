# D-0 · Kontrak Keuangan dan Workflow

Dua port yang paling menentukan bentuk D-4 dan D-6.

---

## Bagian I — `WorkflowPort`

### Keadaannya

Tidak ada mesin workflow. Empat tabel `workflow_*` ada sejak V007 tanpa satu
baris kode pun yang menjalankannya. Rincian temuannya pada
[00](00-current-state.md) dan
[integration request 001](../integration-requests/village/001-workflow-port.md).

### Yang dikerjakan village

Village mendefinisikan antarmukanya sendiri dan mengimplementasikannya sendiri
di dalam `modules/village/`:

```
modules/village/ports/workflow.port.ts        <- antarmuka (milik village)
modules/village/workflow/village-workflow.service.ts   <- implementasi
modules/village/workflow/village-workflow-state.ts     <- mesin transisi murni
```

Bukan karena village ingin punya mesin sendiri, melainkan karena tidak ada yang
dapat dipanggil. Antarmukanya sengaja dibuat sesempit yang diperlukan D-4, agar
penggantiannya kelak murah.

### Alur persetujuan layanan warga

Bentuknya berbeda dari persetujuan internal, dan perbedaannya menentukan
rancangannya:

```
Warga mengajukan  ──▶  Verifikasi berkas  ──▶  Persetujuan  ──▶  Penerbitan
   (dari luar)          (operator)            (kasi/sekdes)      (nomor + TTD)
       │                     │                      │
       │                     ▼                      ▼
       │              Berkas kurang          Ditolak beralasan
       │                     │                      │
       └◀────────────────────┴──────────────────────┘
              dikembalikan ke warga, bukan menggantung
```

Empat hal yang harus benar:

1. **Permohonan yang ditolak kembali kepada warga beserta alasannya.**
   Permohonan yang berhenti tanpa kabar adalah keluhan nomor satu pelayanan
   publik. Status akhir "ditolak" wajib punya alasan yang terbaca warga.

2. **Aturan yang berlaku adalah aturan saat permohonan masuk.** Bila katalog
   layanan diubah — persyaratan ditambah, jenjang persetujuan diubah —
   permohonan yang sudah berjalan tetap memakai aturan lamanya. Karena itu
   `citizen_service_request` menyimpan **cuplikan** definisi alurnya, bukan
   hanya rujukan.

3. **Pemohon tidak dapat memproses permohonannya sendiri.** Berlaku ketika
   perangkat desa mengajukan surat untuk dirinya — yang di desa kecil sering
   terjadi.

4. **SLA dihitung dari saat berkas lengkap**, bukan dari saat permohonan masuk.
   Menghitung dari permohonan masuk membuat SLA terlihat buruk karena warga
   yang lambat melengkapi berkas, dan angka yang menyalahkan orang yang salah
   tidak dipakai siapa pun.

### Antarmuka

```ts
export interface WorkflowPort {
  start(input: StartWorkflowInput): Promise<WorkflowInstanceView>;
  act(input: WorkflowActionInput): Promise<WorkflowInstanceView>;
  pendingFor(input: PendingForInput): Promise<WorkflowStepView[]>;
  current(schemaName: string, instanceId: string): Promise<WorkflowInstanceView>;
  /** Cuplikan definisi, disimpan pada permohonan agar aturannya tidak berubah di tengah jalan. */
  snapshotDefinition(schemaName: string, definitionCode: string): Promise<WorkflowDefinitionSnapshot>;
}
```

`snapshotDefinition` tidak ada pada usulan integration request 001 — ia
kebutuhan khusus layanan publik. Bila Core kelak membangun mesin generiknya
tanpa itu, village mempertahankan cuplikannya sendiri.

---

## Bagian II — `AccountingEventPort` dan APBDes

### APBDes bukan pembukuan komersial

Perbedaannya bukan istilah:

| | Akuntansi komersial | APBDes |
|---|---|---|
| Struktur | Neraca, laba-rugi, arus kas | Pendapatan, Belanja, Pembiayaan |
| Tujuan | Mengukur laba | Mempertanggungjawabkan penggunaan anggaran |
| Satuan pengendalian | Akun | **Pagu per kegiatan** |
| Pertanyaan pokok | Untung berapa | Terserap berapa persen, sesuai peruntukan atau tidak |
| Yang dilarang | — | **Belanja melampaui pagu kegiatan** |

Yang terakhir menentukan rancangan: pada sistem komersial, membelanjakan lebih
dari rencana adalah keputusan bisnis. Pada APBDes, **belanja melampaui pagu
adalah pelanggaran** dan harus ditolak sistem, bukan sekadar diberi peringatan.

### Yang dipakai dari Core, dan yang tidak

| Dipakai | Tidak dipakai |
|---|---|
| Mesin peristiwa akuntansi (`accounting_event`) | Bagan akun komersial |
| Aturan posting berbasis data (`accounting_posting_rule`) | Struktur laba-rugi |
| Idempotensi peristiwa | Periode fiskal komersial |
| Uji kelengkapan kode peristiwa | Jurnal umum sebagai antarmuka utama |

Village menyediakan bagan akun APBDes-nya sendiri sebagai data acuan —
kelompok, jenis, objek belanja mengikuti peraturan yang berlaku — dan
memetakannya ke mesin posting yang sudah ada.

### Kode peristiwa yang diusulkan

Awalan `VILLAGE_` supaya tidak tercampur dengan `MARKETPLACE_*` maupun `POS_*`:

```
VILLAGE_BUDGET_APPROVED        pagu disahkan
VILLAGE_REVENUE_RECEIVED       pendapatan diterima
VILLAGE_EXPENDITURE_COMMITTED  belanja diikat (SPP disetujui)
VILLAGE_EXPENDITURE_REALIZED   belanja direalisasi (uang keluar)
VILLAGE_ADVANCE_ISSUED         panjar diberikan
VILLAGE_ADVANCE_SETTLED        panjar dipertanggungjawabkan
VILLAGE_TAX_WITHHELD           pajak dipotong
VILLAGE_TAX_REMITTED           pajak disetor
VILLAGE_FINANCING_RECEIPT      penerimaan pembiayaan
VILLAGE_FINANCING_EXPENDITURE  pengeluaran pembiayaan
VILLAGE_AID_DISBURSED          bantuan disalurkan
VILLAGE_ASSET_ACQUIRED         aset diperoleh
```

Mengikuti pola yang sudah ada, setiap kode wajib punya daftar nilai wajib dan
aturan posting — dijaga oleh uji kelengkapan yang meniru
`posting-engine.spec.ts`. Kode yang ditambahkan tanpa aturan posting akan
menggagalkan pengujian, bukan diam-diam menghasilkan jurnal kosong.

Pembedaan `COMMITTED` dan `REALIZED` sengaja: pagu terpakai sejak belanja
diikat, bukan sejak uang keluar. Desa yang hanya melihat realisasi akan
mengira paguya masih tersedia padahal sudah habis diikat kontrak.

### Penegakan pagu

```ts
export interface AccountingEventPort {
  emit(input: {
    schemaName: string;
    eventCode: string;
    sourceType: string;
    sourceId: string;
    amounts: Record<string, number>;
    idempotencyKey: string;
  }): Promise<{ eventId: string; duplicate: boolean }>;
}
```

Penegakan pagu **tidak** ada pada port ini. Ia milik village, dijalankan
sebelum peristiwa diterbitkan, dan ditegakkan **basis data** lewat constraint
pada realisasi terhadap pagu kegiatan — sama alasannya dengan batas jumlah
retur pada POS: perhitungan sisa yang dilakukan layanan akan salah begitu dua
transaksi berjalan bersamaan.

### `PaymentPort`

Untuk penyaluran bantuan non-tunai dan pembayaran belanja desa lewat bank.

Keadaannya: **belum ada kontrak penyedia**. Village menyediakan antarmukanya
dan adapter yang mengembalikan "belum tersedia"; penyaluran tunai dengan bukti
tanda terima tetap dapat berjalan penuh tanpanya.

Satu larangan yang mengikat: **AI tidak pernah menyentuh port ini.** Sudah
dinyatakan spesifikasi §24 dan ditegakkan dengan tidak mendaftarkan port ini
sebagai alat yang dapat dipanggil dari gerbang AI.

---

## Ringkasan port

| Port | Sisi Core | Yang dikerjakan village sekarang |
|---|---|---|
| `WorkflowPort` | **Tidak ada** | Implementasi sendiri di balik antarmuka |
| `AccountingEventPort` | Ada | Adapter tipis + bagan akun APBDes sendiri |
| `PaymentPort` | Sebagian (eSmartlink marketplace) | Antarmuka + adapter "belum tersedia" |
| `NotificationPort` | Ada | Adapter tipis |
| `IdentityPort` | Ada | Adapter tipis |
| `FileStoragePort` | Ada | Adapter tipis |
| `AiGatewayPort` | Ada | Adapter tipis + keperluan village |
| `AuditPort` | Ada | Adapter tipis |
| `HealthAggregatePort` | Belum ada vertikalnya | Antarmuka + adapter "belum tersedia" |
| `CooperativeIntegrationPort` | Belum ada vertikalnya | Sama |
| `PosIntegrationPort` | Sedang dikerjakan | Sama |

Lima dari sebelas port mengembalikan "belum tersedia" pada tahap ini. Itu
keadaan yang jujur dan disengaja — bukan kegagalan. Yang akan menjadi kegagalan
adalah bila adapter itu mengembalikan data karangan agar tampilannya terisi.
