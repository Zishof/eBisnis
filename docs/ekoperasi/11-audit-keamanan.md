# Audit keamanan modul koperasi — K-11

Diperiksa terhadap aturan keamanan yang berlaku pada seluruh proyek, ditambah
larangan khusus POS §4 dan §22 serta spesifikasi eKoperasi §14.

Yang dilaporkan di sini adalah **keadaan sesudah** dua cacat yang ditemukan
selama K-11 diperbaiki. Keduanya diuraikan pada bagian akhir, sebab cara
menemukannya lebih berguna daripada cacatnya sendiri.

---

## 1. Cara memeriksanya

Tiga lapis, dan ketiganya diperlukan karena masing-masing menangkap hal yang
tidak dapat ditangkap yang lain.

| Lapis | Berkas | Yang ditangkapnya |
| --- | --- | --- |
| Aturan sebagai fungsi murni | `*.spec.ts` (1.541 pengujian) | Kekeliruan logika |
| Pemeriksaan teks berkas | `cooperative-security.spec.ts` (24) | Penambahan yang melanggar larangan tanpa disadari |
| Bukti pada basis data | `prove-cooperative-*.mjs` (7 berkas) | Penjaga yang dikira ada padahal tidak |

Lapis ketiga yang menemukan kedua cacat K-11. Keduanya lolos dari lapis pertama
dan kedua, sebab keduanya bukan kesalahan logika maupun pelanggaran pola —
melainkan **penjaga yang menjaga hal yang salah**.

### Penjaga yang tidak pernah dibuktikan menangkap apa pun

Setiap penjaga pada lapis kedua diuji dengan sengaja melanggarnya:

- Pada K-7, `INSERT INTO pos_sale` disisipkan ke adapter POS. Dua pengujian
  gagal dan menyebut berkas serta tabelnya.
- Pada K-11, `@Query('memberId')` ditambahkan ke controller portal dan
  `DELETE FROM cooperative_member` ke layanannya. Dua pengujian gagal dan
  menyebut keduanya.

Keduanya lalu dikembalikan. Penjaga yang tidak pernah dibuktikan menangkap apa
pun tidak berbeda dari komentar.

---

## 2. Hasil per aturan

### 2.1 Isolasi antarpenyewa

| Aturan | Keadaan | Bukti |
| --- | --- | --- |
| Nama skema hanya dari `platform.tenant_schema_registry` | **Patuh** | `cooperative-security.spec.ts` memeriksa seluruh berkas modul; tidak ada `body/query/params/headers.schema`, tidak ada `@Param('schema')` |
| `public` tidak pernah menjadi cadangan | **Patuh** | Diperiksa pola `?? 'public'` dan `search_path, public` |
| Data koperasi terpisah per penyewa | **Patuh** | Skema per penyewa; tabel koperasi sengaja **tidak** membawa kolom `tenant_id` — lihat [09](09-isolasi-data-antar-koperasi.md) |
| Satu koperasi per skema | **Patuh** | `ux_cooperative_single_per_tenant` |

Satu kemampuan **ditunda** karena aturan ini: situs koperasi tidak dapat dibuka
pengunjung, sebab satu-satunya cara yang tersedia adalah menerima nama skema
dari alamat. Diajukan sebagai
[IR-005](../integration-requests/cooperative/005-resolusi-tenant-situs-publik.md).
Kemampuan itu ditunda, bukan aturannya dilonggarkan.

### 2.2 Cakupan data portal anggota

| Aturan | Keadaan | Bukti |
| --- | --- | --- |
| Anggota hanya melihat dirinya sendiri | **Patuh** | 38 pengujian murni + 54 pemeriksaan basis data (K-9) + Babak 7 bukti menyeluruh |
| `memberId` tidak pernah dari permintaan | **Patuh** | Diturunkan lewat `memberDiriSendiri()`; diperiksa lapis kedua |
| Penolakan tidak membocorkan keberadaan baris | **Patuh** | Seluruh penolakan berbunyi "Data tidak ditemukan." |
| Lintas koperasi diperiksa sebelum kepemilikan | **Patuh** | Urutan diuji tersendiri |
| Bekas anggota kehilangan akses, bukan datanya | **Patuh** | Dibuktikan pada basis data |

### 2.3 Kata sandi, PIN, dan data pribadi

