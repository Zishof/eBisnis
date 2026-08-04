# H-0 · Matriks Pakai-Ulang / Perluas / Bangun-Baru

Perintah eMedik §8 menutup daftar dependensinya dengan satu kalimat: *"Jangan
menyalin engine shared ke modul health."* Dokumen ini adalah jawabannya — apa
yang dipakai apa adanya, apa yang diperluas, apa yang dibangun baru, dan apa
yang **terdengar** dapat dipakai tetapi tidak boleh.

| Keputusan | Arti |
|---|---|
| `PAKAI` | Dipakai lewat adapter, tanpa perubahan pada milik Core |
| `PERLUAS` | Core menyediakan titik perluasan; eMedik mengisinya |
| `BANGUN` | Tidak ada padanannya; dibangun di namespace kesehatan |
| `JANGAN` | Ada dan mirip, tetapi memakainya akan salah |

---

## PAKAI — lewat adapter, tanpa menyentuh milik Core

| Kebutuhan | Yang dipakai | Adapter |
|---|---|---|
| Autentikasi, peran aktif, cakupan data | `modules/auth/` | `IdentityPort` |
| Jejak audit hanya-bertambah | `V008` pemicu basis data + `AuditService` | `AuditPort` |
| Notifikasi | `modules/notification/` — pengelompokan dan SLA sudah berjalan | `NotificationPort` |
| Peristiwa akuntansi | `modules/accounting/posting-engine.ts` | `AccountingEventPort` |
| Pembayaran | `modules/payment/` + eSmartlink | `PaymentPort` |
| Berkas dan lampiran | `file_object`, `entity_attachment` | `FileStoragePort` |
| Gerbang AI | `modules/ai/` — kebijakan, bukti, redaksi, kuota sudah ada | `AiGatewayPort` |
| Persediaan | `modules/tenant/erp-inventory.service.ts` | `InventoryPort` |
| Penomoran dokumen | `number_sequence` | langsung; ia data acuan, bukan mesin |
| Pemisahan wewenang | `V010` `segregation_of_duty_rule` | langsung; cukup mendaftarkan aturan kesehatan |
| Observabilitas | V10-2, V10-3, V10-5 | otomatis; tidak perlu kode |

Kedelapan port belum ada sebagai antarmuka — yang ada layanannya langsung.
Membuat antarmukanya adalah pekerjaan H-1.

---

## PERLUAS — Core menyediakan tempatnya, eMedik mengisinya

| Kebutuhan | Titik perluasan | Yang diisi eMedik |
|---|---|---|
| Menu | Katalog menu global | `health-menu.catalog.ts` — tidak menambah ke berkas global |
| Peran | Katalog peran global | `health-role.catalog.ts` — 29 peran klinis |
| Hak akses | `permission_action` (40 aksi sudah ada) | Aksi klinis yang belum ada: `PRESCRIBE`, `DISPENSE`, `VERIFY_RESULT`, `ACKNOWLEDGE_CRITICAL`, `ADMIT`, `DISCHARGE`, `BREAK_GLASS` |
| Data contoh | Kerangka `master-seed` beserta golongan `REFERENCE`/`EXAMPLE` | Profil demo kesehatan |
| Migrasi | `manifest.json` | Awalan `H###`, `sequence` mulai 1000 — [IR 002](../integration-requests/health/002-modular-migration-catalog.md) |

Catatan tentang aksi hak akses: menambah baris ke `permission_action` adalah
data, bukan kode bersama. Tetapi katalog benihnya ada di berkas Core. Bila
menambahkannya menuntut menyunting berkas Core, itu menjadi integration request
tersendiri pada H-11.

---

## BANGUN — tidak ada padanannya

Seluruh sepuluh bounded context pada [01](01-domain-map.md). Yang perlu
ditegaskan adalah yang **hampir** ada padanannya:

