# Template Bukti PROVEN — Purchase/AP (20–29) & Sales/AR (30–42)

**Tanggal:** 2026-08-08
**Fokus:** dua domain transaksional inti. Di sinilah kekhawatiran paket paling tajam — *legacy purchase → PO/GR/AP* dan *sales order → invoice/AR/journal* harus terbukti **atomik, idempotent, dan reversible**, bukan sekadar ada endpoint.

## 1. Properti kritis yang WAJIB dibuktikan (dari audit source)

Audit menemukan mekanisme berikut sudah ada; PROVEN = membuktikannya bekerja di bawah tekanan:

| Properti | Bukti di source | Cara membuktikan |
|---|---|---|
| **Idempotency** pembayaran/penerimaan | `createSettlement` (controller ~1677) wajib `Idempotency-Key`, cek `WHERE idempotency_key=$1` | Kirim 2× dengan key sama → hanya 1 settlement, saldo tak dobel |
| **Idempotency** jurnal | journal POST (~660) wajib `Idempotency-Key`, `posting_key` | Retry POST jurnal → tidak dobel |
| **Atomicity** invoice | `invoiceSalesOrder` (~1511) `tenantDb.transaction` + `SELECT ... FOR UPDATE` | Paksa error di tengah → tak ada stok terpotong tanpa AR/jurnal |
| **State guard** | invoice hanya `status='CONFIRMED'`; settlement punya POST/REVERSE | Coba invoice order DRAFT → 409 CONFLICT |
| **Allocation cap** | dedup `ledgerIds`, cek `outstanding = abs(amount) - allocated` | Alokasi > outstanding → ditolak |
| **Reversal** | `transitionSettlement('REVERSE')`, `ap/ar .../reverse` | Reverse → saldo kembali, audit bertambah, dokumen asli tak dihapus |
| **Aging benar** | `agingReport`: `NOT is_settled AND amount>0`, `overdue_days` | Bandingkan dengan hitung manual per pihak |

## 2. Cakupan layar & endpoint

**Purchase/AP (20–29):**
`POST /purchase-orders` (+submit/approve/send), `POST /goods-receipts` (+inspect/validate/reverse-validation/create-backorder), `GET /inventory/legacy/payables[?includeSettled=true]`, `POST /ap/payments` (+`/:id/post`, `/:id/reverse`), reports `ap-payment-register`, `ap-aging`, `purchase-invoice`, `purchase-register`.

**Sales/AR (30–42):**
`GET/POST /sales/orders` (+`/:id/invoice`), `POST /inventory/mobile-orders`, `GET /inventory/legacy/receivables[?includeSettled=true]`, `POST /ar/receipts` (+`/:id/post`, `/:id/reverse`), `POST /sales-note-handovers` (+handover/return/close/cancel), reports `ar-receipt-register`, `ar-aging-customer`, `ar-aging-sales`, `ar-outstanding`, `sales-note-handover`.

## 3. Skenario bukti (jalankan lokal terhadap tenant uji)

```bash
API=http://localhost:3000 ; TOKEN=... ; DATE=2026-08-08
J="-H Content-Type:application/json -H Authorization:Bearer $TOKEN"
```

### 3.1 Idempotency AR receipt (layar 34)
```bash
KEY=$(uuidgen)
# kirim dua kali dengan Idempotency-Key sama
for i in 1 2; do
  curl -s $J -H "Idempotency-Key: $KEY" $API/ar/receipts \
    -d '{"partyId":"<customerId>","method":"CASH","allocations":[{"ledgerId":"<recvLedgerId>","amount":100000}]}' \
    > evidence/screen-34/receipt-attempt-$i.json
done
# BUKTI: kedua respons punya id sama; saldo piutang turun 100000, BUKAN 200000.
```
Rekonsiliasi:
```sql
SELECT id, idempotency_key FROM "demo".inventory_ar_receipt WHERE idempotency_key = '<KEY>';  -- harus 1 baris
```

