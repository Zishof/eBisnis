# 11 — Inventaris Menu dan Rencana MenuCatalog

Pemetaan 21 menu root yang ada sekarang terhadap 33 root yang diminta blueprint
Versi 8 Revisi 1.

## Kondisi sekarang

73 menu pada schema `demo`, dengan **21 root**. Sumbernya
`apps/api/src/infrastructure/provisioning/tenant-menu.seed.ts`, disemai saat
provisioning tenant.

| # | Kode | Nama | Anak |
| ---: | --- | --- | ---: |
| 1 | `HOME` | Beranda | 3 |
| 2 | `POS` | Kasir / POS | 2 |
| 3 | `SALES` | Penjualan | 2 |
| 4 | `CATALOG` | Produk dan Harga | 5 |
| 5 | `CRM` | Pelanggan dan CRM | 2 |
| 6 | `PURCHASING` | Pembelian | 6 |
| 7 | `INVENTORY` | Gudang dan Persediaan | 7 |
| 8 | `MANUFACTURING` | Produksi | 1 |
| 9 | `QUALITY` | Quality Control | 0 |
| 10 | `SHIPPING` | Distribusi dan Pengiriman | 1 |
| 11 | `FINANCE` | Keuangan dan Akuntansi | 2 |
| 12 | `INVESTOR` | Investor dan Bagi Hasil | 0 |
| 13 | `HR` | SDM dan Payroll | 4 |
| 14 | `ASSET` | Aset dan Pemeliharaan | 0 |
| 15 | `WORKFLOW` | Workflow dan Persetujuan | 0 |
| 16 | `REPORTING` | Laporan dan Analitik | 0 |
| 17 | `SUBSCRIPTION` | Langganan dan Perangkat | 3 |
| 18 | `MASTER_DATA` | Master Data | 9 |
| 19 | `INTEGRATION` | Integrasi dan API | 0 |
| 20 | `ADMIN` | Administrasi Sistem | 5 |
| 21 | `SUPPORT` | Bantuan dan Dukungan | 0 |

Tujuh root tidak punya anak sama sekali: `QUALITY`, `INVESTOR`, `ASSET`,
`WORKFLOW`, `REPORTING`, `INTEGRATION`, `SUPPORT`. Menu itu tampil tetapi tidak
menuju ke mana pun.

## Pemetaan ke 33 root Versi 8

| # | Root Versi 8 | Root sekarang | Tindakan |
| ---: | --- | --- | --- |
| 01 | Beranda dan Pusat Kerja | `HOME` | perluas dari 3 menjadi 15 anak |
| 02 | Kasir / POS | `POS` | perluas dari 2 menjadi 19 anak |
| 03 | Penjualan dan Order Management | `SALES` | perluas dari 2 menjadi 15 anak |
| 04 | Pelanggan, CRM, dan Layanan | `CRM` | perluas dari 2 menjadi 13 anak |
| 05 | E-commerce, Marketplace, Omnichannel | — | **baru** |
| 06 | Produk, Katalog, Harga, Promosi | `CATALOG` | perluas dari 5 menjadi 16 anak |
| 07 | Pembelian dan Strategic Sourcing | `PURCHASING` | perluas dari 6 menjadi 15 anak |
| 08 | Pemasok, Kontrak, Vendor Portal | — | **baru** (pecahan dari `PURCHASING`) |
| 09 | Gudang dan Persediaan | `INVENTORY` | perluas dari 7 menjadi 18 anak |
| 10 | Distribusi, Ekspedisi, Armada | `SHIPPING` | perluas dari 1 menjadi 19 anak |
| 11 | Produksi, MRP, Perencanaan | `MANUFACTURING` | perluas dari 1 menjadi 19 anak |
| 12 | Quality Management | `QUALITY` | isi 15 anak |
| 13 | Aset, Maintenance, Field Service | `ASSET` | isi 17 anak |
| 14 | Proyek, Timesheet, Job Costing | — | **baru** |
| 15 | Keuangan, Kas, Bank, Treasury | `FINANCE` (sebagian) | pecah dan perluas |
| 16 | Akuntansi, Pajak, Buku Besar | `FINANCE` (sebagian) | pecah dan perluas |
| 17 | Anggaran, Konsolidasi, Kinerja Keuangan | — | **baru** |
| 18 | Organisasi, SDM, Administrasi Karyawan | `HR` (sebagian) | pecah dan perluas |
| 19 | Kehadiran, Jadwal, Payroll | `HR` (sebagian) | pecah dan perluas |
| 20 | Rekrutmen, Talenta, Kinerja, Pelatihan | — | **baru** |
| 21 | Investor, Kepemilikan, Bagi Hasil | `INVESTOR` | isi 17 anak |
| 22 | Referral, Partner, Komisi | — | **baru** |
| 23 | Workflow, SOP, Persetujuan | `WORKFLOW` | isi 15 anak |
| 24 | Ticketing, Helpdesk, Knowledge Base | — | **baru** |
| 25 | Website, CMS, Portal, Custom Domain | — | **baru** |
| 26 | Dokumen, Pengetahuan, Records | — | **baru** |
| 27 | GRC, Risiko, Audit, EHS, ESG | — | **baru** |
| 28 | Laporan, BI, Analitik, AI | `REPORTING` | isi 14 anak |
| 29 | Integrasi, API, Perangkat, IoT | `INTEGRATION` | isi 17 anak |
| 30 | Langganan, Paket, Billing, Perangkat SaaS | `SUBSCRIPTION` | perluas dari 3 menjadi 16 anak |
| 31 | Master Data dan Data Governance | `MASTER_DATA` | perluas dari 9 menjadi 18 anak |
| 32 | Administrasi Sistem, Keamanan, Konfigurasi | `ADMIN` | perluas dari 5 menjadi 22 anak |
| 33 | Bantuan dan Pembelajaran | `SUPPORT` | isi 16 anak |

