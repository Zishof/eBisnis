# 02 — Matriks Gap Versi 8 ke Versi 9

Status: `DONE`, `PARTIAL`, `MISSING`, `BROKEN`, `CONFLICTING`, `BLOCKED`,
`NOT_APPLICABLE`.

Kolom **Reuse** menyatakan apa yang dipakai ulang agar tidak ada implementasi
kedua. Kolom **Fase** menunjuk [09-implementation-plan.md](09-implementation-plan.md).

## A. Fondasi marketplace

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | `MarketplaceProgram` | MISSING | 0 berkas | — | seluruh model | rendah | V9-1 |
| A2 | `MarketplaceSeller` + enrollment 14 status | MISSING | 0 berkas | `workflow_*` untuk transisi | seluruh model + service | sedang | V9-1 |
| A3 | `MarketplaceStore` + profil, kebijakan, alamat | MISSING | 0 berkas | `address`, `legal_entity`, `brand` | model toko | rendah | V9-1 |
| A4 | Readiness / go-live checklist | MISSING | 0 berkas | — | service + UI | rendah | V9-1 |
| A5 | Verifikasi dan suspensi toko | MISSING | 0 berkas | `MasterLifecycleService` | model + alur | sedang | V9-1 |

## B. eSmartlink dan aktivasi

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | Kontrak create-order / callback / inquiry | **DONE** | `esmartlink.client.ts`, `esmartlink-payment.service.ts` | dipakai apa adanya | — | — | — |
| B2 | Idempotensi transaction id | **DONE** | `@@unique([providerId, providerTransactionId])` | dipakai apa adanya | — | — | — |
| B3 | Log H2H, dead letter, rate limit | **DONE** | `HostToHostLog`, `PaymentDeadLetter`, `ProviderRateLimitState` | dipakai apa adanya | — | — | — |
| B4 | Rekonsiliasi | **DONE** | `PaymentReconciliationRun`/`Item` | dipakai apa adanya | tautan ke order marketplace | rendah | V9-7 |
| B5 | Akun provider **per tenant** | MISSING | `PaymentProvider` global | struktur `PaymentProvider` | `TenantPaymentProviderAccount` | tinggi | V9-2 |
| B6 | Credential per seller, terenkripsi, berversi | MISSING | hanya `secretReference` env | pola "jangan simpan rahasia mentah" | penyimpanan terenkripsi + versi | **tinggi** | V9-2 |
| B7 | Health check tercatat | MISSING | 0 model | `PaymentAttempt` | model health check | rendah | V9-2 |
| B8 | Katalog capability provider | MISSING | 0 model | — | `PaymentProviderCapability` | sedang | V9-2 |
| B9 | Tiket aktivasi `PLATFORM_SUPPORT` | **MISSING** | modul ticketing **tidak ada** | — | seluruh modul tiket | **tinggi** | V9-2 |
| B10 | Interface onboarding masa depan | MISSING | 0 berkas | — | interface saja, tanpa endpoint karangan | rendah | V9-2 |
| B11 | Refund API | **BLOCKED** | tidak ada pada client maupun dokumentasi provider | — | `REFUND_MANUAL_REQUIRED` | sedang | V9-10 |
| B12 | Split settlement | **BLOCKED** | tidak ada bukti dukungan provider | — | payment per seller | — | V9-6 |
| B13 | `PaymentOrder` untuk order non-invoice | **CONFLICTING** | `invoiceId` wajib | model yang sama | longgarkan + tautan polimorfik | **tinggi** | V9-7 |

## C. Toko dan domain

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | `OnlineStore` tenant | MISSING | 0 berkas | — | model | rendah | V9-3 |
| C2 | Registry domain **terverifikasi** | MISSING | `WebsiteDomain` tanpa `tenantId` dan tanpa verifikasi | struktur `WebsiteDomain` | model + alur verifikasi | **tinggi** | V9-3 |
| C3 | Storefront resolver berbasis host | MISSING | 0 berkas | — | resolver | **tinggi** | V9-3 |
| C4 | Halaman informasi toko | MISSING | 0 berkas | `CmsPage` platform | model halaman tenant | rendah | V9-3 |
| C5 | Isolasi katalog custom domain | MISSING | — | — | penyaringan wajib | **tinggi** | V9-3 |

