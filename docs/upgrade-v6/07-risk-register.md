# 07 — Risk Register Upgrade V5 → V6

> Fase V6-0. Setiap risiko punya pemicu yang konkret, bukan kekhawatiran umum.
> Skala: dampak × kemungkinan (T/M/R = Tinggi/Menengah/Rendah).

## Risiko yang SUDAH TERJADI (temuan, bukan prediksi)

| ID | Risiko | Dampak | Bukti | Mitigasi | Fase |
| --- | --- | --- | --- | --- | --- |
| R-01 | Kredensial ter-commit ke SVN | **T** | `svn list -R` menampilkan `apps/api/.env`; berisi kata sandi DB, dua JWT secret, kata sandi super admin | rotasi seluruh secret, hapus dari versioning, set `svn:ignore` sungguhan | segera, keputusan pemilik |
| R-02 | `node_modules` ter-commit dan menimbulkan obstruction | T | 70 dari 104 path versioned; `~M apps\api\node_modules\@nestjs\cli` | keluarkan dari versioning, set `svn:ignore` | sebelum commit V5 |
| R-03 | Source V5 belum diversi | T | 54 entri `?` termasuk `apps/api/src`, `apps/web`, `tenant-migrations`, `scripts` | commit V5 lebih dahulu, terpisah dari V6 | sebelum V6-1 |
| R-04 | Purge master tanpa verifikasi otorisasi | T | `permission.guard.ts:40-42` + `tenant.module.ts:555` tanpa `@Permissions` | guard permission dinamis per resource + test negatif | V6-0.x |
| R-05 | Registry versi schema tidak konsisten dengan history | M | 2 schema registry `V000` padahal V008 diterapkan | hitung versi dari history, sediakan rekonsiliasi | V6-0.x |

## Risiko teknis fase V6

| ID | Risiko | Pemicu konkret | Dampak | Mitigasi |
| --- | --- | --- | --- | --- |
| R-10 | Migration tenant setengah jalan pada sebagian schema | 10 schema, batch migration bisa gagal di tengah | T | orkestrasi per schema dengan status, resumable, laporan progres; jangan satu transaksi raksasa |
| R-11 | Migration V6 menabrak migration V001–V009 | penomoran salah atau berkas lama diedit | T | V6 mulai dari **V010**; berkas V001–V009 read-only; checksum diverifikasi sebelum apply |
| R-12 | Duplikasi tabel workflow | `workflow_definition`/`step`/`instance`/`action_log` sudah ada dari V007 | T | wajib `ALTER TABLE ADD COLUMN`; struktur existing sudah didokumentasikan pada `workflow/legacy-sop-reuse-redesign.md` |
| R-13 | Dua general ledger paralel | menambah `JournalEntry` baru padahal `journal_entry` sudah ada + guard immutability | T | keputusan reuse/extend ditulis pada ADR-011 sebelum model dibuat |
| R-14 | Ledger komisi/kapital bisa di-UPDATE | lupa memasang trigger seperti `forbid_ledger_mutation` | T | trigger wajib pada migration yang sama dengan tabelnya, bukan menyusul |
| R-15 | Double posting komisi | callback pembayaran ganda, run bulanan dijalankan dua kali | T | `uniqueCalculationKey` unique constraint + run idempotent; test duplicate payment |
| R-16 | Attribution dipindah tanpa jejak | admin mengubah attribution manual | T | `ReferralAttribution` immutable + audit; perubahan lewat adjustment + step-up + approval |
| R-17 | Domain takeover | domain dihapus lalu diklaim tenant lain | T | cooling period, verifikasi ulang, audit routing |
| R-18 | Unknown host jatuh ke tenant pertama | resolver memakai `LIMIT 1` tanpa validasi status | T | resolver wajib `ACTIVE + VERIFIED` + tenant `ACTIVE`; unknown host → halaman platform/404 |
| R-19 | Host header poisoning | mempercayai `X-Forwarded-Host` | T | trusted proxy eksplisit; normalisasi IDNA; test spoofed host |
| R-20 | SSRF lewat verifikasi DNS/webhook | resolver DNS menerima host arbitrer | M | allowlist resolver, blokir IP privat, timeout |
| R-21 | Cache resolver menyilangkan tenant | cache key hanya hostname | T | cache key = hostname ternormalisasi **+ mappingVersion**; invalidasi saat mapping berubah |
| R-22 | Workflow terminal command membuat dokumen ganda | retry setelah timeout | T | idempotency key; workflow tidak COMPLETE sebelum transaksi domain commit |
| R-23 | Instance workflow berjalan berubah saat definisi diedit | ini perilaku legacy | M | instance menunjuk `workflowDefinitionVersionId`; test eksplisit |
| R-24 | Policy workflow memakai ekspresi bebas | godaan memakai `eval` untuk kondisi | T | whitelist field+operator seperti evaluator diskon yang sudah ada |
| R-25 | Feature flag melewati otorisasi | flag dipakai sebagai pengganti permission | T | flag hanya mengaktifkan modul; permission tetap wajib; test flag-on tanpa permission harus 403 |
| R-26 | Backfill satu transaksi raksasa | data historis referral/ownership | M | batch + checkpoint + resumable; catat baris ambigu, jangan menebak |
| R-27 | Menebak data historis | attribution/ownership/domain masa lalu tidak diketahui | T | jangan backfill data yang tidak diketahui; tandai `UNKNOWN` dan minta keputusan pemilik |
| R-28 | Refactor massal merusak V5 | godaan merapikan sambil menambah fitur | T | dilarang; refactor hanya pada area yang diperlukan dan harus dilindungi test |
| R-29 | Kontrak API V5 berubah | Orval regenerate mengubah signature | M | endpoint V5 tidak diubah; endpoint V6 memakai path baru |
| R-30 | Proliferasi schema tanpa observabilitas | tenant bertambah, migration makin lama | M | dashboard kesehatan schema, versi per schema, laporan kegagalan |

