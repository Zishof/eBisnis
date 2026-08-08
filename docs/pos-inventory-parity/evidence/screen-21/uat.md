# UAT — Layar 21 (Tombol Hutang pada Pembelian)

**Tenant uji:** `uat_purchase_ap_19222`. **Endpoint:** `GET /inventory/legacy/payables`
(sama persis dengan layar 22 — layar 21 di manual lama cuma tombol yang membuka daftar hutang
dari menu Pembelian, tidak ada endpoint terpisah).

## Skenario

Legacy layar ini murni navigasi: tombol "Hutang" pada menu Pembelian membuka daftar hutang
supplier. Karena tidak ada endpoint/kontrak terpisah dari layar 22 (`Data Hutang Supplier`),
pembuktian teknisnya (termasuk bug permission yang ditemukan+diperbaiki dan temuan payable hantu)
didokumentasikan penuh di **`screen-22/uat.md`** — dokumen ini hanya menegaskan bahwa endpoint yang
sama dipanggil berhasil setelah perbaikan.

## Hasil

**PASS** (mengikuti pembuktian layar 22, endpoint identik: `GET /inventory/legacy/payables`).
Sebelum perbaikan permission (lihat layar 22), endpoint ini mengembalikan **HTTP 403** untuk
SEMUA role termasuk pemilik tenant baru — jadi tombol "Hutang" pada Pembelian akan gagal total
di produksi. Setelah perbaikan (`PURCHASE_ORDER.READ` → `PURCHASING.READ`), **HTTP 200** dan
data hutang tampil benar.

## Yang TIDAK dicakup pass ini

Tidak ada endpoint/perilaku unik untuk layar ini di luar yang sudah dibuktikan pada layar 22.
Screenshot Web/Windows/Android tidak diambil.