## D. Listing dan media

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | Produk master | **DONE** | `product` + 4 tabel | dipakai apa adanya | — | — | — |
| D2 | **Varian produk** | MISSING | 0 tabel varian | — | model varian | sedang | V9-4 |
| D3 | Media produk | MISSING | `file_object` ada tetapi **tidak dipakai service mana pun** | tabel `file_object` | seluruh pipeline media | **tinggi** | V9-4 |
| D4 | Gerbang minimal 3 gambar | MISSING | 0 berkas | — | validator publikasi | sedang | V9-4 |
| D5 | Validasi URL YouTube | MISSING | 0 berkas | — | validator | rendah | V9-4 |
| D6 | Model listing + 12 status | MISSING | 0 berkas | `MasterLifecycleService` | model listing | sedang | V9-4 |
| D7 | Moderasi listing dan media | MISSING | 0 berkas | `workflow_*` | model moderasi | sedang | V9-12 |
| D8 | Harga per kanal | **PARTIAL** | `price_book`, `price_book_item` | dipakai apa adanya | tautan kanal online | rendah | V9-4 |

## E. Marketplace publik

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | Projection listing ke platform | MISSING | `sync_outbox` ada tetapi **tidak dipakai service mana pun** | tabel `sync_outbox` | worker projection | **tinggi** | V9-5 |
| E2 | Halaman marketplace publik | MISSING | 0 halaman | pola halaman publik CMS | halaman baru | sedang | V9-5 |
| E3 | Pencarian dan filter | MISSING | 0 berkas | PostgreSQL FTS | indeks + query | sedang | V9-5 |
| E4 | SEO terstruktur | **PARTIAL** | `SeoStructuredData` ada untuk CMS | model yang sama | data produk | rendah | V9-5 |
| E5 | Sitemap dan canonical | MISSING | 0 berkas | — | generator | rendah | V9-5 |

## F. Pembeli, keranjang, checkout

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | Akun pembeli | MISSING | 0 berkas | `PlatformUser` | model pembeli | sedang | V9-6 |
| F2 | Login Google pembeli | MISSING | bukan dependency | rancangan `docs/upgrade-v8/17` | implementasi | rendah | V9-6 |
| F3 | Keranjang + kelompok seller | MISSING | 0 berkas | — | model | sedang | V9-6 |
| F4 | Validasi checkout | MISSING | 0 berkas | — | validator | **tinggi** | V9-6 |
| F5 | Pembayaran per seller | MISSING | 0 berkas | `PaymentOrder` (setelah B13) | orchestrator | **tinggi** | V9-6 |

## G. Order, reservasi, routing

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | **Reservasi stok** | **PARTIAL** | tabel `stock_reservation` **ada** | dipakai ulang | service reservasi | sedang | V9-8 |
| G2 | Order marketplace + 24 status | MISSING | `sales_order` ada tetapi bukan order marketplace | `sales_order` sebagai hilir | model order | sedang | V9-8 |
| G3 | Routing ke lokasi fulfillment | MISSING | 0 berkas | `warehouse`, `outlet` | mesin routing | sedang | V9-8 |
| G4 | Alokasi dan backorder | **PARTIAL** | `purchase_backorder` untuk pembelian | pola yang sama | backorder penjualan | rendah | V9-8 |
| G5 | Pencegahan oversell | MISSING | — | `stock_reservation` + idempotensi | penegakan | **tinggi** | V9-8 |

## H. Fulfillment dan pengiriman

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H1 | Fulfillment order | MISSING | 0 tabel | `goods_receipt` sebagai pola | model | sedang | V9-9 |
| H2 | Picking (wave, task, scan) | MISSING | 0 tabel | `warehouse_bin` | model + UI | sedang | V9-9 |
| H3 | Packing dan paket | MISSING | 0 tabel | — | model + UI | sedang | V9-9 |
| H4 | Provider pengiriman | MISSING | `carrier` hanya master data | tabel `carrier` | abstraksi provider | sedang | V9-9 |
| H5 | Quote, booking, label, manifest | MISSING | 0 tabel | — | model + adapter | sedang | V9-9 |
| H6 | Pelacakan | MISSING | 0 tabel | — | model + webhook | sedang | V9-9 |
| H7 | **Armada internal V7** | **MISSING** | `ExpeditionOrder` dll **tidak ada** | tidak ada yang dapat dipakai ulang | seluruh modul | **tinggi** | V9-9 |

## I. Retur, refund, sengketa

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| I1 | Kebijakan dan permintaan retur | MISSING | 0 tabel | `workflow_*` | model | sedang | V9-10 |
| I2 | Inspeksi dan disposisi | MISSING | 0 tabel | `goods_receipt_inspection` sebagai pola | model | sedang | V9-10 |
| I3 | Refund | **BLOCKED** oleh B11 | — | — | alur manual | sedang | V9-10 |
| I4 | Sengketa dan banding | MISSING | 0 tabel | `workflow_*` | model | rendah | V9-10 |

