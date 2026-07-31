# K-0 · Rencana Implementasi

Sebelas fase, K-1 sampai K-11. Setiap fase adalah irisan tegak lengkap:
migrasi, model, layanan, API, antarmuka, hak akses, audit, bantuan, pengujian,
dokumen, changelog, commit, push.

---

## Urutan dan ketergantungan

```
K-1 Koperasi, legalitas, langganan
     │
     ├──▶ K-2 Organisasi dan anggota
     │         │
     │         ├──▶ K-3 Simpanan  ──┐
     │         │                    │
     │         └──▶ K-4 Pinjaman ───┼──▶ K-6 SHU
     │                              │
     ├──▶ K-7 Unit usaha + POS ─────┘
     │
     └──▶ K-5 RAT ──────────────────┘  (RAT menyetujui SHU)

K-8 Akuntansi dan laporan   ← setelah K-3, K-4, K-6, K-7 punya peristiwa
K-9 Website dan portal anggota
K-10 Peran, bantuan, data contoh, AI
K-11 Keamanan, E2E, UAT
```

Simpanan (K-3) mendahului pinjaman (K-4) bukan karena lebih mudah, melainkan
karena **keanggotaan baru sah setelah simpanan pokok lunas**, dan pinjaman hanya
boleh diberikan kepada anggota sah. Membalik urutannya akan memaksa pinjaman
dibangun di atas keanggotaan yang belum punya cara diaktifkan.

---

## Fase

### K-1 · Koperasi, legalitas, langganan

| | |
|---|---|
| Migrasi | 7 tabel: `cooperative`, `cooperative_type`, `cooperative_legal_document`, `cooperative_address`, `cooperative_service_area`, `cooperative_policy`, `cooperative_domain` |
| API | `POST /cooperative/profile`, `GET /cooperative/profile`, `PATCH /cooperative/profile`, CRUD legalitas dan kebijakan |
| UI | `/ekoperasi/profil`, `/ekoperasi/legalitas`, `/ekoperasi/kebijakan` |
| Port | `SubscriptionPort` (langganan Rp 500.000/bulan), `FileStoragePort` (unggah akta) |
| Uji | jenis koperasi sah; satu koperasi per tenant; masa berlaku izin; slug domain unik |

Portal `ekoperasi.id` dan alur pendaftaran memakai alur pendaftaran mandiri yang
sudah ada, ditambah langkah profil koperasi. **Tidak** membangun pendaftaran
kedua.

### K-2 · Organisasi, calon anggota, anggota

| | |
|---|---|
| Migrasi | 17 tabel: 7 organisasi + 10 keanggotaan |
| API | `/cooperative/organization/*`, `/cooperative/prospects/*`, `/cooperative/members/*` |
| UI | Kepengurusan, pengajuan calon anggota, daftar anggota, kartu anggota |
| Port | `IdentityPort` (tautan `party`), `NumberingPort` (nomor anggota), `NotificationPort` |
| Uji | **calon anggota tidak menjadi anggota sebelum simpanan pokok lunas**; jabatan tidak tumpang tindih; nomor anggota tidak kembar |

Aturan keanggotaan ditulis sebagai fungsi murni di `cooperative-member-state.ts`
— dapat diuji tanpa basis data, mengikuti pola `pos-sale-state.ts`.

### K-3 · Simpanan dan buku pembantu anggota

| | |
|---|---|
| Migrasi | 5 tabel simpanan + `cooperative_member_subledger` + `cooperative_account_mapping` |
| API | `/cooperative/saving-products/*`, `/cooperative/savings/*` |
| UI | Produk simpanan, rekening, setoran, penarikan, mutasi |
| Port | `AccountingEventPort` |
| Uji | **pokok dan wajib tidak dapat ditarik**; saldo = jumlah mutasinya; setoran ganda berkunci sama tidak tercatat dua kali; pelunasan pokok mengaktifkan keanggotaan |

Peristiwa `COOPERATIVE_PRINCIPAL_SAVING_RECEIVED` yang mengaktifkan keanggotaan
— penghubung K-2 dan K-3.

### K-4 · Pinjaman, angsuran, penagihan

Fase terbesar. Dipecah tiga agar tiap bagian dapat diuji sendiri:

**K-4a Produk dan pengajuan** — 6 tabel, alur `Ajukan → Verifikasi → Survei →
Analisis → Setujui/Tolak`.

**K-4b Perjanjian sampai angsuran** — 8 tabel, pencairan, jadwal angsuran,
pembayaran, denda, pelunasan dipercepat.

**K-4c Penagihan dan risiko** — 6 tabel, umur piutang, tunggakan, janji bayar,
restrukturisasi, penyisihan, PAR.

