# EP-0.5 — Matriks Kesenjangan Domain ePesantren

Status per §3: `DONE` hanya bila model, migrasi, service, API, OpenAPI, Orval,
UI, permission, menu, Help, audit, uji, dan dokumentasi lengkap.

| Modul (§8.3) | Status | Yang ada | Yang kurang |
| --- | --- | --- | --- |
| `EPESANTREN_FOUNDATION` | PARTIAL | Penyewa bervertikal PESANTREN, identitas pendaftaran, situs | Model santri, unit pondok, tahun ajaran |
| `EPESANTREN_PUBLIC_WEBSITE` | PARTIAL | Host penyewa terdaftar dan aktif | Halaman situs penyewa belum berisi |
| `EPESANTREN_CMS` | MISSING | Mesin CMS ada, tanpa penyewa | Kepemilikan penyewa pada `Website` |
| `EPESANTREN_ONBOARDING` | DONE | Pendaftaran lima langkah, provisioning, kredensial, beranda | — |
| `EPESANTREN_SANTRI_PROFILE` | MISSING | — | Seluruhnya |
| `EPESANTREN_ASRAMA` | MISSING | — | Seluruhnya |
| `EPESANTREN_ROOM_PLACEMENT` | MISSING | — | Seluruhnya |
| `EPESANTREN_DINIYAH` | MISSING | — | Seluruhnya |
| `EPESANTREN_TAHFIZ` | MISSING | — | Seluruhnya |
| `EPESANTREN_KITAB`, `HALAQAH` | MISSING | — | Seluruhnya |
| `EPESANTREN_DAILY_ACTIVITY` | MISSING | — | Seluruhnya |
| `EPESANTREN_IBADAH_ATTENDANCE` | MISSING | — | Seluruhnya |
| `EPESANTREN_PERMISSION`, `GATE` | MISSING | — | Seluruhnya |
| `EPESANTREN_DISCIPLINE`, `COACHING`, `COUNSELING` | MISSING | — | Seluruhnya |
| `EPESANTREN_VISITOR`, `PACKAGE_DELIVERY`, `TRANSPORT` | MISSING | — | Seluruhnya |
| `EPESANTREN_PARENT_COMMUNICATION` | MISSING | Notification Hub ada | Adapter dan model wali |
| `EPESANTREN_WALLET`, `SPENDING_LIMIT` | MISSING | Mesin pembayaran ada | Dompet santri |
| `EPESANTREN_KIOSK`, `CARD_RFID` | MISSING | — | Seluruhnya |
| `EPESANTREN_*_ADAPTER` | MISSING | Modul tujuannya ada | Port/adapter belum dibuat |
| `EPESANTREN_AI_USE_CASES` | MISSING | AI Gateway ada | Kasus pakai pesantren |
| `EPESANTREN_REPORTING` | MISSING | — | Seluruhnya |

**39 modul diminta: 1 `DONE`, 3 `PARTIAL`, 35 `MISSING`.**

Angka itu bukan alasan berkecil hati — sebagian besar bersandar pada lapis
bersama yang sudah matang. Ia disampaikan supaya rencana waktu disusun dari
kenyataan.
