# 25 · UAT Persona eMedik

**43 peran kesehatan, seluruhnya dijalankan sebagai orang sungguhan terhadap
peladen yang hidup.** Tiap persona dibuatkan pengguna, diberi **peran yang
tersemai apa adanya**, dimintai login, lalu diminta mengerjakan pekerjaan
hariannya dan mencoba hal yang bukan wewenangnya.

```bash
cd C:/opt/eBisnisGithub-emedik/apps/api && node scripts/prove-health-uat-persona.mjs
```

Menuntut peladen hidup. Hasil terakhir disimpan ke
[`bukti-uat-persona.txt`](bukti-uat-persona.txt).

```
lulus 217, gagal 0
cakupan 43/43 peran
```

---

## Mengapa UAT ini ada

Seluruh fase sebelumnya membuktikan bahwa **fitur** bekerja. Tidak satu pun
membuktikan bahwa **pembagian kerjanya** benar.

Itu pertanyaan yang berbeda, dan tidak dapat dijawab uji unit. Peran yang
dihibahi terlalu banyak akan lulus setiap uji yang ada — sebab tidak ada satu
pun uji yang bertanya "seharusnya siapa yang boleh".

### Yang TIDAK dibuktikannya

Ia **tidak** membuktikan penjaga hak akses bekerja. Penjaga membaca tabel hibah
yang sama, sehingga "ditolak bila tidak dihibahkan" hampir merupakan tautologi.

Yang dibuktikannya: **hibah yang tersemai sesuai dengan kebijakan yang
dinyatakan.** Daftar menu berdata pasien dan daftar peran non-klinis di dalam
naskahnya **ditulis tangan dengan sengaja** — keduanya pernyataan kebijakan,
bukan turunan dari basis data. Menurunkannya dari basis data akan membuatnya
menyetujui apa pun yang tersemai, termasuk yang keliru.

---

## Bentuk tiap persona

Mengikuti [`docs/ekoperasi/10-uat-skenario.md`](../ekoperasi/10-uat-skenario.md):

| Bagian | Isinya |
|---|---|
| **kerja** | yang dilakukannya tiap hari; harus **tidak** ditolak |
| **ditolak** | yang bukan wewenangnya; harus ditolak **403** |
| **hibahTerlarang** | hak yang tidak boleh dipegangnya sama sekali |

> **Bagian "ditolak" yang paling berharga.** Sistem yang mengizinkan seluruhnya
> tetap lulus seluruh bagian "kerja".

`hibahTerlarang` ada karena sebagian pemisahan wewenang **tidak terlihat dari
satu panggilan HTTP**: ia tentang hak yang TIDAK ada pada tabel hibah, dan
satu-satunya cara memeriksanya adalah membaca tabelnya.

Penolakan diperiksa **tepat 403**, bukan "gagal apa pun". 404 atau 400 bukan
penolakan — ia kegagalan yang berbeda, dan menghitungnya sebagai penolakan akan
menyembunyikan jalan yang sebenarnya terbuka. Penjaga hak berjalan **sebelum**
handler, jadi jalan berparameter diuji dengan id palsu: bila jawabannya 404
alih-alih 403, itu sendiri temuan.

---

## Pemisahan wewenang yang terbukti berlaku

Yang tersemai ternyata jauh lebih tajam daripada yang diduga. Yang paling
penting, menurut akibatnya bila dilanggar:

### Kamar operasi — daftar periksa keselamatan WHO

| Peran | Memegang | TIDAK memegang |
|---|---|---|
| Dokter bedah | `SURGERY.INCISE`, `CREATE`, `CANCEL` | **`SURGERY.CHECKLIST`** |
| Perawat instrumen | `SURGERY.CHECKLIST` | **`SURGERY.INCISE`**, `CREATE` |

Yang menyayat **tidak mencentang daftar periksa keselamatannya sendiri**. Ini
inti daftar periksa WHO: yang menyatakan persiapan sudah benar tidak boleh orang
yang paling dirugikan bila operasinya tertunda.

### Laboratorium

| Peran | Memegang | TIDAK memegang |
|---|---|---|
| Radiografer | `LAB_RESULT.CREATE` | **`VERIFY_RESULT`** |
| Penanggung jawab lab | `LAB_RESULT.VERIFY_RESULT`, `AMEND` | **`CREATE`** |

