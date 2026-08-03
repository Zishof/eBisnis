# 23 · Metode Kerja Fase Layar

Urutan yang dipakai W-1 sampai W-5, dan sebab tiap langkahnya ada. Tiap langkah
di bawah lahir dari cacat yang benar-benar terjadi — bukan dari kehati-hatian
teoretis.

---

## Urutan satu fase layar

### 1. Survei menu dan jalan API

```bash
grep -nE "code: 'HEALTH_[A-Z_]*'" -A 6 apps/api/src/modules/emedik/health-catalog.ts
grep -nE "@Get\(|@Post\(" apps/api/src/modules/emedik/health-<domain>.controller.ts
```

Catat **kode menu, utas, dan aksinya**. Utas menu yang dipakai rute web harus
sama persis dengan yang ada pada basis data — lihat langkah 6.

### 2. SELIDIKI BENTUK JAWABAN SEBELUM MENULIS SATU BARIS LAYAR

Ini langkah yang paling sering ingin dilewati, dan yang paling mahal bila
dilewati.

Buat naskah sementara `apps/api/scripts/.tmp-probe-<fase>.mjs` yang:

1. membuat pengguna sungguhan dengan hak yang diperlukan,
2. login lewat `POST /auth/login`,
3. memanggil setiap jalan yang akan dipakai layar,
4. mencetak `Object.keys()` jawabannya beserta satu baris contoh.

Contoh yang dapat disalin: lihat riwayat Git untuk `.tmp-probe-w5.mjs`
(commit `09d8c8b`), atau tiru `scripts/prove-web-contract.mjs`.

**Yang ditemukan cara ini pada sesi lalu:**

| Fase | Tebakan | Kenyataan |
|---|---|---|
| W-1 | `percentage`, `shortfall` | `coverage`, `gap`, `message` |
| W-1 | `verdict.reason` berisi kalimat | ia berisi **kode**; kalimatnya pada `verdict.message` |
| W-3 | satu konvensi | daftar `snake_case`, satu baris `camelCase` |
| W-4 | tabel berawalan `health_` | `fee_policy`, `fee_settlement`, `fee_contract` |
| W-5 | `protocol`, `status` | `source_protocol`, `parse_status` |
| W-5 | `deviceCode`, `count` | `device_code`, `occurrence_count` |

Hapus naskah penyelidik sebelum commit.

### 3. Tulis tipe dan klien pada `health-api.ts`

Salin medan **dari jawaban peladen**, bukan dari nama yang masuk akal.

Tulis komentar yang menyebutkan apa yang mengejutkan — konvensi campur, medan
yang tidak ada, atau nama yang berbeda dari dugaan. Komentar itu mencegah orang
berikutnya menebak hal yang sama.

### 4. Tulis layarnya

Yang membedakan layar yang berguna dari yang sekadar menampilkan data:

- **Hitung gabungan keadaan yang berbahaya.** Contoh dari W-4: kebijakan jasa
  yang *aktif* tetapi *belum disetujui produksi* menghitung uang sungguhan
  memakai persentase yang belum disepakati siapa pun — dan tidak ada galat.
- **Jangan meringkas beberapa keadaan menjadi satu lencana status.** Kontrak
  yang disetujui tanpa telaah hukum tampak sama dengan yang lengkap.
- **Jangan mengurutkan ulang daftar yang sudah diurutkan peladen.** Antrean
  kunjungan rumah, papan insiden, dan antrean pemetaan kode diurut menurut
  kemendesakan; mengurutnya menurut nama membalikkan seluruh maksudnya.
- **Sebutkan sebab, bukan sekadar keadaan.** "Terhalang" tidak berguna;
  "kredensial belum ada" membuat petugas berhenti mencoba.
- **Tombol yang tidak dapat dipakai dimatikan beserta jalan keluarnya**, bukan
  dibiarkan hidup lalu gagal.
- **Yang belum diukur ditampilkan, bukan disembunyikan.** Papan yang seluruhnya
  hijau karena separuh indikatornya tidak diukur adalah keadaan paling
  menyesatkan yang dapat ditampilkan sebuah dasbor.

### 5. Uji komponen — dan ketahui batasnya

Berkas `*-pages.spec.tsx` pada `apps/web/src/verticals/health/`.

**Perlengkapan datanya WAJIB disalin dari jawaban peladen sungguhan** yang
diperoleh di langkah 2.

> **Uji komponen tidak dapat membuktikan kontrak dengan peladen, dan tidak akan
> pernah dapat.** Ia menguji komponen terhadap data yang bentuknya ditentukan
> penulisnya sendiri.

Ini bukan kekhawatiran teoretis. Pada W-1, enam uji `CoveragePage` **lulus**
sementara halamannya melempar `TypeError` dan kosong sama sekali di peramban —
sebab perlengkapan yang keliru dan kode yang keliru saling menyetujui.

Yang berguna diuji: **ketiadaan**. Tidak ada tajuk kolom yang dapat diklik,
tidak ada tombol hapus jejak akses, tidak ada tombol untuk imunisasi yang belum
boleh diberikan. Ketiadaan tidak terlihat dengan membuka halaman; ia hanya dapat
diperiksa dengan menanyakannya.

**Jebakan yang berulang:** menegaskan terlalu dini. Ringkasan di bagian atas
halaman dirender tanpa menunggu apa pun dan menampilkan `0`. Tunggu **baris
datanya**, bukan judul kolomnya.

### 6. Perluas naskah bukti kontrak

`apps/api/scripts/prove-web-contract.mjs`. Tambahkan tiap jalan baru ke larik
`kontrak`.

