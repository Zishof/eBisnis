# ADR-008 — Kepemilikan sebagai relasi effective-dated, bukan kolom investor

- Status: Diterima (fase V6-0, sebelum implementasi V6-2)
- Tanggal: 2026-07-30

## Konteks

Skenario acceptance Versi 6: lima investor bersama-sama memiliki satu brand, tiga
outlet, dan sembilan perangkat POS, dengan persentase hak ekonomi dan hak suara
yang berbeda, kontribusi modal berkala, serta bagi hasil per brand/outlet/grup.

Versi 5 sudah memiliki `party`, `owner_profile`, `investor_profile`,
`ownership_interest`, `investment_contract`, `revenue_share_contract`, dan
`revenue_share_settlement` pada schema tenant — tetapi tanpa service, tanpa API,
dan tanpa dimensi waktu.

## Keputusan

### 1. Investor adalah `Party`, bukan entitas baru

`party` yang sudah ada menjadi akar identitas. Satu party dapat sekaligus menjadi
owner, investor, direktur, pemasok, dan pelanggan. Membuat tabel investor
tersendiri akan menduplikasi identitas dan menghasilkan dua nama untuk orang yang
sama.

### 2. Kepemilikan adalah relasi many-to-many effective-dated

```text
ownership_interest
  party_id            siapa
  target_type         BRAND | OUTLET | LEGAL_ENTITY | OWNERSHIP_GROUP
  target_id           atas apa
  ownership_class_id  kelas saham/unit
  economic_share      Decimal(19,8)
  voting_share        Decimal(19,8)
  effective_from      wajib
  effective_until     nullable = masih berlaku
```

**Dilarang** menambahkan `investor1_id` … `investorN_id` pada `brand` atau
`outlet`. Alasannya bukan estetika: kolom bernomor membatasi jumlah investor,
tidak dapat menyimpan periode berlaku, dan membuat query "siapa pemilik outlet X
pada Maret lalu" tidak mungkin dijawab.

### 3. Hak ekonomi dan hak suara adalah dua angka berbeda

Investor dapat memiliki 10% hak ekonomi tetapi 25% hak suara, atau sebaliknya.
Menyimpannya sebagai satu kolom `percentage` akan memaksa salah satu makna hilang.

### 4. Presisi `Decimal(19,8)`

Delapan desimal diperlukan karena dilusi menghasilkan pecahan panjang. Contoh:
kepemilikan 1/3 setelah dua kali dilusi menghasilkan angka yang jika dibulatkan
ke 2 desimal membuat total tidak lagi 100%.

### 5. Perubahan kepemilikan tidak mengubah histori

Transfer, dilusi, dan penerbitan baru **menutup** baris lama
(`effective_until = tanggal`) dan **membuka** baris baru. Settlement periode lalu
tetap menunjuk kepemilikan yang berlaku saat itu, karena settlement menyimpan
snapshot ownership + formula + input.

### 6. Capital ledger immutable

`capital_account_ledger` memakai trigger `forbid_ledger_mutation` — pola yang
sama dengan `stock_movement` dan `referral_commission_ledger`. Koreksi kontribusi
modal dilakukan dengan baris pembalik, bukan dengan mengubah baris lama.

## Validasi yang wajib

| Aturan | Alasan |
| --- | --- |
| Periode tumpang tindih untuk `(party, target, class)` ditolak | mencegah dua persentase berlaku bersamaan |
| Total `economic_share` per target per periode sesuai policy (100% atau mengizinkan unallocated) | mencegah kepemilikan hilang atau berlebih |
| Transfer tidak melebihi kepemilikan pada tanggal efektif | mencegah menjual yang tidak dimiliki |
| Perubahan rekening penerima memerlukan step-up + dual approval | rekening adalah target penipuan |
| Setiap settlement punya posting key unik | mencegah pembayaran ganda |

## Ownership group

`ownership_group` memungkinkan lima investor membentuk satu kesatuan yang memiliki
brand, alih-alih lima baris kepemilikan langsung. Keduanya didukung: kepemilikan
dapat menunjuk grup, dan grup memiliki anggota dengan persentase internal.
Ini yang membuat skenario "5 investor → 1 group → 1 brand → 3 outlet → 9 POS"
dapat dinyatakan tanpa mengulang lima baris pada setiap outlet.

## Rujukan

- BRD V6 bab 24 (OWN-001 … OWN-012)
- Master Prompt V6 Lampiran V6-B
- [ADR-003 — Lifecycle master](ADR-003-master-lifecycle.md)