### Uang — empat tangan yang berbeda

| Tahap | Peran | Hak |
|---|---|---|
| menghitung | Petugas kalkulasi jasa | `FEE_SETTLEMENT.CREATE` |
| menyetujui | Penyetuju kebijakan jasa | `FEE_SETTLEMENT.APPROVE` |
| membayar | Petugas pembayaran jasa | `FEE_SETTLEMENT.POST` |
| membalik | Petugas keuangan | `FEE_SETTLEMENT.REVERSE` |

Tidak satu peran pun memegang dua di antaranya.

### Kontrak, koding, klaim, tarif, alat

| Yang menyusun | Yang memutuskan |
|---|---|
| `CONTRACT_DRAFTER` — `FEE_CONTRACT.CREATE` | `CONTRACT_APPROVER` — `APPROVE`, `ACTIVATE` |
| `CODER` — `HIM_CODING.CREATE` | `CODING_VERIFIER` — `VERIFY` |
| `CLAIM_OFFICER` — `CLAIM.CREATE` | `CLAIM_VERIFIER` — `VERIFY` |
| `TARIFF_OFFICER` — `TARIFF.IMPORT` | `HEALTH_ADMIN` — `APPROVE`, `ACTIVATE` |
| `DEVICE_INBOX_CLERK` — `DEVICE_INBOX.ASSIGN` | `LAB_SUPERVISOR` — `REVIEW` |
| `DEVICE_SECURITY_ANALYST` — `DEVICE_SECURITY.CREATE` | `HEALTH_ADMIN` — `APPROVE` |
| `SERVICE_CATALOGUER` — `SERVICE_CATALOG.CREATE` | `HEALTH_ADMIN` — `ACTIVATE` |
| `INVESTOR_ANALYST` — `INVESTOR_DISTRIBUTION.CREATE` | `SETTLEMENT_PAYER` — `POST` |

### Batas profesi

- **Apoteker** memegang `PRESCRIPTION.READ` + `REVIEW`, **bukan `CREATE`** — ia
  menelaah resep, tidak menulisnya. Dan ia tidak memegang `ADMINISTRATION` sama
  sekali: pemberian obat di bangsal dicatat perawat.
- **Perawat** memegang `ADMINISTRATION.ADMINISTER`, **bukan**
  `PRESCRIPTION.CREATE`.
- **Kader posyandu** memegang `IMMUNIZATION.READ` **tanpa `CREATE`** — ia dapat
  memberitahu ibu kapan giliran anaknya, tetapi **tidak menyuntik**. Ia juga
  memegang `SAFETY.CREATE` **tanpa `READ`**: ia dapat melaporkan insiden, tetapi
  tidak menelusuri laporan orang lain.
- **Petugas bangsal** memegang `BED.UPDATE`, **bukan `ADMISSION.ADMIT`** — ia
  mengatur tempat tidur, tidak memutuskan rawat inap.

### Siapa yang tidak pernah melihat rekam pasien

Disapu atas **seluruh** menu berdata pasien, bukan hanya yang kebetulan diuji
persona:

- **Seluruh peran investor** — aturan mutlak R2. Termasuk jalan berparameter.
- **Administrator eMedik** — ia mengurus sistem, bukan pasien.
- **Direktur** — ia melihat papan arus pelayanan dan agregat mutu, tetapi
  **tidak memegang `HEALTH_PATIENT`**. Jabatan tinggi bukan alasan klinis.
- **Manajer mutu** — ia **menyetujui akses darurat** tanpa memegang
  `HEALTH_PATIENT`. Ia menelaah apakah aksesnya patut, bukan isi rekamnya.
- Seluruh peran uang, tarif, katalog, interoperabilitas, dan keamanan alat.

> Direktur sengaja **dikecualikan** dari sapuan mutlak: ia memegang papan ICU,
> gawat darurat, dan rawat inap supaya dapat mengawasi arus pelayanan. Itu
> keputusan sadar, dan persona direkturlah yang memeriksa batasnya.

---

## Temuan: nama pasien bocor lewat daftar tempat tidur

**Satu temuan sungguhan, dan sudah ditutup.**

