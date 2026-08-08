# UAT — Layar 40 (Nota Sales — Detail, Return/Close, Cetak)

**Tenant uji:** `uat_sales_ar_18620`. **Prasyarat:** nota `3901e97f-...` (NOTA-20260808-MSKSU52Y)
sudah HANDED_OVER (lihat `../screen-39/uat.md` untuk pembuatan & 2 perbaikan bug sebelumnya di
jalur ini: netting `outstanding_amount` dan `/cancel` yang tadinya 500 error total).

## Temuan DIPERBAIKI #3: `POST /sales-note-handovers/:id/return` gagal total (500 INTERNAL_ERROR)

Percobaan PERTAMA transisi HANDED_OVER → RETURNED (legal, bukan skenario ilegal) dengan payload
valid (`{"lines":[{"lineId":..., "status":"COLLECTED", "amount":500000}, {"lineId":...,
"status":"RETURNED", "amount":1000000}]}`) gagal **500 INTERNAL_ERROR**: `"mededuksi tipe yang
tidak konsisten untuk parameter $3"` (Postgres: *inconsistent types deduced for parameter*).

**Akar masalah:** query update baris nota memakai parameter `$3` (nilai `line.status`, string) di
tiga posisi berbeda tanpa cast: `SET status = $3`, lalu dibandingkan `WHEN $3 = 'RETURNED'` dan
`WHEN $3 = 'COLLECTED'`. Kolom `status` bertipe `varchar`, sementara perbandingan `$3 = '...'`
membuat driver `pg` menyimpulkan tipe berbeda (`text`) di posisi lain untuk parameter yang sama —
Postgres extended query protocol menolak keduanya sekaligus karena perlu SATU tipe konsisten per
`$n` di seluruh statement. Sama seperti gap `/cancel` (temuan #2 di layar 39), endpoint ini
**rusak TOTAL untuk SEMUA pemanggil** — bukan kasus tepi.

**Perbaikan:** cast eksplisit konsisten di ketiga posisi ($3::text) dan pada $4 (numeric):
```sql
SET status = $3::text,
    returned_amount = CASE WHEN $3::text = 'RETURNED' THEN $4::numeric ELSE returned_amount END,
    collected_amount = CASE WHEN $3::text = 'COLLECTED' THEN $4::numeric ELSE collected_amount END
```
File: `sales-inventory-operations.controller.ts`, fungsi `returnHandover`.

**Verifikasi ulang setelah perbaikan:** percobaan yang identik persis (payload sama) →
**201, `{"id":"3901e97f-...","status":"RETURNED"}`** (`return-transition.json`). Baris nota
diperiksa lewat `GET .../:id` — `outstanding_amount` order1 tetap 500000 (tidak berubah oleh
`/return`, kolom ini snapshot titik-serah), `status` order1 → `COLLECTED`, `collected_amount`
500000; order3 → `RETURNED`, `returned_amount` 1000000 (lihat `handover-detail-final.json`).

Diverifikasi bersih bersama perbaikan #1/#2: `pnpm --filter @ebisnis/api lint` (0 error),
`pnpm --filter @ebisnis/api test` (157 suite / 4015 test, semua PASS).

## Skenario state machine (lanjutan dari `../screen-39/uat.md`)

1. **LEGAL — `/return`**: HANDED_OVER → RETURNED, sukses setelah perbaikan #3 di atas.
2. **ILLEGAL — `/return` LAGI** (sudah RETURNED): `409 CONFLICT`,
   `"Nota hanya dapat dikembalikan setelah diserahterimakan."` (`illegal-double-return.json`
   di folder layar 39).
3. **ILLEGAL — `/handover` mundur ke RETURNED**: `409 CONFLICT`,
   `"Serah-terima harus berstatus DRAFT."` (`illegal-handover-on-returned.json` di folder layar 39).
4. **LEGAL — `/close`**: RETURNED → CLOSED (`close-transition.json`, HTTP 201).
5. **ILLEGAL — `/close` LAGI** (sudah CLOSED): `409 CONFLICT`,
   `"Serah-terima harus berstatus RETURNED."` (`illegal-double-close.json`).

Total 8 transisi diuji lintas layar 39+40: 3 legal (handover, return, close) semuanya berhasil
tepat sekali; 5 ilegal (close-on-draft, return-on-draft, double-handover, double-return,
handover-mundur, double-close — 6 sebenarnya, salah satu dihitung di layar 39) semuanya ditolak
`409 CONFLICT` bersih, tanpa mengubah state.

## Jejak audit custody (actor + timestamp + alasan)

`custody-events-reconciliation.txt` — query `sales_note_custody_event` JOIN `user_subject`:

| event_type | from → to | actor | occurred_at | metadata |
|---|---|---|---|---|
| CREATED | ∅ → DRAFT | UAT Tester | 03:01:14 | `{"invoiceCount":2}` |
| HANDED_OVER | DRAFT → HANDED_OVER | UAT Tester | 03:01:49 | `{}` |
| RETURNED | HANDED_OVER → RETURNED | UAT Tester | 03:06:04 | `{"lines":[...COLLECTED 500000, RETURNED 1000000]}` |
| CLOSED | RETURNED → CLOSED | UAT Tester | 03:07:43 | `{}` |

(Nota lama yang dibatalkan pada layar 39 juga tercatat: `CREATED` lalu `CANCELLED` dengan
`metadata.reason` = alasan pembatalan verbatim.) Setiap baris punya `actor_id` (bukan NULL) dan
`occurred_at` monoton naik sesuai urutan transisi — TERBUKTI, bukan sekadar diklaim.

## Detail, print-data, dan laporan cetak

1. `GET /sales-note-handovers/:id` (status akhir CLOSED) → `handover-detail-final.json`, kedua
   baris menunjukkan `outstanding_amount` yang BENAR (500000/1000000, hasil perbaikan #1) dan
   status akhirnya (COLLECTED/RETURNED).
2. `GET /sales-note-handovers/:id/print-data` → `print-data.json`, identik dengan detail plus
   `document_type:"SALES_NOTE_HANDOVER"` dan `generated_at`.
3. `POST /reports/sales-note-handover/preview` → `report-preview.json`, `rowCount:4`
   (2 baris nota lama yang CANCELLED + 2 baris nota CLOSED — lihat catatan di bawah),
   `totals.outstanding_amount:"3300000"` = 800000+1000000 (nota lama, nilai lama sebelum
   perbaikan, karena baris nota historis tidak ditulis ulang saat header dibatalkan) + 500000+1000000
   (nota baru, benar).
4. `POST /reports/sales-note-handover/snapshot` → `report-snapshot.json`, id
   `57e9f6b1-97dc-4d9e-a358-0f21d462f2d1`, `row_count:4`.
5. `POST /report-snapshots/57e9f6b1.../print-log` → `print-log.json`, tercatat sukses.

**Catatan (bukan gap, observasi):** laporan `sales-note-handover` menampilkan baris nota dari
paket yang sudah `CANCELLED` (nota lama dari layar 39) berdampingan dengan paket aktif, karena
query `reportSql` untuk kode ini tidak menyaring `h.status`. Kolom `l.status` per baris tetap
`CARRIED` (bukan `CANCELLED`) karena `/cancel` hanya mengubah status header, bukan baris — bisa
membingungkan pembaca laporan yang mengira invoice itu masih beredar di tangan sales padahal
paketnya sudah batal sebelum diserahkan. Ini keputusan tampilan/filter laporan, bukan cacat
integritas data (header `status` tetap benar `CANCELLED` bila dicek langsung), sehingga
dilaporkan sebagai catatan untuk tim produk, bukan diperbaiki sepihak di pass ini.

## Hasil

**PASS** untuk state machine (transisi legal/ilegal), jejak audit custody (actor+timestamp+alasan
terbukti lewat SQL, bukan asumsi), dan siklus cetak (preview→snapshot→print-log). Satu gap nyata
(temuan #3) DIPERBAIKI dan diverifikasi ulang. Satu observasi non-blocking dicatat di atas.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android dan berkas PDF fisik tidak dihasilkan.