### 3.2 Allocation cap (layar 24/34)
```bash
# alokasi melebihi outstanding harus DITOLAK
curl -s -o evidence/screen-24/overalloc.json -w "%{http_code}\n" $J -H "Idempotency-Key: $(uuidgen)" \
  $API/ap/payments -d '{"partyId":"<supplierId>","method":"TRANSFER","allocations":[{"ledgerId":"<payableLedgerId>","amount":999999999}]}'
# BUKTI: HTTP 4xx + pesan validasi; tidak ada baris pembayaran terbentuk.
```

### 3.3 Atomicity & state guard invoice (layar 30)
```bash
# order DRAFT tak boleh jadi invoice
curl -s -o evidence/screen-30/invoice-draft.json -w "%{http_code}\n" $J -H "Idempotency-Key: $(uuidgen)" \
  $API/sales/orders/<draftOrderId>/invoice     # harap 409 CONFLICT

# order CONFIRMED → invoice sukses, cek efek gabungan
curl -s $J -H "Idempotency-Key: $(uuidgen)" $API/sales/orders/<confirmedOrderId>/invoice \
  > evidence/screen-30/invoice-ok.json
```
Rekonsiliasi efek gabungan (harus konsisten dalam satu transaksi):
```sql
-- stok berkurang
SELECT product_id, sum(quantity) FROM "demo".stock_movement WHERE reference_type='SALES_INVOICE' AND reference_id='<orderId>' GROUP BY product_id;
-- piutang tercatat
SELECT * FROM "demo".legacy_receivable_ledger WHERE legacy_invoice_number = '<orderNumber>';
-- event akuntansi tercatat
SELECT event_type, status FROM "demo".accounting_event WHERE source_ref = '<orderId>';
```
Uji atomicity negatif: jalankan invoice pada order yang sengaja dibuat melanggar (mis. stok kurang) → **tidak boleh** ada stok terpotong tanpa piutang/jurnal (semua rollback).

### 3.4 Reversal (layar 24/34)
```bash
SID=<settlementId>
curl -s $J $API/ap/payments/$SID/reverse > evidence/screen-24/reverse.json
```
```sql
-- dokumen asli tetap ada (immutable), saldo kembali, audit bertambah
SELECT status FROM "demo".inventory_ap_payment WHERE id='<SID>';       -- REVERSED, bukan terhapus
SELECT count(*) FROM "demo".audit_log WHERE entity_id='<SID>';          -- ≥ 2 event
```

### 3.5 Aging (layar 27/37/38)
```bash
curl -s $J $API/reports/ap-aging/preview -d "{\"asOfDate\":\"$DATE\"}" > evidence/screen-27/ap-aging.json
curl -s $J $API/reports/ar-aging-customer/preview -d "{\"asOfDate\":\"$DATE\"}" > evidence/screen-37/ar-aging.json
```
Rekonsiliasi: total per pihak = `sum(outstanding)` dari ledger `NOT is_settled AND amount>0`; `overdue_days = max(asOf - due_date, 0)`.

### 3.6 Sales-note custody (layar 39–40)
Uji siklus penuh: `POST /sales-note-handovers` → `/handover` → `/return` → `/close`. BUKTI: state transition tercatat dengan actor+timestamp+reason; nota tak bisa loncat state; hasil `sales-note-handover` report cocok.

## 4. Layout evidence & kenaikan status

```
docs/pos-inventory-parity/evidence/screen-20 … screen-42/
   api-*.json  reconciliation.sql  reconciliation.json  reversal.json  uat.md  web.png  windows.png  android.png
```
Setelah PASS, tambah entri di `parity-evidence.registry.ts` (dok `03-*`) untuk tiap layar & keluarkan dari `PENDING_PROOF`. Prioritas pembuktian: **34 (AR receipt) & 30 (invoice)** dulu karena paling berisiko (idempotency + atomicity), lalu 24 (AP payment), 27/37/38 (aging), 39–40 (custody), sisanya laporan.

## 5. Definition of Done domain

Purchase/AP & Sales/AR disebut PROVEN bila: idempotency terbukti (retry tak dobel), invoice atomik (rollback bersih pada kegagalan), allocation cap ditegakkan, reversal mengembalikan saldo tanpa menghapus dokumen, aging cocok rekonsiliasi, custody state machine tak bisa dilanggar — semuanya ber-screenshot 3 platform dan ber-UAT.
