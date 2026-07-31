# V10-5 — Jejak Pemakaian, Jejak Perubahan, dan Kapasitas Pelaku

Status: **SELESAI**
Cakupan: MenuLog/UiActionLog (`ui_activity_log`), dashboard TableAudit atas
`audit_row_change`, konteks permintaan, dan kapasitas pelaku pada jejak audit.

---

## 1. Audit lebih dulu

| Kemampuan | Keadaan sebelum V10-5 |
|---|---|
| Jejak perubahan baris (siapa mengubah apa, nilai lama dan baru) | **Sudah ada sejak V003** — 15.371 baris pada basis pengembangan |
| Peristiwa audit dengan pelaku, sesi, IP, modul, aksi | **Sudah ada** — `audit_event` |
| Kolom `actor_role_codes` | **Ada tetapi kosong pada seluruh 258 baris** |
| Cara membaca jejak perubahan | **Belum ada** |
| Jejak pemakaian antarmuka | **Belum ada** |

Temuan yang paling menentukan arah: `audit_row_change` sudah lengkap dan berisi
belasan ribu baris, tetapi **tidak ada satu pun cara membacanya**. Jejak yang
lengkap tanpa cara membaca sama tidak bergunanya dengan jejak yang tidak ada.

---

## 2. Laporan peramban dan kesaksian server tidak dicampur

Isi `ui_activity_log` **dilaporkan peramban**. Ketika peramban berkata "saya
membuka menu Pembelian", server tidak punya cara memastikannya: tidak ada
permintaan yang wajib menyertainya, dan siapa pun yang memegang token dapat
mengirim laporan apa saja.

Karena itu ia **tidak boleh** bercampur dengan `audit_event`. Tabel itu memuat
peristiwa yang benar-benar terjadi pada server dan dipakai sebagai bukti. Satu
baris yang dapat dikarang membuat seluruh tabel tidak lagi dapat dijadikan
bukti — dan yang hilang bukan satu baris itu, melainkan kepercayaan pada
seluruh isinya.

| | `ui_activity_log` | `audit_event` / `audit_row_change` |
|---|---|---|
| Sumber | Peramban | Server / trigger basis data |
| Dapat diverifikasi | Tidak | Ya |
| Dapat dilewati kode aplikasi | — | Tidak (trigger) |
| Guna | Analitik pemakaian | Bukti perbuatan |

Dibuktikan pada bagian 4 skrip bukti: perubahan yang dilakukan **langsung lewat
SQL**, tanpa melewati satu baris pun kode aplikasi, tetap tercatat. Itulah
bedanya trigger basis data dari pencatatan di dalam kode.

### 2.1 Yang tetap dijaga meski datanya tidak dapat diverifikasi

Tidak dapat diverifikasi bukan berarti boleh menerima apa saja:

1. **Identitas diambil dari sesi, bukan dari badan permintaan.** Analitik yang
   dapat difitnah lebih buruk daripada tidak ada analitik.
2. **Kode menu wajib benar-benar ada.** Kode karangan ditolak beserta alasannya
   — bukan dibuang diam-diam, karena kesalahan yang dibuang diam-diam bertahan
   berbulan-bulan.
3. **Kueri string dibuang.** `/pelanggan?cari=Budi+Santoso` menyatakan bahwa
   seseorang mencari orang itu, dan analitik pemakaian tidak berhak menyimpan
   pengetahuan tersebut. Dibuktikan: nama yang dicari tidak muncul di basis data.
4. **Paling banyak 50 peristiwa per permintaan.**
5. **Durasi dibatasi dua jam.** Delapan jam bukan berarti orang menatap layar
   selama itu — itu tab yang dibiarkan terbuka semalaman, dan membiarkannya akan
   merusak setiap rata-rata.
6. **Jam peramban yang salah dibuang.** Satu baris bertahun 1970 atau 2099 akan
   merusak setiap rentang tanggal yang dihitung darinya.

---

## 3. Kapasitas pelaku: kolom yang terisi sendiri

`audit_event` sudah mencatat **siapa** sejak skema pertama. Yang belum
dijawabnya: **dalam kapasitas apa**.

