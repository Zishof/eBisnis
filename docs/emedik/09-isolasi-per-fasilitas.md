# H-2 · Satu Fasilitas, Satu Skema

**Keputusan pemilik sistem, 1 Agustus 2026:**

> Tiap pendaftaran rumah sakit / puskesmas / posyandu / klinik / apotek dibuatkan
> skema sendiri, agar datanya tidak bercampur dengan fasilitas lain.

Dokumen ini mencatat apa artinya bagi rancangan, apa yang sudah sesuai, dan
satu akibat yang menuntut keputusan lanjutan.

---

## Yang sudah sesuai

Arsitektur inti **sudah** melakukannya. `platform.tenant_schema_registry`
memiliki `tenantId` yang unik, sehingga:

```
satu pendaftaran  →  satu tenant  →  satu skema  →  satu skema audit
```

Rumah sakit A dan rumah sakit B yang mendaftar terpisah menempati skema basis
data yang berbeda. Pemisahannya berada di lapisan basis data, bukan pada
penyaringan kueri — satu kueri yang lupa menyaring tidak dapat membocorkan data
fasilitas lain, karena tabelnya memang tidak ada di sana.

Apotek yang mendaftar sendiri juga memperoleh skemanya sendiri. Demikian pula
Posyandu.

**Tidak ada perubahan yang diperlukan untuk memenuhi keputusan ini.** Yang
diperlukan adalah memastikan alur pendaftaran fasilitas pada portal eMedik
memakai jalur yang sama, dan itu memang rencananya.

---

## Yang berubah pada rancangan

Rancangan H-1 mengizinkan **beberapa fasilitas dalam satu skema** —
`health_facility` adalah tabel dengan banyak baris, lengkap dengan
`parent_facility_id` untuk jejaring.

Kemampuan itu **tetap ada**, tetapi bukan lagi bentuk yang lazim. Sesudah
keputusan ini:

| Keadaan | Bentuknya |
|---|---|
| Satu klinik mendaftar | Satu tenant, satu skema, satu baris `health_facility` |
| Satu apotek mendaftar | Satu tenant, satu skema, satu baris `health_facility` |
| Puskesmas dengan tiga Poskesdes jejaring | Satu tenant, satu skema, empat baris — Poskesdes bukan pendaftar terpisah, melainkan bagian dari puskesmas induk |
| Dua rumah sakit milik yayasan yang sama, mendaftar terpisah | **Dua tenant, dua skema** |

Baris kedua dari bawah sengaja dipertahankan: Posyandu dan Poskesdes di bawah
satu puskesmas bukan pendaftar mandiri — mereka unit kerja puskesmas itu, dan
memisahkannya akan memecah laporan program yang justru harus terkonsolidasi.

Yang dipisahkan adalah **pendaftar**, bukan setiap titik layanan.

---

## Akibat yang menuntut keputusan lanjutan

Spesifikasi §5 mewajibkan **Enterprise Master Patient Index** — satu identitas
pasien yang berlaku lintas fasilitas, supaya alergi yang tercatat di klinik A
terlihat saat meresepkan di rumah sakit B.

Dengan satu skema per fasilitas, itu **tidak dapat** dicapai lewat tabel
bersama: tabel `patient` klinik A memang tidak dapat dibaca dari skema rumah
sakit B. Itulah gunanya pemisahan, dan melubanginya akan membatalkan
keputusan ini.

Karena itu identitas lintas fasilitas harus berada **di atas** skema, yaitu di
control plane. Bentuk yang lazim dan sesuai:

```
platform.enterprise_patient          identitas orang, lintas fasilitas
platform.enterprise_patient_link     tautan ke patient_id pada skema fasilitas
<skema fasilitas>.patient            rekam pasien di fasilitas itu, dengan MRN-nya
```

Pencarian lintas fasilitas menjadi: cari di indeks platform, temukan fasilitas
mana yang punya rekamnya, lalu **minta persetujuan pasien** sebelum isinya
dibuka. Itu justru lebih baik daripada tabel bersama — akses lintas fasilitas
menjadi tindakan sadar yang tercatat, bukan sesuatu yang terjadi diam-diam.

`platform.*` adalah milik Core dan termasuk berkas rawan konflik, sehingga
permintaannya diajukan sebagai
[integration request 003](../integration-requests/health/003-enterprise-patient-index.md).

### Sampai itu tersedia

Kolom `patient.enterprise_patient_id` sudah ada sejak H002 dan **tetap
dipakai**, tetapi nilainya untuk sementara **hanya berlaku dalam satu skema**.
Ia belum menyatukan identitas lintas fasilitas.

Ini disebutkan apa adanya, bukan dibiarkan tampak sudah berfungsi. Kolom yang
bernama "enterprise" tetapi hanya berlaku lokal adalah jenis kekeliruan yang
paling mahal ditemukan belakangan — seseorang akan mengandalkannya untuk
memutuskan bahwa pasien tidak punya alergi.

Karena itu API pencarian pasien pada H-2 **tidak** menjanjikan cakupan lintas
fasilitas, dan menyatakannya pada jawabannya sendiri.

---

## Akibat lain yang perlu diketahui

| Akibat | Catatan |
|---|---|
| Jumlah skema tumbuh cepat | Satu per fasilitas terdaftar. Migrasi diterapkan ke seluruhnya; `migrate:tenants` sudah menanganinya, tetapi waktunya bertambah linear |
| Laporan lintas fasilitas | Harus digabungkan di atas skema, bukan dengan `JOIN`. Untuk grup usaha, itu pekerjaan pelaporan terpusat — bukan kueri biasa |
| Penagihan langganan | Justru lebih rapi: satu tenant, satu tagihan, satu jenjang tarif |
| Pencadangan dan pemulihan | Lebih rapi: satu fasilitas dapat dipulihkan tanpa menyentuh yang lain |
| Penghapusan saat berhenti berlangganan | Lebih rapi: skema fasilitas itu saja yang diekspor lalu ditutup |

Tiga baris terakhir adalah keuntungan nyata yang tidak dimiliki model tabel
bersama, dan pantas dicatat sebagai alasan tambahan keputusan ini — bukan
sekadar konsekuensinya.
