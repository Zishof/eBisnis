# Pemisahan Data Antar Koperasi

Pertanyaan yang wajar ditanyakan pemilik sistem, dan yang lebih baik dijawab
dengan bukti daripada dengan pernyataan: **apakah data koperasi A dapat bertemu
dengan data koperasi B?**

Jawabannya tidak, dan pemisahannya berlapis tiga.

---

## Lapisan 1 — Satu koperasi, satu penyewa, satu skema

Setiap pendaftaran koperasi menjalankan penyiapan **skema PostgreSQL
tersendiri** — bukan menambah baris pada tabel bersama.

```
ekoperasi.id
  └─ Daftar Koperasi
       └─ Buat tenant  ──▶  CREATE SCHEMA <slug>
                            jalankan 23 migrasi inti
                            jalankan 5 migrasi modul koperasi
                            semai data acuan
```

Keadaan sekarang pada basis data pengembangan:

```
17 penyewa terdaftar, 17 skema terpisah
tidak ada dua penyewa berbagi satu skema
tidak ada dua skema menunjuk satu penyewa
setiap skema terdaftar benar-benar ada sebagai skema PostgreSQL
```

Keempatnya diperiksa setiap kali `prove-cooperative-k5.mjs` dijalankan.

## Lapisan 2 — Satu skema tidak dapat berisi dua koperasi

```sql
CREATE UNIQUE INDEX ux_cooperative_single_per_tenant
  ON "<skema>".cooperative USING btree ((true))
  WHERE (deleted_at IS NULL);
```

Indeks unik atas ekspresi tetap `(true)` membuat tabel `cooperative` hanya dapat
berisi **satu baris hidup**. Mencoba menyisipkan koperasi kedua ditolak basis
data — bukan ditolak layanan yang dapat dilewati lewat jalan lain.

Dibuktikan pada `bukti-k1-profil.txt`:

```
3. Satu ruang kerja hanya untuk satu koperasi
  LULUS  koperasi kedua pada tenant yang sama DITOLAK basis data
```

## Lapisan 3 — Nama skema tidak pernah berasal dari permintaan

Batasan yang berlaku sejak awal platform ini dibangun:

> Nama skema hanya boleh berasal dari `platform.tenant_schema_registry`.
> Tidak pernah dari badan permintaan, kueri, maupun tajuk. Dan `public` tidak
> pernah menjadi cadangan pada `search_path`.

Artinya seseorang yang mengirim `schemaName: "koperasi_lain"` pada permintaan
tidak memperoleh apa pun — nilai itu tidak pernah dibaca. Skema ditentukan dari
sesi penggunanya, yang ditentukan keanggotaannya pada penyewa.

---

## Mengapa tidak memakai kolom penyaring penyewa

Pilihan yang lazim pada sistem multi-penyewa adalah satu tabel bersama dengan
kolom `tenant_id`, disaring pada setiap kueri. Modul koperasi **tidak** memakai
pendekatan itu, dan pengujian memastikannya:

```
LULUS  tabel anggota tidak memakai kolom penyaring penyewa — pemisahannya di skema
```

Alasannya satu kalimat: pada model satu tabel bersama, **satu kueri yang lupa
menyaring sudah cukup** untuk membocorkan data penyewa lain. Kebocoran seperti
itu tidak menghasilkan galat, tidak tercatat pada log, dan biasanya baru
ketahuan ketika seorang anggota melihat nama orang yang tidak dikenalnya pada
laporannya sendiri.

Pemisahan di lapisan skema tidak bergantung pada ketelitian setiap kueri. Kueri
yang lupa menyaring hanya membaca data penyewanya sendiri, sebab data penyewa
lain memang tidak berada di sana.

---

## Yang tetap dibagi bersama

Untuk kejelasan, inilah yang **tidak** dipisah per koperasi, dan mengapa itu
benar:

| Yang dibagi | Letak | Alasan |
|---|---|---|
| Identitas pengguna | `platform.platform_user` | Satu orang dapat menjadi pengurus di dua koperasi dengan satu akun. Keanggotaannya pada tiap koperasi tetap terpisah lewat `tenant_membership` |
| Registri skema | `platform.tenant_schema_registry` | Daftar penyewa; tidak berisi data operasional koperasi |
| Katalog paket langganan | `platform.*` | Harga dan paket berlaku sama bagi semua |
| Katalog menu dan peran bawaan | `platform.global_*` | Templat, bukan data. Disalin ke tiap skema saat penyiapan |
| Observabilitas terpusat | `platform_observability` | Catatan galat dan kinerja bagi pengelola platform. **Administrator koperasi tidak memperoleh akses ke sini** |

Yang perlu diperhatikan pada baris pertama: seseorang yang menjadi pengurus di
dua koperasi memakai satu akun, tetapi **sesinya membawa satu penyewa pada satu
waktu**. Ia berpindah koperasi lewat pemilihan penyewa, dan setiap perpindahan
tercatat pada audit.

---

## Cara memeriksanya sendiri

```bash
node apps/api/scripts/prove-cooperative-k5.mjs
```

Bagian A pada keluarannya memeriksa keenam hal di atas terhadap basis data
sungguhan, dan menyebutkan angkanya — bukan sekadar menyatakan bahwa
pemisahannya ada.
