# K-0 · Kontrak Akuntansi

Koperasi **tidak** memiliki buku besar sendiri. Setiap konsekuensi keuangan
menerbitkan `accounting_event`, dan mesin posting Core yang mengubahnya menjadi
`journal_entry`.

Alasannya sederhana dan mahal bila diabaikan: koperasi dengan dua buku besar
akan menghabiskan setiap penutupan buku untuk mencocokkan keduanya, dan yang
tidak cocok tidak pernah dapat dijelaskan.

---

## Cara kerja mesin yang sudah ada

```
peristiwa bisnis            accounting_event          accounting_posting_rule
(setoran simpanan)   ──▶    kode + nilai + sumber ──▶  peta akun debit/kredit
                                                              │
                                                              ▼
                                                        journal_entry
                                                        journal_entry_line
```

Pemetaan akun tinggal di **data** (`accounting_posting_rule`), bukan di kode.
Karena itu koperasi tidak menulis debit-kredit di layanannya; ia menerbitkan
peristiwa, dan pemetaannya dikonfigurasi per koperasi.

`posting-engine.spec.ts` memaksa setiap kode peristiwa punya aturan posting dan
daftar nilai wajib. Kode `COOPERATIVE_*` harus lulus uji yang sama — kode yang
ditambahkan tanpa aturan akan menggagalkan pengujian, bukan diam-diam
menghasilkan jurnal kosong.

---

## Kode peristiwa koperasi yang diusulkan

Namespace `COOPERATIVE_*`, mengikuti pola `MARKETPLACE_*` dan `POS_*` yang ada.

### Simpanan

| Kode | Nilai wajib | Kapan |
|---|---|---|
| `COOPERATIVE_PRINCIPAL_SAVING_RECEIVED` | `amount` | Simpanan pokok diterima — inilah yang mengaktifkan keanggotaan |
| `COOPERATIVE_MANDATORY_SAVING_RECEIVED` | `amount`, `period` | Simpanan wajib berkala |
| `COOPERATIVE_VOLUNTARY_SAVING_DEPOSIT` | `amount` | Setoran sukarela |
| `COOPERATIVE_VOLUNTARY_SAVING_WITHDRAWAL` | `amount` | Penarikan sukarela |
| `COOPERATIVE_SAVING_PROFIT_SHARING` | `amount`, `basis` | Bagi hasil simpanan berjangka |
| `COOPERATIVE_SAVING_CLOSED` | `amount` | Penutupan rekening |

**Sifat akunnya perlu ditegaskan.** Simpanan pokok dan wajib adalah **ekuitas**
koperasi, bukan kewajiban — keduanya tidak dapat ditarik selama keanggotaan
berjalan. Simpanan sukarela adalah **kewajiban** karena dapat ditarik
sewaktu-waktu. Menyamakan ketiganya sebagai kewajiban akan membuat neraca
koperasi menyatakan modal sendiri jauh lebih kecil daripada yang sebenarnya, dan
rasio kesehatan yang dihitung di atasnya ikut salah.

### Pinjaman

| Kode | Nilai wajib | Kapan |
|---|---|---|
| `COOPERATIVE_LOAN_DISBURSED` | `principal` | Pinjaman cair |
| `COOPERATIVE_INSTALLMENT_RECEIVED` | `principalPortion`, `interestPortion`, `total` | Angsuran diterima |
| `COOPERATIVE_LOAN_PENALTY_ACCRUED` | `amount` | Denda keterlambatan diakui |
| `COOPERATIVE_LOAN_PENALTY_RECEIVED` | `amount` | Denda dibayar |
| `COOPERATIVE_LOAN_PROVISION` | `amount`, `riskClass` | Penyisihan piutang tak tertagih |
| `COOPERATIVE_LOAN_WRITE_OFF` | `principal`, `provisionUsed` | Penghapusbukuan |
| `COOPERATIVE_LOAN_RECOVERY` | `amount` | Penerimaan atas pinjaman yang sudah dihapusbukukan |
| `COOPERATIVE_LOAN_RESTRUCTURED` | `oldBalance`, `newBalance` | Restrukturisasi |

`COOPERATIVE_INSTALLMENT_RECEIVED` menuntut **pokok dan jasa terpisah**, bukan
hanya totalnya. Keduanya masuk akun berbeda — pokok mengurangi piutang, jasa
menjadi pendapatan — dan membelah totalnya kemudian berarti menebak berapa
pendapatan koperasi.

### Syariah

Kode terpisah, bukan kode yang sama dengan nama berbeda:

| Kode | Nilai wajib |
|---|---|
| `COOPERATIVE_MURABAHA_DISBURSED` | `costPrice`, `margin`, `sellingPrice` |
| `COOPERATIVE_MURABAHA_INSTALLMENT` | `principalPortion`, `marginPortion`, `total` |
| `COOPERATIVE_MUDHARABAH_PLACED` | `capital` |
| `COOPERATIVE_MUDHARABAH_PROFIT_SHARE` | `grossProfit`, `cooperativeShare`, `memberShare`, `nisbah` |
| `COOPERATIVE_IJARAH_RENTAL` | `rentalAmount` |
| `COOPERATIVE_QARDH_DISBURSED` | `principal` |

