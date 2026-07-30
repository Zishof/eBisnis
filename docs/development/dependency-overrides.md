# Override Dependency

`package.json` tidak dapat memuat komentar, sehingga alasan setiap entri pada
`pnpm.overrides` dicatat di sini. Setiap override wajib punya baris di tabel ini.

## Override aktif

| Selector | Versi | Alasan | Ditinjau ulang bila |
| --- | --- | --- | --- |
| `glob@10` | `^10.5.0` | [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) — command injection pada CLI `glob` (`-c`/`--cmd`) versi `>=10.2.0 <10.5.0`. Masuk secara transitif melalui `@nestjs/cli`. | `@nestjs/cli` sudah memakai `glob >= 10.5.0` secara langsung |

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
