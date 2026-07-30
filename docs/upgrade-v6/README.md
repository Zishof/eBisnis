# Upgrade Versi 5 → Versi 6

Fase **V6-0 (audit) SELESAI**. Belum ada satu pun kode Versi 6 yang ditulis.

## Status fase

| Fase | Isi | Status |
| --- | --- | --- |
| **V6-0** | Audit source dan database, baseline, matriks status, rencana upgrade, ADR | **SELESAI** |
| V6-0.x | Prasyarat: guard permission master, rekonsiliasi registry, Orval, higiene SVN | belum |
| V6-1 | Referral vertical slice | belum |
| V6-2 | Multi-investor dan ownership | belum |
| V6-3 | Tenant website dan custom domain | belum |
| V6-4 | Workflow/SOP + PR direct vs workflow | belum |
| V6-5 | Fondasi enterprise accounting | belum |
| V6-6 | Advanced finance | belum |
| V6-7 | Modul ERP tambahan | belum |
| V6-8 | Hardening dan rollout | belum |

## Dokumen

| Berkas | Isi |
| --- | --- |
| [00-current-state-inventory.md](00-current-state-inventory.md) | Kondisi workspace, perangkat, volume source, kondisi SVN, 3 temuan repository |
| [01-v5-regression-status.md](01-v5-regression-status.md) | 26 area V5: 15 DONE, 9 PARTIAL, 1 MISSING, 1 BROKEN + 3 temuan |
| [02-v5-to-v6-gap-matrix.md](02-v5-to-v6-gap-matrix.md) | 69 requirement V6: 58 MISSING, 11 PARTIAL |
| [03-database-migration-inventory.md](03-database-migration-inventory.md) | 23 schema, 1.357 tabel, katalog V001–V009, backup pra-V6 |
| [04-api-route-inventory.md](04-api-route-inventory.md) | 157 operasi dari OpenAPI + guard per endpoint, 38 route V6 yang dibutuhkan |
| [05-ui-route-inventory.md](05-ui-route-inventory.md) | 51 route React, 73 node menu, komponen reusable |
| [06-test-baseline.md](06-test-baseline.md) | 263 test otomatis, semuanya hijau + celah yang belum tertutup |
| [07-risk-register.md](07-risk-register.md) | 5 risiko yang sudah terjadi + 21 risiko teknis + rollback per fase |
| [08-upgrade-plan.md](08-upgrade-plan.md) | Rencana additive expand-and-contract per fase, 8 feature flag |
| [09-svn-change-plan.md](09-svn-change-plan.md) | Rencana commit dan 3 masalah repository yang harus diselesaikan |

## Karakterisasi SOP legacy

| Berkas | Isi |
| --- | --- |
| [workflow/legacy-sop-class-inventory.md](workflow/legacy-sop-class-inventory.md) | 22 class, ~19.700 baris; anti-pattern 60 kolom graph |
| [workflow/legacy-sop-state-map.md](workflow/legacy-sop-state-map.md) | State runtime, alur `prosesLangkah`, pemetaan aksi, SLA, versioning |
| [workflow/legacy-sop-actor-rules.md](workflow/legacy-sop-actor-rules.md) | 11 aturan aktor + 6 perilaku resolusi yang wajib dipertahankan |
| [workflow/legacy-sop-reuse-redesign.md](workflow/legacy-sop-reuse-redesign.md) | Keputusan REUSE/REDESIGN/DROP + pemetaan 22 perilaku step |

## ADR Versi 6

| ADR | Keputusan |
| --- | --- |
| [ADR-007](../architecture/ADR-007-referral-control-plane.md) | Referral di control plane, bukan schema tenant |
| [ADR-008](../architecture/ADR-008-multi-investor-ownership.md) | Kepemilikan sebagai relasi effective-dated |
| [ADR-009](../architecture/ADR-009-host-based-tenant-routing.md) | Routing host lewat registry; hostname bukan schema |
| [ADR-010](../architecture/ADR-010-workflow-orchestrates-shared-service.md) | Workflow mengorkestrasi service yang sama |
| [ADR-011](../architecture/ADR-011-accounting-event-engine.md) | Posting lewat event dan rule berversi |

## Evidence

Seluruh klaim pada dokumen di atas dibuktikan oleh keluaran perintah pada
`evidence/`:

| Berkas | Isi |
| --- | --- |
| `svn-info-before.txt`, `svn-status-before.txt`, `svn-diff-summary-before.txt`, `svn-log-before.txt` | kondisi SVN |
| `environment-inventory.txt` | versi perangkat dan jumlah berkas |
| `database-inventory.txt` | schema dan jumlah tabel |
| `migration-inventory.txt` | registry, history, katalog, job gagal, inkonsistensi |
| `baseline-01-install-db.txt` … `baseline-05-e2e.txt` | keluaran seluruh quality gate |
| `baseline-health.json` | respons `/health` |
| `baseline-api-server.log`, `baseline-web-server.log` | log server saat baseline |

## Yang menunggu keputusan pemilik

Tiga hal tidak dieksekusi pada fase ini karena bersifat outward-facing, tidak
dapat dibatalkan, atau menyentuh pekerjaan yang sedang berjalan:

0. **198 path `node_modules` sudah dijadwalkan `svn add` oleh pihak lain** selama
   fase ini berlangsung (changelist `ignore-on-commit`, konvensi TortoiseSVN).
   Commit sekarang akan memasukkan seluruh pohon dependency. Perintah pembatalan
   yang tidak menghapus berkas dari disk ada pada
   [09-svn-change-plan.md](09-svn-change-plan.md) bagian PERINGATAN.

1. **Rotasi kredensial dan pengeluaran `.env` dari SVN.** `apps/api/.env`
   ter-commit pada r104 beserta kata sandi database, dua JWT secret, dan kata
   sandi super admin. Rincian dan urutan langkah pada
   [09-svn-change-plan.md](09-svn-change-plan.md).
2. **Pembersihan 9 schema tenant artefak uji.** Penghapusan schema tidak dapat
   dibatalkan. Daftar pada
   [03-database-migration-inventory.md](03-database-migration-inventory.md).