| Dibangun | Ada yang mirip | Mengapa tetap dibangun |
|---|---|---|
| `patient` | `customer` | Lihat "JANGAN" di bawah |
| `encounter` | `sales_order`, `pos_sale` | Kunjungan boleh tidak menghasilkan tagihan sama sekali, dan tetap harus tersimpan |
| `health_facility` | `outlet` | Fasilitas punya kelas rumah sakit, izin, jejaring, dan jenis yang tidak dikenal outlet ritel |
| `drug_master` | `product` | Obat punya golongan terkendali, interaksi, dan bentuk sediaan. Menaruhnya di `product` berarti aturannya berlaku pada kaus dan kopi |
| `health_charge_catalog` | `price_book` | Tarif kesehatan bergantung kelas rawat, penjamin, dan casemix — bukan hanya outlet dan tanggal |
| `patient_bill` | `sales_order` | Tagihan pasien dapat ditanggung beberapa penjamin sekaligus dengan porsi berbeda |

---

## JANGAN — ada, mirip, tetapi memakainya akan salah

Bagian ini yang paling berguna diingat.

### `customer` untuk pasien

Sudah diuraikan pada [01](01-domain-map.md). Ringkasnya: identitas ganda pada
pelanggan merepotkan, identitas ganda pada pasien membahayakan nyawa — alergi
yang tercatat pada satu berkas tidak terlihat saat obat diresepkan dari berkas
lain.

### Menulis langsung ke `stock_balance` untuk stok obat

Perintah §12 menyebutnya eksplisit. Alasannya bukan kerapian: farmasi memiliki
aturan yang persediaan umum tidak punya — obat kedaluwarsa **menghentikan**
pemberian, golongan terkendali menuntut pencatatan ganda, penarikan sediaan
harus dapat menelusuri siapa yang sudah menerimanya. Menaruh aturan itu di mesin
persediaan bersama membuatnya berlaku pada seluruh barang dagangan; tidak
menaruhnya berarti obat kedaluwarsa dapat diserahkan.

Jalan yang benar: `InventoryPort` dengan aturan farmasi di sisi kesehatan.

### `PricingEngineService` untuk tarif layanan

Sama dengan temuan pada audit POS: mesin itu menghitung **tagihan langganan
SaaS** (`planCode`, `billingInterval`, `deviceIds`), bukan harga barang atau
tarif layanan. Tidak ada `productId`, tidak ada `serviceId`.

### Menulis jurnal langsung

Kesehatan tidak pernah menulis ke `journal_entry`. Ia menerbitkan peristiwa
lewat `AccountingEventPort`, dan `accounting_posting_rule` memetakannya ke akun.
Menulis jurnal langsung dari modul kesehatan berarti ada dua tempat yang
menentukan debit dan kredit — dan keduanya akan berbeda.

### `surat_*` untuk dokumen medis

Tata kelola surat V10-6 cocok untuk surat keterangan sakit dan rujukan
administratif. **Tidak** untuk resume medis, hasil laboratorium, atau catatan
operasi: dokumen medis terikat masa retensi, penahanan hukum, dan aturan
pelepasan informasi yang tidak dikenal tata kelola surat.

### `StockReservationService`

Catatan silang dari audit POS: layanan itu bekerja pada `online_listing_variant`
(stok etalase marketplace), bukan `stock_balance`. Sesi Core sudah membangun
`PosStockService` tersendiri. eMedik memakai `InventoryPort`, bukan salah satu
dari keduanya.

---

## Aturan yang dipegang selama eMedik dibangun

1. **Bila sudah ada dan netral terhadap domain, pakai lewat adapter.**
2. **Bila polanya terbukti, tiru polanya — jangan salin kodenya.** Mesin transisi
   status, penomoran anti-kembar, uji kelengkapan kode peristiwa.
3. **Bila khusus perdagangan, jangan dipaksa dipakai.** Memaksa `customer`
   menjadi pasien menghasilkan model yang salah di kedua tempat.
4. **Bila membangun baru, letakkan di namespace kesehatan.** Satu modul, bukan
   tersebar, sehingga cakupan kesehatan dapat dilihat dan diuji sebagai satu
   kesatuan — dan dapat dipisahkan bila kelak perlu.
