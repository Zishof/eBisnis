# D-0 · Peta Profil Desa dan Kelurahan

Perintah §8 mewajibkan setiap fitur menyatakan kelayakannya:

```
DESA_ONLY  KELURAHAN_ONLY  BOTH  CONFIGURABLE
```

Dokumen ini menetapkannya untuk seluruh cakupan, dan menerangkan mengapa
pembedaannya bukan sekadar penyembunyian menu.

---

## Mengapa pembedaan ini serius

Desa dan kelurahan bukan dua nama untuk hal yang sama. Perbedaannya bersumber
dari undang-undang, dan menyalahkannya bukan sekadar menampilkan menu yang
tidak terpakai:

| | Desa | Kelurahan |
|---|---|---|
| Kedudukan | Kesatuan masyarakat hukum yang berwenang mengatur urusannya sendiri | Perangkat kecamatan; bagian dari perangkat daerah |
| Pemimpin | Kepala Desa — **dipilih warga**, punya masa jabatan | Lurah — **pegawai negeri yang ditugaskan**, tanpa masa jabatan pemilihan |
| Anggaran | APBDes sendiri, disahkan bersama BPD | Bagian dari APBD kabupaten/kota; **tidak punya anggaran sendiri** |
| Lembaga permusyawaratan | BPD | Tidak ada padanannya |
| Perencanaan | RPJMDes dan RKPDes sendiri | Mengikuti Renstra kecamatan/daerah |
| Aset | Aset desa, milik desa | Aset daerah yang ditempatkan di kelurahan |
| Badan usaha | BUMDes | Tidak ada padanannya |

Menyodorkan APBDes kepada kelurahan bukan hanya membingungkan — ia mengundang
kelurahan mencatat anggaran pada sistem yang bukan sistem anggarannya, lalu
angka itu tidak pernah cocok dengan APBD daerah. Karena itu kelayakannya
ditegakkan pada **layanan dan basis data**, bukan hanya pada tampilan menu.

---

## Matriks kelayakan

### Profil wilayah dan portal (D-1)

| Fitur | Kelayakan | Catatan |
|---|---|---|
| Profil unit pemerintahan | `BOTH` | Bentuknya berbeda: `VillageProfile` vs `UrbanVillageProfile` |
| Kode administratif (Provinsi→Kab→Kec) | `BOTH` | Kode wilayah nasional berlaku bagi keduanya |
| Dusun (Hamlet) | `DESA_ONLY` | Kelurahan memakai lingkungan, bukan dusun |
| Lingkungan | `KELURAHAN_ONLY` | |
| RT / RW | `BOTH` | Keduanya punya |
| Batas wilayah dan geospasial | `BOTH` | |
| Potensi dan indikator desa | `CONFIGURABLE` | Kelurahan boleh memakainya bila daerah memintanya |
| Domain dan situs | `BOTH` | `<slug>.info-desa.id` untuk keduanya |

### Penduduk dan keluarga (D-2)

| Fitur | Kelayakan | Catatan |
|---|---|---|
| Seluruh cakupan penduduk, keluarga, mutasi | `BOTH` | Kependudukan adalah urusan keduanya, tanpa perbedaan |
| Penduduk rentan, kondisi sosial | `BOTH` | |
| Penduduk tidak tetap | `BOTH` | |

Ini bagian yang paling tidak berbeda, dan patut disebut: kesamaan pun perlu
dinyatakan agar tidak ada yang "berjaga-jaga" membedakannya tanpa alasan.

### Aparatur (D-3)

| Fitur | Kelayakan | Catatan |
|---|---|---|
| Kepala Desa | `DESA_ONLY` | Dipilih; punya masa jabatan |
| Lurah | `KELURAHAN_ONLY` | Ditugaskan; tanpa masa jabatan pemilihan |
| Sekretaris | `BOTH` | Sebutannya berbeda, perannya setara |
| Kaur / Kasi | `BOTH` | |
| **BPD** | `DESA_ONLY` | Tidak ada padanannya di kelurahan |
| Kepala Dusun | `DESA_ONLY` | |
| Ketua RT / RW | `BOTH` | |
| Linmas | `BOTH` | |
| Masa jabatan dan pemilihan | `DESA_ONLY` | Lurah tidak melewati pemilihan |

### Layanan warga dan surat (D-4)

| Fitur | Kelayakan | Catatan |
|---|---|---|
| Katalog layanan, permohonan, verifikasi, penerbitan | `BOTH` | Inti sistem, sama bagi keduanya |
| Antrean dan loket | `BOTH` | |
| Penomoran surat | `BOTH` | Pola nomornya berbeda dan dapat dikonfigurasi |
| Tanda tangan Kepala Desa | `DESA_ONLY` | |
| Tanda tangan Lurah | `KELURAHAN_ONLY` | |
| Surat pengantar ke kecamatan | `CONFIGURABLE` | Alurnya berbeda menurut daerah |

