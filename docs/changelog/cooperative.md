# Changelog — Vertikal Koperasi (eKoperasi)

Changelog modular sesuai panduan koordinasi §11. Sesi Core/Integrator yang
menggabungkan entri terpilih ke `CHANGELOG.md` induk.

---

## K-7 — Unit usaha dan integrasi POS

### Ditambahkan

- **Migrasi modul** `20260731T220000__cooperative__unit_business_and_pos_link.sql`:
  delapan tabel — unit usaha, penghubung POS, tautan harga anggota, anggaran,
  hasil usaha per periode, pembacaan patronage, baris patronage, dan aset unit.
- **`cooperative-unit.ts`** — aturan sebagai fungsi murni: jenis unit, tautan
  outlet, ringkasan patronage, laba rugi unit, alokasi beban umum, tautan
  harga anggota, dan **batas kewenangan adapter**. **27 pengujian.**
- **`adapters/pos.adapter.ts`** — satu-satunya berkas koperasi yang menyentuh
  tabel `pos_*`, dan **hanya membaca**.
- **`adapters/pos-adapter-readonly.spec.ts`** — **7 pengujian** yang memeriksa
  isi berkas modul, bukan perilakunya.

### Penjagaan batas yang tidak biasa, dan alasannya

Pengujian `pos-adapter-readonly.spec.ts` membaca **isi berkas modul koperasi
sendiri** dan menolak setiap `INSERT`, `UPDATE`, atau `DELETE` yang menyentuh
tabel `pos_*` maupun `stock_*`. Ia juga menolak penyebutan kode peristiwa
akuntansi POS di mana pun dalam modul, dan memastikan hanya adapter yang
menyebut `pos_sale` — membaca pun harus lewat satu pintu.

Cara ini dipilih karena pengujian perilaku hanya membuktikan jalur yang
kebetulan diuji, sedangkan pemeriksaan isi berkas menangkap setiap penulisan
yang kelak ditambahkan seseorang — termasuk pada jalur yang belum ada
pengujiannya.

**Penjagaannya diverifikasi dengan sengaja melanggarnya:** sebuah
`INSERT INTO pos_sale` disisipkan ke adapter, dan pengujian gagal dengan
menyebut berkas serta tabelnya. Penjagaan yang tidak pernah dibuktikan menangkap
apa pun adalah penjagaan yang belum tentu bekerja.

### Keputusan yang perlu dicatat

- **Unit usaha koperasi TIDAK memiliki POS sendiri.** Ia tertaut ke `outlet`
  Core lewat satu tabel penghubung; menghapus tabel itu harus cukup untuk
  membuat POS berjalan tanpa koperasi dan sebaliknya.
- **Satu outlet hanya dimiliki satu unit usaha**, ditegakkan indeks unik
  parsial. Dua pemilik akan menghitung patronage penjualan yang sama dua kali —
  dan SHU dibagikan atas angka itu.
- **Harga khusus anggota berjalan tanpa mengubah POS sama sekali**, lewat
  tautan kategori anggota ke `customer_group` Core. Kasir memindai kartu
  anggota, POS mengenali pelanggannya, dan buku harga berlingkup kelompok itu
  berlaku. Tautannya diletakkan pada tabel koperasi karena `customer_group`
  milik Core.
- **Patronage dibaca berkala, bukan ditulis saat transaksi.** Ia dihitung atas
  periode buku yang sudah ditutup; menuliskannya saat transaksi membuat angkanya
  ikut berubah setiap ada retur — sesudah SHU dihitung.
- **Penjualan yang tidak teratribusi dilaporkan, bukan dibuang.** Unit toko yang
  sebagian besar penjualannya tidak teratribusi berarti kartu anggotanya jarang
  dipakai — keadaan yang perlu diketahui pengurus sebelum SHU dihitung.
- **Penyaringan memakai `business_date`, bukan `created_at`.** Penjualan yang
  diselesaikan lewat tengah malam tetap milik hari usaha tempat ia terjadi.
- **Beban umum dialokasikan ke unit.** Tanpanya, unit tampak jauh lebih untung
  daripada sebenarnya, dan pengurus memutuskan membuka unit baru berdasarkan
  angka yang belum menanggung bagiannya atas gaji, listrik, dan sewa kantor.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 53 suite, **1382 tes lulus** (bertambah 34) |