Dipisahkan karena akunnya memang berbeda, dan karena laporan keuangan syariah
menuntut penyajian tersendiri. Memakai `COOPERATIVE_LOAN_DISBURSED` untuk
murabahah akan menyajikan jual-beli sebagai pinjaman berbunga — cacat yang
serius bagi koperasi syariah dan bagi Dewan Pengawas Syariahnya.

### SHU

| Kode | Nilai wajib | Kapan |
|---|---|---|
| `COOPERATIVE_SURPLUS_CLOSED` | `surplus` | Penutupan periode buku |
| `COOPERATIVE_RESERVE_ALLOCATED` | `amount` | Alokasi cadangan |
| `COOPERATIVE_SHU_ALLOCATED` | `capitalService`, `patronageService`, `socialFund`, `total` | SHU disetujui RAT |
| `COOPERATIVE_SHU_PAID` | `amount` | SHU dibayarkan ke anggota |

`COOPERATIVE_SHU_ALLOCATED` hanya boleh terbit setelah ada keputusan RAT yang
sah kuorumnya. Ini bukan aturan akuntansi melainkan aturan hukum koperasi, dan
ditegakkan di layanan sebelum peristiwanya diterbitkan.

### Dompet dan unit usaha

| Kode | Nilai wajib |
|---|---|
| `COOPERATIVE_WALLET_TOPUP` | `amount` |
| `COOPERATIVE_WALLET_PAYMENT` | `amount` |
| `COOPERATIVE_WALLET_REFUND` | `amount` |
| `COOPERATIVE_UNIT_CAPITAL_INJECTED` | `amount` |
| `COOPERATIVE_UNIT_RESULT_TRANSFERRED` | `amount` |

**`COOPERATIVE_WALLET_PAYMENT` tidak menjurnal penjualannya.** Penjualan di unit
toko sudah dijurnal mesin POS lewat `POS_SALE`. Yang dijurnal di sini hanya
perpindahan dari kewajiban dompet ke kas — hal yang tidak diketahui POS. Bila
keduanya sama-sama menjurnal penjualan, pendapatan koperasi tercatat dua kali.

---

## Buku besar pembantu anggota

Spesifikasi §13 menyebut `MemberSubledger`, `SavingSubledger`, `LoanSubledger`.
Bentuknya:

```
cooperative_member_subledger
├── member_id
├── subledger_type       SAVING | LOAN | SHU | WALLET
├── account_id           → chart_of_account (Core)
├── reference_type       jenis dokumen sumber
├── reference_id
├── debit / credit
├── balance_after
└── accounting_event_id  → accounting_event (Core)
```

Buku pembantu **bukan** buku besar kedua. Ia rincian per anggota atas akun yang
sama, dan setiap barisnya menunjuk `accounting_event` yang menjadi asalnya.
Jumlah seluruh baris buku pembantu atas satu akun **wajib** sama dengan saldo
akun itu di buku besar — dan uji rekonsiliasi pada K-8 memeriksanya.

---

## Pemetaan akun per koperasi

```
cooperative_account_mapping
├── mapping_code         PRINCIPAL_SAVING, LOAN_RECEIVABLE, ...
├── account_id           → chart_of_account
├── effective_from
└── effective_until
```

Kode akun **tidak** dikunci di dalam program. Koperasi yang memakai bagan akun
standar Kementerian Koperasi dan koperasi yang memakai bagan akunnya sendiri
sama-sama harus dapat berjalan.

Berlaku bertanggal karena bagan akun berubah, dan jurnal tahun lalu harus tetap
menunjuk akun yang berlaku saat itu.

---

## Yang dibutuhkan dari Core

Menambahkan 25+ kode `COOPERATIVE_*` ke `posting-engine.ts` berarti menyunting
berkas milik Core — dilarang §3.

→ **[Permintaan integrasi 003](../integration-requests/cooperative/003-kode-peristiwa-akuntansi-koperasi.md)**

Usulannya bukan menambahkan kodenya satu per satu, melainkan mengubah
`posting-engine.ts` agar menerima **pendaftaran katalog peristiwa dari modul**,
sehingga eMedik dan info-desa dapat melakukan hal yang sama tanpa tiga vertikal
menyunting satu berkas.

**Sampai disetujui:** katalog peristiwa koperasi tetap ditulis di
`modules/cooperative/accounting/cooperative-events.catalog.ts` beserta
pengujiannya, dan adapter akuntansi memvalidasi terhadap katalog itu. Yang
tertunda hanyalah pendaftarannya ke mesin Core — bukan perancangannya.