Ringkasannya: **21 root dipertahankan dan diperluas, 12 root baru**, tidak ada
yang dihapus. `FINANCE` dan `HR` masing-masing dipecah menjadi dua root sesuai
blueprint, dengan kode lama dipertahankan pada salah satu pecahan agar
permission yang sudah ada tidak putus.

Jumlah menu setelah diperluas diperkirakan **±520 node** (33 root + anaknya),
dari 73 sekarang.

## Keputusan rancangan

### MenuCatalog sebagai satu sumber kebenaran

Blueprint meminta satu katalog yang melayani UI, API, Help, dan Entitlement.
Saat ini menu hanya melayani UI dan permission.

Yang ditambahkan pada tiap node:

```text
menuCode            kunci stabil, dipakai permission dan help mapping
resourceCode        menghubungkan ke registry CRUD bila menu adalah halaman CRUD
routePath           menghubungkan ke React Router
helpTopicCode       menghubungkan ke Help Center
moduleCode          menghubungkan ke entitlement langganan
requiredFeature     entitlement paket yang harus aktif
isNavigable         node struktural atau halaman sungguhan
```

### Menu tersembunyi bukan otorisasi

Blueprint menegaskan hal ini, dan temuan V6-0-F03 membuktikan bahayanya nyata:
endpoint CRUD master saat ini **tidak memverifikasi permission sama sekali**,
sehingga menu yang disembunyikan tidak menghalangi siapa pun memanggil API-nya
langsung. Perbaikan itu prasyarat, bukan pelengkap.

### Jangan hard-code menu per role di React

Menu dan permission tetap datang dari API. `MenuList` pada `AppLayout.tsx` sudah
merender rekursif dari data, jadi perluasan ke 33 root tidak menuntut perubahan
komponen — hanya data.

## Risiko

| Risiko | Mitigasi |
| --- | --- |
| Menu bertambah 7× membuat sidebar sulit dipakai | pencarian menu, favorit, dan menu terakhir dipakai; blueprint bagian 01 sudah memuatnya |
| Node tanpa halaman menimbulkan 404 | `isNavigable=false` untuk node struktural; halaman yang belum ada memakai `ComingSoonPage` yang sudah tersedia |
| Permission lama putus saat kode menu berubah | kode menu lama dipertahankan; root baru memakai kode baru |
| Seed menu besar memperlambat provisioning | seed batch, dan diukur pada fase implementasi |
