# ECO-0 — Baseline pengujian

Diukur pada worktree integrator, cabang
`feature/collaborative-multi-portal-platform` pada `98cd52c` (= `main`), sebelum
satu baris kode pun diubah.

Gunanya satu: bila angka ini turun kelak, penyebabnya adalah pekerjaan
ekosistem — bukan sesuatu yang "memang sudah begitu".

## Angka

| Rangkaian | Hasil |
| --- | --- |
| `pnpm --filter @ebisnis/api test` | **2092 lulus**, 78 berkas, 0 gagal |
| `pnpm --filter @ebisnis/web test` | **193 lulus**, 13 berkas, 0 gagal |
| `flutter test` (klien kasir) | **147 lulus**, 0 gagal |
| **Jumlah** | **2432 uji** |
| `pnpm lint` | bersih |

## E2E peramban

Tidak dijalankan pada mesin ini: ia menuntut PostgreSQL, API berjalan, dan
peramban Playwright. Baseline diambil dari jalan CI terakhir pada `main`:

| | Hasil |
| --- | --- |
| E2E peramban di `main` (`98cd52c`) | **73 lulus, 0 gagal, 0 flaky**, ~51 detik |

Angka nol flaky itu baru saja diperoleh: sebelum #61, rangkaian yang sama
mencatat 1 gagal dan 1–4 flaky. Bila angka flaky naik lagi, itu regresi.

## Yang TIDAK punya baseline

| Hal | Sebabnya |
| --- | --- |
| Keadaan basis data sungguhan | Tidak ada PostgreSQL terjangkau (5432/5433/5434 tidak menjawab) |
| Perilaku kelima domain | Hanya `ebisnis.id` menjawab (200); empat lainnya belum diuji |
| Migrasi tenant terhadap basis data | Menuntut basis data |
| Uji beban, uji keamanan | Belum ada rangkaiannya |

Ketiadaan baseline basis data berarti setiap klaim ECO-6 dan ECO-7 kelak harus
dibuktikan pada lingkungan yang punya PostgreSQL — bukan di sini.

## Cara mengulang pengukuran ini

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @ebisnis/api test
pnpm --filter @ebisnis/web test
cd apps/pos-flutter && flutter test
pnpm lint
```
