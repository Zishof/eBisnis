# Integration Request 006 — Penyimpanan berkas berskala penyewa

**Vertikal:** info-desa
**Cabang:** `feature/v12-info-desa`
**Diajukan:** 1 Agustus 2026
**Sifat:** Bukan pemblokir. Foto bukti pengaduan sudah berjalan dengan
registri dan adapter milik village; permintaan ini agar vertikal lain tidak
membangun hal yang sama untuk ketiga kalinya.

---

## Keadaan

D-5 membuat `village_complaint_evidence` beserta kolom `file_object_id UUID`.
Kolom itu **menggantung sejak saat dibuat**: tidak ada tabel berkas yang dapat
ditunjuknya, sehingga nilai apa pun diterima begitu saja, termasuk pengenal
yang tidak pernah ada.

Satu-satunya model berkas pada repositori adalah `MediaAsset`
(`prisma/platform/cms.prisma`), dan ia tempat yang salah untuk foto pengaduan
warga karena tiga hal sekaligus:

1. **Ia berada pada skema `platform`, bukan skema penyewa.** Foto pengaduan
   Desa A akan duduk pada tabel yang sama dengan Desa B. Ini meruntuhkan
   pemisahan skema-per-penyewa yang menjadi dasar seluruh sistem, dan
   meruntuhkannya justru pada data yang paling pribadi.
2. **`is_public` bawaannya benar, dan ia punya `public_url`.** Foto pengaduan
   memperlihatkan rumah, wajah, pelat nomor, dan halaman orang. Foto pembuangan
   sampah selalu memuat pagar rumah seseorang.
3. **Ia pustaka media CMS** — untuk gambar hero, testimoni, dan lampiran
   halaman. Peruntukannya memang publik.

Selain itu, **tidak ada infrastruktur unggah sama sekali** pada `apps/api`:
tidak ada `multer`, tidak ada `FileInterceptor` yang terpakai, tidak ada
adapter penyimpanan objek. `@nestjs/platform-express` ada, tetapi `multer`
tidak terjangkau dari `apps/api/node_modules`, dan menambahkannya menyentuh
berkas kunci bersama yang sedang dipakai sesi vertikal lain — dilarang
perintah §3.

## Yang dibangun village untuk sementara

Mengikuti pola yang sama dengan `WorkflowPort` (IR-001) dan
`VillagePublicResolver` (IR-005): village memiliki miliknya sendiri, di dalam
namespace-nya sendiri, tanpa menyentuh Core.

| Bagian | Berkas |
|---|---|
| Aturan murni | `apps/api/src/modules/village/village-file.ts` |
| Registri | `tenant-migrations/village/20260731000015__village__file_object.sql` |
| Port | `modules/village/ports/file-storage.port.ts` |
| Adapter cakram | `modules/village/ports/local-file-storage.adapter.ts` |
| Layanan | `modules/village/village-file.service.ts` |

### Keputusan yang sudah diambil, dan alasannya

**Isi berkas dikirim sebagai badan permintaan mentah**, bukan multipart dan
bukan base64 di dalam JSON.

- Multipart membutuhkan `multer` — tidak terjangkau, dan menambahkannya
  menyentuh lockfile bersama.
- Base64 menaikkan ukuran kiriman sepertiga (foto 8 MB menjadi ~10,6 MB) dan
  memaksa seluruh isinya masuk ke memori sebelum dapat dinilai sama sekali.
- Badan mentah tidak membutuhkan keduanya, dan alirannya dapat **diputus tepat
  pada bita yang melewati batas**. Permintaan lima ratus megabita tidak pernah
  sempat menempati memori peladen.

**Metadata dibuang, lalu diperiksa kembali, lalu baru disimpan.** Berkas yang
metadatanya bertahan **ditolak**, bukan disimpan diam-diam. Basis data ikut
menegakkannya:

```sql
CONSTRAINT village_file_metadata_must_be_stripped CHECK (metadata_stripped = TRUE)
```

