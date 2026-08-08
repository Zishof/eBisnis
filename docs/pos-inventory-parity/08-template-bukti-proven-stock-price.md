# Template Bukti PROVEN — Stok & Harga (Layar 8–19)

**Tanggal:** 2026-08-08
**Cakupan:** Stok Barang (8), Opname (9–10), Harga Beli/Jual & cetak/ekspor (11–16), Master Harga (17–19).

## 1. Properti kritis yang WAJIB dibuktikan (dari audit source)

| Properti | Bukti di source | Cara membuktikan |
|---|---|---|
| **Balance = Σ movement (immutable)** | opname POST menulis `stock_movement` (append-only), lalu update `stock_balance` | `on_hand` = jumlah movement per produk/gudang/lot/bin |
| **Opname state machine** | freeze `DRAFT→FROZEN`, approve `COUNTED→APPROVED`, post `APPROVED→POSTED` | Loncat state ditolak; post sebelum APPROVED ditolak |
| **Posting idempoten** | `posting_key = STOCK_OPNAME:<id>:<lineId>` unik | Post 2× → movement tidak dobel |
| **Koreksi via reversal, bukan hapus** | movement `ADJUSTMENT_IN/OUT`, balance `version+1` | Selisih dikoreksi movement baru, movement lama tetap |
| **No self-approval harga** | app-check + constraint `price_book_no_self_approval` (V055) | Pengaju menyetujui sendiri → ditolak |
| **Price-book state machine** | DRAFT→SUBMITTED→APPROVED/REJECTED→INACTIVE; `is_active` hanya saat APPROVED | Harga DRAFT tak dipakai; hanya APPROVED aktif |
| **Snapshot laporan immutable** | `inventory_report_snapshot` beku + `inventory_print_log` | Reprint = snapshot sama, audit bertambah |

## 2. Endpoint

Stok 8: `GET /inventory/balances`, `GET /inventory/mobile-catalog`, `GET /inventory/master-data`.
Opname 9–10: `GET/POST /stock-opnames` (+`/:id` patch, `/freeze`, `/approve`, `/post`), `POST /reports/stock-opname/snapshot`.
Harga 11–16: `GET /inventory/legacy/price-history`, `POST /reports/price-sale/snapshot`, `POST /reports/stock-list/snapshot`, `GET /report-snapshots/:id` (+`/print-log`).
Master Harga 17–19: `GET/POST /inventory/price-books`, `PATCH /inventory/price-books/:id/status`.

## 3. Skenario bukti (jalankan lokal)

```bash
API=http://localhost:3000 ; TOKEN=... ; DATE=2026-08-08
J="-H Content-Type:application/json -H Authorization:Bearer $TOKEN"
```

### 3.1 Balance = Σ movement (layar 8)
```bash
curl -s $J "$API/inventory/balances?warehouseId=<wh>" > evidence/screen-08/balances.json
```
```sql
-- balance harus sama dengan agregasi movement
SELECT sb.product_id, sb.on_hand_qty,
       (SELECT COALESCE(SUM(CASE WHEN sm.destination_warehouse_id=sb.warehouse_id THEN sm.quantity
                                 WHEN sm.source_warehouse_id=sb.warehouse_id THEN -sm.quantity ELSE 0 END),0)
          FROM "demo".stock_movement sm WHERE sm.product_id=sb.product_id) AS derived
  FROM "demo".stock_balance sb WHERE sb.warehouse_id='<wh>';   -- on_hand_qty = derived
```

### 3.2 Opname state machine + idempotency (layar 9)
```bash
OP=<opnameId>
curl -s -o evidence/screen-09/post-before-approve.json -w "%{http_code}\n" $J -X POST $API/stock-opnames/$OP/post   # DITOLAK (belum APPROVED)
curl -s $J -X POST $API/stock-opnames/$OP/freeze  > evidence/screen-09/freeze.json
curl -s $J -X POST $API/stock-opnames/$OP/approve > evidence/screen-09/approve.json
curl -s $J -X POST $API/stock-opnames/$OP/post    > evidence/screen-09/post.json
# post ulang → tidak menambah movement (posting_key unik)
curl -s -o evidence/screen-09/post-again.json -w "%{http_code}\n" $J -X POST $API/stock-opnames/$OP/post
```
```sql
SELECT count(*) FROM "demo".stock_movement WHERE reference_type='STOCK_OPNAME' AND reference_id='<OP>';  -- = jumlah baris variance≠0, tidak bertambah saat post ulang
```

### 3.3 No-self-approval harga (layar 17–19)
```bash
# user A submit
curl -s $J -X PATCH $API/inventory/price-books/<pb>/status -d '{"status":"SUBMITTED"}' > evidence/screen-17/submit.json
# user A (pengaju) approve sendiri → DITOLAK
curl -s -o evidence/screen-17/self-approve.json -w "%{http_code}\n" $J -X PATCH $API/inventory/price-books/<pb>/status -d '{"status":"APPROVED"}'   # 403
# user B (supervisor) approve → sukses, is_active=true
```
```sql
SELECT approval_status, is_active, submitted_by, approved_by FROM "demo".price_book WHERE id='<pb>';  -- approved_by <> submitted_by; is_active hanya saat APPROVED
```

### 3.4 Snapshot & print (layar 13–16)
```bash
SID=$(curl -s $J $API/reports/stock-list/snapshot -d "{\"asOfDate\":\"$DATE\"}" | tee evidence/screen-15/snapshot.json | jq -r .id)
curl -s $J $API/report-snapshots/$SID > evidence/screen-16/retrieve.json
curl -s $J $API/report-snapshots/$SID/print-log -d '{"format":"PDF","documentNumber":"STK-2026-0001"}' > evidence/screen-16/print-log.json
```
Immutability: `result_payload` snapshot tidak berubah walau data stok berubah setelahnya.

## 4. UAT ringkas (layar 9 opname)
```
1. Buat opname, isi hitungan fisik → variance muncul.
2. Freeze → status FROZEN, hitungan terkunci.
3. Coba post → ditolak (belum APPROVED).
4. Approve (oleh role POST) → APPROVED.
5. Post → stock_movement ADJUSTMENT terbentuk, balance berubah sesuai variance.
6. Post ulang → tidak ada movement baru (idempoten).
7. Bandingkan balance dengan Σ movement → cocok.
Hasil: PASS + evidence.
```

## 5. DoD & kenaikan status
Stok/Harga PROVEN bila: balance konsisten dengan movement immutable, opname state machine & idempotency ditegakkan, no-self-approval harga bekerja (app+DB), snapshot laporan immutable dengan print audit — ber-screenshot 3 platform + UAT. Tambah entri `parity-evidence.registry.ts` layar 8–19, keluarkan dari `PENDING_PROOF`.
