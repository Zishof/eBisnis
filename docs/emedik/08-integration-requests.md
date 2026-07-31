# H-0 · Daftar Integration Request

Panduan koordinasi §5 mewajibkan setiap kebutuhan perubahan pada berkas bersama
diajukan sebagai dokumen tersendiri, bukan dikerjakan langsung. Berkas ini
adalah daftarnya.

| No | Judul | Diajukan | Status | Menghalangi | Jalan sementara |
|---|---|---|---|---|---|
| [001](../integration-requests/health/001-health-namespace-collision.md) | Nama `modules/health` sudah dipakai pemeriksa ketersediaan | 31 Jul 2026 | Menunggu Core | Tidak | Memakai `modules/emedik/` |
| [002](../integration-requests/health/002-modular-migration-catalog.md) | Katalog migrasi modular belum ada | 31 Jul 2026 | Menunggu Core | Tidak | Awalan `H###`, `sequence` mulai 1000 |

---

## Yang sudah diperkirakan akan menyusul

Dicatat sekarang supaya Core dapat merencanakan, bukan menerima kejutan.

| Perkiraan | Fase | Sebab |
|---|---|---|
| Kode peristiwa akuntansi `HEALTH_*` | H-4 | Mesin posting Core hanya mengenal `MARKETPLACE_*` dan `POS_*`. Menambah kode kesehatan menyentuh `posting-engine.ts` |
| Aksi hak akses klinis | H-11 | `PRESCRIBE`, `DISPENSE`, `VERIFY_RESULT`, `ACKNOWLEDGE_CRITICAL`, `ADMIT`, `DISCHARGE`, `BREAK_GLASS` belum ada pada 40 aksi yang tersedia |
| Kontrak plugin katalog menu | H-11 | Panduan §9 menyebutnya, tetapi mekanismenya belum ada. Tanpa itu, katalog menu kesehatan harus disisipkan ke berkas global |
| Pola redaksi AI untuk data kesehatan | H-12 | Redaksi yang ada disetel untuk surel, NPWP, dan nomor telepon. Nomor rekam medis dan NIK belum |
| `apps/web/src/verticals/` | H-1 (UI) | Direktori tidak ada; antarmuka web belum bervertikal |
| Kerangka Pusat Bantuan | H-11 | Tidak pernah dibangun. Bukan permintaan perubahan, melainkan permintaan pembangunan |

---

## Aturan yang dipegang

1. **Jangan menyentuh berkas bersama.** Bila terasa perlu, itu tanda integration
   request, bukan tanda aturannya perlu dilanggar sekali ini saja.
2. **Sertakan jalan sementara.** Permintaan tanpa jalan sementara menghentikan
   pekerjaan sampai Core menjawab, dan Core sedang mengerjakan POS Web.
3. **Sertakan alasan yang dapat diperiksa.** "Lebih rapi" bukan alasan.
   "Kepemilikan CODEOWNERS menjadi salah" dapat diperiksa.
4. **Sebutkan bila keputusan diambil karena ketiadaan jawaban.** Bukan sebagai
   kesepakatan.