| Penjagaan batas | diverifikasi dengan pelanggaran sengaja |

### Belum dikerjakan pada K-7

- **K-7d — pembayaran dengan saldo simpanan dan pembelian kredit anggota**
  menunggu **IR-002** (kait pembayaran bersaldo eksternal pada POS). Unit toko
  koperasi berjalan penuh dengan tunai dan nontunai biasa; K-7d tidak menahan
  K-8 sampai K-11.

## K-6 — SHU dan patronage

### Ditambahkan

- **Migrasi modul** `20260731T210000__cooperative__shu_and_patronage.sql`:
  enam tabel — komponen kebijakan, perhitungan, alokasi, patronage anggota,
  pembagian, dan rincian untuk anggota.
- **`cooperative-shu.ts`** — aturan sebagai fungsi murni: pemeriksaan
  kebijakan, alokasi surplus, pembagian metode sisa terbesar, keutuhan,
  sidik jari masukan, bagian masa keanggotaan, dan gerbang RAT.
  **53 pengujian.**
- **`scripts/prove-cooperative-k6.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k6-shu.txt` — **24 pemeriksaan, seluruhnya lulus.**

### Cacat yang ditemukan bukti K-6, dan perbaikannya

Bukti K-6 menjalankan perhitungan, menyimpannya, lalu **menghitung ulang dari
cuplikan yang tersimpan** dan membandingkannya baris demi baris. Pada jalannya
yang pertama:

```
LULUS  sidik jari perhitungan ulang SAMA dengan yang tersimpan
GAGAL  bagian 3 anggota SAMA PERSIS sampai ke rupiah terakhir  (8 berbeda)
```

Sebabnya: bagian masa keanggotaan dihitung pada presisi penuh tetapi disimpan
sebagai `NUMERIC(9,6)`. Perhitungan ulang dari data tersimpan memakai angka yang
sedikit berbeda, dan pada metode sisa terbesar selisih sekecil apa pun dapat
memindahkan satu rupiah dari seorang anggota ke anggota lain.

Yang membuatnya berbahaya bukan selisih satu rupiahnya, melainkan **sidik
jarinya**: ia membulatkan ke empat angka di belakang koma, sehingga menyatakan
"masukan sama" atas masukan yang sesungguhnya berbeda. Sidik jari yang memberi
keyakinan palsu lebih buruk daripada tidak ada sidik jari sama sekali.

Perbaikannya: presisi cuplikan dinyatakan sebagai tetapan `PRESISI_FRAKSI`, dan
**perhitungan memakai presisi yang sama dengan penyimpanannya** — pembulatan
terjadi saat menghitung, bukan saat menyimpan. Tiga pengujian regresi
ditambahkan, termasuk yang memastikan sidik jari peka sampai digit keenam.

### Keputusan lain yang perlu dicatat

- **Angka masukan DICUPLIK, bukan dibaca ulang.** Simpanan anggota hari ini
  berbeda dari simpanannya saat periode buku ditutup; membaca ulang berarti
  menghitung SHU tahun lalu memakai angka tahun ini.
- **Jumlah komponen kebijakan wajib tepat 100%.** Kurang berarti ada surplus
  yang tidak diketahui ke mana perginya; lebih berarti membagikan uang yang
  tidak ada. Dibandingkan dalam basis per sepuluh ribu supaya kebijakan yang
  benar tidak ditolak karena pecahan biner.
- **Selisih pembulatan alokasi dibebankan pada CADANGAN**, bukan disebar.
  Cadangan milik koperasi, bukan milik anggota perorangan, jadi selisih di sana
  tidak mengubah hak siapa pun.
- **Pembagian sisa memakai metode sisa terbesar dengan pemutus seri `memberId`**
  — bukan urutan baris dari basis data, yang dapat berbeda antar pemanggilan.
- **Dasar jasa modal hanya simpanan ekuitas.** Simpanan sukarela tidak ikut: ia
  kewajiban koperasi kepada anggota, bukan modal anggota pada koperasi, dan
  memperoleh bagi hasil tersendiri.
- **Bagian masa keanggotaan dihitung dari HARI, bukan bulan.** Anggota yang
  masuk 20 Januari memperoleh bagian berbeda dari yang masuk 1 Januari.
