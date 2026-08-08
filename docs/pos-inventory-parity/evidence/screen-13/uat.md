# UAT — Layar 13 (Mencetak Harga Jual)

**Tenant uji:** `uat_stock_price_18662`. **Klaim katalog:** `POST
/reports/price-sale/snapshot`. **Klaim temuan lama**
(`09-master-stock-pricing-findings.md` #5): "mekanisme benar, GAP integrasi — tidak
ada frontend yang pernah memanggilnya". Pass ini memverifikasi endpoint itu sendiri
bekerja dengan data live, terlepas dari apakah frontend memanggilnya — dua klaim yang
berbeda dan sengaja dipisahkan di sini.

## Skenario

1. Setelah sales order CUST-007/AYAM diinvoice (layar 11), `legacy_price_history`
   berisi 1 baris `party_type='CUSTOMER'`.
2. `POST /reports/price-sale/snapshot` dengan `asOfDate=2026-08-09` → **sukses**,
   `row_count: 1` (`snapshot-create.json`).
3. `GET /report-snapshots/:id` → isi lengkap: `{"price":"40000.0000",
   "product_code":"AYAM","customer_code":"CUST-007","customer_name":"Andi Pratama",
   "effective_date":"2026-08-09"}`, `title:"Daftar Harga Jual Customer"`,
   `totals:{"price":"40000"}` (`snapshot-retrieve.json`) — data nyata dari transaksi
   live, bukan payload placeholder.

## Hasil

**PASS untuk mekanisme endpoint**: `/reports/price-sale/snapshot` benar-benar
menghasilkan laporan dengan data harga jual customer yang akurat dari transaksi live,
membekukannya sebagai snapshot yang dapat diambil ulang. **GAP integrasi terkonfirmasi
tetap berlaku** (bukan diverifikasi ulang secara langsung di pass ini — lihat catatan
di bawah): temuan lama menyatakan endpoint ini nol dipanggil oleh kode frontend Web
maupun Flutter manapun (hanya `gross-profit`/`profit-loss` yang pernah dipanggil).
Endpoint BEKERJA saat dipanggil langsung; klaim terpisah adalah apakah pengguna nyata
bisa mengaksesnya lewat UI — dua hal berbeda, dilaporkan terpisah sesuai instruksi
tugas ini.

## Yang TIDAK dicakup pass ini

Verifikasi ulang "nol pemanggil frontend" tidak diulang dengan pencarian kode
frontend baru di pass ini (memakan waktu, temuan lama sudah menyitir file:line
spesifik) — diwariskan sebagai klaim yang belum dibantah, bukan diverifikasi ulang.
Screenshot Web/Windows/Android tidak diambil (konsisten dengan gap integrasi:
tidak ada layar UI yang memanggil endpoint ini untuk discreenshot).
