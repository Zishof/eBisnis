# 10 · Matriks Kemampuan BPJS/JKN

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026
**Perintah:** `PERINTAH_CLAUDE_CODE_EKSEKUSI_PARALEL_V12_R2_EMEDIK.md` §5

---

## Pemisahan yang tidak boleh dikaburkan

```text
SATUSEHAT  →  pertukaran data kesehatan (FHIR)
BPJS/JKN   →  kepesertaan, rujukan, SEP, antrean, klaim, casemix,
              verifikasi, pembayaran, rekonsiliasi
```

Keduanya **konteks terbatas yang berbeda**, dengan kredensial berbeda, siklus
hidup berbeda, dan kegagalan yang berbeda pula. Menyatukannya ke dalam satu
modul "integrasi nasional" akan membuat kegagalan pengiriman FHIR menghentikan
pengajuan klaim — dan sebaliknya, kesibukan musim klaim menghentikan pengiriman
data klinis.

Karena itu keduanya memakai pekerja (worker) terpisah, antrean terpisah, dan
gerbang kemampuan terpisah.

---

## Status seluruh adapter

Sama seperti SATUSEHAT: **tidak satu pun dapat diaktifkan hari ini.**

| Adapter | Cakupan | Status | Penghalang |
|---|---|---|---|
| `BpjsVClaimAdapter` | Kepesertaan, rujukan, SEP, surat kontrol | `BLOCKED` | Consumer ID, secret, user key |
| `BpjsPcareAdapter` | FKTP: pendaftaran, kunjungan, rujukan | `BLOCKED` | Kredensial FKTP |
| `BpjsAntreanAdapter` | Antrean daring | `BLOCKED` | Kredensial; kewajiban SLA jawaban |
| `BpjsAplicaresAdapter` | Ketersediaan tempat tidur | `BLOCKED` | Kredensial |
| `BpjsHfisAdapter` | Profil dan kelas fasilitas | `BLOCKED` | Kredensial |
| `BpjsEklaimAdapter` | Pengelompokan INA-CBG | `BLOCKED` | Berkas grouper; lisensi |
| `BpjsClaimInteroperabilityAdapter` | Pertukaran klaim | `BLOCKED` | Kredensial; spesifikasi berversi |

---

## Yang boleh dibangun tanpa kredensial

Inilah bagian yang justru paling banyak, dan paling berguna.

**Seluruh siklus hidup klaim di dalam rumah sakit dapat dibangun sekarang.**
Yang terhalang hanya dua ujungnya: menanyakan kepesertaan ke BPJS, dan
mengirimkan klaimnya. Yang di antara keduanya — pengkodean, pengelompokan,
kelengkapan berkas, verifikasi internal, penelusuran selisih — seluruhnya milik
kami dan tidak menuntut kredensial siapa pun.

| Boleh dibangun sekarang | Alasan |
|---|---|
| `BpjsProviderAccount` beserta gerbang kemampuannya | Konfigurasi, bukan panggilan |
| `BpjsParticipantEligibility` sebagai **cache hasil**, dengan penanda kedaluwarsa | Bentuknya milik kami; isinya menunggu panggilan |
| `BpjsSep` sebagai catatan lokal | Nomornya dari BPJS, catatannya milik kami |
| `BpjsClaim`, `BpjsClaimLine`, `BpjsClaimDocument` | Berkas klaim disusun di sini sebelum dikirim ke mana pun |
| `BpjsClaimVerification` — verifikasi **internal** | Menemukan kekurangan sebelum BPJS menemukannya |
| `BpjsClaimDispute`, `BpjsClaimReconciliation` | Penelusuran selisih antara diajukan, disetujui, dan dibayar |
| `JknTariffRegulation` dan turunannya | Struktur tarif berversi; isinya diimpor |
| Seluruh model kelas, KRIS, dan COB | Kebijakan berversi, bukan panggilan |

| **Tidak boleh dibangun sekarang** | Alasan |
|---|---|
| Panggilan HTTP ke BPJS | Bentuk, penandatanganan, dan enkripsinya harus diverifikasi |
| Pengelompokan INA-CBG | Grouper adalah perangkat lunak berlisensi; menirunya menghasilkan tarif karangan |
| Nilai tarif resmi | Harus diimpor dari terbitan resmi, tidak boleh diketik dari ingatan |