- **Perhitungan yang disetujui wajib menunjuk keputusan RAT dan wajib utuh**,
  ditegakkan constraint. Pembagian SHU tanpa keputusan RAT yang sah adalah
  pengurus membagikan uang anggota atas keputusannya sendiri.
- **Satu perhitungan hidup per tahun buku.** Dua perhitungan atas tahun yang
  sama berarti dua angka SHU, dan tidak ada yang tahu mana yang dibagikan.
- **Pemotongan tidak boleh melebihi hak anggota dan wajib beralasan.** SHU
  tidak dapat menjadi utang.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 51 suite, **1348 tes lulus** (bertambah 53) |
| Bukti K-6 | **24 pemeriksaan lulus** |

## K-5 — Rapat anggota, kuorum, voting, dan keputusan

### Ditambahkan

- **Migrasi modul** `20260731T200000__cooperative__meetings_and_voting.sql`:
  delapan tabel — rapat, mata acara, undangan, kehadiran, suara, keputusan,
  tindak lanjut, dan notulen.
- **`cooperative-meeting.ts`** — aturan sebagai fungsi murni: penyaringan
  kuasa, perhitungan kuorum, penghitungan suara empat aturan keputusan, hak
  memilih, keabsahan keputusan, dan ambang per jenis mata acara.
  **43 pengujian.**
- **`scripts/prove-cooperative-k5.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k5-rat.txt` — **32 pemeriksaan, seluruhnya lulus.**
- **`docs/ekoperasi/09-isolasi-data-antar-koperasi.md`** — keterangan tiga
  lapis pemisahan data antar koperasi, beserta cara memeriksanya sendiri.

### Keputusan yang perlu dicatat

- **Tabel suara TIDAK memiliki kolom bobot, dan tidak boleh memilikinya.** Satu
  anggota satu suara, berapa pun besar simpanannya — pembeda koperasi dari
  perseroan. Pengujian memeriksa ketiadaan kolom `weight`, `bobot`, `share`,
  `saving`, dan `capital` pada tabelnya, supaya penambahan pembobotan kelak
  tertangkap. Indeks unik menegakkannya: satu anggota satu suara per mata acara.
- **Keputusan tanpa kuorum DITANDAI tidak sah, bukan ditolak diam-diam.**
  Keputusan itu terjadi, tercatat pada notulen, dan mungkin sudah dilaksanakan.
  Menghilangkannya dari catatan membuat pelaksanaannya tidak dapat dijelaskan
  kemudian; menandainya tidak sah membuatnya terlihat dan dapat diperbaiki
  lewat rapat berikutnya.
- **Keputusan SAH wajib benar-benar memenuhi ambangnya**, ditegakkan
  constraint. Menutup jalan mencatat keputusan sebagai sah padahal angkanya
  menunjukkan sebaliknya.
- **Abstain tidak dihitung sebagai penolak.** Anggota yang abstain menyatakan
  dirinya tidak mengambil sikap; memperlakukannya sebagai penolak berarti
  memberinya sikap yang tidak dinyatakannya. Pengecualiannya keputusan bulat,
  yang menuntut seluruh yang hadir menyetujui.
- **Kuasa dibatasi jumlahnya per pemegang.** Tanpa batas, seseorang dapat
  mengumpulkan kuasa dari puluhan anggota dan memutuskan sendiri hal yang
  seharusnya diputuskan bersama.
- **Syarat kuorum dicuplik ke rapat saat dibuka**, tidak dibaca ulang dari
  AD/ART. Membacanya ulang membuat kuorum rapat tahun lalu ikut berubah bila
  AD/ART kelak diubah.
- **Notulen susunan AI ditandai jelas dan wajib melalui pemeriksaan manusia
  sebelum disahkan**, ditegakkan constraint. Konsep yang tidak diperiksa tidak
  boleh tampak seperti catatan resmi rapat.
- **Perubahan AD/ART menuntut dua per tiga; pembubaran dan penggabungan tiga
  per empat.** Pemberhentian pengurus dua per tiga — lebih tinggi daripada
  pemilihannya, sebab memberhentikan orang yang dipilih rapat sebelumnya
  menuntut kesepakatan yang lebih kuat.

### Pemisahan data antar koperasi — diperiksa, bukan diasumsikan

Bukti K-5 bagian A memeriksa enam hal terhadap basis data sungguhan:

