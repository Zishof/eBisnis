# 15 · Model Ancaman Keamanan Siber Alat Kesehatan

**Fase:** H-0 Revisi 2 · **Tanggal audit:** 1 Agustus 2026

---

## Keadaan yang harus diterima apa adanya

Alat medis **tidak dapat diamankan seperti server**. Ia:

- menjalankan sistem operasi lama yang tidak lagi menerima tambalan;
- tidak boleh dipasangi perangkat lunak keamanan tambahan tanpa membatalkan
  sertifikasinya;
- sering memakai kata sandi bawaan yang tidak dapat diubah;
- dan tidak dapat dimatikan untuk diperbarui, karena ada pasien yang memakainya.

Karena itu keamanannya **tidak diletakkan pada alatnya**, melainkan pada apa
yang mengelilinginya.

---

## Ancaman dan penahannya

| Ancaman | Akibat | Penahan |
|---|---|---|
| Alat dijadikan pijakan masuk jaringan | Seluruh jaringan rumah sakit | Segmentasi jaringan; alat tidak dapat menjangkau apa pun selain gateway-nya |
| Kredensial basis data pada alat | Kebocoran seluruh rekam medis | **Alat tidak pernah punya kredensial basis data** |
| Perintah jarak jauh yang disusupkan | Perubahan dosis pompa infus | Kendali jarak jauh **mati secara bawaan**; aktivasi menuntut persetujuan tertulis |
| Hasil palsu disuntikkan | Keputusan klinis pada data karangan | Provenance; sidik jari pesan asli; telaah manusia |
| Hasil pasien tertukar | Hasil orang lain di rekam medis seseorang | Pengaitan hanya lewat order ID, pemindaian, atau manusia |
| Jam alat melenceng | Urutan kejadian klinis kacau | `capturedAt` dan `receivedAt` disimpan terpisah; selisih besar ditandai |
| Alat kedaluwarsa kalibrasinya | Hasil menyimpang tanpa ada yang tahu | Status kalibrasi wajib; hasilnya ditandai |
| Serangan penyanderaan data | Pelayanan berhenti | Segmentasi; cadangan; prosedur luring |
| Perangkat lunak alat diperbarui diam-diam | Perilaku berubah tanpa diketahui | `MedicalDeviceSoftwareVersion` dicatat dan perubahannya ditandai |

---

## Segmentasi

```text
Jaringan Alat  ──►  Gateway  ──►  Integration Engine  ──►  eMedik
     ▲                  │
     └── tidak dapat menjangkau apa pun di kanan gateway
```

Alat hanya dapat berbicara kepada gateway-nya. Gateway hanya dapat berbicara
kepada integration engine. Tidak ada jalan langsung dari alat ke basis data,
dan tidak ada jalan dari alat ke internet.

---

## Kredensial

Kredensial gateway dan alat disimpan sebagai **rujukan ke brankas**
(`HealthSecretVaultPort`), tidak pernah sebagai nilai di dalam basis data
tenant.

Administrator yang menyimpannya **tidak dapat membacanya kembali** — addendum
§F menyebutnya tegas. Ia dapat menggantinya; ia tidak dapat melihatnya. Ini
membedakan "administrator yang mengelola kredensial" dari "administrator yang
memiliki kredensial", dan perbedaan itu menentukan siapa yang harus dicurigai
ketika ada kebocoran.

---

## Kendali jarak jauh

**Mati secara bawaan, untuk seluruh alat, tanpa kecuali.**

Menyalakannya menuntut:

```text
persetujuan tertulis manajemen        telaah risiko klinis
daftar perintah yang diizinkan        batas nilai
pencatatan setiap perintah            tombol henti darurat
```

Alasan mengapa ini keras: pompa infus yang dapat dikendalikan jarak jauh adalah
pompa yang dapat dinaikkan dosisnya oleh siapa pun yang menembus jaringannya.
Manfaatnya nyata tetapi kecil; akibat kegagalannya tidak dapat diperbaiki.

---

## Yang dilakukan ketika alat terputus

Bukan menghentikan pelayanan. Alat yang terputus:

1. menyimpan hasilnya sendiri bila mampu (*store and forward*);
2. hasilnya menyusul dengan `capturedAt` yang benar, bukan waktu tibanya;
3. duplikat dideteksi lewat sidik jari pesan, bukan lewat waktu;
4. dan bila alatnya tidak mampu menyimpan, hasilnya dicatat manual dengan
   penanda `MANUAL_ENTRY` — yang membedakannya dari hasil alat, selamanya.
