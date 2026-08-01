# Changelog — Platform Ekosistem Multi-Portal

Cabang: `feature/collaborative-multi-portal-platform`

Digabungkan ke `CHANGELOG.md` akar pada integration gate (§63).

## ECO-0 — Audit (belum dirilis)

### Ditambahkan

- `docs/ecosystem/` — 13 dokumen audit keadaan saat ini: portal, layanan inti,
  produk/modul, harga, identitas/SSO, schema registry, kontrak lintas vertical,
  peta berkas rawan konflik, rencana implementasi, baseline uji, dan daftar
  risiko.
- Worktree integrator `C:\opt\eBisnisGithub-ecosystem` pada cabang tersendiri,
  sesuai §4.

### Temuan yang mengubah rencana

- **Pola port lintas vertical sudah ada dan sudah dipakai.** POS menerima
  pembayaran dari saldo anggota koperasi dan klaim kesehatan lewat registry
  penangan, tanpa membaca tabel vertical itu. ECO-9 memperluas, bukan membangun
  ulang.
- **Schema registry memodelkan satu schema per tenant**, sedangkan §11 menuntut
  satu per modul. Perpindahannya wajib aditif dan berdampingan.
- **Tidak ada OIDC.** SSO lintas lima domain menuntut lapisan identity provider
  baru di depan model identitas yang sudah ada.
- **Tidak ada usage metering.** Tiga dari lima harga default tidak dapat
  ditagihkan sebelum metering ada, sehingga metering diusulkan mendahului seed
  harga.
- **14 dari 17 dokumen rujukan §2 tidak tersedia.** Audit tetap selesai karena
  sumber kebenaran keadaan implementasi adalah source; rancangan vertical
  menunggu.

### Baseline

2432 uji lulus (API 2092, web 193, Flutter 147), lint bersih, E2E 73 lulus /
0 flaky pada `main`.
