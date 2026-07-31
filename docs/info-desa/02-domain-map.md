# D-0 · Peta Domain

Sembilan konteks terbatas (*bounded context*) di dalam `modules/village/`,
beserta apa yang boleh dan tidak boleh saling memanggil.

---

## Peta

```
                        ┌──────────────────────────┐
                        │  D-1 WILAYAH & PROFIL    │
                        │  unit pemerintahan,      │
                        │  dusun/RW/RT, batas,     │
                        │  domain, profil DESA/    │
                        │  KELURAHAN               │
                        └────────────┬─────────────┘
                                     │ dirujuk semua
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
   ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
   │ D-2 KEPENDUDUKAN   │ │ D-3 APARATUR       │ │ D-11 TRANSPARANSI  │
   │ penduduk, keluarga,│ │ pejabat, masa      │ │ PPID, publikasi,   │
   │ mutasi, riwayat    │ │ jabatan, BPD,      │ │ temuan, audit      │
   └─────────┬──────────┘ │ struktur           │ └────────────────────┘
             │            └─────────┬──────────┘
             │ subjek layanan       │ pelaku & penyetuju
             ▼                      ▼
   ┌──────────────────────────────────────────────┐
   │ D-4 LAYANAN WARGA & SURAT                    │
   │ katalog, permohonan, verifikasi, antrean,    │
   │ penerbitan, QR, SLA                          │
   └───────────────┬──────────────────────────────┘
                   │
   ┌───────────────┴────────┬─────────────────────┐
   ▼                        ▼                     ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ D-5          │  │ D-6 PERENCANAAN  │  │ D-7 ASET &       │
│ PARTISIPASI  │─▶│ & KEUANGAN       │─▶│ BANTUAN          │
│ pengaduan,   │  │ RPJM, RKP,       │  │ aset, pengadaan, │
│ aspirasi,    │  │ APBDes, realisasi│  │ program bantuan, │
│ Musrenbang   │  │                  │  │ penerima         │
└──────────────┘  └──────────────────┘  └──────────────────┘
                                                 │
   ┌─────────────────────────────────────────────┘
   ▼
┌──────────────────┐  ┌──────────────────────────────────┐
│ D-8 USAHA        │  │ D-9 KEAMANAN, BENCANA,           │
│ BUMDes, UMKM,    │  │ LINGKUNGAN, PERTANAHAN           │
│ wisata           │  │                                  │
└──────────────────┘  └──────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ D-10 SITUS & PORTAL WARGA — hanya MEMBACA dari seluruhnya│
└──────────────────────────────────────────────────────────┘
```

---

## Aturan ketergantungan

Tiga aturan, dan yang ketiga paling sering dilanggar tanpa disadari:

1. **D-1 dirujuk semua, dan tidak merujuk siapa pun.** Wilayah adalah fondasi.
2. **D-10 hanya membaca.** Situs publik tidak pernah menulis. Portal warga
   menulis lewat D-4 dan D-5, bukan langsung.
3. **Ketergantungan tidak boleh melingkar.** Bantuan (D-7) membaca penduduk
   (D-2); penduduk tidak boleh membaca bantuan. Bila layar penduduk perlu
   menampilkan "penerima PKH", itu dibaca lewat proyeksi milik D-7, bukan
   dengan D-2 memanggil D-7.

Aturan ketiga dijaga oleh uji ketergantungan pada D-12.

---

## Yang menjadi milik siapa

| Konteks | Memiliki | Membaca dari | Tidak boleh menyentuh |
|---|---|---|---|
| D-1 Wilayah | unit pemerintahan, dusun, RW, RT, batas, domain, profil | — | — |
| D-2 Kependudukan | penduduk, keluarga, mutasi, dokumen, riwayat | D-1 | Bantuan, keuangan, layanan |
| D-3 Aparatur | pejabat, jabatan, masa jabatan, BPD, struktur | D-1, D-2 (pejabat adalah penduduk) | — |
| D-4 Layanan | katalog, permohonan, verifikasi, surat, antrean, SLA | D-1, D-2, D-3 | Keuangan |
| D-5 Partisipasi | pengaduan, aspirasi, Musrenbang, survei | D-1, D-2, D-3 | Keuangan langsung |
| D-6 Perencanaan | RPJM, RKP, APBDes, realisasi, buku kas | D-1, D-3, D-5 (usulan Musrenbang) | Penduduk perorangan |
| D-7 Aset & bantuan | aset, pengadaan, program bantuan, penerima | D-1, D-2, D-6 | — |
| D-8 Usaha | BUMDes, UMKM, wisata | D-1, D-2 | — |
| D-9 Keamanan dsb. | linmas, insiden, bencana, lingkungan, tanah | D-1, D-2 | — |
| D-10 Situs | halaman, berita, agenda, sesi kiosk, siaran | **membaca semua** | **menulis apa pun** |
| D-11 Transparansi | PPID, publikasi, temuan | membaca semua | menulis di luar miliknya |

---

## Perbatasan yang perlu dijaga ketat

### D-2 Kependudukan ↔ D-7 Bantuan

Godaannya besar: menyimpan `is_penerima_bantuan` pada tabel penduduk. Jangan.

Status penerima bantuan berubah menurut program, periode, dan hasil verifikasi.
Menyimpannya pada penduduk berarti satu kolom yang jawabannya bergantung pada
"bantuan yang mana" — dan kolom seperti itu selalu berakhir salah.

Yang benar: `beneficiary` milik D-7 menunjuk ke penduduk. Pertanyaan "apakah
warga ini menerima bantuan" dijawab D-7.

### D-2 Kependudukan ↔ eMedik

Spesifikasi §14 menyebutnya tegas: *"Desa tidak boleh membaca rekam medis
individual tanpa legal basis, permission, purpose, dan contract."*

Perbatasan ini bukan soal arsitektur melainkan hukum. Rinciannya pada
[04](04-health-cooperative-pos-contracts.md) dan [06](06-security-privacy.md).

### D-6 Keuangan ↔ akuntansi Core

APBDes bukan pembukuan komersial. Ia punya struktur pendapatan-belanja-pembiayaan
sendiri, bukan neraca laba-rugi. Yang dipakai dari Core adalah **mesin peristiwa
akuntansinya**, bukan bagan akun komersialnya. Rinciannya pada
[05](05-finance-workflow-contracts.md).

### D-10 Situs ↔ semuanya

Satu-satunya konteks yang boleh membaca lintas batas secara luas, dan justru
karena itu ia sama sekali tidak boleh menulis. Situs publik yang dapat menulis
adalah permukaan serangan yang menghadap internet tanpa autentikasi.

---

## Peristiwa domain

Awalan `village.*` sesuai perintah §6:

```
village.resident.registered        village.resident.moved_out
village.family.created             village.service.requested
village.service.verified           village.service.approved
village.service.issued             village.complaint.submitted
village.complaint.resolved         village.musrenbang.proposal_accepted
village.budget.approved            village.budget.realized
village.aid.beneficiary_confirmed  village.aid.distributed
village.asset.registered           village.disaster.declared
```

Diterbitkan lewat `sync_outbox` yang sudah ada — pola outbox, sehingga peristiwa
tidak dapat terbit tanpa perubahan datanya ikut tersimpan.