Alasannya bukan kerapian. Foto dari ponsel membawa koordinat GPS tempat ia
dipotret dan nomor seri kameranya. Warga yang memotret pembuangan sampah
tetangganya tidak tahu bahwa ia melampirkan koordinat rumahnya sendiri. Lebih
jauh, EXIF yang lolos **membatalkan keputusan yang sudah diambil**: aplikasi
warga sengaja mengirim lokasi kejadian yang *ditunjuk* warga, bukan posisi
ponselnya — dan EXIF mengembalikan posisi ponsel lewat pintu belakang, tanpa
seorang pun menyadarinya, sebab ia tidak tampak di layar mana pun.

Aplikasi warga membuangnya sekali lagi **di ponsel**, sebelum apa pun dikirim
(`packages/village-mobile/lib/domain/foto.dart`). Itu bukan pengganti
pembuangan di peladen — kelak akan ada aplikasi lain, dan aplikasi tidak pernah
menjadi tempat menegakkan aturan. Yang berubah adalah koordinatnya tidak pernah
melewati jaringan seluler sama sekali.

**Tidak ada `urlPublik()` pada `FileStoragePort`.** Antarmuka yang tidak punya
metodenya tidak dapat dipaksa menyediakannya. Tautan yang dapat dibuka siapa
pun yang memegangnya membuat seluruh pemeriksaan hak akses tidak berarti: satu
tautan tersalin ke grup percakapan sudah cukup.

## Yang diminta dari Core

1. **Penyimpanan berkas berskala penyewa** sebagai layanan bersama — kunci
   berawalan skema penyewa, tanpa URL publik bawaan, dengan adapter cakram dan
   penyimpanan objek. eMedik akan membutuhkannya untuk lampiran rekam medis,
   dan eKoperasi untuk bukti setoran. Tiga vertikal membangun hal yang sama
   adalah tiga tempat yang harus diperbaiki ketika satu kekeliruan ditemukan.
2. **Dukungan unggah multipart** pada `apps/api` (`multer` + `@types/multer`),
   bila Core memang menghendaki multipart sebagai bentuk baku. Village tidak
   dapat menambahkannya sendiri tanpa melanggar §3.
3. **Kepastian tentang `MediaAsset`**: apakah ia memang khusus CMS. Bila kelak
   ia dipakai lebih luas, `is_public` bawaannya perlu ditinjau — bawaan yang
   aman adalah tidak publik, dan yang publik dinyatakan secara sengaja.

## Yang TIDAK diminta

- **Bukan** meminta Core menyediakan pembuang metadata. Aturannya spesifik
  village (jenis mana yang diterima, apa yang dibuang, apa yang ditolak), dan
  menyerahkannya ke tempat lain berarti perubahan di sana diam-diam mengubah
  apa yang sampai ke kantor desa.
- **Bukan** meminta perubahan pada `village_complaint_evidence`. Kunci asingnya
  sudah dipasang migrasi village sendiri.

## Bila permintaan ini tidak dijawab

Tidak ada yang berhenti. Foto pengaduan berjalan dengan adapter cakram, dan
pemasangan terpusat menggantinya dengan penyimpanan objek tanpa menyentuh satu
baris pun kode layanan — itulah gunanya port.

Yang hilang hanyalah kesempatan menghindari vertikal ketiga menulis ulang hal
yang sama.

## Bukti

- `docs/info-desa/bukti-foto-pengaduan.txt` — 21 pemeriksaan terhadap
  PostgreSQL sungguhan, seluruhnya lulus.
- `apps/api/src/modules/village/village-file.spec.ts` — 20 pengujian; yang
  menentukan menyusun JPEG dan PNG berisi koordinat GPS sungguhan lalu
  memastikan koordinat itu **hilang** dari hasilnya.
- `packages/village-mobile/test/foto_test.dart` — 17 pengujian yang sama di
  sisi ponsel.