```
17 penyewa terdaftar, masing-masing pada skema tersendiri
tidak ada dua penyewa berbagi satu skema
tidak ada dua skema menunjuk satu penyewa
setiap skema terdaftar benar-benar ada sebagai skema PostgreSQL
indeks penjaga satu koperasi per skema terpasang
tabel anggota tidak memakai kolom penyaring penyewa — pemisahannya di skema
```

Yang terakhir disengaja: pada model satu tabel bersama dengan kolom `tenant_id`,
**satu kueri yang lupa menyaring sudah cukup** untuk membocorkan data penyewa
lain — tanpa galat, tanpa catatan log, dan biasanya baru ketahuan ketika seorang
anggota melihat nama yang tidak dikenalnya pada laporannya sendiri.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 50 suite, **1295 tes lulus** (bertambah 43) |
| Bukti K-5 | **32 pemeriksaan lulus** |

## K-4 — Pinjaman, pembiayaan, angsuran, dan penagihan

### Ditambahkan

- **Migrasi modul** `20260731T190000__cooperative__loans_and_collection.sql`:
  dua belas tabel — produk, pengajuan, agunan, penjamin, analisis kredit,
  pinjaman, pencairan, jadwal angsuran, pembayaran, restrukturisasi, kasus
  penagihan, dan aktivitas penagihan.
- **`cooperative-loan.ts`** — aturan sebagai fungsi murni: kesesuaian metode
  dengan jenis koperasi, kelayakan mengajukan, pembentukan jadwal untuk tujuh
  metode (flat, efektif, anuitas, murabahah, mudharabah, ijarah, qardh),
  alokasi pembayaran, denda, golongan risiko, penyisihan, PAR, pelunasan
  dipercepat, transisi empat belas status, dan pemisahan wewenang.
  **68 pengujian.**
- **`scripts/prove-cooperative-k4.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k4-pinjaman.txt` — **38 pemeriksaan, seluruhnya lulus.**

### Keputusan yang perlu dicatat

- **Pemisahan wewenang ditegakkan basis data**, bukan hanya layanan.
  Penganalisis tidak boleh sama dengan penyurvei; penyetuju tidak boleh sama
  dengan penganalisis. Aturan yang hanya ada di satu lapisan berhenti berlaku
  begitu ada jalan kedua menuju tabelnya.
- **Penghapusbukuan menuntut DUA orang berbeda.** Perbuatan ini yang paling
  mudah dipakai menghapus jejak pinjaman bermasalah, dan satu tanda tangan
  tidak cukup untuknya.
- **Selisih pembulatan jadwal dibebankan pada angsuran TERAKHIR.**
  Membebankannya di awal membuat angsuran pertama berbeda dari yang disebutkan
  saat akad — dan itulah angka yang diingat anggota. Diuji atas 108 kombinasi
  metode × tenor × pokok; jumlah pokok selalu persis sama dengan pinjamannya.
- **Alokasi pembayaran: denda → jasa → pokok.** Mendahulukan pokok membuat
  denda dan jasa menumpuk tanpa pernah terbayar, dan tunggakan terus bertambah
  meskipun anggota membayar tiap bulan. Jumlah seluruh alokasi wajib sama
  dengan nilai yang diterima — selisih di sini berarti uang yang masuk tidak
  sampai ke mana pun.
- **Denda dibatasi kelipatan nilai tertunggak.** Tanpa batas, denda pada
  pinjaman yang lama menunggak dapat melampaui pokoknya sendiri, dan tagihan
  yang mustahil dibayar tidak menolong siapa pun.
- **PAR dihitung dari SELURUH sisa pinjaman yang menunggak**, bukan dari
  angsuran yang tertunggak saja. Anggota yang menunggak satu angsuran dari dua
  puluh tetap membawa risiko atas seluruh sisanya.
- **Murabahah: margin tetap terutang pada pelunasan dipercepat.** Ia bagian
  harga jual yang disepakati saat akad, bukan bunga berjalan. Potongan
  sukarela disebut *muqasah* dan tidak diperjanjikan di muka.
- **Qardh tidak boleh membawa imbalan apa pun**, ditegakkan constraint.
- **Janji bayar wajib menyebutkan tanggal DAN nilainya.** Janji tanpa angka
  tidak dapat dipantau kepatuhannya, dan janji yang tidak dapat dipantau sama
  saja dengan tidak ada janji.
