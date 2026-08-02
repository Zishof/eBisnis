# EP-0.13 — Peta Semantik Bisnis Legacy

**Status: `BLOCKED`.**

§4.4 menunjuk source legacy pada:

```text
C:/opt/AIS/ais/src/main/src/ais/action/master/**
C:/opt/AIS/ais/src/main/src/ais/database/model/**
C:/opt/AIS/ais/src/main/webapp/**
```

Pohon source itu belum pernah dibuka pada sesi ini. Satu berkas dari direktori
induknya pernah dibaca sesi sebelumnya
(`SPESIFIKASI_FITUR_POS_DESKTOP_ANDROID.md`), dan darinya diambil peta pintasan
papan tik yang kini dipakai POS web dan POS Flutter.

## Mengapa tidak diisi dengan perkiraan

§2.6 melarang mengarang isi dokumen yang tidak tersedia, dan §4.4 melarang
menganggap bug legacy sebagai kebutuhan. Peta semantik yang disusun dari tebakan
melanggar keduanya sekaligus, dan kesalahannya terbawa ke model data yang
kemudian sulit diubah.

## Yang dibutuhkan untuk membuka status ini

Akses baca ke pohon source legacy. Yang akan dipetakan:

```text
Kelas/Model/Halaman Legacy
  -> Makna bisnis
  -> Bounded context modern
  -> Kemampuan modern yang sudah ada
  -> Pakai ulang / adapter / baru
  -> Risiko
```

Yang dicari khususnya: istilah, status, aturan validasi, alur persetujuan,
rumus, dan laporan yang benar-benar dipakai — bukan struktur tabelnya.