| Aturan | Keadaan | Catatan |
| --- | --- | --- |
| Kata sandi hanya Argon2 | **Patuh** | Modul ini tidak menyentuh kata sandi sama sekali |
| PIN anggota di-hash, tidak pernah polos | **Patuh** | `pin_hash` Argon2id; diperiksa lapis kedua dan basis data |
| **PIN tidak pernah terlihat kasir** (spesifikasi §14) | **Patuh** | `bolehKasirMengaksesPin()` selalu menolak; `pin_hash` tidak pernah masuk daftar `SELECT` portal |
| Nomor identitas dan rekening disamarkan | **Patuh** | `samarkanIdentitas`, `samarkanRekening`; `MEDAN_TERLARANG` dibuang saat pengiriman |
| Data sensitif tidak masuk catatan | **Patuh** | Tidak ada `console.*` di dalam modul; jejak portal tidak menyalin isi bacaan |
| Kredensial tidak ada dalam repositori | **Patuh** | Skrip bukti membaca `.env`, yang tidak pernah dikomit |

### 2.4 Larangan penghapusan dan jejak

| Aturan | Keadaan | Bukti |
| --- | --- | --- |
| Tidak ada izin `DELETE` di katalog | **Patuh** | 74 hak akses, nol berakhiran `.DELETE` |
| Tidak ada `DELETE` atas tabel koperasi di layanan | **Patuh** | Lapis kedua |
| Pengaduan, suara, keputusan, notulen, jejak portal **tidak dapat dihapus** | **Patuh sejak K-11** | Trigger `BEFORE DELETE` pada enam tabel — lihat cacat kedua di bawah |
| Skema audit hanya bertambah | **Patuh** | Modul tidak menulis ke skema audit |
| Data contoh dibersihkan tanpa menyentuh data sungguhan | **Patuh** | Dibuktikan dengan menyelipkan empat baris sungguhan berkode mirip |

### 2.5 Larangan perbuatan otomatis

| Aturan | Keadaan | Bukti |
| --- | --- | --- |
| AI tidak melakukan pembayaran, posting, persetujuan, penghapusan, RBAC | **Patuh** | `outputKind` hanya `DRAFT`/`ANALYSIS`/`RECOMMENDATION`; seluruh keperluan beraksi `READ` |
| Tidak ada penjadwal yang memicu perbuatan keuangan | **Patuh** | Tidak ada `@Cron` maupun `setInterval` di modul |
| Isi prompt tidak disimpan | **Patuh** | Seluruh `storeContent: false` |
| Tidak ada data lintas penyewa ke AI | **Patuh** | Perbandingan antarkoperasi termasuk keperluan yang ditolak |
| Ollama hanya lewat AI Gateway | **Patuh** | Modul tidak memanggil Ollama sama sekali |

### 2.6 Tidak ada penilaian ekspresi bebas

| Aturan | Keadaan |
| --- | --- |
| Tidak memakai `eval` maupun `new Function` | **Patuh** |
| Tidak merakit SQL dari nilai permintaan | **Patuh** — interpolasi hanya untuk nama skema yang berasal dari sesi |
| Rumus SHU sebagai kode, bukan sebagai data yang dievaluasi | **Patuh** |

### 2.7 Batas antarsesi (panduan koordinasi §3–§4)

| Aturan | Keadaan |
| --- | --- |
| Tidak menyunting mesin POS, inventori, akuntansi bersama | **Patuh** |
| POS hanya lewat adapter baca | **Patuh** — 7 pengujian memeriksa isi berkasnya |
| Berkas bersama tersentuh sesedikit mungkin | **Patuh** — `app.module.ts` dua baris, `App.tsx` dua baris |
| Tidak mengimpor modul vertikal lain | **Patuh** |
| Tidak menggabungkan sendiri ke `main` | **Patuh** — seluruh pekerjaan pada `feature/v12-ekoperasi` |

---

## 3. Dua cacat yang ditemukan K-11

Keduanya ditemukan bukti menyeluruh, bukan oleh pengujian satuan. Keduanya
menyangkut **penjaga yang ada tetapi menjaga hal yang salah** — jenis cacat
yang paling sulit ditangkap, sebab kehadiran penjaganya memberi rasa aman.

### Cacat 1 — Penjaga kuorum dikaitkan pada status yang salah

`ck_coop_meeting_quorum_evidence` dari K-5 berbunyi:

```sql
CHECK (status <> 'QUORUM_REACHED' OR (quorum_reached = TRUE AND ...))
```

Penjaganya dikaitkan pada **status**, padahal yang perlu dijaga adalah
**pernyataannya**. Sebuah RAT yang sudah selesai berstatus `CLOSED`, bukan
`QUORUM_REACHED` — `QUORUM_REACHED` hanya keadaan sesaat di tengah rapat.

