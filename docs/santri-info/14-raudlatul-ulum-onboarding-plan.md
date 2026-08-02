# EP-0.15 — Rencana Onboarding Tenant Pertama

Nama tenant contoh kini **Ponpes Demo**, mengikuti permintaan agar seluruh
contoh terbaca sebagai contoh sebelum penyebaran publik.

## Yang sudah terbukti berjalan

Dijalankan sungguhan terhadap basis data pengembangan lewat formulir, bukan
lewat curl:

```text
Pendaftaran lima langkah
  -> Ponpes Demo, slug ponpes-demo, pengguna ponpes_demo
  -> penyewa ACTIVE dengan vertical_code = PESANTREN
  -> situs ponpes-demo.santri.info ACTIVE dan terverifikasi
  -> identitas: KOMBINASI, PUTRA_PUTRI, 2 jenjang, 450 mukim, 38 ustaz
  -> schema ponpes_demo dan ponpes_demo__audit
  -> kata sandi hanya tersimpan sebagai hash Argon2
  -> masuk -> ganti kata sandi -> masuk -> beranda /pesantren
```

Status `DONE` untuk onboarding; `MISSING` untuk seluruh yang dikerjakan sesudah
masuk.

## Yang belum dapat dikerjakan pondok sesudah masuk

Beranda `/pesantren` menyebutkan dengan jujur mana yang siap dan mana yang
sedang dibangun. Yang belum: santri, asrama, diniyah, tahfiz, perizinan,
tagihan, dompet, dan situs yang dapat disunting sendiri.

## Urutan yang disarankan bagi pondok pertama

1. Masuk, ganti kata sandi, kenali beranda.
2. Isi identitas pondok dan pengguna pengurus beserta perannya.
3. Tunggu modul santri — tanpa itu tidak ada yang dapat diisikan.
4. Masukkan data santri (impor dari Excel, bila tersedia).
5. Presensi, lalu tagihan.
6. Situs dan berita.

Langkah 3 adalah penghalang nyata. Menawarkan pondok mendaftar hari ini berarti
menjanjikan mereka menunggu — dan itu harus dikatakan di depan.
