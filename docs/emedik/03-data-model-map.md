# H-0 · Peta Model Data

Bagaimana model kesehatan menempel pada 153 tabel yang sudah ada, dan di mana
ia berdiri sendiri.

---

## Penamaan

Seluruh tabel kesehatan berawalan sesuai konteksnya, bukan berawalan `health_`
untuk semuanya. Awalan tunggal yang panjang membuat setiap nama tabel berbunyi
sama dan tidak menolong siapa pun.

```
health_        fasilitas dan profil tenant     health_facility, health_tenant_profile
patient_       identitas pasien                patient, patient_identifier
encounter_     kunjungan dan klinis            encounter, encounter_diagnosis
order_         pesanan klinis                  order_clinical, order_laboratory
rx_            farmasi                         rx_prescription, rx_dispensing
lab_ / rad_    diagnostik                      lab_result, rad_study
adt_           rawat inap                      adt_admission, adt_bed_assignment
nursing_       keperawatan                     nursing_assessment
primary_       Puskesmas dan Posyandu          primary_family_folder, primary_growth
billing_       keuangan kesehatan              billing_patient_bill, billing_claim
```

Yang penting bukan awalannya, melainkan bahwa **tidak ada tabel kesehatan yang
namanya dapat dikira tabel inti**. Tidak ada `visit`, `note`, `result`, atau
`schedule` tanpa awalan — ketiganya terlalu umum.

---

## Titik singgung dengan tabel inti

Delapan titik. Masing-masing perlu keputusan sadar, bukan kebetulan.

### 1. Fasilitas ↔ `outlet`

`health_facility` **tidak** menggantikan `outlet`, dan **tidak** memakainya.

| | `outlet` | `health_facility` |
|---|---|---|
| Punya | kode, nama, alamat, zona waktu, merek | ditambah: jenis fasilitas, kelas rumah sakit, nomor izin, jejaring, kepemilikan |
| Dipakai | POS, gudang, penjualan | pendaftaran, kunjungan, klaim |

Keputusan: `health_facility.outlet_id` **nullable**. Fasilitas yang juga menjual
barang (apotek dengan kasir) menautkan diri ke outlet; Posyandu tidak punya
outlet sama sekali, dan memaksakannya akan menciptakan outlet palsu yang muncul
di laporan penjualan.

### 2. Pasien ↔ `customer`

`patient.customer_id` **nullable**, searah, dan **tidak pernah** dipakai sebagai
sumber identitas pasien. Diisi hanya bila pasien menjadi pihak tertagih
(bayar sendiri). Pasien yang ditanggung BPJS tidak punya `customer_id`.

Arah tautannya penting: pasien menunjuk pelanggan, bukan sebaliknya. Sebaliknya
akan membuat setiap pelanggan tampak seperti calon pasien.

### 3. Obat ↔ `product`

`rx_drug_master.product_id` **wajib** — obat memang barang yang dibeli, disimpan,
dan dihitung stoknya oleh mesin persediaan yang sudah ada. Yang ditambahkan
`rx_drug_master` adalah yang tidak dikenal barang dagangan:

```
golongan (bebas, bebas terbatas, keras, narkotika, psikotropika)
bentuk sediaan dan kekuatan
zat aktif
formularium
aturan substitusi
```

Stoknya tetap di `stock_balance`, diakses lewat `InventoryPort`.

### 4. Tarif ↔ `price_book`

`billing_charge_catalog` berdiri sendiri. `price_book` menentukan harga menurut
outlet dan tanggal; tarif kesehatan menurut **kelas rawat, penjamin, dan
casemix** — tiga sumbu yang tidak ada padanannya.

Obat yang dijual di apotek tetap memakai `price_book`. Tindakan medis tidak.

### 5. Tagihan ↔ akuntansi

`billing_patient_bill` tidak pernah menulis `journal_entry`. Ia menerbitkan
`accounting_event` lewat port. Satu tagihan pasien dapat menghasilkan beberapa
peristiwa (pendapatan jasa, pendapatan obat, piutang penjamin, HPP farmasi),
dan pemetaannya ke akun tinggal di `accounting_posting_rule` — data, bukan kode.

### 6. Tenaga kesehatan ↔ `user_subject` dan `employee`

