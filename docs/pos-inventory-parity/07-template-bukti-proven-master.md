# Template Bukti PROVEN — Master (Layar 1–7)

**Tanggal:** 2026-08-08
**Cakupan:** Supplier (1–3), Customer (4–6), Sales/Penjual Keliling (7).
**Dilayani:** `MasterController` (`tenant.module.ts:579`) — CRUD generik `:resource` + `master-resource.registry.ts`.

## 1. Properti kritis yang WAJIB dibuktikan (dari audit source)

| Properti | Bukti di source | Cara membuktikan |
|---|---|---|
| **Referential guard** | `GET :resource/:id/references`; registry mendaftarkan referensi transaksional (supplier→purchase_order/goods_receipt; customer→pos_sale/sales_order) | Coba hapus master yang punya transaksi → ditolak / hanya soft-delete |
| **Soft-delete + restore** | `DELETE :resource/:id` (694 restore) | Hapus → `deleted_at` terisi; restore → kembali |
| **Purge terkontrol** | `POST :resource/:id/purge` | Hanya master tanpa referensi yang bisa di-hard-delete |
| **Audit trail** | `GET :resource/:id/audit` | Setiap create/update/deactivate tercatat actor+timestamp |
| **Server identity** | schema tenant dari token, bukan request | Tak ada cara memilih schema via body/query |
| **Uniqueness kode** | `code` unik per tenant (registry `searchableFields`/constraint) | Buat kode duplikat → ditolak |

## 2. Endpoint

`GET /master-resources`, `GET /:resource`, `GET /:resource/:id`, `POST /:resource`, `PATCH /:resource/:id`, `POST /:resource/:id/activate|deactivate`, `DELETE /:resource/:id` (+`/restore`), `GET /:resource/:id/references`, `POST /:resource/:id/purge`, `GET /:resource/:id/audit`.
`:resource` ∈ `suppliers`, `customers`, `salespeople` (+ groups, uom, product, warehouse, dst.).

## 3. Skenario bukti (jalankan lokal terhadap tenant uji)

```bash
API=http://localhost:3000 ; TOKEN=... ; J="-H Content-Type:application/json -H Authorization:Bearer $TOKEN"
```

### 3.1 CRUD + uniqueness (layar 1/4/7)
```bash
# create supplier
curl -s $J $API/suppliers -d '{"code":"SUP-UAT-1","name":"Supplier UAT"}' > evidence/screen-01/create.json
# duplikat kode → harus DITOLAK
curl -s -o evidence/screen-01/dup.json -w "%{http_code}\n" $J $API/suppliers -d '{"code":"SUP-UAT-1","name":"Dobel"}'
# update
curl -s $J -X PATCH $API/suppliers/<id> -d '{"name":"Supplier UAT (edit)"}' > evidence/screen-01/update.json
```

### 3.2 Referential guard (inti PROVEN)
```bash
# supplier yang punya PO tidak boleh dihapus permanen
curl -s $J $API/suppliers/<idDenganPO>/references > evidence/screen-01/references.json   # menampilkan PO terkait
curl -s -o evidence/screen-01/purge-blocked.json -w "%{http_code}\n" $J -X POST $API/suppliers/<idDenganPO>/purge  # harus 4xx
```
Rekonsiliasi:
```sql
SELECT count(*) FROM "demo".purchase_order WHERE supplier_id = '<idDenganPO>';   -- > 0 → purge harus ditolak
```

### 3.3 Soft-delete → restore (layar 3/6 "menutup daftar")
```bash
curl -s $J -X DELETE $API/customers/<idTanpaTransaksi> > evidence/screen-06/delete.json
curl -s $J -X POST   $API/customers/<idTanpaTransaksi>/restore > evidence/screen-06/restore.json
```
```sql
SELECT deleted_at FROM "demo".customer WHERE id='<id>';   -- terisi setelah delete, NULL setelah restore
```

### 3.4 Audit trail
```bash
curl -s $J $API/suppliers/<id>/audit > evidence/screen-01/audit.json   # ≥ create+update+delete
```

### 3.5 Screenshot 3 platform
Web `/app/master/suppliers|customers|salespeople`; Windows & Android modul `Inventory Control` → Master. Daftar, cari, edit-by-permission harus sama angka.

## 4. UAT ringkas (layar 1)
```
1. Buat supplier baru.                         → muncul di daftar
2. Buat lagi dengan kode sama.                 → ditolak (uniqueness)
3. Buat PO memakai supplier itu.               → sukses
4. Coba hapus supplier tsb.                     → ditolak / hanya soft-delete (guard)
5. Buka references.                             → menampilkan PO terkait
6. Buka audit.                                  → jejak lengkap
Hasil: PASS + evidence.
```

## 5. DoD & kenaikan status
Master PROVEN bila: uniqueness ditegakkan, referential guard mencegah hapus master bereferensi, soft-delete/restore bekerja, audit lengkap, identity dari server — ber-screenshot 3 platform + UAT. Tambah entri ke `parity-evidence.registry.ts` untuk layar 1–7 dan keluarkan dari `PENDING_PROOF`.