- **Jadwal angsuran dibekukan saat pencairan.** Restrukturisasi membentuk
  pinjaman baru yang menunjuk yang lama, bukan menyunting jadwalnya — jadwal
  yang disunting membuat riwayat tunggakan tidak dapat dipertanggungjawabkan,
  dan riwayat itulah dasar penilaian kelayakan pinjaman berikutnya.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 49 suite, **1252 tes lulus** (bertambah 68) |
| Bukti K-4 | **38 pemeriksaan lulus** |

### Belum dikerjakan pada K-4

- **Peristiwa akuntansi pinjaman belum dijurnal** — menunggu IR-003, sama
  dengan simpanan pada K-3.
- **Penjadwal denda harian** belum dipasang; denda dihitung saat pembayaran.

## K-3 — Simpanan dan buku pembantu anggota

### Ditambahkan

- **Migrasi modul** `20260731T180000__cooperative__savings_and_subledger.sql`:
  lima tabel — produk simpanan, rekening, transaksi, buku pembantu anggota, dan
  rekening koran.
- **`cooperative-saving.ts`** — aturan sebagai fungsi murni: sifat empat jenis
  simpanan, saldo sebagai proyeksi mutasi, gerbang setor dan tarik, kemajuan
  simpanan pokok, tunggakan berkala, dormansi, penutupan, dan bagi hasil
  berbasis saldo rata-rata harian. **49 pengujian.**
- **`scripts/prove-cooperative-k3.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k3-simpanan.txt` — **24 pemeriksaan, seluruhnya lulus.**

### Keputusan yang perlu dicatat

- **Simpanan pokok dan wajib WAJIB bertanda ekuitas dan tidak dapat ditarik**,
  ditegakkan constraint. Tidak ada jalan membuat "simpanan wajib yang dapat
  ditarik" — yang secara hukum bukan simpanan wajib lagi.
- **Bunga dan nisbah tidak boleh diisi bersamaan.** Produk yang membawa
  keduanya tidak dapat dijelaskan kepada Dewan Pengawas Syariah maupun kepada
  pengawas konvensional.
- **Hanya satu produk simpanan pokok aktif per koperasi.** Dua berarti dua
  besaran modal keanggotaan, dan tidak ada yang tahu mana yang menentukan
  keabsahan keanggotaan.
- **Saldo simpanan tidak pernah negatif.** Simpanan bukan pinjaman.
- **Satu periode simpanan wajib dibayar sekali saja per rekening.** Tunggakan
  dihitung dari periode, bukan dari selisih nilai — menyetor dua kali lipat
  pada satu bulan tidak melunasi bulan yang terlewat, sebab SHU jasa modal
  dihitung per periode.
- **Buku pembantu memakai satu sisi saja per baris.** Baris bernilai nol pada
  debit dan kredit tidak berarti apa-apa tetapi ikut terhitung saat
  rekonsiliasi.
- **Bagi hasil memakai saldo rata-rata harian, bukan saldo akhir.** Saldo akhir
  memungkinkan seseorang menyetor besar pada hari terakhir dan memperoleh bagi
  hasil sebulan penuh atasnya.
- **`baruSajaLunas` dibedakan dari `lunas`** pada kemajuan simpanan pokok.
  Tanpa pembedaan itu, setiap setoran berikutnya memicu pengaktifan keanggotaan
  lagi — dan pengaktifan berulang menulis ulang tanggal aktif, yang menentukan
  masa keanggotaan pada perhitungan SHU.
- **Simpanan pokok dan wajib tidak pernah dormant.** Keduanya memang tidak
  bergerak menurut sifatnya; menandainya dormant akan menyatakan seluruh
  anggota tidak aktif.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 48 suite, **1184 tes lulus** (bertambah 49) |
| Bukti K-3 | **24 pemeriksaan lulus** |

### Belum dikerjakan pada K-3

- **Peristiwa akuntansi simpanan belum dijurnal.** Kode `COOPERATIVE_*` belum
  dikenal mesin Core sampai IR-003 disetujui. Buku pembantu anggota berjalan;
  yang belum terbentuk adalah jurnal buku besarnya. Kolom
  `accounting_event_id` sudah tersedia dan tinggal diisi.
