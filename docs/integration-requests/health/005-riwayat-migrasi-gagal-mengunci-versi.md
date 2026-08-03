# 005 · Riwayat Migrasi yang GAGAL Mengunci Nomor Versinya Selamanya

**Diajukan:** sesi eMedik · 1 Agustus 2026
**Untuk:** sesi Core/Integrator
**Berkas:** `apps/api/src/infrastructure/provisioning/tenant-migration.service.ts`
**Tingkat:** tinggi — cacatnya menghasilkan laporan "berhasil" atas keadaan
yang tidak berubah

---

## 1. Ringkasan

`applyAll()` membaca riwayat migrasi **tanpa menyaring `status`**:

```ts
const applied = await this.prisma.tenantSchemaMigrationHistory.findMany({
  where: { schemaName },                    // <-- tidak ada status: 'SUCCEEDED'
  select: { migrationVersion: true, checksum: true },
});
const appliedMap = new Map(applied.map((row) => [row.migrationVersion, row.checksum]));
```

Sementara itu, cabang penanganan galat **menuliskan checksum-nya juga** ketika
migrasi gagal:

```ts
} catch (error) {
  await this.prisma.tenantSchemaMigrationHistory.create({
    data: { ..., checksum, status: 'FAILED', errorMessage: message.slice(0, 4000) },
  });
```

Akibatnya sebuah nomor versi yang pernah gagal **tidak pernah dapat dipakai
lagi**, pada skema mana pun yang mencatat kegagalannya.

## 2. Dua cabangnya, dan yang kedua lebih berbahaya

### (a) Migrasinya diperbaiki lalu dijalankan ulang → CONFLICT

`existingChecksum !== checksum` → dilempar:

> Checksum migration H055 berbeda dari yang sudah diterapkan pada schema X.
> Migration yang telah dipakai tidak boleh diubah — buat versi baru.

Pesannya keliru pada satu kata yang menentukan: migrasi itu **tidak pernah
dipakai**. Ia gagal, dan seluruh DDL-nya dibatalkan.

### (b) Migrasinya TIDAK diubah lalu dijalankan ulang → dilaporkan BERHASIL

Ini yang berbahaya. `existingChecksum === checksum` → `skipped: true`, dan
`migrate:tenants` melaporkan skema itu mutakhir — padahal **tabelnya tidak
pernah dibuat.**

Kegagalan sementara sudah cukup untuk memicunya: basis data penuh, kunci
tertahan, jaringan putus di tengah jalan. Satu kegagalan sesaat, satu
pengulangan yang tampak berhasil, dan sebuah skema tenant berjalan tanpa tabel
yang dikiranya ada. Yang menemukannya adalah pengguna, lewat galat "relation
does not exist" pada jam kerja.

Bentuk kegagalan ini persis yang dicatat pada H054 fase H-11: **laporan yang
berkata selesai dan keadaan yang tidak berubah.**

## 3. Bagaimana ia ditemukan

H055 (kini [H057](../../../apps/api/tenant-migrations/H057__health__security_zone.sql))
menuliskan `access_log_id UUID`, padahal `health_access_log.id` adalah `BIGINT`
— satu-satunya tabel kesehatan yang kuncinya bukan UUID. PostgreSQL menolaknya:

```text
foreign key constraint "health_break_glass_review_access_log_id_fkey"
cannot be implemented
```

Penolakan yang baik: keliru yang tidak mungkin lolos. Tujuh belas skema gagal,
seluruhnya dibatalkan bersih — tidak satu pun dari empat tabelnya terbentuk.

Kelirunya diperbaiki (satu kata: `UUID` → `BIGINT`), dijalankan ulang, dan
tujuh belas skema yang sama menolak dengan CONFLICT.

Riwayat sesudahnya: **1.700 baris SUCCEEDED, 17 baris FAILED** — seluruh yang
FAILED berasal dari percobaan tunggal ini. Jadi cacatnya belum pernah mengenai
migrasi Core mana pun; ia baru terlihat sekarang sebab ini kegagalan migrasi
pertama yang tercatat pada basis data pengembangan ini.

## 4. Yang diminta

Satu penyaringan pada satu kueri:

```ts
const applied = await this.prisma.tenantSchemaMigrationHistory.findMany({
  where: { schemaName, status: 'SUCCEEDED' },
  select: { migrationVersion: true, checksum: true },
});
```

Baris FAILED **tetap disimpan** — ia bukti yang berguna, dan tidak boleh
dihapus. Yang berubah hanyalah: ia tidak lagi dibaca sebagai "sudah
diterapkan".

Bila ada dua baris untuk satu versi pada satu skema (satu FAILED lalu satu
SUCCEEDED), penyaringan ini memilih yang benar dengan sendirinya.

### Tambahan yang dianjurkan, bukan diminta

Pertimbangkan pula: bila sebuah versi punya baris FAILED tetapi belum punya
baris SUCCEEDED, catat NOTICE pada log ketika ia diterapkan ulang. Penerapan
ulang sesudah kegagalan adalah kejadian yang layak dilihat orang, bukan
disembunyikan sebab ia berhasil.

## 5. Yang dilakukan sementara di sisi eMedik

Nomor H055 dan H056 **dihanguskan**, dan isinya dipindahkan ke H057 dan H058
— persis seperti yang diperintahkan pesan galatnya. Tidak ada baris riwayat
yang dihapus, dan tidak ada berkas Core yang disentuh.

Sebabnya dicatat pada kepala H057 supaya pembaca berikutnya yang bertanya "ke
mana perginya H055?" menemukan jawabannya di berkas yang menggantikannya.

Perlu diperhatikan: **sesudah cacat ini diperbaiki, H055 dan H056 tetap
hangus.** Menghidupkannya kembali menuntut penghapusan baris riwayat, dan itu
tidak sepadan. Nomor versi murah; riwayat tidak.
