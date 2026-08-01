# D-0 · Garis Dasar Pengujian

Titik acuan sebelum satu baris kode village ditulis. Setiap tahap berikutnya
harus menambah, bukan mengurangi.

**Tanggal:** 31 Juli 2026 · **Titik tolak:** `origin/main` @ `4f7ab88`

---

## Cakupan pengujian village saat ini

**Nol.** Tidak ada berkas `*.spec.ts` mana pun yang menyebut `village`, `desa`,
`resident`, atau `kelurahan`. Vertikal ini dimulai dari kosong.

## Garis dasar yang diwarisi

Dijalankan **di dalam worktree village**, pada `origin/main` @ `4f7ab88` — yang
belum memuat pekerjaan POS pada `feature/pos-web-priority`:

| Perintah | Hasil |
|---|---|
| `tsc --noEmit` (API) | bersih |
| `tsc --noEmit` (web) | bersih |
| `eslint src --max-warnings=0` (API) | bersih |
| `jest` (API) | **45 suite, 1048 tes lulus** — 7,5 s |
| `vitest` (web) | **4 berkas, 35 tes lulus** — 4,0 s |

Cabang ini belum menyentuh satu baris kode pun; seluruh angka di atas adalah
warisan `main` yang terverifikasi utuh.

### Catatan penyiapan worktree

Worktree baru memerlukan dua langkah sebelum pengujian dapat berjalan, dan
keduanya mudah terlewat:

1. **`pnpm install --frozen-lockfile`** — memakan sekitar 11 menit.
2. **`pnpm db:generate`** — klien Prisma dihasilkan ke `node_modules`, sehingga
   setiap worktree memerlukannya sendiri.

Tanpa langkah kedua, 11 dari 45 suite gagal dengan
`Property 'tenantSchemaRegistry' does not exist on type 'PrismaService'` —
pesan yang mengesankan cacat kode padahal hanya klien yang belum dihasilkan.
Dicatat di sini agar sesi eMedik dan eKoperasi tidak kehilangan waktu pada
gejala yang sama.

Satu jebakan lagi: `npx prisma generate` mengunduh Prisma CLI **7.x** dan gagal
dengan `Validation Error Count: 1`. Yang benar `pnpm db:generate`, yang memakai
versi 6.19.3 yang dipatok proyek.

`apps/api/.env` tidak ada pada worktree baru (memang tidak pernah dikomit).
Belum diperlukan untuk pengujian unit; akan diperlukan pada D-1 ketika migrasi
dijalankan terhadap basis data.

---

## Sasaran per tahap

Jumlah minimum pengujian baru, beserta apa yang wajib diuji. Angkanya bukan
target yang dikejar demi angka — tiap baris "yang wajib diuji" adalah keadaan
yang bila salah akan merugikan warga atau desa.