---

## Aturan tarif yang menentukan seluruh rancangan

**INA-CBG adalah pembayaran berbasis paket kasus.** Ini bukan kehalusan
administrasi — ia menentukan bentuk basis data.

Akibatnya, satu hal yang tampak wajar justru **dilarang**:

> Sistem tidak boleh menganggap setiap obat, tindakan, alat, atau kamar
> memiliki nilai penggantian BPJS resmi per item.

Seorang pasien yang menerima obat senilai Rp2 juta pada paket klaim senilai
Rp5 juta **tidak** membuat BPJS mengganti Rp2 juta untuk obat itu. Yang diganti
adalah paketnya. Menyimpan "nilai penggantian BPJS" pada baris obat akan
menghasilkan laporan yang menjumlahkan angka yang tidak pernah ada — dan
laporan itu akan dipakai menghitung jasa dokter.

Karena itu data per item tetap disimpan, tetapi **untuk tujuan yang berbeda**:

| Data per item dipakai untuk | Nilai penggantian resmi berada pada |
|---|---|
| biaya aktual | `Claim Package` |
| tagihan pasien | `Casemix Group` |
| utilisasi | `Severity` |
| bukti klaim | `Tariff Region` |
| perhitungan harga pokok | `Facility Class` |
| alokasi internal | `Approved Claim` |
| dasar pembagian jasa | `Paid Claim` |

---

## Metode pembayaran

| Jenjang | Metode | Catatan |
|---|---|---|
| FKTP | Kapitasi | Per peserta terdaftar per bulan, bukan per kunjungan |
| FKTP | Nonkapitasi | Layanan tertentu di luar kapitasi |
| FKRTL | INA-CBG | Paket kasus |
| FKRTL | Non-INA-CBG | Di luar paket; obat kronis, alat tertentu |
| Khusus | Program | Menurut program yang berlaku |

Keempatnya harus didukung berdampingan. Fasilitas yang sama dapat memakai lebih
dari satu.

---

## Kelas dan KRIS

Sistem **tidak dikunci** pada kelas I/II/III maupun pada KRIS. Keduanya
diperlakukan sebagai kebijakan berversi dengan tanggal berlaku, sebab tata
kelola JKN memang berubah dan perubahannya harus dapat diikuti tanpa mengubah
kode.

```text
CoverageBenefitClass      hak kelas menurut kepesertaan
RoomAccommodationClass    kelas kamar yang sesungguhnya ditempati
JknEntitlementPolicy      aturan yang menghubungkan keduanya, berversi
KrisCriteriaProfile       kriteria KRIS, berversi
UpgradeClassPolicy        naik kelas
DifferencePaymentPolicy   selisih yang ditanggung pasien
CobPolicy                 koordinasi manfaat dengan asuransi lain
```

Kelas yang ditempati dan kelas yang menjadi hak **disimpan terpisah**. Pasien
yang naik kelas atas kehendaknya sendiri berbeda dari pasien yang dinaikkan
karena kamarnya penuh, dan yang kedua tidak boleh ditagih selisih.

---

## Siklus hidup klaim

```text
Eligibility → Rujukan/Kontrol → SEP → Pelayanan → Koding → Grouping
→ Berkas → Verifikasi Internal → Pengajuan → Pending/Dispute
→ Persetujuan → Pembayaran → Rekonsiliasi → Alokasi Jasa → Akuntansi
```

Tiga langkah pertama dan pengajuan **terhalang kredensial**. Sisanya dapat
dibangun sekarang, dan sisanya itulah yang paling banyak menghabiskan waktu
petugas.

---

## Yang dibutuhkan sebelum status berubah

```text
Consumer ID dan Consumer Secret per layanan
User Key
kode fasilitas (PPK)
dokumentasi berversi tiap layanan
lingkungan sandbox yang dapat dipanggil
berkas grouper INA-CBG beserta lisensinya
terbitan tarif resmi yang berlaku
catatan UAT yang ditandatangani
```

Tanpa ketujuh pertama, adapter tetap menolak berjalan — dan itulah perilaku
yang benar.