Kolom `actor_role_codes` sudah ada sejak awal dan bernilai `null` pada seluruh
258 baris yang pernah ditulis. Sebabnya bukan kelalaian satu orang: memanggil
`audit.record()` dari **76 tempat** berarti 76 kesempatan untuk lupa mengisi
satu bidang, dan bidang yang bergantung pada ingatan penulis kode akan kosong
pada sebagian besar tempat.

Menambal ketujuh puluh enam pemanggilan itu hanya menunda masalah yang sama
sampai pemanggilan ketujuh puluh tujuh ditulis. Perbaikan yang benar adalah
membuat bidang itu **terisi sendiri**.

`AsyncLocalStorage` menyimpan konteks yang mengikuti seluruh rantai `await` dari
satu permintaan:

- **Middleware** membuka konteks dengan `requestId`. Harus di sini — konteks
  hanya mengikuti alur yang dimulai di dalam `run()`, jadi membukanya belakangan
  berarti sebagian permintaan berjalan di luar konteks.
- **Guard JWT** melengkapi pelakunya begitu token terverifikasi.
- **`AuditService`** memungutnya sendiri lewat `withRequestScope()`.

### 3.1 Nilai yang disebut pemanggil tidak pernah ditimpa

Pemanggil yang menyebutkan pelaku secara eksplisit biasanya sedang mencatat
perbuatan **atas nama orang lain** — mis. petugas dukungan yang bertindak untuk
penyewa. Konteks yang menimpanya akan menghapus justru perbedaan yang paling
penting untuk dicatat.

### 3.2 Konteks ini bukan sumber kebenaran untuk otorisasi

Penjaga hak akses tetap membaca `request.user` dari token terverifikasi.
Mencatat dari konteks yang salah menghasilkan catatan yang salah; mengizinkan
dari konteks yang salah menghasilkan pelanggaran.

### 3.3 Yang sengaja tidak diisi

- **`actorRoleCodes` tetap tidak diisi otomatis.** Daftar seluruh peran tenant
  menuntut satu kueri tambahan ke skema tenant, dan membebankan kueri itu pada
  **setiap** permintaan demi sebuah kolom catatan bukan pertukaran yang sepadan.
  `activeRoleCode` sudah menjawab pertanyaan yang paling sering diajukan.
- **Baris audit lama tidak diisi mundur.** Skema audit append-only, dan mengisi
  mundur berarti mengarang kapasitas yang tidak pernah tercatat.
- **Baris `LOGIN` tetap tanpa kapasitas** — saat masuk memang belum ada peran
  yang dipilih. Dibuktikan.

---

## 4. Dashboard TableAudit

Tiga pertanyaan dijawab:

| Endpoint | Pertanyaan |
|---|---|
| `GET /table-audit/tables` | Apa yang berubah belakangan ini, pada tabel apa |
| `GET /table-audit/actors` | Siapa mengubah apa |
| `GET /table-audit/rows/:table/:id` | Seluruh riwayat satu baris |

Keputusan yang membentuknya:

- **Penghapusan ditampilkan tersendiri**, tidak dilebur ke total. Seratus
  penyuntingan dan seratus penghapusan adalah dua keadaan yang sangat berbeda.
- **Riwayat baris menyebut perbedaan per kolom**, bukan dua keadaan utuh yang
  harus dibandingkan sendiri dengan mata.
- **Kolom yang ditandai berubah padahal nilainya sama dibuang.** Trigger kadang
  menandai seluruh kolom saat baris ditulis ulang utuh, dan menampilkannya
  membuat pembacanya mencari perbedaan yang tidak ada.
- **Kolom rahasia tidak pernah ditampilkan** — penyaringan kedua setelah
  penyaringan trigger, supaya baris lama yang ditulis sebelum penyaringan itu
  ada tetap aman dibaca.
- **Nilai teks yang sangat panjang dipotong.** Satu kolom berisi seratus ribu
  karakter akan membuat riwayat tidak dapat dibuka sama sekali.
- **Nama tabel divalidasi dengan pola ketat.** Nama tabel dari permintaan yang
  disisipkan langsung ke teks kueri adalah jalan masuk injeksi yang paling
  sering terlewat. Dibuktikan pada bagian 5.

### 4.1 `row_pk` adalah jsonb, bukan teks

Kunci baris disimpan sebagai `{"id": "8f3c…"}`, bukan sebagai teks. Bentuk itu
memang perlu: sebagian tabel berkunci gabungan, dan menyimpannya sebagai satu
teks akan membuat kunci gabungan tidak dapat dipisahkan kembali. Karena itu
pencocokan menerima dua bentuk — id tunggal, dan JSON utuh.

