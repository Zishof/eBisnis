# 00. Repository Baseline — POS/Inventory 48-Layar Parity

**Waktu audit:** 2026-08-08 (Asia/Jakarta)

**Repository aktual:** `C:\opt\eBisnis-Github\eBisnis`

**Remote:** `https://github.com/Zishof/eBisnis.git`

**Branch:** `main` mengikuti `origin/main`

**HEAD sebelum perubahan sesi ini:** `8093d9bd07c814c2f7b399f642018fa37b3e09c6` (`pos-v0.1.16`)

Dokumen master menyebut `C:\opt\eBisnisGithub`, tetapi path tersebut tidak ada. Audit memakai
checkout Git nyata di atas. Working tree bersih ketika baseline dimulai. Tidak ada reset, drop
database, perubahan migration lama, perubahan `.env`, atau force-push.

## Kesimpulan P0

Repository sudah mempunyai implementasi luas untuk 48 layar, tetapi ledger lama yang menandai
seluruh baris `COMPLETE` belum memenuhi definisi `DONE` master. Live-database smoke dan browser
E2E kini sudah dibuktikan lokal; build Flutter Windows/APK, rekonsiliasi DBF, cetak/perangkat
fisik, dan UAT legacy-vs-baru belum tersedia. Status keseluruhan yang jujur masih
`PARTIAL/BLOCKED`, bukan 100%.

Sejak baseline audit terdahulu (`6df6b85`) terdapat 13 commit baru sampai `8093d9b`, termasuk
approval/void POS, discount permission, bridge pembelian→AP dan penjualan→AR, masking bank,
pemisahan approval harga, freeze stok-opname, serta checkout Flutter luring. Semua perubahan itu
diaudit ulang; keberadaan commit tidak dipakai sebagai bukti penerimaan akhir.

## Toolchain dan layanan

| Komponen | Kondisi aktual |
|---|---|
| Node.js | `v20.12.0` |
| package manager | project mengunci `pnpm@9.15.4`; runtime global yang ditemukan `11.16.0` dan mencoba purge/install, sehingga verifikasi berikut memakai binary dependency yang sudah terkunci |
| Git / GitHub CLI | Git `2.44.0`; `gh 2.97.0` belum login |
| Flutter / Dart | tidak terpasang — analyze/test/build Windows/APK `BLOCKED` |
| PostgreSQL | PostgreSQL 16.4 pada `localhost:5432`; database uji `ebisnis` berhasil dipakai melalui environment sementara, tanpa menulis credential ke repository |
| API/Web dev server | tidak berjalan pada port 3000/5173 saat snapshot |
| Git hook | `.githooks/pre-push` ada, tetapi `core.hooksPath` belum diset |

Tidak ada password database ditebak dan tidak ada `.env` dibuat atau ditimpa.

## Baseline sebelum source diubah

| Gate | Hasil |
|---|---|
| API lint | PASS |
| API build | PASS |
| API tests | PASS — 154 suite, 3.988/3.988 test |
| Web lint | FAIL — 3 warning `react-hooks/exhaustive-deps` |
| Web build | PASS — bundle utama 1.868 KB (527,84 KB gzip), warning ukuran |
| Web tests | 42 file PASS; 1 file timeout, 503/504 test PASS. File gagal kemudian PASS 24/24 sendiri, sehingga diklasifikasikan flaky/resource contention |
| Migration integrity | FAIL — 136 pelanggaran palsu karena checker memaksa migration health `H###` memakai pola inti `V###` |
| DB-dependent smoke/E2E | Belum dijalankan pada baseline awal; hasil setelah migrasi/seed dicatat di bawah |
| Flutter analyze/test/build | BLOCKED — SDK tidak tersedia |

## Perbaikan gate setelah baseline

- Tiga referensi array React distabilkan dengan `useMemo`; Web lint kini PASS.
- Timeout khusus satu test interaksi HIM dinaikkan menjadi 10 detik; test target PASS 24/24.
- Checker migration kini memahami 56 migration inti `V###`, 68 health `H###`, dan 54 modular;
  seluruhnya PASS tanpa mengubah migration SQL lama.