Akibatnya rapat dapat berstatus `CLOSED` dengan `quorum_reached = TRUE` tanpa
satu pun angka pendukung, **selamanya**. Penjaganya menjaga keadaan yang lewat
dalam hitungan jam dan membiarkan keadaan yang bertahan.

Ini tidak teoretis: keputusan RAT hanya sah bila kuorumnya tercapai, dan
keabsahan pembagian SHU bersandar pada keputusan itu.

**Diperbaiki** migrasi `20260801T100000` — penjaganya dikaitkan pada
`quorum_reached = TRUE` berapa pun statusnya, ditambah dua penjaga aritmetika:
rapat yang menyatakan kuorum wajib benar-benar dihadiri sekurang-kurangnya
sebanyak syaratnya, dan rapat yang **menyangkal** kuorum tidak boleh justru
memenuhinya — sebab penyangkalan itu dapat dipakai membatalkan keputusan yang
sah.

### Cacat 2 — Larangan menghapus pengaduan hanya ada pada aplikasi

K-9 menyatakan "pengaduan tidak dapat dihapus, hanya berpindah status sampai
`CLOSED`". Itu benar tentang aplikasinya — tidak ada endpoint yang
menghapusnya. Basis datanya sendiri menerima `DELETE` tanpa keberatan.

Selisih antara keduanya menentukan. Alasan pengaduan tidak boleh dapat dihapus
adalah supaya ia tidak dapat dihilangkan oleh orang yang isinya menegur
dirinya — dan orang semacam itu justru yang paling mungkin memiliki akses
langsung ke basis data. Penjagaan yang hanya ada pada lapisan aplikasi tidak
menjaga dari orang itu.

**Diperbaiki** migrasi yang sama — trigger `BEFORE DELETE` pada enam tabel yang
gunanya justru terletak pada ketidakmungkinannya dihilangkan: pengaduan,
tanggapan pengaduan, keputusan rapat, suara, notulen, dan jejak portal.

Daftarnya sengaja pendek. Penjaga yang menghalangi pekerjaan wajar — misalnya
pembersihan data contoh — akan dicabut seseorang pada suatu hari, bersama
seluruh gunanya.

### Yang dipelajari

Kedua cacat menyangkut **jarak antara apa yang dinyatakan dan apa yang
ditegakkan.** Keduanya tercatat dalam changelog dengan kalimat yang percaya
diri, dan keduanya lolos dari 1.541 pengujian.

Yang menemukannya adalah pemeriksaan yang menjalankan urutan **seperti koperasi
sungguhan menjalankannya** — sampai rapatnya `CLOSED`, bukan berhenti pada
`QUORUM_REACHED` yang lebih mudah diuji. Pengujian yang berhenti pada keadaan
yang paling nyaman diuji akan melewatkan keadaan yang paling lama bertahan.

---

## 4. Yang masih tertahan

Bukan temuan keamanan, tetapi disebutkan supaya gambarannya utuh.

| Hal | Tertahan oleh | Akibat keamanannya |
| --- | --- | --- |
| Migrasi belum diterapkan ke penyewa | IR-001 | Tidak ada — belum ada data sungguhan |
| Menu dan hak akses belum disemai | IR-004 | **Menguntungkan** — seluruh endpoint menolak setiap permintaan |
| Peristiwa akuntansi belum dijurnal | IR-003 | Neraca belum lengkap; bukan kebocoran |
| Situs publik | IR-005 | **Menguntungkan** — permukaan paling terbuka belum terbuka |
| PIN belum dapat diatur dari portal | Alur autentikasi bersama | Portal belum dapat dipakai anggota sungguhan |

Tiga dari lima justru **mengurangi** permukaan serang selama masa tunggu. Itu
bukan alasan menunda IR-nya, tetapi berarti keadaan sekarang tidak berbahaya —
melainkan belum dapat dipakai.

---

## 5. Kesimpulan

Modul koperasi **patuh pada seluruh aturan keamanan yang berlaku**, sesudah dua
perbaikan K-11.

Yang belum dapat dinyatakan adalah bahwa ia aman **dalam pemakaian sungguhan**,
sebab ia belum pernah dipakai penyewa sungguhan. Pemeriksaan yang dapat
dilakukan tanpa pemakaian sungguhan sudah dilakukan; sisanya menunggu
IR-001 dan IR-004, lalu pengujian terima menurut
[10-uat-skenario.md](10-uat-skenario.md).