Naskah ini membaca medan wajib **dari `health-api.ts` itu sendiri** — bukan dari
salinan di dalam naskahnya. Naskah yang membandingkan salinan dengan salinan
tidak membuktikan apa pun.

Ia juga:

- **membuat sendiri baris yang diperlukannya** lewat jalan API sungguhan, sebab
  bukti yang melewatkan jalan tanpa data akan berkata seluruh kontrak cocok
  sekalipun jalan paling rawan tidak pernah dilihat;
- **melaporkan jalan yang tetap kosong sebagai belum terbukti**, bukan
  menghitungnya lulus;
- **memeriksa bahwa setiap utas pada `health-catalog.ts` ada sebagai menu pada
  basis data.**

Penjaga terakhir itu ditambahkan pada W-5 dan **langsung menemukan dua
ketidakcocokan**, salah satunya bertahan empat fase.

### 7. Migrasi kejujuran menu

Migrasi `H0NN__health__menu_truth_<fase>.sql` yang menyetel
`is_coming_soon = false` untuk utas yang baru berlayar.

Salin dari `H065__health__menu_truth_w5.sql` dan tambahkan utas baru ke
larik `berlayar`.

**Daftarnya adalah daftar yang PUNYA layar, bukan yang tidak.** Satu daftar,
satu sumber kebenaran; daftar "yang belum" tidak pernah perlu ditulis, dan
karena itu tidak pernah dapat menjadi usang tanpa ketahuan.

Migrasi ini **gagal berisik** bila satu utas pun tidak cocok dengan menu mana
pun — dan penjaga itu sudah membuktikan dirinya: ia menemukan `gateway-alat`
yang seharusnya `gateway`, dan menghanguskan H064.

### 8. Verifikasi penuh

```bash
cd apps/web && npx tsc --noEmit -p tsconfig.json
cd apps/web && npx eslint "src/**/*.ts*" --max-warnings 0
cd apps/web && npx vitest run
cd apps/web && npx vite build
cd apps/api && npx jest
cd apps/api && npm run lint
cd apps/api && npm run route:audit
cd apps/api && node scripts/prove-web-contract.mjs
```

**Naskah bukti dijalankan DUA KALI.** Bukti yang mengubah keadaan yang diukurnya
sendiri akan lulus sekali dan gagal pada pengulangan.

### 9. Dokumentasi, commit, push, worktree bersih

- `docs/changelog/health.md` — entri fase baru **di atas** yang sebelumnya
- `docs/emedik/06-implementation-plan.md` — tandai fasenya **SELESAI**
- `docs/emedik/07-test-baseline.md` — perbarui angka dan **catat pelajarannya**

Pesan commit menjelaskan **mengapa**, bukan hanya apa. Pesan yang menyebutkan
cacat yang ditemukan dan sebabnya jauh lebih berguna daripada daftar berkas.

Hapus naskah sementara. Pastikan `git status --short` kosong.

---

## Tiga cacat yang berulang

Ketiganya muncul lebih dari sekali pada sesi lalu. Bila hanya tiga hal yang
diingat dari dokumen ini, jadikan ketiganya.

### 1. Nama yang ditulis dari dugaan

Muncul **enam kali** (lihat tabel di langkah 2). Ia tidak pernah menghasilkan
galat kompilasi — ia menghasilkan halaman kosong, atau lebih buruk, angka yang
salah tanpa satu pun tanda.

**Penawarnya:** panggil peladennya dulu.

### 2. Uji yang sepakat dengan kode yang keliru

Perlengkapan uji yang ditulis penulis kodenya sendiri akan mencerminkan
andaiannya, termasuk andaian yang keliru.

**Penawarnya:** perlengkapan disalin dari jawaban sungguhan, dan naskah bukti
kontrak yang membaca tipe dari berkasnya.

### 3. Uji yang membandingkan kode dengan dirinya sendiri

`health-catalog.ts` punya 73 uji. Tidak satu pun menangkap bahwa dua utas
menunya berbeda dari basis data — sebab seluruh 73 uji itu membandingkan katalog
dengan dirinya sendiri.

> Uji semacam itu membuktikan **konsistensi**, bukan **kebenaran**. Ia lulus
> dengan sempurna pada daftar yang seluruh isinya keliru.

**Penawarnya:** bandingkan dengan sumber di luar berkas itu.

---

## Pola yang muncul enam kali pada fase API

Dicatat di sini karena ia akan muncul lagi:

> **Sebagian pemisahan wewenang adalah hubungan antara SATU ORANG dan SATU
> BARIS, bukan antara dua hak akses.**

Contohnya: tidak seorang pun menelaah akses daruratnya sendiri. Setiap penelaah
memegang hak yang sama, jadi tidak ada dua hak yang dapat dipertentangkan.
Mendaftarkannya sebagai pasangan hak yang bertentangan justru **melumpuhkan**
telaahnya — satu-satunya cara memenuhinya adalah mencabut hak telaah dari
seluruh dokter.

Pemisahan semacam itu ditegakkan **trigger pada basis data**, dan alasannya
ditulis pada migrasinya.

## Pola kedua: penjaga yang mengunci pintu menuju penjaga itu sendiri

Muncul dua kali pada fase API (H-9 dan H-9J) dan sekali pada Core (005).

Contoh H-9J: constraint memeriksa **keadaan** padahal aturannya tentang
**perpindahan keadaan**, sehingga mustahil mencatat uji keselamatan yang gagal
pada alat yang sedang melayani. Diperbaiki dengan mengganti CHECK menjadi
trigger perpindahan.

Bila sebuah aturan membuat langkah yang sah menjadi mustahil, curigai
aturannya — bukan orang yang mencoba melakukannya.
