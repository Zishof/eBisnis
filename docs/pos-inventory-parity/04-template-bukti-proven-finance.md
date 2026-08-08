# Template Bukti PROVEN — Domain FINANCE (Layar 45–48)

**Tanggal:** 2026-08-08
**Kenapa FINANCE dulu:** SQL laba-kotor & laba-rugi sudah ter-*unit test* (`catalog.spec` baris 50–67), dan alur snapshot→print-log sudah immutable + ber-audit. Jadi domain ini paling siap dinaikkan ke PROVEN dan cocok jadi **pola percontohan** untuk 44 layar lain.

Menaikkan status ke PROVEN = melengkapi bukti nyata di enam sumbu: **API result, reconciliation, snapshot immutability, print audit, screenshot 3 platform, UAT**.

## 1. Cakupan & Definition of Done per layar

| Layar | Nama | Endpoint | DoD |
|--:|---|---|---|
| 45 | Menu Laba/Rugi | `POST /reports/gross-profit/preview`, `POST /reports/profit-loss/preview` | Angka preview cocok dengan rekonsiliasi sumber |
| 46 | Cetak Laba Rugi Kotor | `POST /reports/gross-profit/snapshot` → `POST /report-snapshots/:id/print-log` | Snapshot beku + print-log tercatat |
| 47 | Laporan Laba/Rugi | `POST /reports/profit-loss/snapshot`, `GET /report-snapshots/:id` | Snapshot = hasil preview (immutable) |
| 48 | Cetak Laporan Laba/Rugi | `GET /report-snapshots/:id`, `POST /report-snapshots/:id/print-log` | Reprint memakai snapshot yang sama, audit bertambah |

## 2. Layout folder evidence

```
docs/pos-inventory-parity/evidence/
  screen-45/  api-preview.json  reconciliation.sql  reconciliation.json  uat.md  web.png  windows.png  android.png
  screen-46/  api-snapshot.json  print-log.json  gross-profit.pdf  web.png  windows.png  android.png  uat.md
  screen-47/  api-snapshot.json  snapshot-immutability.md  profit-loss.pdf  web.png  windows.png  android.png  uat.md
  screen-48/  reprint-print-log.json  audit-chain.sql  uat.md  web.png  windows.png  android.png
```

## 3. Langkah tangkap bukti API (jalankan lokal)

Set variabel (token dari login tenant uji, mis. tenant `demo`):

```bash
API=http://localhost:3000
TOKEN=... ; DATE=2026-08-08
H="-H Authorization:Bearer $TOKEN -H Content-Type:application/json"
```

**Layar 45 — preview:**
```bash
curl -s $H $API/reports/gross-profit/preview  -d "{\"asOfDate\":\"$DATE\"}" > evidence/screen-45/api-preview-gross.json
curl -s $H $API/reports/profit-loss/preview   -d "{\"asOfDate\":\"$DATE\"}" > evidence/screen-45/api-preview-pl.json
```

**Layar 46 — snapshot + print-log (laba kotor):**
```bash
SID=$(curl -s $H $API/reports/gross-profit/snapshot -d "{\"asOfDate\":\"$DATE\"}" | tee evidence/screen-46/api-snapshot.json | jq -r .id)
curl -s $H $API/report-snapshots/$SID/print-log -d '{"format":"PDF","documentNumber":"LK-2026-0001"}' > evidence/screen-46/print-log.json
```

**Layar 47 — snapshot + retrieve (laba rugi):**
```bash
SID=$(curl -s $H $API/reports/profit-loss/snapshot -d "{\"asOfDate\":\"$DATE\"}" | tee evidence/screen-47/api-snapshot.json | jq -r .id)
curl -s $H $API/report-snapshots/$SID > evidence/screen-47/api-retrieve.json
```

**Layar 48 — reprint (memakai snapshot layar 47):**
```bash
curl -s $H $API/report-snapshots/$SID/print-log -d '{"format":"PDF","documentNumber":"LR-2026-0001"}' > evidence/screen-48/reprint-print-log.json
```

## 4. Rekonsiliasi (read-only, WAJIB cocok)

