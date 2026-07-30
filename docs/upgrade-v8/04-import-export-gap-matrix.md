# 04 — Matriks Gap Impor dan Ekspor

## Hasil ringkas

**Seluruh resource berstatus `CRUD_V8_MISSING`.** Tidak ada Excel, tidak ada
PDF, tidak ada unggah berkas, tidak ada antrean latar belakang, dan tidak ada
pemindaian malware.

| Kapabilitas | Status | Bukti |
| --- | --- | --- |
| Ekspor Excel | MISSING | nol berkas memuat `exceljs`/`xlsx`/`workbook` |
| Impor Excel | MISSING | nol berkas memuat `multer`/`FileInterceptor`/`upload` |
| Cetak PDF | MISSING | nol berkas memuat `pdfkit`/`puppeteer`/`printJob` |
| Antrean latar belakang | MISSING | nol dependency `bullmq`/`bull` |
| Pemindaian malware | MISSING | nol berkas memuat `clamav`/`malwareScan` |
| Penyimpanan berkas | PARTIAL | tabel `file_object` ada; adaptor penyimpanan belum |

## Resource yang perlu diberi Excel dan PDF

33 resource pada `apps/api/src/modules/tenant/master-resource.registry.ts`,
seluruhnya `CRUD_V8_MISSING`. Sebagian di antaranya:

```text
CATALOG_UOM              CATALOG_CATEGORY        CATALOG_PRODUCT
CRM_CUSTOMER             CRM_GROUP               PURCHASING_SUPPLIER
MASTER_SUPPLIER_GROUP    INVENTORY_WAREHOUSE     MASTER_WAREHOUSE_TYPE
MASTER_OUTLET            MASTER_OUTLET_TYPE      MASTER_REGION
INVENTORY_STOCK_POLICY   MASTER_PAYMENT_METHOD   MASTER_PAYMENT_TERM
CATALOG_TAX              HR_DEPARTMENT           HR_POSITION
HR_LEAVE_TYPE            MASTER_VEHICLE_TYPE     PURCHASING_PRODUCT_SUPPLIER
ADMIN_ROLE               FINANCE_COA             …
```

Ditambah halaman transaksi yang perlu ekspor dan cetak, tetapi **tidak** impor:
Request Order, Purchase Order, Penerimaan Barang, Backorder, Internal Transfer,
Stock Tree.

## Aturan yang wajib ditegakkan

Diambil dari blueprint bagian 11–13, dicatat di sini agar tidak longgar saat
implementasi.

### Tombol Upload

```text
Upload tampil HANYA bila UPDATE = true DAN DELETE = true.
```

Alasannya: unggah dapat menonaktifkan dan menghapus baris, sehingga izinnya
harus mencakup keduanya. Penyembunyian tombol **bukan** kontrol keamanan —
server tetap memverifikasi setiap baris.

**Prasyarat yang belum terpenuhi:** temuan V6-0-F03 menunjukkan endpoint CRUD
master saat ini tidak memverifikasi permission sama sekali. Selama itu belum
diperbaiki, aturan di atas hanya berlaku di UI dan dapat dilewati dengan
memanggil API langsung. Perbaikan itu masuk lingkup V8-4.

### Aturan ID pada unggahan

| Kondisi | Tindakan |
| --- | --- |
| ID ada dan ditemukan | UPDATE |
| ID kosong | CREATE, hanya bila permission CREATE |
| ID ada tetapi tidak ditemukan | ERROR |
| ID milik tenant lain | SECURITY ERROR |

Konflik ditangani `Row Version` (optimistic locking). Kolom `version` sudah ada
pada seluruh tabel master sebagai bagian kontrak lifecycle Versi 5 — tidak perlu
kolom baru.

### Penolakan template halaman lain

Berkas yang dibuat untuk resource lain wajib ditolak dengan pesan yang menyebut
kedua halaman. **Dilarang melakukan pencocokan kolom secara fuzzy.**

### Hard purge tidak tersedia lewat Excel

Purge hanya lewat UI dengan step-up authentication.

## Rancangan lembar workbook

```text
Data                    baris yang dapat diedit
Petunjuk                cara pakai, aturan ID, arti tiap kolom
Daftar Nilai            nilai referensi untuk kolom lookup
__ebisnis_template__    metadata dan tanda tangan; disembunyikan
```

Metadata pada lembar terakhir:

```text
templateId  resourceCode  moduleCode  templateVersion  applicationVersion
tenantIdHash  localeCode  generatedAt  columnFingerprint  columnDefinitions
serverSignature
```

`tenantIdHash`, bukan `tenantId` mentah — berkas Excel sering berpindah tangan,
dan pengenal tenant tidak perlu ikut tersebar.

## Keamanan yang wajib ada

| Ancaman | Penanganan |
| --- | --- |
| Injeksi formula | teks yang diawali `=` `+` `-` `@` di-escape saat ekspor |
| Berkas palsu berekstensi xlsx | validasi magic byte dan struktur ZIP |
| Makro | ditolak sesuai kebijakan |
| Zip bomb | batas ukuran terkompresi dan terdekompresi |
| Metadata dipalsukan | tanda tangan server diverifikasi |
| ID lintas tenant | ditolak sebagai kesalahan keamanan, dicatat audit |
| Berkas besar | batas ukuran dan jumlah baris; proses di latar belakang |
| Kolom tersembunyi ikut terekspor | masking mengikuti permission, diverifikasi di server |

## Keputusan pustaka

| Kebutuhan | Pilihan | Alasan |
| --- | --- | --- |
| Excel | **`exceljs`** | mendukung penulisan multi-sheet, styling, proteksi sheet, dan pembacaan streaming; `xlsx` (SheetJS) versi bebasnya terbatas pada penulisan bergaya |
| PDF | **`pdfkit`** | tanpa browser headless, sehingga jejak deployment kecil; `puppeteer` menuntut Chromium yang berat untuk server ini |
| Antrean | **tabel PostgreSQL + worker** | Redis belum ada pada deployment; menambah Redis berarti menambah komponen operasional. Tabel `background_job` sudah ada pada migration V007 |
| Diagram | **Mermaid dirender di server** | teks sumbernya dapat diversikan dan ditinjau; SVG hasilnya disanitasi |

Ketiga keputusan pertama memperhitungkan kenyataan deployment: satu server
Ubuntu 20.04 yang juga menjalankan aplikasi lain. Menambah Chromium dan Redis
akan memberatkan tanpa manfaat sepadan pada skala ini.

Keputusan ini ditulis sebagai ADR pada fase implementasinya masing-masing.
