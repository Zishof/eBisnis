# 03 — Hospitality Capability Inventory (MI-0)

## Metode

Pencarian literal (case-insensitive) di seluruh `apps/api/src` dan
`apps/web/src` untuk istilah: `hospitality`, `reservation`, `folio`,
`housekeeping`, `night audit`/`night-audit`, `hotel`, `guest portal`,
`property management`.

## Hasil: TIDAK ADA kapabilitas hospitality/PMS yang sudah ada

Seluruh hit yang ditemukan adalah **false positive**, dikonfirmasi satu
per satu:

```text
apps/api/src/modules/order/stock-reservation.service.ts
  -> "reservation" = penahanan STOK inventori (mis. stok ditahan saat
     checkout belum selesai), TIDAK ADA hubungannya dengan reservasi
     kamar hotel.

apps/api/src/infrastructure/provisioning/tenant-menu.seed.ts
  -> baris 320-322, menu "Reservation dan Routing" adalah bagian modul
     MARKETPLACE (moduleCode: 'MARKETPLACE'), untuk reservasi STOK
     e-commerce (ALLOCATION_RESERVATION, aksi READ/RESERVE/RELEASE),
     bukan reservasi tamu/kamar.

apps/web/src/pages/contoh/business-verticals.ts
  -> baris 323, entri marketing/showcase "homestay" pada halaman contoh
     ("contoh" = halaman demo/pemasaran publik yang mendaftar berbagai
     jenis usaha yang BISA dilayani eBisnis secara umum). Teks deskripsi
     menyebut "housekeeping", "booking kamar", dll. sebagai kalimat
     pemasaran -- BUKAN kode yang mengimplementasikan kapabilitas itu.
     Halaman ini murni daftar kartu ilustratif, tidak terhubung ke modul
     backend apa pun.
```

Tidak ada model data (`pesantren_santri`-setara untuk "hotel_room"/
"reservation"/dst.), tidak ada controller/service, tidak ada halaman
admin, tidak ada endpoint publik untuk konsep PMS/hospitality apa pun.

## Kesimpulan

**Ini benar-benar halaman kosong.** MitraInap TIDAK mewarisi kode
existing apa pun untuk domain hospitality-nya sendiri (kamar, reservasi,
folio, housekeeping, night audit, dst.) -- seluruhnya perlu dibangun
baru di `apps/api/src/modules/hospitality/**` dan
`apps/web/src/verticals/hospitality/**`, PERSIS seperti arahan perintah
master (§6 Namespace Implementasi).

Yang BISA (dan harus) dipakai ulang -- bukan konsep hospitality itu
sendiri, tapi INFRASTRUKTUR BERSAMA yang sudah matang dan sudah terbukti
lewat vertikal pesantren:

```text
Multi-tenant schema provisioning + migration loader (manifest.json per vertikal)
Domain registry (vertical_site_domain) -- lihat 02-portal-domain-username-inventory.md
BLOB file storage per skema tenant (TenantFileBlobService, PostgreSQL Large Object)
RBAC: menu/role/permission catalog per vertikal + PermissionGuard + resolve()
Auth staf (JwtAuthGuard/AccessTokenPayload) DAN pola auth non-staf terpisah
  (contoh: PsbApplicantAuthGuard -- token beda bentuk, TTL pendek, tidak lewat
  guard staf global -- pola yang relevan untuk "guest portal" MitraInap,
  sebab tamu BUKAN staf hotel juga)
Response envelope + rawResponse() untuk streaming file
Pola halaman admin: DataGrid/PageHeader/Pagination/StatusBadge dari components/ui.tsx
```

Detail masing-masing infrastruktur ini ada di
`docs/santri-info/18-session-handoff-2026-08-03.md` (berkas kunci,
alasan desain, dan jebakan yang sudah pernah ditemukan) -- dipakai
sebagai referensi utama, BUKAN ditulis ulang di sini.
