# V10-4 — Login, Sesi, dan Peran Aktif

Status: **SELESAI**
Cakupan: peran aktif per sesi, riwayat pergantian peran, daftar sesi milik
sendiri, pencabutan sesi, dan pengenalan perangkat.

---

## 1. Yang sudah ada sebelum V10-4

Audit lebih dulu, supaya tidak membangun ulang yang sudah berdiri:

| Kemampuan | Keadaan sebelum V10-4 |
|---|---|
| Percobaan masuk berhasil/gagal + IP + user agent | **Sudah ada** — `platform_login_attempt` |
| Penguncian akun setelah percobaan gagal berulang | **Sudah ada** — 8 percobaan, kunci 15 menit |
| Daur hidup sesi, kedaluwarsa, pencabutan | **Sudah ada** — `platform_session` |
| Rotasi refresh token beserta token family | **Sudah ada** — `platform_refresh_token` |
| Pemilihan peran aktif | **Belum ada** |
| Riwayat pergantian peran | **Belum ada** |
| Pengenalan perangkat | **Belum ada** |
| Daftar sesi milik sendiri + pencabutan | **Belum ada** |

Yang dikerjakan V10-4 adalah empat baris terakhir.

---

## 2. Aturan yang menjaga penyempitan tetap aman

**Memilih peran hanya boleh MENGURANGI izin, tidak pernah menambah.**

Tanpa aturan itu ada celah yang nyata. Misalkan peran A melarang `KAS.APPROVE`
dan peran B mengizinkannya. Gabungan keduanya menghasilkan **tolak**, karena
DENY selalu menang. Bila penyempitan hanya melihat peran B, larangan dari peran
A ikut hilang — dan memilih peran justru **memberi** izin yang tadinya tidak
ada. Fitur yang dijual sebagai pembatasan akan diam-diam menjadi peningkatan
hak.

Karena itu `narrowToRole()` menegakkan dua hal:

1. **Seluruh DENY dari semua peran tetap berlaku**, bukan hanya dari peran
   aktif. Larangan tidak melekat pada topi yang sedang dipakai.
2. **Hasilnya diiriskan dengan gabungan penuh.** Langkah ini sudah tersirat oleh
   butir pertama, tetapi ditulis eksplisit supaya sifat "tidak pernah menambah"
   dijamin oleh kode, bukan oleh penalaran.

Diuji pada `tenant-permission.spec.ts` — termasuk uji yang secara langsung
menembak celah di atas, dan uji yang memeriksa bahwa hasil penyempitan selalu
himpunan bagian dari gabungan penuh.

### 2.1 Izin langsung tetap berlaku

Izin yang diberikan langsung kepada orangnya (`user_direct_permission`) tidak
melekat pada peran mana pun — ia diberikan kepada **orang itu**, bukan kepada
topi yang dipakainya. Karena itu ia tetap berlaku saat menyempit. Yang
dipersempit adalah izin yang berasal dari peran.

Izin langsung pun tetap kalah oleh DENY dari peran mana pun.

### 2.2 Ini bukan penegakan SoD

Segregation of Duty sudah ditegakkan **saat penugasan peran** oleh
`SegregationOfDutyService`: seseorang tidak dapat diberi dua peran yang
bertentangan sejak awal. Karena itu peran yang dipegang seseorang sudah bersih
menurut SoD, dan pemilihan peran aktif **bukan** mekanisme penegakan SoD.

Gunanya dua: pembatasan sukarela (least privilege atas kehendak sendiri), dan
kejelasan kapasitas pada jejak audit — *dalam kapasitas apa* orang ini
bertindak.

---

## 3. Peran aktif dibaca dari sesi, bukan dari token

Token yang sudah diterbitkan tidak dapat diubah. Bila peran aktif disimpan
sebagai klaim di dalamnya, pergantian peran baru berlaku setelah token
berikutnya terbit — dan sepanjang jeda itu pengguna **masih memegang izin peran
lamanya**. Untuk fitur yang gunanya justru membatasi izin, jeda seperti itu
tidak dapat diterima.

Baris sesi memang sudah dibaca dari basis data pada setiap permintaan
(`buildAuthenticatedUser`), jadi membaca peran aktif dari sana **tidak menambah
satu kueri pun**.

Akibatnya, dibuktikan pada bagian 5 skrip bukti: token yang sama persis langsung
mengikuti pergantian peran, tanpa penerbitan ulang.

---

## 4. Penyempitan berlaku pada penjaganya, bukan hanya tampilannya

