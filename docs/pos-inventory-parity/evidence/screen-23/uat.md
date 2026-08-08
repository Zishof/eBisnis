# UAT — Layar 23 (Menampilkan Hutang yang Sudah Lunas)

**Tenant uji:** `uat_purchase_ap_19222`. **Endpoint:** `GET /inventory/legacy/payables?includeSettled=true`
(query param tambahan pada endpoint yang sama dengan layar 22 — perbaikan bug permission
`PURCHASE_ORDER.READ` → `PURCHASING.READ` yang didokumentasikan penuh di `screen-22/uat.md` juga
berlaku di sini, endpoint identik). **Alur data:** lihat `screen-20/uat.md`.

## Skenario

`GET /inventory/legacy/payables?pageSize=20&includeSettled=true` → **4 baris**, satu lebih banyak
dari layar 22 (yang cuma 3): GR-000001 kini ikut muncul dengan `is_settled=true`,
`amount="0.0000"` (net outstanding, karena sudah lunas penuh), `aging_bucket="LUNAS"`. Tiga baris
lain (GR-000002 dicicil, GR-000003 jatuh tempo dimundurkan, GR-000004 payable hantu) tampil identik
dengan layar 22. Bukti: `api-payables-includeSettled-true.json`.

Ini membuktikan filter `includeSettled` bekerja tepat sesuai definisi: query SQL-nya cuma mengubah
`WHERE ($2::boolean OR NOT lp.is_settled)` — tanpa param, klausanya `NOT lp.is_settled` (hanya buka);
dengan `includeSettled=true`, klausanya selalu benar (semua baris, termasuk lunas).

## Hasil

**PASS**. Baris lunas (GR-000001) hanya tampil saat `includeSettled=true`, dan disembunyikan
secara default — cocok dengan perilaku legacy "Menampilkan Hutang yang Sudah Lunas" sebagai
toggle terpisah dari daftar hutang aktif. `amount` untuk baris lunas benar dilaporkan 0 (net),
sementara `original_amount` tetap menyimpan nilai dokumen asli (600000) — histori tidak hilang.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil.