### Pengaduan dan partisipasi (D-5)

| Fitur | Kelayakan | Catatan |
|---|---|---|
| Pengaduan warga, tindak lanjut, penyelesaian | `BOTH` | |
| Aspirasi dan survei | `BOTH` | |
| **Musrenbang Desa** | `DESA_ONLY` | |
| Musrenbang Kelurahan | `KELURAHAN_ONLY` | Bentuk dan jenjangnya berbeda; keduanya dipisah, bukan disatukan |
| Konsultasi publik | `BOTH` | |

### Perencanaan dan keuangan (D-6)

| Fitur | Kelayakan | Catatan |
|---|---|---|
| **RPJMDes / RKPDes** | `DESA_ONLY` | |
| **APBDes** dan seluruh turunannya | `DESA_ONLY` | Buku kas, buku bank, buku pajak, LPJ, realisasi |
| Rencana kegiatan kelurahan | `KELURAHAN_ONLY` | Menempel pada perencanaan kecamatan/daerah |
| Pagu dan realisasi kelurahan | `KELURAHAN_ONLY` | Menerima pagu, bukan menyusun anggaran sendiri |
| Publikasi transparansi anggaran | `BOTH` | Isinya berbeda; kewajiban keterbukaannya sama |

### Aset, pengadaan, bantuan (D-7)

| Fitur | Kelayakan | Catatan |
|---|---|---|
| Aset desa | `DESA_ONLY` | Milik desa |
| Aset daerah di kelurahan | `KELURAHAN_ONLY` | Dicatat sebagai penempatan, bukan kepemilikan |
| Pengadaan | `CONFIGURABLE` | Kewenangan pengadaan kelurahan bergantung kebijakan daerah |
| Bantuan sosial | `BOTH` | Pendataan dan penyaluran berlaku bagi keduanya |

### Usaha (D-8)

| Fitur | Kelayakan | Catatan |
|---|---|---|
| **BUMDes** | `DESA_ONLY` | |
| UMKM dan profil usaha | `BOTH` | Pendataan usaha warga tidak mengenal batas ini |
| Wisata | `BOTH` | |
| Peluang investasi | `DESA_ONLY` | Terikat pada BUMDes |

### Keamanan, bencana, lingkungan, pertanahan (D-9)

Seluruhnya `BOTH`, kecuali:

| Fitur | Kelayakan | Catatan |
|---|---|---|
| Surat keterangan tanah | `CONFIGURABLE` | Kewenangan kelurahan berbeda menurut daerah |
| Pernyataan batas | `CONFIGURABLE` | Sama |

### Situs, portal, transparansi (D-10, D-11)

Seluruhnya `BOTH`, kecuali:

| Fitur | Kelayakan | Catatan |
|---|---|---|
| Transparansi APBDes | `DESA_ONLY` | Mengikuti keberadaan APBDes |
| Pengawasan BPD | `DESA_ONLY` | |
| PPID | `BOTH` | Keterbukaan informasi publik mengikat keduanya |

---

## Cara kelayakan ditegakkan

Empat lapisan, dan yang pertama saja tidak cukup:

1. **Menu.** Katalog menu village menyimpan `eligibility` per simpul; menu
   disaring saat disusun untuk penyewa.
2. **Hak akses.** Peran `DESA_ONLY` tidak disemai pada penyewa kelurahan.
   `BPD` tidak akan pernah ada sebagai peran di kelurahan.
3. **Layanan.** Setiap layanan memeriksa profil penyewa sebelum bekerja.
   Menyembunyikan menu tetapi membiarkan endpoint-nya terbuka berarti fiturnya
   masih dapat dipanggil langsung — dan itu bukan pembatasan, melainkan
   penyamaran.
4. **Data contoh.** Pabrik data contoh tidak membuat APBDes untuk kelurahan.

Pengujian kebocoran profil (perintah §8: *"Test profile leakage wajib
tersedia"*) menguji lapisan **ketiga**, bukan pertama. Menu yang tersembunyi
mudah diuji dan tidak membuktikan apa-apa; endpoint yang menolak adalah yang
sesungguhnya menahan.

---

## Yang sengaja dibuat `CONFIGURABLE`

Enam fitur dibiarkan dapat dikonfigurasi, bukan dikunci. Alasannya sama untuk
seluruhnya: **kewenangannya berbeda antar kabupaten/kota**, dan menebaknya dari
pusat akan salah di sebagian daerah. Yang benar adalah menyediakan sakelarnya
dan membiarkan daerah yang bersangkutan menentukan.

Sakelar itu sendiri harus punya jejak: siapa menyalakannya, kapan, dan atas
dasar apa. Kewenangan yang dinyalakan tanpa dasar adalah temuan audit yang
menunggu terjadi.