Penyempitan yang hanya mengubah menu tetapi membiarkan `PermissionGuard`
memakai gabungan seluruh peran adalah pembatasan yang tidak membatasi apa pun.
Karena itu peran aktif diteruskan ke seluruh tempat yang menghitung izin:

| Tempat | Akibat |
|---|---|
| `PermissionGuard` | Menolak permintaan di luar peran aktif |
| `GET /me/menus` | Menu di luar peran aktif tidak ditampilkan |
| `GET /me/permissions` | Melaporkan izin efektif, bukan izin penuh |
| `GET /auth/me` | Sama, beserta `activeRoleCode` |

Melaporkan izin penuh sementara penjaganya memakai izin yang sudah dipersempit
akan membuat antarmuka menampilkan tombol yang pasti ditolak saat ditekan.

Penolakan akibat peran aktif menyertakan `activeRole` pada rincian galat —
ditolak karena sedang memakai peran lain berbeda dari ditolak karena tidak
berhak sama sekali, dan penyelesaiannya juga berbeda.

---

## 5. Peran aktif tidak ditebak saat masuk

Sesi baru selalu dimulai **tanpa** peran aktif, artinya izinnya gabungan seluruh
peran — persis seperti sebelum V10-4.

Menebakkan satu peran saat masuk akan mengejutkan pengguna yang selama ini
memakai gabungan seluruh perannya: tombol yang kemarin ada mendadak hilang tanpa
ia melakukan apa pun. Pemilihan harus disengaja.

Inilah yang membuat perubahan ini aman bagi pengguna yang ada: **yang memegang
satu peran tidak merasakan perbedaan apa pun**, dan yang memegang beberapa peran
tidak berubah sampai ia sendiri memilih.

---

## 6. Perangkat: mengenali, bukan menjaga

Sidik perangkat **tidak dipakai untuk mengizinkan atau menolak** apa pun.
Gunanya satu: mengelompokkan sesi pada daftar "di mana saja saya sedang masuk"
supaya orang dapat mengenali mana yang miliknya.

Menjadikannya penjaga adalah godaan yang harus ditolak, karena dua alasan:

1. **User agent berubah setiap kali peramban memperbarui dirinya sendiri.**
   Penjaga yang memakainya akan mengunci orang keluar dari akunnya sendiri pada
   hari Chrome naik versi. Diuji langsung pada `device-fingerprint.spec.ts`:
   Chrome 131 dan Chrome 132 menghasilkan sidik berbeda — tetapi label yang sama.
2. **Ia sepenuhnya dapat dipalsukan** oleh siapa pun yang mengirim permintaan.
   Sebagai penjaga ia menghalangi yang jujur tanpa menghambat yang tidak.

Yang disimpan hanya hash, bukan user agent mentah, pada kolom sidik: user agent
memuat versi peramban, sistem operasi, dan kadang perangkat keras — cukup untuk
melacak seseorang lintas tenant bila kolomnya kelak dibaca untuk keperluan lain.

Urutan pemeriksaan peramban penting: Edge dan Opera menyebut dirinya Chrome, dan
Chrome menyebut dirinya Safari. Diperiksa dengan urutan yang salah, seluruh
peramban akan dilaporkan sebagai Safari.

---

## 7. Sesi: milik sendiri saja

Seluruh endpoint sesi bekerja pada sesi **milik pemanggilnya**. Tidak ada
parameter untuk menyebut pengguna lain, dan itu disengaja: melihat atau
mengakhiri sesi orang lain adalah kemampuan pengawasan yang menuntut izin
tersendiri, bukan kelanjutan wajar dari mengelola akun sendiri.

- **Sesi milik orang lain dijawab `404`, bukan `403`.** Membedakan keduanya akan
  memberi tahu penebak bahwa suatu id memang dipakai orang.
- **`revoke-others` menyisakan sesi yang sedang dipakai.** Mencabut semuanya
  termasuk yang sedang berjalan akan mengeluarkan orang tepat saat ia sedang
  mengamankan akunnya, dan itu justru menghalangi langkah pengamanan berikutnya.
- **Alamat IP ditampilkan utuh** kepada pemilik sesinya sendiri: yang hendak
  dijawab adalah "apakah ini saya", dan itu tidak terjawab oleh alamat yang
  disamarkan.

---

## 8. Skema

Migration: `add_session_active_role` (additive).

`platform_session` bertambah empat kolom:

| Kolom | Isi |
|---|---|
| `active_role_id` | Peran yang sedang dipakai; `null` berarti gabungan seluruh peran |
| `active_role_code` | Salinan kode peran saat dipilih |
| `device_fingerprint` | Hash user agent, 32 heksadesimal |
| `device_label` | Keterangan terbaca, mis. "Chrome di Windows" |