Dokter adalah tiga hal sekaligus: pengguna sistem (`user_subject`), pegawai
(`employee`), dan pemberi layanan berkewenangan klinis.

Keputusan: `health_provider` tabel tersendiri dengan `user_subject_id` dan
`employee_id` keduanya nullable. Alasannya — dokter tamu punya kewenangan klinis
tanpa menjadi pegawai; kader Posyandu adalah pemberi layanan tanpa akun sistem.
Memaksakan keduanya wajib akan menutup dua keadaan yang justru umum.

Kewenangan klinis (`clinical_privilege`) melekat pada `health_provider`, bukan
pada peran. Peran menentukan menu apa yang terbuka; kewenangan klinis
menentukan tindakan apa yang boleh dilakukan — dan keduanya berbeda.

### 7. Dokumen ↔ `file_object`

Hasil radiologi, hasil laboratorium terlampir, dan foto luka memakai
`file_object` + `entity_attachment` yang sudah ada. Yang ditambahkan kesehatan
adalah aturan pelepasan informasi dan retensi di atasnya — bukan penyimpanan
kedua.

Biner DICOM **tidak** masuk basis data. `rad_study` menyimpan metadata dan
penunjuk ke PACS.

### 8. Surat ↔ `surat_*`

Surat keterangan sakit dan rujukan administratif memakai tata kelola surat yang
sudah ada — penomorannya sudah terbukti tidak dapat kembar.

Resume medis, hasil laboratorium, dan catatan operasi **tidak**. Ketiganya
dokumen medis dengan aturan retensi, penahanan hukum, dan pelepasan informasi
yang tidak dikenal tata kelola surat.

---

## Kolom yang wajib ada pada setiap tabel kesehatan

Selain kolom siklus hidup standar yang sudah dipakai seluruh tabel tenant
(`is_active`, `is_sample`, `sample_batch_id`, `created_at`, `deleted_at`,
`version`, dan seterusnya), tabel kesehatan menambahkan:

| Kolom | Pada tabel | Mengapa |
|---|---|---|
| `facility_id` | seluruh tabel transaksional | Satu tenant dapat punya beberapa fasilitas; pemisahannya harus dapat ditegakkan |
| `patient_id` | seluruh tabel klinis | Titik masuk pencatatan pembacaan |
| `sensitivity` | tabel klinis | `NORMAL` / `RESTRICTED` / `VERY_RESTRICTED`. Ditandai sejak awal — menandainya belakangan berarti data lama harus ditebak |
| `signed_at`, `signed_by` | tabel dokumentasi | Yang sudah ditandatangani tidak dapat diubah |
| `amended_from_id` | tabel dokumentasi | Amandemen menunjuk yang digantikannya; yang asli tetap terbaca |

---

## Tabel yang tidak ada padanannya sama sekali

Perlu disebut karena ia tidak muncul dari mana pun di inti:

```
health_access_log        siapa MEMBACA rekam medis apa, untuk tujuan apa
patient_merge            riwayat penggabungan, dapat dibatalkan
patient_consent          persetujuan berbagi, per tujuan, dapat dicabut
clinical_privilege       kewenangan klinis per pemberi layanan
critical_result_ack      penerimaan hasil kritis oleh manusia berwenang
break_glass_access       akses darurat di luar hubungan perawatan
legal_hold               penahanan hukum yang mengalahkan aturan retensi
```

`health_access_log` akan menjadi tabel dengan baris terbanyak di seluruh
sistem — setiap pembukaan rekam medis menambah satu baris. Ia perlu partisi
menurut waktu sejak awal, bukan sesudah lambat.

---

## Yang diputuskan pada H-1, bukan sekarang

- Apakah `patient` berada di skema tenant yang sama atau skema terpisah.
  Pertimbangannya: pemisahan skema mempermudah pembatasan akses dan pencadangan
  terpisah, tetapi mempersulit gabungan dengan tabel inti. Keputusan menunggu
  bentuk `IdentityPort` final.
- Partisi `health_access_log` — menurut bulan atau menurut fasilitas.
- Apakah nomor rekam medis memakai `number_sequence` yang ada atau penomoran
  tersendiri. `number_sequence` sudah punya lingkup dan kebijakan reset; yang
  perlu diperiksa adalah apakah lingkupnya dapat per fasilitas.
