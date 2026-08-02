# EP-0.7 — Peta Schema Penyewa

## Kenyataan hari ini

Registry memakai **satu schema per penyewa**, bukan satu schema per modul:

```text
<username>            schema kerja penyewa
<username>__audit     schema audit penyewa
```

Terbukti pada uji lokal: pendaftaran `ponpes_demo` menghasilkan `ponpes_demo`
dan `ponpes_demo__audit`.

## Yang diminta §4.2

```text
{tenantUsername}_core
{tenantUsername}_eschool
{tenantUsername}_epesantren
{tenantUsername}_ecampus      hanya bila entitlement aktif
{tenantUsername}_pos          bila aktif
```

## Selisihnya, dan mengapa tidak diubah sekarang

Perbedaannya mendasar: satu schema per penyewa versus satu schema per modul per
penyewa. Mengubahnya berarti:

- memindahkan 37 migrasi tenant ke pengelompokan baru;
- menulis ulang `TenantConnectionService` beserta `search_path`-nya;
- memigrasikan **14 schema penyewa** yang sudah ada di pengembangan, dan yang
  sudah ada di produksi;
- menyentuh setiap modul yang menulis ke schema penyewa.

Status `CONFLICTING`. Perubahan sebesar ini **tidak boleh** dikerjakan sebagai
efek samping penambahan ePesantren. Ia perlu keputusan tersendiri, jendela
pemeliharaan, dan rencana pengembalian.

## Usul untuk ePesantren

Tetap pada pola existing. Modul ePesantren memakai awalan tabel di dalam schema
penyewa yang sudah ada:

```text
pesantren_santri
pesantren_asrama
pesantren_kamar
pesantren_izin
```

Bila kelak pemisahan per modul diputuskan, tabel berawalan itu berpindah sebagai
satu kesatuan. Yang tidak berawalan tidak dapat dipindahkan tanpa menebak.
