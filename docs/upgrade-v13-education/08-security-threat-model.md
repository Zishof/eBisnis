# E13-0 · Model Ancaman

Enterprise Education mengubah profil risiko eBisnis secara mendasar: sistem ini mulai
menyimpan **data anak** dalam jumlah besar, beserta nilai, catatan konseling, kesehatan,
lokasi (gerbang, antar-jemput), dan uang saku.

UU 27/2022 memperlakukan data anak sebagai data pribadi yang memerlukan perlindungan
khusus. Bagian ini menuliskan ancaman yang paling mungkin terjadi, bukan daftar lengkap
kontrol keamanan.

---

## 1. Aset yang dilindungi

| Aset | Mengapa menarik | Akibat bila bocor |
| --- | --- | --- |
| NIK dan identifier nasional anak | Pencurian identitas jangka panjang | Tidak dapat dipulihkan — NIK tidak diganti |
| Nilai dan rapor | Manipulasi kelulusan | Ijazah tidak sah |
| Catatan konseling / BK | Sangat pribadi, menyangkut keluarga | Kerugian yang tidak dapat diperbaiki |
| Data kesehatan santri | Kategori khusus UU PDP | Sanksi dan kerugian pribadi |
| Biometrik presensi | Tidak dapat dicabut | Permanen |
| Lokasi anak (gerbang, antar-jemput) | Keselamatan fisik | Bahaya langsung |
| Uang saku dan wallet | Uang nyata | Kerugian finansial |
| Kredensial integrasi nasional | Akses ke sistem pemerintah | Dampak di luar tenant |

## 2. Ancaman utama

### A1 · Kebocoran lintas vertical

Yayasan dengan sekolah dan pesantren menyimpan keduanya di satu tenant. Query yang lupa
memfilter dapat membaca lintas vertical.

**Mitigasi:** schema terpisah per vertical (dokumen 03), bukan konvensi penamaan.
Isolasinya ditegakkan PostgreSQL. Ini alasan teknis utama menolak Pilihan A pada
dokumen 03 — dan alasannya keamanan, bukan kerapian.

### A2 · Wali membaca anak orang lain

Portal wali adalah permukaan paling luas dan paling sedikit terlatih penggunanya.

**Mitigasi:** `GUARDIAN_CHILD` sebagai data scope yang dievaluasi di query, bukan di
UI. Otoritas wali versioned. Pengujian wajib mencakup wali yang mencoba mengakses id
anak lain — termasuk lewat ekspor dan laporan, dua jalur yang sering luput.

### A3 · Nilai diubah tanpa jejak

**Mitigasi:** `GradeResult` versioned, `GradePublication` mengunci, koreksi menghasilkan
versi baru dengan alasan dan pelaku. AI **dilarang** mengubah nilai final (§210.2).
SoD: yang memasukkan nilai bukan yang menyetujui publikasi.

### A4 · Catatan konseling terlihat pihak yang tidak berhak

Guru mata pelajaran tidak perlu membaca catatan konseling; wali kelas belum tentu.

**Mitigasi:** `CounselingCase` dengan tingkat kerahasiaan sendiri, purpose-of-use, dan
akses yang diaudit. Tidak ikut dalam ekspor umum maupun sample data.

### A5 · Data anak mengalir ke AI cloud

**Mitigasi:** AI Gateway dengan default Ollama on-premise yang sudah ditetapkan platform.
Data peserta anak tidak dikirim ke penyedia cloud tanpa policy, minimisasi, dan dasar
hukum (§222.2). Seluruh keluaran AI berstatus **usulan** dan wajib ditinjau manusia.

### A6 · Billing dimanipulasi

Menaikkan atau menurunkan jumlah peserta aktif mengubah tagihan.

**Mitigasi:** snapshot harian idempotent, `inputHash`/`resultHash`, policy versioned,
audit yang dapat direproduksi (dokumen 06 §3). Perubahan tarif memerlukan persetujuan
dan tidak menimpa histori.

### A7 · Biometrik menjadi satu-satunya jalan

Presensi wajah tanpa alternatif memaksa persetujuan yang tidak bebas — dan persetujuan
yang tidak bebas bukan persetujuan.

**Mitigasi:** §198 menegaskan biometrik bukan satu-satunya cara presensi dan wajib ada
jalur alternatif. Ditegakkan sebagai aturan produk, bukan saran.

### A8 · Sample data tercampur data nyata

Sample pendidikan memuat 500 peserta per vertical dengan nama dan identifier.

**Mitigasi:** `isSampleData`, `sampleBatchId`, soft delete, dan penghapusan diblokir
bila data nyata mereferensikannya. Peserta sample **tidak** masuk hitungan billing
(§187.3). Mekanismenya sudah ada di `modules/master-seed`.

### A9 · Kredensial integrasi nasional bocor

**Mitigasi:** vault, tidak pernah di Git, rotasi, dan akses yang diaudit.

### A10 · Break-glass menjadi kebiasaan

Akses darurat yang mudah akan dipakai untuk kenyamanan.

**Mitigasi:** break-glass hanya untuk kasus yang sah, berbatas waktu, diaudit, dan
ditinjau berkala.

## 3. Yang tidak berubah

Aturan repo yang sudah berlaku dan mengikat penuh di V13:

- Kata sandi hanya Argon2; tidak pernah plaintext.
- `.env` tidak pernah masuk Git.
- Nama schema tidak pernah dari request; hanya dari `platform.tenant_schema_registry`.
- `public` tidak pernah menjadi fallback `search_path`.
- Tidak ada `eval`, `Function`, atau SQL bebas untuk ekspresi diskon/harga.
- Skema audit append-only.
- Payload sensitif dimasker sebelum audit/log.
- Tidak ada force push.

## 4. Retensi dan hak subjek data

| Kewajiban | Konsekuensi desain |
| --- | --- |
| Data alumni disimpan lama untuk transkrip | Retensi berbeda per kategori, bukan satu angka |
| Hak koreksi | Koreksi menghasilkan versi, bukan menimpa |
| Hak hapus | Bertabrakan dengan kewajiban arsip akademik — perlu keputusan hukum, bukan teknis |
| Kepemilikan data institusi | Ekspor lengkap saat kontrak berakhir (Rangkuman §11) |

Baris ketiga sengaja dibiarkan terbuka. Menuliskannya sebagai "sudah ditangani" akan
menyembunyikan pertanyaan hukum yang belum dijawab siapa pun di proyek ini.
