# ADR-007 — Referral berada di control plane, bukan schema tenant

- Status: Diterima (fase V6-0, sebelum implementasi V6-1)
- Tanggal: 2026-07-30

## Konteks

Versi 6 menambahkan komisi referral: tenant R mereferensikan tenant A, dan ketika
A membayar langganan, R memperoleh komisi. Pertanyaan arsitektur pertama adalah
**di mana data referral hidup**, karena eBisnis memakai schema-per-tenant.

Tiga kandidat:

1. **Pada schema tenant referrer.** Terlihat wajar karena komisi milik R.
   Tetapi basis komisi berasal dari `billing_invoice` dan
   `billing_payment_allocation` milik **A**, yang berada pada control plane.
   Menghitung komisi berarti membaca lintas schema, yang justru dilarang
   ([ADR-001](ADR-001-schema-per-tenant.md)).
2. **Diduplikasi pada kedua schema.** Menghasilkan dua sumber kebenaran untuk
   satu jumlah uang. Rekonsiliasi menjadi mustahil dibuktikan.
3. **Pada control plane.** Referral menghubungkan dua tenant dan bersandar pada
   data langganan yang sudah ada di control plane.

## Keputusan

Seluruh 23 model referral berada pada schema **`platform`**, dengan audit pada
`platform__audit`.

Konsekuensi turunannya:

- Tenant tidak pernah membaca data referral tenant lain; ia mengakses miliknya
  melalui endpoint `/api/v1/referrals/*` yang menyaring berdasarkan
  `partnerId` hasil resolusi dari sesi — bukan dari parameter request.
- Basis komisi dihitung dari `billing_invoice`, `billing_payment_allocation`,
  dan `billing_credit_note` yang sudah ada, tanpa query lintas schema tenant.
- Partner hanya melihat data agregat tenant yang direferensikannya, tidak pernah
  data operasional tenant tersebut.

## Aturan integritas yang mengikat

| Aturan | Penegakan |
| --- | --- |
| Satu tenant referred punya paling banyak satu attribution | `referral_attribution.referred_tenant_id` UNIQUE |
| Ledger komisi immutable | trigger `forbid_ledger_mutation`, pola yang sama dengan `stock_movement` |
| Tidak ada komisi ganda | UNIQUE `(period, source_payment_id, partner_id, plan_version_id)` |
| Rate default 20% adalah data, bukan konstanta kode | `referral_commission_plan_version.default_rate = 20.000000` |
| Rate berubah tanpa mengubah histori | versi baru `effectiveFrom`, ledger lama menunjuk versi lama |
| Uang dan rate memakai Decimal | `Decimal(19,4)` untuk jumlah, `Decimal(19,6)` untuk rate |

## Mengapa rate memakai 6 desimal

Spesifikasi menyebut default `20.000000%`. Enam desimal bukan hiasan: rate tier
dan bonus milestone dapat menghasilkan angka seperti `17.333333%`. Menyimpannya
sebagai `Decimal(19,2)` akan menghasilkan selisih pembulatan yang muncul sebagai
sengketa komisi.

## Yang ditolak

| Ditolak | Alasan |
| --- | --- |
| Cookie sebagai sumber kebenaran attribution | cookie dapat dipalsukan; cookie hanya sinyal, kebenaran ada pada event server dan token acak |
| `referrerId` dari request body | client tidak boleh menentukan siapa yang dibayar |
| Menghapus ledger saat refund | ledger append-only; refund menghasilkan baris clawback |
| Menghitung komisi saat invoice diterbitkan | basis default adalah uang **yang tertagih**, bukan yang ditagihkan |

## Rujukan

- BRD V6 bab 23 (REF-001 … REF-015)
- Master Prompt V6 Lampiran V6-A
- [ADR-001 — Schema per tenant](ADR-001-schema-per-tenant.md)
- [ADR-002 — Audit append-only](ADR-002-append-only-audit.md)