---

## 5. Skema

| Migration | Isi |
|---|---|
| `V016__ui_activity_log.sql` (tenant) | `ui_activity_log` |
| `V017__audit_active_role.sql` (tenant audit) | `audit_event.active_role_code` |
| `add_audit_active_role` (platform) | `platform__audit.audit_event.active_role_code` |

`ui_activity_log` sengaja **tanpa trigger audit**: tabelnya append-only dan
bervolume tinggi, sehingga mengauditnya melipatgandakan volume tanpa menambah
satu pun jawaban.

---

## 6. Endpoint

| Method | Jalur | Izin |
|---|---|---|
| POST | `/activity/ui` | Terautentikasi |
| GET | `/activity/menu-usage` | `ADMIN_AUDIT.READ` |
| GET | `/activity/abandoned-actions` | `ADMIN_AUDIT.READ` |
| GET | `/table-audit/tables` | `ADMIN_AUDIT.READ` |
| GET | `/table-audit/actors` | `ADMIN_AUDIT.READ` |
| GET | `/table-audit/rows/:table/:id` | `ADMIN_AUDIT.READ` |

`menu-usage` menyertakan daftar **menu yang tidak pernah dibuka** — biasanya
itulah yang paling berguna, karena menandai fitur yang tidak terpakai, dan
menghapus fitur yang tidak terpakai lebih murah daripada merawatnya. Jawabannya
menyertakan catatan bahwa nol pembukaan berarti "tidak ada laporan", belum tentu
"tidak dipakai".

---

## 7. Bukti

Skrip: `apps/api/scripts/prove-v10-5-activity.mjs`
Keluaran: `docs/upgrade-v10-v11/bukti-v10-5-activity.txt`

Enam bagian, seluruhnya lulus:

1. **Kapasitas terisi sendiri.** Tiga pergantian peran menghasilkan jejak yang
   terbaca benar: pergantian *menuju* sebuah peran tercatat dengan kapasitas
   `(gabungan)` — kapasitas yang dipegang **saat keputusan diambil** — dan
   pergantian *keluar* darinya tercatat dengan peran itu. Tidak satu pun
   pemanggil menyebutkan kapasitas. Baris `LOGIN` tetap kosong.
2. Empat peristiwa pemakaian diterima, dua ditolak beserta alasannya; kueri
   string dibuang dan nama yang dicari tidak tersimpan.
3. Ringkasan pemakaian menu dan tindakan yang dibatalkan.
4. Perubahan lewat SQL langsung — tanpa kode aplikasi — tetap tercatat, dan
   riwayat barisnya menyebut kolom `name` beserta nilai sebelum dan sesudahnya.
5. Nama tabel yang disuntikkan ditolak `400`; tabelnya masih ada.
6. Tanpa `ADMIN_AUDIT.READ`, seluruh ringkasan ditolak `403`.

Uji unit: `ui-activity.spec.ts` (18 uji), `request-context.spec.ts` (8 uji) —
termasuk uji bahwa dua permintaan bersamaan tidak saling mencemari konteksnya.

---

## 8. Yang belum dikerjakan

- **FunctionLog tidak dibuat sebagai tabel tersendiri.** Yang dimaksud
  spesifikasi — mencatat pemanggilan fungsi beserta durasi dan hasilnya — sudah
  dijawab dua hal yang ada: `PerformanceLog` (V10-3) mencatat durasi dan tingkat
  galat per rute, dan `audit_event` mencatat perbuatan bisnis beserta hasilnya.
  Tabel ketiga akan menjadi sumber kebenaran ketiga untuk pertanyaan yang sama,
  dan tiga sumber yang saling berbeda lebih buruk daripada dua yang jelas
  pembagiannya. Bila kelak ada kebutuhan yang benar-benar tidak terjawab
  keduanya, tabelnya dibuat saat itu.
- **UI belum ada.** Endpoint lengkap dan teruji; halaman TableAudit serta
  pengiriman laporan pemakaian dari peramban dikerjakan pada V10-8.
- **Pembatasan laju pada `/activity/ui` belum ada** selain batas 50 per
  permintaan. Peramban yang rusak masih dapat mengirim banyak permintaan
  berturut-turut.