## J. Promosi, chat, ulasan

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| J1 | Diskon dan voucher | **PARTIAL** | `DiscountProgram` dkk **ada** di platform | mesin diskon whitelist-only | voucher seller | rendah | V9-11 |
| J2 | Flash sale, bundle, kampanye | MISSING | 0 berkas | mesin diskon | aturan tambahan | rendah | V9-11 |
| J3 | Chat pembeli-penjual | MISSING | 0 tabel | — | model | sedang | V9-11 |
| J4 | Ulasan terverifikasi | MISSING | 0 tabel | — | model | rendah | V9-11 |

## K. Operasi platform

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| K1 | Persetujuan seller | MISSING | 0 berkas | `PlatformTenantAction` | alur | sedang | V9-12 |
| K2 | Moderasi produk dan media | MISSING | 0 berkas | `workflow_*` | model | sedang | V9-12 |
| K3 | Kebijakan produk terlarang | MISSING | 0 berkas | — | model | sedang | V9-12 |
| K4 | Fee marketplace | MISSING | 0 berkas | `BillingInvoice` untuk penagihan | model akrual | sedang | V9-12 |
| K5 | Risiko dan fraud | MISSING | 0 berkas | — | model | rendah | V9-12 |

## L. Menu, role, permission

| # | Requirement | Status | Bukti | Reuse | Gap | Risiko | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | Profil M1–M8 | MISSING | hanya P0–P12 | `role-profile.ts` | tambahkan pada berkas yang sama | rendah | V9-13 |
| L2 | 33 role marketplace | MISSING | 129 role non-marketplace | `tenant-role.seed.ts` | tambahkan ke katalog | rendah | V9-13 |
| L3 | 16 root menu marketplace | MISSING | 21 root non-marketplace | `MENU_TREE_SEED` | tambahkan | rendah | V9-13 |
| L4 | Resource permission `MARKETPLACE.*` dll | MISSING | 26 aksi generik | `permission_action` | aksi baru | sedang | V9-13 |
| L5 | Data scope marketplace | **PARTIAL** | 14 tingkat ada; V9 minta 17 | `role_data_scope` | 3 tingkat baru | rendah | V9-13 |
| L6 | **Penegakan data scope pada query** | **MISSING** | tersimpan, tidak ditegakkan | — | resolver predikat | **tinggi** | V9-1 |
| L7 | SoD marketplace | **PARTIAL** | 13 aturan non-marketplace | `SegregationOfDutyService` | 10 aturan baru | rendah | V9-13 |
| L8 | Sample user per role | MISSING | 0 berkas | — | generator | sedang | V9-13 |
| L9 | **V6-0-F03 guard bocor** | **BROKEN** | 13 endpoint tanpa metadata permission | — | perbaikan guard | **tinggi** | V9-1 |

## M. Help, Excel, PDF

| # | Requirement | Status | Reuse | Fase |
| --- | --- | --- | --- | --- |
| M1 | Help Center | MISSING | — | V9-13B |
| M2 | CrudActionGroup | MISSING | — | V9-1 (dasar) / V9-13B (lengkap) |
| M3 | Excel unduh/unggah | MISSING | — | V9-13B |
| M4 | PDF | MISSING | — | V9-13B |

## N. Akuntansi

| # | Requirement | Status | Bukti | Reuse | Fase |
| --- | --- | --- | --- | --- | --- |
| N1 | Jurnal | **DONE** | `journal_entry`, `journal_entry_line`, `chart_of_account` | dipakai apa adanya | — |
| N2 | Mesin event akuntansi | MISSING | tidak ada mesin aturan | — | V9-14 |
| N3 | 12 event marketplace | MISSING | — | mesin N2 | V9-14 |

## Rekapitulasi

| Status | Jumlah |
| --- | ---: |
| DONE | 6 |
| PARTIAL | 9 |
| MISSING | 48 |
| BROKEN | 1 |
| CONFLICTING | 1 |
| BLOCKED | 2 |
| **Total** | **67** |

## Empat temuan yang paling mengubah rencana

**1. Ticketing Versi 7 tidak ada** (B9). Seluruh alur aktivasi eSmartlink Versi 9
bergantung padanya. Bukan "reuse", melainkan modul baru.

**2. Ekspedisi Versi 7 tidak ada** (H7). Dokumen Versi 9 melarang membuat model
armada kedua dan meminta memakai ulang enam model Versi 7. Tidak satu pun ada.

**3. `PaymentOrder` terikat invoice** (B13). Menuntut perubahan pada tabel yang
sudah dipakai produksi, dengan regression billing sebagai syarat.

**4. Guard permission bocor** (L9) dan **data scope tidak ditegakkan** (L6).
Keduanya sudah tercatat sejak V6-0 dan belum diperbaiki. Versi 9 menambah puluhan
endpoint yang menyentuh uang dan stok milik seller yang berbeda-beda. Menambah
endpoint di atas otorisasi yang bocor memperbesar masalah, bukan menundanya —
karena itu keduanya dinaikkan ke **V9-1**, bukan V9-13.