- Password tenant CMN dihapus dari Web dan CLI onboarding. CLI kini mewajibkan enam secret
  environment dan tidak menyentuh `.env`.
- API lint dan build setelah perubahan PASS.
- Suite penuh setelah perubahan PASS: API 157 suite / 4.013 test; Web 44 file / 505 test.
- Web type-check dan build produksi PASS; warning chunk utama sekitar 1.869 KB tetap tercatat.
- Vertical slice layar 07 menolak order baru dari profil sales nonaktif, dan layar 08 sekarang
  memakai saldo stok live per gudang. Rincian status ada pada requirement ledger.
- Database `ebisnis` awalnya kosong. `prisma migrate deploy` menerapkan 28 migration platform
  secara additive; tidak ada reset/drop dan tidak ada migration applied yang disunting.
- Seed resmi berhasil membuat tenant demo, menerapkan 177 migration tenant sampai `H071`, dan
  memasukkan 242 master record. Verifikasi seed lulus: platform 25 resource / 0 gagal dan demo
  22 resource / 0 gagal. Superadmin sengaja tidak dibuat karena password bootstrap tidak diberikan.
- Smoke HTTP database-backed lulus **122/122**. Alurnya mencakup registrasi tenant, forced password
  change, lifecycle master, audit, minimum-stock request, PO, penerimaan 58 accepted + 2 quarantine,
  backorder, transfer in-transit, stock tree/ledger, pricing/invoice, isolasi demo/lintas tenant,
  serta cleanup/restore sample data.
- Smoke tersebut menemukan cacat nyata: `LifecycleContext.userId` adalah platform user id sedangkan
  data-scope memakai `user_subject.id`; selain itu role legacy `OWNER` tidak mewarisi data-scope role
  penerus. Keduanya diperbaiki tanpa melonggarkan fail-closed authorization.
- Browser E2E terhadap build produksi lulus **73 executed / 15 intentionally skipped / 0 failed**
  pada proyek Chromium desktop dan mobile. Cakupan meliputi aksesibilitas/responsive, autentikasi,
  sandbox demo, master/stock/purchasing, Stock Opname aktual, POS online, service-worker/offline,
  laporan kasir, dan website publik. Fixture akun kasir acak dibersihkan sesudah test.
- Respons rate-limit 429 sekarang memakai kode stabil `RATE_LIMITED` dan pesan yang dapat
  ditindaklanjuti, bukan salah dilaporkan sebagai `INTERNAL_ERROR`.
- Auto-posting Inventory/Sales kini operasional. Migration aditif `V057` menyemai 10 rule,
  `V058` menyemai 12 periode bulanan tahun berjalan, dan MasterSeed menjamin keduanya untuk tenant
  baru. Worker terjadwal, API proses/retry, alasan kegagalan, serta antrean Web sudah tersedia.
  Pembuktian PostgreSQL: tiga event penerimaan barang lama berhasil berubah `PENDING` → `FAILED`
  (periode belum ada) → `POSTED` sesudah retry; terbentuk tepat tiga jurnal, semuanya seimbang dan
  tertaut satu-ke-satu. Pemrosesan ulang menghasilkan nol jurnal tambahan.
- Penjualan POS normal kini ikut auto-post melalui `V059` (total rule sistem menjadi 22). Emitter
  membagi penerimaan berdasarkan `payment_method.method_type`, tidak lagi menganggap semua pembayaran
  tunai, dan tidak menerbitkan event pajak maupun pelepasan persediaan yang menggandakan jurnal.
  Playwright POS desktop lulus 9/9; transaksi tunai aktual menghasilkan tiga jurnal (penjualan,
  penerimaan kas, HPP), semuanya seimbang, dengan net akun Piutang POS tepat nol. Fixture resmi
  dibersihkan; jurnal `POSTED` tetap tersimpan karena trigger immutability secara benar menolak
  penghapusan jurnal audit.