- **Layanan dan endpoint** menyusul pada satu commit tersendiri bersama
  keanggotaan K-2, sebab pengaktifan anggota adalah akibat dari transaksi
  simpanan pokok.

## K-2 — Organisasi, kepengurusan, dan keanggotaan

### Ditambahkan

- **Migrasi modul** `20260731T170000__cooperative__organization_and_membership.sql`:
  sebelas tabel — periode kepengurusan, jabatan, penugasan, anggota, kategori
  anggota, dokumen, persetujuan data, ahli waris, hubungan keluarga, riwayat
  status, dan akun portal.
- **`cooperative-member.ts`** — aturan sebagai fungsi murni: transisi sembilan
  status, gerbang pengaktifan, kelayakan mendaftar, kepengurusan berperiode,
  larangan rangkap jabatan, penomoran anggota, dan perhitungan penyelesaian.
  **48 pengujian.**
- **`scripts/prove-cooperative-k2.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k2-keanggotaan.txt` — **33 pemeriksaan, seluruhnya
  lulus.** Bukti berjalan dalam satu transaksi yang selalu digulung balik,
  sehingga basis data pengembangan tidak berubah karena dijalankannya.

### Keputusan yang perlu dicatat

- **Calon anggota dan anggota berbagi satu tabel**, dibedakan `status`. Dua
  tabel terpisah memaksa pemindahan baris saat calon menjadi anggota, dan
  pemindahan baris memutus rujukan dokumen serta jejak auditnya.
- **Gerbang keanggotaan ditegakkan dari DUA arah.** Anggota `ACTIVE` wajib
  punya nomor dan tanggal aktif; **dan** calon anggota tidak boleh punya
  tanggal aktif. Arah kedua menutup jalan mengisi `activated_at` lebih dahulu
  lalu mengubah status kemudian — jalan yang akan terlewat bila hanya arah
  pertama yang dijaga.
- **Pengaktifan tidak menuntut hak akses tersendiri.** Ia bukan keputusan
  manusia melainkan akibat lunasnya simpanan pokok. Memberinya hak akses akan
  membuka jalan bagi petugas untuk mengaktifkan anggota yang belum membayar.
- **Satu jabatan hanya dipangku satu orang pada satu waktu**, ditegakkan
  *exclusion constraint* (`btree_gist`), bukan hanya layanan. Jabatan Ketua
  menentukan siapa yang sah menandatangani perjanjian pinjaman, dan dua ketua
  pada satu tanggal berarti dua tanda tangan yang sama-sama tampak sah.
- **Bekas anggota yang meninggalkan tunggakan tidak dapat mendaftar ulang.**
  Tanpa aturan ini, seseorang dapat menghapus tunggakannya dengan keluar lalu
  masuk kembali sebagai orang baru.
- **`cooperative_member_category` bukan `customer_group`.** Yang satu
  menentukan hak suara, hak pinjam, dan bagian SHU; yang lain menggolongkan
  pelanggan untuk harga. Menyamakannya berarti kategori anggota ikut berubah
  setiap kali seseorang menyunting daftar harga.
- **`cooperative_related_party`** mencatat hubungan keluarga antar anggota dan
  pengurus. Diperlukan aturan pemisahan wewenang nomor 6; tanpanya, benturan
  kepentingan hanya dapat ditangkap manusia yang kebetulan mengenali nama.
- **PIN anggota disimpan sebagai hash Argon2id**, tidak pernah plaintext, dan
  tidak pernah terlihat kasir.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 47 suite, **1135 tes lulus** (bertambah 48) |
| Bukti K-2 | **33 pemeriksaan lulus** |

### Belum dikerjakan pada K-2

- **Layanan dan endpoint keanggotaan** menyusul bersama K-3, sebab pengaktifan
  anggota adalah akibat dari transaksi simpanan pokok — memisahkannya berarti
  menulis dua kali jalur yang sama.

## K-1 — Profil koperasi, legalitas, dan kebijakan

**Cabang:** `feature/v12-ekoperasi`

### Ditambahkan

- **Migrasi modul** `20260731T160000__cooperative__profile_and_legality.sql`:
  delapan tabel — `cooperative_type`, `cooperative`,
  `cooperative_legal_document`, `cooperative_address`,
  `cooperative_service_area`, `cooperative_policy`, `cooperative_domain`,
  `cooperative_account_mapping`.