**Laba kotor (45/46)** — total `gross_profit` laporan harus sama dengan hitung independen dari sumber:
```sql
-- reconciliation gross-profit; ganti "demo" dg schema tenant uji
SELECT SUM(sol.line_total - sol.ordered_qty * COALESCE(sol.legacy_unit_cost, p.standard_cost))::text AS gross_profit_total
  FROM "demo".sales_order so
  JOIN "demo".sales_order_line sol ON sol.sales_order_id = so.id
  JOIN "demo".product p ON p.id = sol.product_id
 WHERE so.status = 'INVOICED' AND so.order_date <= '2026-08-08';
```
Bandingkan dengan `sum(rows[].gross_profit)` di `api-preview-gross.json`. Simpan selisih (harus 0) di `reconciliation.json`.

**Laba rugi akuntansi (47)** — hanya jurnal `POSTED`, kategori REVENUE/EXPENSE, arah normal balance:
```sql
SELECT at.category,
       SUM(CASE WHEN coa.normal_balance='DEBIT' THEN jel.debit-jel.credit
                ELSE jel.credit-jel.debit END)::text AS balance
  FROM "demo".chart_of_account coa
  JOIN "demo".account_type at ON at.id = coa.account_type_id
  LEFT JOIN "demo".journal_entry_line jel ON jel.account_id = coa.id
  LEFT JOIN "demo".journal_entry je ON je.id = jel.journal_entry_id
       AND je.status='POSTED' AND je.journal_date <= '2026-08-08'
 WHERE coa.deleted_at IS NULL AND at.category IN ('REVENUE','EXPENSE')
 GROUP BY at.category;
```
Total (REVENUE − EXPENSE) harus sama dengan total `balance` di `api-preview-pl.json`.

## 5. Uji immutability & audit chain

**Immutability (47):** `result_payload` pada `GET /report-snapshots/:id` harus identik dengan hasil `preview` pada tanggal sama. Tulis buktinya di `snapshot-immutability.md` (diff harus kosong). Snapshot menyimpan `source_revision='V047'`.

**Audit chain (48):** tiap baris `inventory_print_log` mereferensikan `snapshot_id`; reprint menambah baris baru tanpa mengubah snapshot:
```sql
SELECT pl.id, pl.report_code, pl.snapshot_id, pl.output_format, pl.document_number, pl.printed_at
  FROM "demo".inventory_print_log pl
  JOIN "demo".inventory_report_snapshot s ON s.id = pl.snapshot_id
 ORDER BY pl.printed_at;
```

## 6. Screenshot 3 platform

Untuk tiap layar, tangkap Web (`/app/finance/profit-loss`), Windows (Flutter `Inventory Control` → Laba/Rugi), Android (kartu/PDF). Angka total harus sama persis di ketiga platform (aturan: tampilan boleh beda, angka tidak).

## 7. Skrip UAT (contoh layar 46)

```
Prasyarat: tenant uji punya ≥1 sales_order INVOICED pada periode.
1. Buka Laba Rugi Kotor, set as-of 2026-08-08.        → tabel muncul, total > 0
2. Klik "Snapshot/Cetak".                              → snapshot id terbentuk
3. Cetak PDF, nomor LK-2026-0001.                      → print-log tercatat, PDF terbuka
4. Ubah 1 sales_order lalu buka ulang snapshot lama.   → angka snapshot TIDAK berubah
5. Bandingkan total dengan query rekonsiliasi.         → selisih 0
Hasil: PASS/FAIL + lampiran evidence.
```

## 8. Setelah bukti lengkap → naikkan ke PROVEN

Di `parity-evidence.registry.ts` (lihat dokumen `03-*`):

```ts
export const PARITY_EVIDENCE: ParityProof[] = [
  { screen: 45, surface: 'api', kind: 'uat', reference: 'evidence/screen-45/uat.md' },
  { screen: 46, surface: 'api', kind: 'uat', reference: 'evidence/screen-46/uat.md' },
  { screen: 47, surface: 'api', kind: 'uat', reference: 'evidence/screen-47/uat.md' },
  { screen: 48, surface: 'api', kind: 'uat', reference: 'evidence/screen-48/uat.md' },
];
// dan hapus 45,46,47,48 dari PENDING_PROOF
```
Test honesty (dokumen 03) memaksa: PROVEN & PENDING tak boleh tumpang tindih, dan `PENDING_PROOF.length` menyusut. Dengan begitu status DONE untuk FINANCE menjadi terbukti, bukan diklaim.