- `V060` dan `V061` melengkapi void/retur/refund, kas masuk/keluar, serta shortage/overage shift;
  total rule sistem Inventory/Sales/POS menjadi 51. Event reversal memakai nilai positif dan sisi
  terbalik. Penutupan periode kini ikut diblokir oleh event `PENDING/FAILED` pada rentang periode.
- SQL laporan laba-rugi yang sebelumnya merujuk kolom `chart_of_account.account_type` yang tidak
  ada diperbaiki memakai join `account_type.category`. Query aktual terhadap PostgreSQL sukses
  menghasilkan lima baris laba-rugi; baris Pendapatan Penjualan membaca saldo posted 10.000.
- Revalidasi PostgreSQL setelah `V061` membuktikan keempat schema lokal masing-masing memiliki
  51 rule posting aktif, 12 periode OPEN, nol event `PENDING/FAILED`, dan nol jurnal tidak
  seimbang. Checker immutability juga lulus terhadap HEAD awal `8093d9b`.
- Layar 39-40 telah ditelusuri ulang sampai jalur data: invoice layar 30 menulis piutang
  `LIVE:SALES` ke `legacy_receivable_ledger`, dan pembuatan paket nota membaca ledger yang sama.
  Pemilihan kini memakai row lock, menolak sales yang berbeda, serta menolak satu nota berada di
  dua paket custody `DRAFT/HANDED_OVER`. Endpoint cancel-draft dan print-data ditambahkan.
  Pembuktian PostgreSQL dilakukan dalam transaksi lalu `ROLLBACK`: AR live eligible tepat sekali,
  duplikasi custody tertolak, dan residu baris uji nol.
- Migration aditif `V062` menambah ledger custody immutable. CREATE/HANDOVER/RETURN/CLOSE/CANCEL
  sekarang menyimpan aktor, waktu, status asal/tujuan, serta metadata; detail dan print-data
  mengembalikan timeline tersebut. V062 diterapkan ke seluruh empat schema. Uji PostgreSQL dalam
  transaksi membuktikan empat event tersimpan berurutan dan UPDATE ditolak trigger immutable;
  rollback kembali menyisakan nol data uji.
- Jalur deploy `deploy/update.sh` diperkeras sebelum rilis V057-V062: lock eksklusif, penolakan
  dirty tracked tree, versi Node/pnpm terkunci, target fast-forward, migration verifier fail-closed,
  lint serta unit test berurutan dengan URL database produksi diisolasi, rollback pada kegagalan
  restart/Apache, pemulihan konfigurasi Apache lama, dan deployment stamp baru ditulis paling
  akhir. Bash syntax dan ShellCheck lulus; release-gate test dengan URL database loopback tertutup
  lulus API 157 suite/4.013 test dan Web 44 file/505 test.

## Inventory teknis

- Platform Prisma migrations: 28 direktori.
- Tenant core catalog: 62 migration `V001`–`V062`.
- Health catalog: 68 migration `H###` (nomor 55, 56, dan 64 sengaja tidak ada dalam katalog).
- Modular tenant migrations: 54 pada modul `cooperative` dan `pesantren`.
- Web, API, Flutter Android, dan Flutter Windows semuanya ada dalam repository.
- Local store Flutter menggunakan Drift/SQLite; command luring memiliki idempotency/correlation
  metadata. Verifikasi runtime retry/conflict/quarantine tetap menunggu Flutter SDK dan backend live.

## Blocker yang tidak boleh disamarkan

1. Flutter SDK tidak ada, sehingga artefak Windows/APK aktual tidak dapat dibangun lokal.
2. GitHub CLI belum terautentikasi, sehingga hasil workflow dan release remote tidak dapat
   dibuktikan dari mesin ini.
3. Mayoritas input legacy yang diwajibkan master tidak tersedia; lihat source manifest.
4. Rekonsiliasi DBF belum dapat dilakukan karena dump/source legacy yang diwajibkan tidak tersedia.
5. UAT, printer/scanner/cash-drawer, dan perbandingan dengan aplikasi lama memerlukan lingkungan
   serta operator bisnis nyata.
