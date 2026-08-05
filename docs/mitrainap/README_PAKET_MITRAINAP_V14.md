# PAKET DOKUMEN MITRAINAP.ID — EBISNIS VERSI 14

Paket ini menambahkan `mitrainap.id` sebagai portal dan vertical Hospitality baru dalam satu ekosistem eBisnis.

## Isi Paket

1. `BRD_eBisnis_ID_Versi_14_MitraInap_Hospitality_Lengkap.md`  
   BRD utama: arsitektur, bisnis proses hospitality end-to-end, website, booking engine, PMS/CRS, channel, revenue, front office, housekeeping, maintenance, folio, night audit, POS, MICE, long stay, ERP integration, security, API, test, fase, dan DoD.

2. `STRUKTUR_MENU_ROLE_PERMISSION_MITRAINAP_V14.md`  
   Struktur menu lengkap, role, permission, data scope, field mask, approval threshold, segregation of duties, demo roles, dan authorization test matrix.

3. `SPESIFIKASI_UI_UX_RESPONSIVE_MITRAINAP_V14.md`  
   Kontrak UI/UX untuk public portal, website tenant, booking engine, app shell, Today Command Center, Tape Chart, front office, housekeeping mobile, maintenance, folio, night audit, POS, revenue, channel, MICE, long stay, responsive behavior, accessibility, dan visual regression.

4. `PERINTAH_MASTER_CLAUDE_CODE_CODEX_EKSEKUSI_MITRAINAP_ID_HOSPITALITY_V14.md`  
   Perintah master untuk sesi Claude Code/Codex khusus MitraInap, lengkap dengan worktree/branch, audit, namespace, anti-bentrok, fase MI-0 sampai MI-24, test, Git, reporting, stop condition, dan Definition of Done.

## Keputusan Kunci

```text
Portal utama       mitrainap.id
Application entry  app.mitrainap.id
Demo               demo.mitrainap.id
Tenant site        {PUBLIC_TENANT_SLUG}.mitrainap.id
Portal code        MITRAINAP
Vertical code      HOSPITALITY
Worktree           C:\opt\eBisnisGithub-mitrainap
Branch             feature/v14-mitrainap-hospitality
API                /api/v1/hospitality/**
Permission         HOSPITALITY.*
Event              hospitality.*
```

Username tenant tetap global, unik case-insensitive, dan immutable di seluruh eBisnis. Public subdomain menggunakan mapping DNS-safe yang deterministic dan tercatat pada domain registry; schema tidak pernah ditentukan langsung dari hostname.

Harga MitraInap belum diisi dengan angka yang dikarang. Sistem menggunakan price catalog/contract/tenant override yang versioned. Sampai keputusan komersial ditetapkan, status harga adalah `PRICE_CONFIGURATION_REQUIRED` dan kanal publik menggunakan CTA konsultasi/penawaran.

## Memulai Sesi Baru

1. Letakkan keempat dokumen di root/docs input repository yang dapat dibaca agent.
2. Buat worktree dan branch sesuai perintah master.
3. Tempel bagian **Perintah Pertama untuk Sesi Claude Code / Codex Baru**.
4. Mulai dari MI-0 audit. Jangan langsung membuat model atau UI besar tanpa evidence kondisi existing.
5. Setiap fase dikerjakan sebagai vertical slice dan harus mempunyai test, commit, push, dan CI evidence.

## Catatan Integrasi

MitraInap tidak membuat ulang shared identity, tenant, billing, CMS, POS, inventory, procurement, finance, accounting, HR, workflow, notification, AI, observability, audit, Help, Excel, PDF, atau report engine. Kebutuhan shared/high-conflict dicatat melalui `docs/integration-requests/hospitality/**` dan diselesaikan oleh sesi Core/Integrator.