| Tahap | Min. | Yang wajib diuji |
|---|---|---|
| D-1 | 14 | profil `DESA` vs `KELURAHAN` menghasilkan wilayah berbeda; dusun tidak dibuat untuk kelurahan; kode wilayah nasional divalidasi; domain tidak dapat dipakai dua desa |
| D-2 | 22 | NIK unik per penyewa; NIK kembar ditandai bukan ditolak; setiap perubahan menghasilkan riwayat; **cakupan RT diuji pada endpoint**; pindah keluar tidak menghapus data; anggota keluarga tidak dapat lintas kartu keluarga tanpa mutasi |
| D-3 | 16 | `BPD` tidak ada pada kelurahan; berakhirnya masa jabatan mencabut akses; delegasi wewenang berbatas waktu; struktur organisasi tidak melingkar |
| D-4 | 28 | nomor surat tidak kembar di bawah permintaan bersamaan; cuplikan alur menahan perubahan katalog; pemohon tidak memproses permohonannya sendiri; SLA dihitung sejak berkas lengkap; penolakan wajib beralasan; QR verifikasi tidak membocorkan data pribadi |
| D-5 | 14 | pengaduan anonim benar-benar tanpa identitas; usulan Musrenbang tertaut ke RKPDes; pengaduan tidak dapat dihapus, hanya ditutup |
| D-6 | 24 | **belanja melampaui pagu ditolak**; `COMMITTED` mengurangi pagu tersedia; kelurahan tidak dapat memanggil endpoint APBDes; versi anggaran tidak menimpa realisasi; setiap kode `VILLAGE_*` punya aturan posting |
| D-7 | 20 | pengusul ≠ penyetuju penerima bantuan; **AI tidak dapat menetapkan penerima**; pemeriksaan ganda lintas program; `eligibility_rule` tidak pernah mengeksekusi kode |
| D-8 | 10 | BUMDes `DESA_ONLY`; adapter yang belum ada mitranya mengembalikan "belum tersedia", bukan data karangan |
| D-9 | 12 | surat keterangan tanah memuat pernyataan bukan bukti kepemilikan |
| D-10 | 16 | situs publik tidak punya jalur tulis; portal warga hanya diri dan keluarga; tidak ada pencarian warga; sesi kiosk berakhir dan menghapus jejak |
| D-11 | 14 | agregat di bawah ambang disembunyikan, bukan ditampilkan kecil; PPID mencatat setiap permintaan |
| D-12 | 20 | data contoh berbeda menurut profil; **uji ketergantungan lintas vertikal**; E2E warga mengajukan surat sampai terbit |

**Minimum sepanjang D-1 sampai D-12: 210 pengujian baru.**

---

## Tiga jenis pengujian yang tidak boleh dilewat

### 1. Kebocoran profil — pada endpoint, bukan pada menu

Perintah §8 mewajibkannya. Bentuk yang benar:

```ts
it('penyewa kelurahan tidak dapat memanggil endpoint APBDes', async () => {
  // Menu disembunyikan itu mudah dan tidak membuktikan apa-apa.
  // Yang membuktikan: URL ditebak, tetap ditolak.
  const res = await api.post('/village/apbdes', body, { as: kelurahanAdmin });
  expect(res.status).toBe(403);
});
```

Bukan:

```ts
it('menu APBDes tidak tampil pada kelurahan', () => { ... });   // tidak cukup
```

Keduanya boleh ada. Yang pertama wajib.

### 2. Cakupan data — pada kueri, bukan pada hasil

Ketua RT yang memanggil `/village/residents` harus memperoleh warganya saja,
karena **kuerinya** menyaring — bukan karena antarmuka menyembunyikan sisanya.
Diuji dengan memanggil endpoint langsung dan menghitung barisnya.

### 3. Uji ketergantungan lintas vertikal

Memindai `modules/village/` untuk:

- impor dari `modules/health/`, `modules/cooperative/`;
- SQL yang menyentuh tabel di luar awalan village dan daftar tabel bersama yang
  diizinkan.

Aturan yang hanya tertulis di dokumen akan dilanggar suatu hari oleh orang yang
belum pernah membacanya. Uji ini yang menahannya.

---

## Yang belum dapat diuji

| | Alasan | Kapan |
|---|---|---|
| Help dalam aplikasi | V8-1/V8-2 tidak pernah dibangun | Terhalang |
| Ekspor Excel | V8-5/6 tidak pernah dibangun | Terhalang |
| Cetak PDF surat | V8-7 tidak pernah dibangun | Terhalang; sementara memakai HTML siap cetak |
| Integrasi eMedik | Vertikalnya belum ada | Diuji lewat adapter tiruan; integrasi sungguhan menyusul |
| Integrasi eKoperasi | Sama | Sama |
| Integrasi POS | Ada di cabang lain, belum di `main` | Sama |
| Siaran WhatsApp/surel | Tidak ada kredensial | Terhalang |

Tujuh butir. Disebutkan sekarang supaya tidak terlihat seperti kelalaian
kemudian — dan supaya, bila salah satunya kelak terbuka, jelas apa yang harus
ikut diuji.