### Yang terjadi

`HEALTH_ADMIN` menerima **403** pada `/health/patients` dan tidak memegang
`HEALTH_ADMISSION`, sehingga papan bangsal pun tertutup baginya. Tetapi ia
memegang `HEALTH_BED.READ`, dan `GET /health/inpatient/beds` menjawab **200**
berisi:

```
tempat tidur TT-ISO-… / Kamar Isolasi  ->  Sari …  (INP-IN-…-20260731-0002)
```

Nama lengkap, nomor rawat inap, dan letak kamarnya. Pintu depan terkunci, pintu
samping terbuka.

**Yang membuatnya lebih dari kebocoran nama:** kamarnya kamar isolasi. Letak itu
sendiri sudah menyatakan sesuatu yang klinis tentang orang itu.

### Mengapa tidak tertangkap sebelumnya

Kueri `daftarTempatTidur` memang `LEFT JOIN patient` dan memilih `p.full_name`.
Tidak ada yang keliru pada satu jalan itu bila dilihat sendirian — perawat
memang perlu melihat siapa yang ada di tempat tidur mana. Yang keliru hanya
tampak ketika ditanya **siapa lagi yang memegang haknya**.

Itu sebabnya UAT persona menemukannya dan 2.500 uji lain tidak.

### Yang diperbaiki

`samarkanPenghuniTempatTidur()` pada `health-inpatient.ts` membuang
`patient_name` dan `admission_number` bagi yang tidak memegang
`HEALTH_ADMISSION.READ`. Kode tempat tidur, kamar, status, kelas rawat, dan
waktu pembersihan **tetap utuh** — itulah yang diperlukan pengurus sarana.

**Tidak ada pekerjaan yang hilang.** Setiap pemegang `HEALTH_BED.READ` selain
administrator — perawat, petugas bangsal, direktur — juga memegang
`HEALTH_ADMISSION.READ`, dan UAT inilah yang membuktikannya.

### Yang menjaganya sesudah ini

Bukan daftar, melainkan **pemeriksaan perilaku**: UAT memanggil peladen sebagai
administrator dan sebagai perawat pada fasilitas yang tempat tidurnya
**benar-benar terisi**, lalu melihat apa yang keluar.

> **Nol baris bukan bukti keamanan.** Percobaan pertama memilih fasilitas mana
> saja, memperoleh nol baris, dan tampak aman. Fasilitas yang terisi harus
> dicari dengan sengaja.

---

## Batas laju login

`/auth/login` dibatasi **10 percobaan per 60 detik**, dan batasnya **terkunci
pada dekorator** [`auth.controller.ts:113`](../../apps/api/src/modules/auth/auth.controller.ts)
sehingga `THROTTLE_AUTH_LIMIT` pada `.env` **tidak mengubahnya**.

Pembatas itu benar — ia yang menahan penebakan sandi. Yang keliru adalah UAT
yang masuk 43 kali lalu melaporkan "peran tidak ada". Naskahnya menunggu
jendelanya berganti dan **mengatakan** bahwa ia menunggu; satu jalan penuh
memakan sekitar lima menit.

> Perbedaan `.env` dengan dekorator itu sendiri patut diketahui operator: orang
> yang menaikkan `THROTTLE_AUTH_LIMIT` untuk uji beban tidak akan melihat
> perubahan apa pun.

---

## Yang masih harus dikerjakan orang

UAT ini memeriksa **wewenang**, bukan kegunaan. Yang belum diperiksa dan hanya
dapat diperiksa manusia:

1. **Apakah layarnya dapat dipakai** untuk pekerjaan itu — UAT hanya memanggil
   API, tidak membuka layar.
2. **Apakah alur kerjanya masuk akal** dari ujung ke ujung: satu pasien, dari
   pendaftaran sampai klaim terbayar, dikerjakan orang yang berbeda-beda.
3. **Apakah pesan penolakannya berguna** bagi yang menerimanya. UAT memeriksa
   angka 403; ia tidak memeriksa apakah kalimatnya memberitahu jalan keluarnya.
4. **Uji E2E dan uji kinerja** — masih terbuka, sebagaimana dicatat
   [24](24-rencana-layar-sisa.md).
