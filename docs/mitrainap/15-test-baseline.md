# Baseline test aktual — 9 Agustus 2026

| Pemeriksaan | Hasil |
|---|---|
| Dependency | `pnpm 9.15.4 install --frozen-lockfile` lulus; 1.340 package |
| Root wrapper | gagal reproducibility: nested pnpm yang lebih baru mengabaikan `package.json#pnpm.overrides` dan mendeteksi lock config mismatch |
| Prisma | schema valid; client generate lulus |
| API lint | lulus, 0 warning |
| Web lint | lulus, 0 warning |
| API unit | 157 suite, 4.015 test lulus |
| Web unit/component | lulus; warning i18n instance dan React Router future flag |
| API build | lulus |
| Web build | lulus; 2.809 module; warning chunk utama 1.871,08 kB dan mixed dynamic/static import jsPDF |
| Playwright | 88 total: 53 lulus, 2 gagal, 30 skipped, 3 tidak jalan. Dua kegagalan existing hanya mobile `stock-tree`; desktop setara lulus |
| Flutter POS | Flutter 3.27.1/Dart 3.6; `pub get` lulus, analyze/test blocked karena Windows Developer Mode/symlink support tidak aktif |
| Flutter gerbang | `pub get` dan analyze lulus; tidak ada direktori `test` |
| Database | PostgreSQL 16.4 port 5432; koneksi/read audit lulus; tidak ada Hospitality tables |

Perintah root tidak memiliki script `typecheck`; typecheck Web dijalankan lewat `tsc -b`, API melalui `nest build`. E2E menggunakan API development sehat pada port 3000 dan Vite worktree pada 5173; proses Vite audit telah dihentikan.