- **`cooperative-profile.ts`** — aturan sebagai fungsi murni: transisi status,
  daftar periksa kesiapan go-live, penyusunan dan pemeriksaan slug, masa
  berlaku berversi, dan kesesuaian jenis koperasi. **39 pengujian.**
- **`cooperative-profile.service.ts`** dan **`cooperative.module.ts`** —
  14 endpoint di bawah `/cooperative/*`.
- **`ports/index.ts`** — delapan port yang didefinisikan koperasi sendiri.
- **`scripts/apply-cooperative-migrations.mjs`** — penerap migrasi modul
  sementara, idempoten, mencatat pada tabel modulnya sendiri.
- **`scripts/prove-cooperative-k1.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k1-profil.txt` — **22 pemeriksaan, seluruhnya lulus.**

### Keputusan yang perlu dicatat

- **Satu ruang kerja hanya untuk satu koperasi**, ditegakkan indeks unik
  parsial. Dua koperasi pada satu tenant berarti dua bagan akun, dua RAT, dan
  dua SHU yang harus dipisahkan pada setiap kueri.
- **Koperasi berstatus ACTIVE wajib punya nomor badan hukum**, ditegakkan
  constraint. Itulah pembeda antara koperasi sah dan perkumpulan biasa, dan
  koperasi tidak sah tidak boleh menghimpun simpanan anggota.
- **Kebijakan aktif wajib menyebutkan persetujuannya.** Kebijakan yang berlaku
  tanpa persetujuan adalah kebijakan yang dibuat seseorang sendirian atas hak
  seluruh anggota.
- **AD/ART, aturan keanggotaan, dan kebijakan SHU sah hanya setelah diputuskan
  Rapat Anggota.** Ditegakkan layanan; tautan keputusannya diisi pada K-5.
- **Kebijakan baru selalu membentuk versi baru**, tidak pernah menyunting versi
  lama. SHU dihitung menurut kebijakan yang berlaku pada periode bukunya;
  kebijakan yang disunting di tempat membuat perhitungan tahun lalu tidak dapat
  diulang.
- **Kekurangan go-live dilaporkan seluruhnya sekaligus.** Pemilik koperasi yang
  diberi tahu satu kekurangan lalu satu lagi setelah memperbaikinya akan
  melalui banyak putaran untuk hal yang muat dalam satu layar.
- **Pembubaran bersifat akhir.** Menghidupkan kembali koperasi yang bubar
  berarti mendirikan koperasi baru dengan badan hukum baru, bukan mengubah
  status baris yang sama.

### Temuan baru untuk IR-001

`schema_migration.version` bertipe **`VARCHAR(16)`**, sedangkan id migrasi
modular yang diminta panduan §7 panjangnya 49 aksara. Kolom itu secara
struktural tidak dapat menampungnya — katalog modular tidak dapat berjalan
tanpa pelebaran kolom ini. Ditambahkan ke IR-001 sebagai bagian wajib dari
perubahan Core, beserta galat sungguhannya sebagai bukti.

### Berkas bersama yang disentuh

