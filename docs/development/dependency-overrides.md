# Override Dependency

`package.json` tidak dapat memuat komentar, sehingga alasan setiap entri pada
`pnpm.overrides` dicatat di sini. Setiap override wajib punya baris di tabel ini.

## Override aktif

| Selector | Versi | Alasan | Ditinjau ulang bila |
| --- | --- | --- | --- |
| `glob@10` | `^10.5.0` | [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) — command injection pada CLI `glob` (`-c`/`--cmd`) versi `>=10.2.0 <10.5.0`. Masuk secara transitif melalui `@nestjs/cli`. | `@nestjs/cli` sudah memakai `glob >= 10.5.0` secara langsung |
| `rollup` | `npm:@rollup/wasm-node@4.62.3` | Binary native `@rollup/rollup-linux-x64-gnu` menuntut GLIBC 2.32, sedangkan server produksi memakai Ubuntu 20.04 dengan GLIBC 2.31. Build gagal `ERR_DLOPEN_FAILED`. | server pindah ke Ubuntu 22.04 atau lebih baru |

### Catatan tentang `rollup`

`@rollup/wasm-node` adalah build WebAssembly resmi dari tim rollup, versinya
selalu sama dengan rilis rollup, dan merupakan pengganti langsung yang memang
disediakan untuk platform tanpa dukungan binary native.

Biayanya sudah diukur, bukan diperkirakan:

| | Native | WASM |
| --- | --- | --- |
| Waktu build `apps/web` | 4,85 detik | 4,95 detik |
| Nama berkas hasil (hash) | `index-5D2WcnBL.js` | `index-5D2WcnBL.js` |

Selisih waktunya tidak berarti, dan hash keluarannya identik — artinya bundel
yang dihasilkan sama persis. Karena itu override diberlakukan untuk semua
platform, bukan hanya server: menjaga satu toolchain untuk pengembangan, CI,
dan produksi lebih berharga daripada selisih sepersepuluh detik.

Efek sampingnya justru menguntungkan: tidak ada lagi binary native rollup yang
diunduh pada platform mana pun, sehingga build tidak bisa lagi gagal karena
ketidakcocokan glibc atau arsitektur.

### Catatan tentang `glob@10`

Selector sengaja dibatasi pada mayor 10 (`glob@10`), bukan `glob` polos.
Beberapa paket masih memakai `glob@7`, dan mengangkat semuanya ke 10 akan
mengubah API yang mereka andalkan.

Kerentanannya ada pada CLI, bukan pada API pustaka, dan `@nestjs/cli` memakai
`glob` sebagai pustaka. Paparan nyatanya rendah dan hanya pada waktu build.
Meski demikian override tetap diterapkan: menaikkan satu versi patch jauh lebih
murah daripada mengabaikan temuan audit, dan mengabaikan berarti `pnpm audit`
harus dilonggarkan sehingga temuan berikutnya ikut tersembunyi.

## Aturan

1. Jangan menurunkan `--audit-level` pada CI untuk membuat build hijau.
   Naikkan versinya atau tulis alasan penerimaan risikonya di sini.
2. Setiap override adalah utang teknis. Cantumkan kondisi yang membuatnya dapat
   dihapus pada kolom "Ditinjau ulang bila".
3. Override yang tidak lagi diperlukan wajib dihapus, bukan dibiarkan.
4. Setelah menambah atau mengubah override, jalankan `pnpm install`,
   `pnpm lint`, `pnpm test`, dan `pnpm build` untuk membuktikan tidak ada yang
   rusak, lalu commit `pnpm-lock.yaml` bersama perubahannya.