`active_role_id` disimpan sebagai uuid biasa **tanpa foreign key**: perannya
berada pada skema tenant sedangkan tabelnya pada skema platform, dan foreign key
lintas skema tenant tidak mungkin dibuat karena setiap tenant punya tabel `role`
sendiri. `active_role_code` disimpan terpisah supaya riwayat tetap terbaca bila
perannya kelak diubah namanya atau dihapus.

Tabel baru `platform_role_switch_log` (append-only) mencatat setiap pergantian
beserta jumlah izin sebelum dan sesudah — inilah akibat yang sebenarnya
dirasakan pengguna, dan menyimpannya membuat pengurangan itu terlihat tanpa
perlu menghitung ulang di kemudian hari.

---

## 9. Endpoint

| Method | Jalur | Izin |
|---|---|---|
| GET | `/me/sessions` | Terautentikasi |
| POST | `/me/sessions/:id/revoke` | Terautentikasi (hanya sesi sendiri) |
| POST | `/me/sessions/revoke-others` | Terautentikasi |
| GET | `/me/roles` | Terautentikasi |
| POST | `/me/active-role` | Terautentikasi |
| GET | `/platform/security/role-switches` | `PLATFORM.OBSERVABILITY.READ` |

`POST /me/active-role` menerima `roleId: null` untuk kembali ke gabungan seluruh
peran, dan jawabannya menyebutkan `permissionsRemoved` — daftar izin yang hilang
akibat pilihan itu, supaya pengguna tahu akibatnya sebelum menemukan tombol yang
hilang.

---

## 10. Bukti

Skrip: `apps/api/scripts/prove-v10-4-session.mjs`
Keluaran: `docs/upgrade-v10-v11/bukti-v10-4-session.txt`

Fitur ini hanya berarti bagi pengguna yang memegang lebih dari satu peran, dan
pada basis data pengembangan tidak ada satu pun. Karena itu buktinya **membuat
sendiri**: dua peran dengan izin yang sengaja bertabrakan (satu melarang apa
yang lain izinkan), satu pengguna yang memegang keduanya. Semuanya dihapus
kembali pada bagian akhir.

Sembilan bagian, seluruhnya lulus:

1. Perangkat dikenali; sidiknya bukan user agent mentah.
2. Sesi baru tidak punya peran aktif; izinnya sama dengan sebelumnya.
3. **Larangan peran lain tetap berlaku** — menyempit ke peran B tidak memberi
   `APPROVE` yang dilarang peran A.
4. Penjaganya ikut menyempit: izin dan menu milik peran lain tidak muncul.
5. Berlaku seketika — token yang sama langsung mengikuti, tanpa penerbitan ulang.
6. Peran yang tidak dipegang ditolak `403`.
7. Tiga pergantian tercatat beserta jumlah izinnya; percobaan yang ditolak tidak
   ikut tercatat.
8. Dua perangkat terlihat; pencabutan membuat token sesi itu langsung tidak
   berlaku sementara sesi berjalan tetap hidup.
9. Sesi orang lain dijawab `404` dan tidak tersentuh.

Uji unit: `tenant-permission.spec.ts` (17 uji), `device-fingerprint.spec.ts`
(12 uji).

---

## 11. Yang belum dikerjakan

- **UI pemilihan peran belum ada.** Endpointnya lengkap dan teruji, tetapi
  pemilih peran pada bilah atas serta halaman "Perangkat & Sesi" belum dibuat.
  Dikerjakan pada V10-8 bersama seluruh UI V10.
- **Allowlist IP/header tidak diterapkan.** Spesifikasi menyebutnya, tetapi
  penjaga berbasis IP akan mengunci pengguna keluar setiap kali jaringannya
  berganti — dan pada penyewa yang memakai jaringan seluler itu terjadi setiap
  hari. Yang dikerjakan adalah pengenalan dan visibilitas; penegakan berbasis IP
  menuntut keputusan kebijakan dari pemilik sistem, bukan keputusan teknis.
- **Peran aktif belum ikut tercatat pada setiap baris audit.** `AuditService`
  belum menerima `activeRoleId`. Riwayat pergantian sudah lengkap, tetapi
  menjawab "dalam kapasitas apa transaksi INI dibuat" masih menuntut penelusuran
  silang terhadap riwayat pergantian. Dikerjakan pada V10-5 bersama
  `FunctionLog`.