Satu: `apps/api/src/app.module.ts` — satu baris impor dan satu entri pada
`imports`. Sengaja sekecil mungkin, sebab berkas itu disentuh empat sesi
paralel. Tidak ada berkas bersama lain, tidak ada dependensi baru, lockfile
tidak berubah.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` (API dan web) | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 46 suite, **1087 tes lulus** (bertambah 39) |
| Bukti K-1 | **22 pemeriksaan lulus** |

### Belum dikerjakan pada K-1

- **Antarmuka `/ekoperasi/*`** ditunda ke K-9 bersama portal anggota, supaya
  seluruh layar koperasi dirancang sekaligus alih-alih sepotong per fase.
- **Langganan Rp 500.000/bulan** memerlukan paket pada control plane; menunggu
  keputusan sesi Core apakah paket vertikal masuk katalog paket yang sama.
- **Menu dan hak akses koperasi** belum disemai — menunggu IR-004. Endpoint
  sudah ada dan berpenjaga, tetapi penyewa sungguhan belum dapat memanggilnya.
  Itu keadaan yang benar, bukan yang perlu diakali.

## K-0 — Audit dan batas konteks

**Cabang:** `feature/v12-ekoperasi` · **Titik tolak:** `origin/main` @ `4f7ab88`

### Ditambahkan

- Sembilan dokumen audit di `docs/ekoperasi/`: keadaan saat ini, peta domain,
  matriks pakai-ulang, kontrak integrasi POS, kontrak akuntansi, keamanan dan
  pemisahan wewenang, rencana implementasi, garis dasar pengujian, dan daftar
  permintaan integrasi.
- Empat permintaan integrasi di `docs/integration-requests/cooperative/`.

### Temuan

- **Tidak ada satu pun kode koperasi di dalam repositori.** Kata "koperasi"
  hanya muncul pada naskah pemasaran. Delapan agregat koperasi seluruhnya
  dibangun baru, sekitar 80 tabel.
- **Katalog migrasi masih tunggal dan bernomor urut.** Tiga vertikal yang
  sama-sama menambahkan ke `manifest.json` bukan sekadar akan berkonflik saat
  penggabungan — dua migrasi berbeda dapat memakai nomor sama, dan penyewa yang
  sudah menerapkan salah satunya akan **melewati** yang lain tanpa satu pun galat
  muncul. → IR-001.
- **Sembilan port bersama yang disebut perintah belum ada.** Tidak menghalangi:
  port yang baik didefinisikan pemakainya. Koperasi mendefinisikan sendiri di
  `modules/cooperative/ports/`.
- **`modules/health/` sudah terpakai** oleh pemeriksaan kesehatan platform,
  padahal panduan memberikannya kepada sesi eMedik. Disampaikan sebagai temuan
  untuk sesi lain.

### Keputusan yang perlu dicatat

- **`investor_profile` dan `ownership_interest` TIDAK dipakai untuk
  keanggotaan.** Keduanya memodelkan penyertaan modal perseroan, dengan suara
  mengikuti kepemilikan. Koperasi bekerja terbalik — satu anggota satu suara,
  berapa pun simpanannya. Memakainya akan menanamkan pembobotan suara
  berdasarkan modal ke dalam fondasinya.
- **Simpanan pokok dan wajib diperlakukan sebagai ekuitas, bukan kewajiban.**
  Keduanya tidak dapat ditarik selama keanggotaan berjalan. Menyamakannya dengan
  simpanan sukarela akan membuat neraca menyatakan modal sendiri jauh lebih
  kecil daripada yang sebenarnya, dan rasio kesehatan yang dihitung di atasnya
  ikut salah.
- **Akad syariah memakai kode peristiwa akuntansi tersendiri**, bukan kode
  pinjaman dengan nama berbeda. Memakai `COOPERATIVE_LOAN_DISBURSED` untuk
  murabahah akan menyajikan jual-beli sebagai pinjaman berbunga.
- **Angsuran wajib memisahkan pokok dan jasa.** Keduanya masuk akun berbeda, dan
  membelah totalnya kemudian berarti menebak berapa pendapatan koperasi.
- **Unit usaha tidak memiliki POS sendiri.** Ia tertaut ke `outlet` dan
  `pos_terminal` Core lewat satu tabel penghubung. POS kedua akan membelah
  persediaan dan pembukuan menjadi dua kebenaran.
- **Patronage dibaca berkala, bukan ditulis saat transaksi.** Ia dihitung atas
  periode buku yang sudah ditutup; menuliskannya saat transaksi berarti angkanya
  ikut berubah setiap ada retur — sesudah SHU dihitung.
- **PIN anggota tidak pernah sampai ke kasir maupun ke POS.** Layar PIN milik
  koperasi; yang diserahkan ke POS hanya token sekali pakai berumur 60 detik.

### Garis dasar

| | |
|---|---|
| `pnpm install --frozen-lockfile` | berhasil — lockfile tidak berubah |
| `tsc --noEmit` (API) | bersih |
| `jest` (API) | 45 suite, **1048 tes lulus** |
| Cakupan pengujian koperasi | **nol** — sasaran K-11: sekitar 1325 |

### Belum dikerjakan

Tidak ada kode koperasi yang ditulis pada K-0. Audit ini sengaja berhenti pada
dokumen, sebab tiga dari empat permintaan integrasi menentukan bentuk kode yang
akan ditulis sesudahnya — dan menulis kode lebih dahulu lalu menyesuaikannya
berarti mengerjakan hal yang sama dua kali.
