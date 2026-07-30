# ADR-005 — PostgreSQL 17.2 pada port 5433 (penyimpangan lingkungan)

- Status: Diterima untuk lingkungan pengembangan lokal
- Tanggal: 2026-07-30

## Konteks

Master prompt menetapkan PostgreSQL pada port bawaan **5432**. Pada mesin
pengembangan ini, port 5432 ditempati **PostgreSQL 9.3.5**, versi yang:

- tidak mendukung `gen_random_uuid()` tanpa ekstensi tambahan,
- tidak mendukung sintaks `CREATE TABLE ... GENERATED`,
- berada di bawah versi minimum yang didukung Prisma 6.

Pada port **5433** berjalan **PostgreSQL 17.2** yang sudah memiliki database
`ebisnis` dan role `root`.

## Keputusan

Menargetkan PostgreSQL 17.2 pada **port 5433** untuk lingkungan lokal, dan
mencatat penyimpangan ini di tiga tempat agar tidak menjadi kejutan:

1. Komentar pada `apps/api/.env`.
2. `apps/api/.env.example`.
3. ADR ini.

Instalasi 9.3.5 pada port 5432 **tidak** diubah, dihentikan, atau di-upgrade —
di luar cakupan pekerjaan ini dan berpotensi merusak sistem lain yang memakainya.

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5433/ebisnis?schema=platform
DATABASE_ADMIN_URL=postgresql://USER:PASSWORD@localhost:5433/ebisnis
```

Nilai `USER` dan `PASSWORD` diisi pada `apps/api/.env` yang tidak pernah dikomit.

## Konsekuensi

- Seluruh perintah `pnpm db:*`, seed, smoke test, dan generator dokumentasi
  memakai port 5433 melalui variabel lingkungan; tidak ada port yang di-hardcode.
- Pada environment lain (staging, produksi), cukup mengubah `DATABASE_URL` dan
  `DATABASE_ADMIN_URL`; tidak ada perubahan source yang diperlukan.
- Kredensial lokal hanya berlaku untuk mesin pengembangan ini dan disimpan pada
  `apps/api/.env`. Berkas `.env` **tidak pernah** dikomit (lihat `.gitignore`);
  hanya `.env.example` yang dikomit dan isinya placeholder.

## Verifikasi

```bash
psql -h localhost -p 5433 -U "$PGUSER" -d ebisnis -c "SELECT version()"
```

Endpoint `GET /health` juga melaporkan status database, jumlah schema tenant, dan
versi katalog migration tenant yang sedang aktif.
