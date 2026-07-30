# 00 — Kondisi Saat Ini Sebelum Versi 8

- Tanggal audit: 2026-07-31
- Workspace: `C:\opt\eBisnisGithub`
- Branch: `feature/v8-help-excel-pdf-crud`
- Commit dasar: `3967cb5`
- Bukti: `evidence/baseline-v8-0.txt`

## Ringkasan satu paragraf

Source memuat implementasi Versi 5 yang berjalan penuh, ditambah audit Versi 6
fase V6-0 dan cutover Git Versi 7. **Kapabilitas Versi 8 belum ada sama sekali** —
bukan sebagian, melainkan nol: tidak ada Help Center, tidak ada Excel, tidak ada
PDF, tidak ada diagram, tidak ada guided tour, tidak ada worker/queue, tidak ada
unggah berkas, tidak ada pemindaian malware, dan tidak ada Google login. Yang
tersedia adalah fondasi yang layak dibangun di atasnya: 33 resource CRUD
terdaftar, 55 route UI, 73 menu, dan mesin permission yang sudah berfungsi.

## Baseline

Seluruhnya hijau. Tidak ada kegagalan baseline yang perlu dipisahkan dari
regresi Versi 8 nanti.

| Langkah | Perintah | Hasil |
| --- | --- | --- |
| Prisma validate | `pnpm db:validate` | schema valid |
| Prisma generate | `pnpm db:generate` | Prisma Client v6.19.3 |
| Lint | `pnpm lint` | api Done, web Done — 0 warning |
| Test | `pnpm test` | **83 lulus** (68 Jest + 15 Vitest) |
| Build | `pnpm build` | api Done, web `built in 9.62s` |

Catatan: repository ini **tidak memiliki script `typecheck` terpisah**.
Pemeriksaan tipe berjalan di dalam `pnpm build` (`nest build` dan `tsc -b`).
`pnpm test:e2e` memerlukan dev server dan dijalankan pada fase yang menyentuh UI.

## Kapabilitas Versi 8 — hasil pencarian source

Pencarian dilakukan pada `apps/api/src` dan `apps/web/src`.

| Kapabilitas | Pola dicari | Berkas ditemukan | Status |
| --- | --- | ---: | --- |
| Help Center | `Help`, `helpTopic`, `HelpDrawer` | 0 | **MISSING** |
| Excel | `exceljs`, `xlsx`, `workbook` | 0 | **MISSING** |
| PDF | `pdfkit`, `puppeteer`, `PDFDocument`, `printJob` | 0 | **MISSING** |
| Diagram/flowchart | `mermaid`, `diagram`, `flowchart` | 1 | **MISSING** (hanya rujukan dokumen) |
| Guided tour | `guidedTour`, `driver.js`, `shepherd` | 0 | **MISSING** |
| Worker/queue | `bullmq`, `bull`, `queue`, `worker` | 1 | **MISSING** (hanya penamaan tabel) |
| Unggah berkas | `multer`, `upload`, `FileInterceptor` | 0 | **MISSING** |
| Pemindaian malware | `clamav`, `malwareScan` | 0 | **MISSING** |

Dependency yang diperlukan Versi 8 dan **belum satu pun terpasang**:

```text
exceljs  xlsx  pdfkit  puppeteer  @react-pdf/renderer  mermaid
bullmq  bull  multer  archiver  sharp
googleapis  google-auth-library  openid-client  passport-google-oauth20
```

## Fondasi yang tersedia dan wajib dipakai ulang

| Aset | Jumlah | Lokasi |
| --- | ---: | --- |
| Resource CRUD terdaftar | 33 | `apps/api/src/modules/tenant/master-resource.registry.ts` |
| Route UI | 55 | `apps/web/src/app/App.tsx` |
| Komponen UI reusable | 11 | `apps/web/src/components/ui.tsx` |
| Model Prisma control plane | 136 | `apps/api/prisma/platform/*.prisma` |
| Migration tenant | 9 (V001–V009) | `apps/api/tenant-migrations/` |
| Operasi OpenAPI | 157 | dihasilkan runtime dari dekorator NestJS |

Kondisi menu, role, dan permission pada schema `demo`:

| Objek | Jumlah | Target Versi 8 |
| --- | ---: | --- |
| Menu total | 73 | struktur 33 root beserta anaknya |
| Menu root | **21** | **33** |
| Role | **6** | **±140** role default Indonesia |
| Aksi permission | 22 | diperluas sesuai P0–P12 |
| Baris role-menu-permission | 2.990 | bertambah mengikuti role dan menu baru |
| Role scope | 1 | data scope policy penuh |
| User subject | 1 | satu sample user per role + kasir per brand-outlet |

## Yang membuat Versi 8 layak dikerjakan di atas fondasi ini

1. **Registry resource sudah ada.** `defineCrudResource` Versi 8 memperluasnya,
   bukan menggantikan — 33 resource yang terdaftar langsung memperoleh definisi
   Excel, PDF, dan help topic.
2. **Mesin permission sudah berfungsi** dan memakai kode menu, sehingga aturan
   "Upload hanya tampil bila UPDATE dan DELETE" dapat dievaluasi tanpa model baru.
3. **Kontrak kolom lifecycle master sudah baku**, sehingga seluruh tabel Help
   dapat mengikutinya tanpa menciptakan konvensi kedua.
4. **Audit append-only sudah berjalan**, siap dipakai untuk mencatat impor,
   ekspor, cetak, dan penerbitan help.
5. **Katalog migration tenant berchecksum** — migration Versi 8 tinggal
   ditambahkan sebagai V010 dan seterusnya.

## Temuan yang belum selesai dan terbawa ke Versi 8

Ketiganya berasal dari audit V6-0 dan masih terbuka. Dua yang pertama menyentuh
otorisasi, sehingga relevan langsung dengan pekerjaan role dan permission
Versi 8 Revisi 1.

| Temuan | Dampak pada Versi 8 |
| --- | --- |
| **V6-0-F03** — endpoint CRUD master tidak memverifikasi permission | Aturan tombol Upload/Download Versi 8 akan tampak berlaku di UI padahal server tidak menegakkannya. **Wajib diperbaiki sebelum atau bersamaan dengan V8-4.** |
| **V6-0-F01** — dua schema registry `V000/FAILED` padahal V008 diterapkan | Orkestrator migration V010+ akan salah menghitung versi pada kedua schema itu. |
| Client Orval belum pernah digenerate | Versi 8 menambah puluhan endpoint; tanpa client bertipe, ketidaksesuaian kontrak tidak tertangkap saat kompilasi. |

## Basis data

| Atribut | Nilai |
| --- | --- |
| Pengembangan | PostgreSQL 17.2, port 5433, 23 schema |
| Produksi | PostgreSQL 13.12 di `38.47.178.34:5434` |
| Versi migration tenant | V009 pada keduanya |

Perbedaan versi ini perlu diingat: fitur PostgreSQL yang hanya ada pada 14+
tidak boleh dipakai migration Versi 8, karena produksi berjalan di 13.
