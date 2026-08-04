# 18 · Peta Pemetaan Layanan ke Unit

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026
**Perintah:** R2 §14

---

## Mengapa pemetaan menentukan segalanya

Satu layanan yang tidak terpetakan tampak tidak berbahaya sampai ia dipesan.
Lalu:

- pesanannya tidak sampai ke unit mana pun;
- tidak ada peran yang berwenang mengerjakannya;
- tarifnya tidak ditemukan;
- pembagian jasanya tidak terhitung;
- dan pendapatannya tidak masuk akun mana pun.

Kelimanya baru ketahuan pada akhir bulan, ketika seseorang bertanya mengapa
pendapatan radiologi lebih kecil daripada jumlah pemeriksaan yang dikerjakan.

Karena itu: **layanan tidak dapat diaktifkan sebelum pemetaannya lengkap.**

---

## Yang wajib dipetakan

```text
department            unit layanan          lokasi
care setting          peran pemberi         peran verifikator
peralatan             spesimen              pesanan klinis
formulir klinis       tarif                 cakupan pembayar
aturan jasa           COA
```

Empat belas hal. Yang paling sering terlupa adalah **peran verifikator** dan
**COA** — yang pertama membuat hasil menumpuk tanpa ada yang berwenang
melepasnya, yang kedua membuat pendapatannya menggantung.

---

## Care setting

```text
OUTPATIENT      INPATIENT       EMERGENCY       OPERATING_THEATRE
ICU             NICU            PICU            DELIVERY_ROOM
LABORATORY      RADIOLOGY       PHARMACY        NUTRITION
REHABILITATION  DENTAL          DIALYSIS        ONCOLOGY
HOMECARE        PUSKESMAS       POSYANDU
```

---

## Contoh

```text
Rontgen Toraks
→ Radiologi
→ Pesanan Radiologi
→ Mesin X-Ray
→ Radiografer
→ Verifikasi Radiolog
→ DICOM Study
→ Pendapatan Radiologi
→ Jasa Pemakaian Alat
```

```text
Persalinan Normal
→ VK / Kamar Bersalin
→ Bidan atau dokter menurut kebijakan
→ Tempat tidur dan kamar
→ Obat dan BMHP
→ Tautan bayi baru lahir
→ Jasa Kebidanan
```

```text
Darah Lengkap
→ Laboratorium
→ Spesimen darah utuh
→ Hematology Analyzer
→ Verifikasi hasil
→ Pendapatan Laboratorium
→ HPP Reagen
```

Contoh ketiga menunjukkan hal yang mudah terlewat: pemeriksaan laboratorium
punya **dua sisi akuntansi** — pendapatannya dan harga pokok reagennya. Layanan
yang hanya memetakan pendapatannya akan menampilkan margin seratus persen.

---

## Validasi sebelum aktivasi

Aktivasi layanan menjalankan pemeriksaan kelengkapan, dan **melaporkan apa yang
kurang satu per satu** — bukan "pemetaan belum lengkap".

```text
[ ] department          [ ] unit layanan
[ ] care setting        [ ] peran pemberi
[ ] peran verifikator   (bila hasilnya menuntut verifikasi)
[ ] peralatan           (bila menuntut alat)
[ ] spesimen            (bila menuntut spesimen)
[ ] tarif berlaku       [ ] akun pendapatan
[ ] akun HPP            (bila memakai persediaan)
[ ] aturan jasa         (bila dibagi jasanya)
```

Yang bertanda kurung hanya wajib bila berlaku — dan "bila berlaku" ditentukan
sifat layanannya, bukan pilihan pengguna. Pemeriksaan laboratorium selalu
menuntut spesimen; menandainya "tidak berlaku" tidak diizinkan.

---

## Hubungan dengan yang sudah ada

Sebagian besar sisi kanan pemetaan sudah dibangun H-1 sampai H-8:

| Yang dipetakan | Sudah ada sejak |
|---|---|
| unit layanan | H-1 `health_service_unit` |
| lokasi, kamar, tempat tidur | H-1, H-6 |
| peran pemberi | H-1 `health_provider` |
| pesanan klinis | H-3 `health_clinical_order` |
| spesimen | H-5 `lab_specimen` |
| peralatan | H-9H (belum) |
| tarif | H-9D (belum) |
| aturan jasa | H-9E (belum) |
| COA | H-9N (belum) |

Yang tersisa adalah sisi kiri — definisi layanannya sendiri — dan empat sisi
kanan yang menunggu fase berikutnya.