## Risiko proses dan bisnis

| ID | Risiko | Dampak | Mitigasi |
| --- | --- | --- | --- |
| R-40 | Sengketa komisi referral | T | evidence attribution immutable + calculation trace tersimpan per ledger |
| R-41 | Fraud referral | T | deteksi self/circular/IP/device, hold payout, review queue, clawback |
| R-42 | Kompleksitas legal ownership | M | kontrak configurable + approval + dokumen; kajian hukum di luar perangkat lunak |
| R-43 | Over-configuration workflow | M | template, validasi definisi, simulasi, versioning |
| R-44 | Scope accounting meledak | T | bertahap; reconciliation-first; satu sumber posting sekali |
| R-45 | Klaim "lebih baik dari Accurate" prematur | M | perlakukan sebagai target scope; verifikasi lewat feature matrix, performa, audit, UAT sebelum klaim apa pun |
| R-46 | Kompleksitas SOP legacy | M | characterization test, bukan salin kode; 22 perilaku step sudah dipetakan |
| R-47 | Fase V6 dikerjakan paralel lalu saling merusak | T | satu fase satu vertical slice; regression V5 dijalankan di antara fase |

## Risiko lingkungan

| ID | Risiko | Bukti | Mitigasi |
| --- | --- | --- | --- |
| R-50 | `pg_dump` pada PATH tidak kompatibel | `pg_dump` 9.3.5 vs server 17.2; gagal `authentication method 10 not supported` | runbook menyebut `C:\Program Files\PostgreSQL\17\bin` secara eksplisit |
| R-51 | PostgreSQL 9.3.5 pada port 5432 tersalahgunakan | dua instance PostgreSQL pada satu mesin | `DATABASE_URL` selalu menyebut port 5433; health endpoint melaporkan versi |
| R-52 | 9 schema artefak uji menumpuk | smoke test membuat tenant baru setiap eksekusi | tandai schema uji, sediakan pembersihan **atas persetujuan pemilik**; jangan hapus otomatis |
| R-53 | Rate limit produksi menghalangi test | sudah terjadi saat V5 (Playwright kena 300/menit) | limit dari konfigurasi; naikkan hanya pada development |

## Rollback per fase

| Fase | Cara rollback | Batas |
| --- | --- | --- |
| V6-0 | tidak ada perubahan perilaku; cukup hapus `docs/upgrade-v6/` | aman |
| V6-1 Referral | matikan `V6_REFERRAL_ENABLED`; tabel tetap ada dan kosong | ledger yang sudah terbentuk tidak dihapus, hanya tidak dipakai |
| V6-2 Investor | matikan `V6_MULTI_INVESTOR_ENABLED` | kolom baru nullable, tidak mengganggu V5 |
| V6-3 Website/domain | matikan `V6_TENANT_WEBSITE_ENABLED` + `V6_CUSTOM_DOMAIN_ENABLED`; resolver kembali hanya melayani host platform | domain yang sudah aktif harus dinonaktifkan lebih dahulu |
| V6-4 Workflow | matikan `V6_WORKFLOW_ENGINE_ENABLED`; jalur direct tetap bekerja | instance berjalan harus diselesaikan atau dibatalkan |
| V6-5 Accounting | matikan `V6_ACCOUNTING_EVENT_ENGINE_ENABLED`; posting otomatis berhenti | jurnal yang sudah POSTED tidak dapat dibalik selain lewat reversal |
| V6-6 Advanced finance | per submodul, flag terpisah | idem |

Prinsip yang berlaku untuk seluruh fase: **migration additive tidak di-rollback**;
yang dinonaktifkan adalah jalur kodenya lewat feature flag. Menghapus kolom/tabel
hanya boleh pada rilis CONTRACT terpisah setelah terbukti tidak dipakai.