| Uji K-4 | |
|---|---|
| | anggota dengan pinjaman aktif tidak dapat mengajukan lagi (kecuali produk mengizinkan) |
| | pengajuan melebihi plafon ditolak |
| | calon anggota tidak dapat mengajukan |
| | simpanan wajib kurang dari syarat menolak pengajuan |
| | analis tidak dapat menyetujui pinjaman yang dianalisisnya |
| | penyetuju tidak dapat mencairkan yang disetujuinya |
| | **jadwal angsuran dibekukan saat pencairan** |
| | restrukturisasi membentuk jadwal baru, tidak menyunting yang lama |
| | angsuran memisahkan pokok dan jasa |
| | pembayaran ganda berkunci sama tidak tercatat dua kali |

Akad syariah ditangani sebagai jenis produk berbeda dengan kode peristiwa
sendiri — bukan pinjaman konvensional dengan nama lain.

### K-5 · RAT, kuorum, voting, keputusan

| | |
|---|---|
| Migrasi | 9 tabel rapat |
| API | `/cooperative/meetings/*` |
| UI | Undangan, daftar hadir, agenda, pemungutan suara, notulen |
| Uji | **satu anggota satu suara**; kuorum dihitung dari kehadiran tercatat; keputusan tanpa kuorum ditandai tidak sah; kuasa dibatasi jumlahnya; anggota tidak dapat memilih dua kali |

### K-6 · SHU dan patronage

| | |
|---|---|
| Migrasi | 7 tabel SHU |
| API | `/cooperative/shu/*` |
| UI | Kebijakan, perhitungan, distribusi, statement anggota |
| Uji | **perhitungan dapat diulang** — periode dan kebijakan sama menghasilkan angka sama; jumlah komponen = surplus; SHU tanpa persetujuan RAT ditolak; anggota yang keluar di tengah periode memperoleh bagian pro rata |

Sifat "dapat diulang" dijaga dengan mencuplik angka masukan, bukan membacanya
ulang dari data yang sementara itu sudah berubah.

### K-7 · Unit usaha dan adapter POS

Sesuai [03-pos-integration-contract.md](03-pos-integration-contract.md).
K-7d (pembayaran saldo anggota) menunggu permintaan integrasi 002 dan **tidak
menahan** fase berikutnya.

### K-8 · Akuntansi, pajak, laporan

| | |
|---|---|
| API | `/cooperative/reports/*` |
| Uji | **jumlah buku pembantu = saldo buku besar**; neraca seimbang; laporan dapat ditelusuri ke dokumen sumber |

Dua puluh satu laporan pada spesifikasi §18. Ekspor Excel dan cetak PDF
`BLOCKED` — prasyarat V8-5/6 dan V8-7 belum dibangun sesi Core. Laporan tetap
dapat ditampilkan di layar.

### K-9 · Website dan portal anggota

Memakai CMS dan storefront yang ada. Portal anggota: saldo, pinjaman, angsuran,
SHU, RAT, voting, pengaduan.

**Cakupan data paling ketat di sini** — anggota hanya melihat dirinya sendiri.

### K-10 · Peran, bantuan, data contoh, AI

Katalog modular sesuai panduan §9. Data contoh bergolongan `EXAMPLE` mengikuti
kerangka yang sudah dibereskan sesi Core, sehingga "Hapus Data Contoh" tidak
menghapus produk simpanan dan bagan akun.

Bantuan `BLOCKED` — prasyarat V8-1/V8-2 belum ada.

### K-11 · Keamanan, E2E, UAT

Sebelas pengujian pada [05-security-and-sod.md](05-security-and-sod.md), ditambah
E2E: daftar → setor pokok → aktif → simpan → pinjam → angsur → RAT → SHU.

---

## Perkiraan besaran

| Fase | Tabel | Endpoint | Uji minimum |
|---|---|---|---|
| K-1 | 7 | 12 | 15 |
| K-2 | 17 | 24 | 30 |
| K-3 | 7 | 16 | 28 |
| K-4 | 20 | 34 | 55 |
| K-5 | 9 | 18 | 25 |
| K-6 | 7 | 14 | 24 |
| K-7 | 6 | 12 | 20 |
| K-8 | 2 | 21 | 20 |
| K-9 | 3 | 16 | 15 |
| K-10 | 1 | 8 | 20 |
| K-11 | 1 | — | 25 |
| **Jumlah** | **± 80** | **± 175** | **± 277** |

---

## Aturan yang dipegang di setiap fase

1. **Aturan bisnis sebagai fungsi murni lebih dahulu**, layanan basis data
   sesudahnya. Pola ini terbukti pada POS: aturan dapat diuji tanpa menyiapkan
   basis data sama sekali.
2. **Setiap fase berakhir dengan gerbang mutu hijau** — typecheck, lint, uji,
   build. Fase yang diakhiri dengan uji merah bukan fase yang selesai.
3. **Setiap konsekuensi keuangan menerbitkan peristiwa akuntansi.** Tidak ada
   layanan koperasi yang menulis `journal_entry`.
4. **Uji yang membuktikan penolakan sama pentingnya dengan yang membuktikan
   keberhasilan.** Yang harus gagal harus benar-benar gagal.
5. **Bila Core perlu berubah, buat permintaan integrasi dan lanjutkan bagian
   yang tidak bergantung padanya.** Tidak ada fase yang berhenti total menunggu
   Core.
