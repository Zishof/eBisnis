# Utang Keamanan Dependency

Temuan `pnpm audit` yang **diketahui, belum diselesaikan, dan diterima
sementara**, beserta alasan dan rencana penyelesaiannya.

Berkas ini ada supaya temuan tidak hilang dari pandangan hanya karena CI hijau.
Ambang yang ditegakkan CI adalah `critical` pada dependency produksi; seluruh
temuan `high` di bawah ini dilaporkan pada setiap run tetapi tidak menggagalkan
build.

- Ditinjau: 2026-07-30
- Perintah: `pnpm audit --prod --audit-level high`

## Ringkasan

| Cakupan | low | moderate | high | critical |
| --- | ---: | ---: | ---: | ---: |
| Dependency produksi | 1 | 13 | **6** | 0 |
| Seluruh dependency (termasuk dev) | 4 | 16 | 11 | 0 |

Tidak ada temuan `critical`.

## Temuan high pada dependency produksi

| Paket | Jalur | Sebab | Penyelesaian |
| --- | --- | --- | --- |
| `multer` | `@nestjs/core` → `@nestjs/platform-express` → `multer` | `multer` 1.x sudah tidak dipelihara; perbaikannya ada pada 2.x | perlu `@nestjs/platform-express` 11.x — **upgrade mayor NestJS** |
| `lodash` | `@nestjs/config` → `lodash` | advisory pada `lodash` 4.17.21 | menunggu `@nestjs/config` memutakhirkan dependency-nya |
| `js-yaml` | `@nestjs/swagger` → `js-yaml@4.1.0` | perbaikan ada pada rilis `js-yaml` berikutnya | dapat diselesaikan dengan override setelah versi patch tersedia dan diuji |

## Mengapa belum diselesaikan sekarang

Ketiganya transitif dari NestJS 10. Perbaikan `multer` mensyaratkan
`@nestjs/platform-express` 11, yang berarti menaikkan NestJS satu versi mayor.
Itu bukan pekerjaan kecil: ia menyentuh seluruh modul API, dan aturan proyek
melarang menaikkan versi mayor dependency tanpa kebutuhan dan ADR.

Melakukannya bersamaan dengan cutover Git juga akan mencampur dua perubahan
besar dalam satu langkah, sehingga bila ada yang rusak, penyebabnya sulit
dipisahkan.

## Yang sudah diselesaikan

| Paket | Advisory | Tindakan |
| --- | --- | --- |
| `glob` | [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) | override `glob@10` → `^10.5.0`; tidak lagi muncul sebagai high |

Rincian override: [dependency-overrides.md](dependency-overrides.md).

## Rencana

1. Buat ADR untuk upgrade NestJS 10 → 11, mencakup dampak pada modul API,
   Swagger, dan konfigurasi.
2. Kerjakan sebagai vertical slice tersendiri dengan regression penuh, **bukan**
   disisipkan ke fase fitur.
3. Setelah upgrade, naikkan ambang CI kembali menjadi
   `pnpm audit --prod --audit-level high`.
4. Perbarui berkas ini setiap kali temuan bertambah, berkurang, atau berubah
   tingkat keparahannya.

## Aturan

- Ambang `--audit-level` tidak boleh diturunkan di bawah `critical`.
- Menambahkan temuan ke berkas ini bukan cara menutup masalah; setiap baris
  wajib punya rencana penyelesaian yang konkret.
- Temuan `critical` tidak pernah boleh diterima — ia menggagalkan build dan
  harus diselesaikan sebelum merge.
