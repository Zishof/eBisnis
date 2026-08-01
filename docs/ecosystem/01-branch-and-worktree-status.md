# ECO-0 — Status cabang dan worktree

Diukur terhadap `origin/main` pada `98cd52c`.

## Worktree aktif

| Worktree | Cabang | Dipakai untuk |
| --- | --- | --- |
| `eBisnisGithub` | `feat/v13-education-audit` | Enterprise Education |
| `eBisnisGithub-core` | `feat/deploy-koperasi-subdomain` | Deployment koperasi |
| `eBisnisGithub-ekoperasi` | `main` | eKoperasi |
| `eBisnisGithub-emedik` | `feature/v12-emedik` | eMedik |
| `eBisnisGithub-info-desa` | `feature/v12-info-desa` | info-desa |
| `eBisnisGithub-pos` | `feat/kelola-aturan-diskon` | POS |
| **`eBisnisGithub-ecosystem`** | **`feature/collaborative-multi-portal-platform`** | **integrator (sesi ini)** |

§4 memerintahkan sesi integrator tidak berjalan pada worktree vertical mana pun.
Dipatuhi: worktree integrator dibuat baru dan tidak menyentuh checkout lain.

Catatan: worktree utama sedang dipakai sesi lain pada `feat/v13-education-audit`.
Ia tidak disentuh sama sekali.

## Jarak cabang vertical dari main

| Cabang | Commit di depan main | Berkas berubah |
| --- | ---: | ---: |
| `feature/v12-emedik` | 40 | 290 |
| `feature/v12-info-desa` | 24 | 226 |
| `feat/v13-education-audit` | 7 | 39 |
| `feat/deploy-koperasi-subdomain` | 1 | 7 |
| `feat/kelola-aturan-diskon` (POS, PR #66 terbuka) | 2 | 6 |

eMedik dan info-desa adalah dua badan pekerjaan besar yang belum menyentuh
`main`. Integrator **tidak** menggabungkan keduanya (§245); yang dilakukan
adalah memetakan titik sentuh bersamanya.

## Cabang yang tergabung selama sesi ini

`fix/refresh-token-serentak` (#61), `feat/pos-flutter-fondasi` (#59),
`fix/rilis-pos-windows` (#62), `feat/pintasan-ais-tahap-1-2` (#64),
`feat/diskon-tersambung-kasir` (#65).

`feat/kelola-aturan-diskon` (#66) masih terbuka dan sengaja dibiarkan.
