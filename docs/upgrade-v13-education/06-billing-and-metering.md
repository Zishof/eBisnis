# E13-0 · Billing dan Usage Metering

Dua hal berbeda yang sering tertukar:

| | Siapa membayar | Kepada siapa |
| --- | --- | --- |
| **SaaS billing** (§187) | Institusi | eBisnis.id — Rp3.500/Rp2.000 per peserta aktif per bulan |
| **Tagihan pendidikan** (§200) | Peserta didik / wali | Institusi — SPP, UKT, asrama, makan |

Keduanya memakai Finance Core, tetapi modelnya terpisah. Dokumen ini terutama tentang
yang pertama, sebab yang pertama menentukan pendapatan eBisnis dan paling mudah
kehilangan kepercayaan.

---

## 1. Yang ada sekarang

`apps/api/prisma/platform/subscription.prisma` memuat 20 model:

```text
ModuleCatalog, FeatureCatalog, SubscriptionProduct, SubscriptionPlan,
SubscriptionPlanVersion, SubscriptionPlanModule, SubscriptionPlanFeature,
SubscriptionPlanPrice, SubscriptionPlanPriceTier, SubscriptionPlanConstraint,
SubscriptionAddOn, SubscriptionAddOnVersion, SubscriptionAddOnModule,
SubscriptionAddOnPrice, TenantPlanContract, TenantPlanModuleOverride,
TenantPlanFeatureOverride, TenantPriceOverride, PackageAssignment, EntitlementSnapshot
```

Pencarian kata `vertical` pada berkas itu: **nihil**. Pencarian `usage`, `learner`,
`meter`: **nihil**.

Yang sudah ada dan berguna:

- Kontrak per tenant (`TenantPlanContract`) dan override harga (`TenantPriceOverride`)
  — bentuk "harga dapat dinegosiasikan" sudah dikenal sistem.
- Tier harga (`SubscriptionPlanPriceTier`) — dasar untuk minimum commitment dan cap.
- `EntitlementSnapshot` — preseden bahwa hak dibekukan sebagai snapshot, bukan dihitung
  ulang setiap kali.

Yang tidak ada: **pengukuran**. Model sekarang menjual paket dan fitur, bukan jumlah
orang per bulan.

## 2. Keputusan: berdampingan, bukan diperluas

Menambahkan `verticalCode` dan `learnerCount` ke `SubscriptionPlanPrice` akan membuat
satu model melayani dua cara berjualan yang berbeda, dan menyeret seluruh tenant
non-pendidikan ikut memikul kolom yang tidak pernah terisi.

Entitas §187.5 dibangun sebagai kelompok tersendiri (`EducationProduct` …
`EducationBillingAudit`), yang **menautkan** ke `TenantPlanContract` ketika kontraknya
memang satu. Finance invoice tetap satu — `EducationSubscriptionInvoice` menunjuk
invoice Finance Core, tidak menggantikannya.

## 3. Rantai perhitungan

```text
Enrollment + EnrollmentStatusHistory        (sumber kebenaran, per hari)
  → LearnerUsageDaily     snapshot harian, idempotent per (tenant, vertical, person, enrollment, tanggal)
  → LearnerUsageMonthly   agregasi, direkonsiliasi
  → EducationSubscriptionInvoiceLine   kuantitas × tarif, snapshot immutable
  → EducationSubscriptionInvoice  → Finance invoice
```

Empat aturan yang menentukan apakah angkanya dipercaya:

1. **Snapshot harian, bukan hitung-saat-tagih.** Status berubah surut; tagihan tidak
   boleh ikut berubah surut. Snapshot mencatat keadaan pada hari itu.
2. **Idempotent.** Menjalankan ulang snapshot untuk tanggal yang sama tidak menggandakan.
3. **Tarif dibekukan pada baris invoice.** Tarif baru berlaku ke depan; invoice lama
   tidak berubah (§187 "Jangan mengubah invoice lama ketika tarif baru berlaku").
4. **Jejak dapat direproduksi.** `EducationBillingAudit` menyimpan `policyVersion`,
   `inputHash`, `resultHash`, `correlationId`. Tanpa itu, sengketa tagihan berakhir
   sebagai adu keyakinan.

## 4. Siapa yang dihitung

Billable (§187.3): enrollment `ACTIVE` atau `ON_LEAVE_BILLABLE` sesuai kontrak, berada
dalam periode, bukan sample, bukan duplikat/hasil merge, belum efektif keluar/lulus,
vertical-nya berlangganan.

Tidak dihitung: admin, dosen, guru, ustadz, pegawai, orang tua/wali, alumni, vendor,
pengurus yayasan.

**Orang yang aktif di beberapa vertical** — ini kasus nyata pada yayasan yang punya
sekolah dan pesantren. Tiga policy:

| Policy | Perilaku |
| --- | --- |
| `BY_ACTIVE_ENROLLMENT` (default) | Dihitung per enrollment; satu orang jadi siswa dan santri = 2 |
| `UNIQUE_PERSON_ACROSS_VERTICALS` | Satu orang sekali, menurut precedence tarif yang disepakati |
| `CONTRACT_DEFINED` | Formula khusus tenant |

Default yang paling transparan adalah yang pertama, dan transparansi lebih berharga
daripada nominal di sini: tenant yang merasa ditagih dua kali untuk satu anak akan
mempertanyakan seluruh tagihan, bukan hanya barisnya.

Deduplikasi mengandalkan `Person` canonical. Bila entity resolution gagal, dedup ikut
gagal — itu menjadikan dokumen 04 prasyarat dokumen ini, bukan sekadar tetangganya.

## 5. Yang perlu diputuskan pemilik

| Pertanyaan | Mengapa tidak dapat diputuskan kode |
| --- | --- |
| Cuti dihitung atau tidak (`ON_LEAVE_BILLABLE`) | Kebijakan komersial |
| Peserta masuk pertengahan bulan: penuh, prorata, atau nol | Menentukan pendapatan |
| Minimum commitment (contoh eCampus: 1.000 mahasiswa) menjadi default atau per kontrak | Rangkuman §14 menyebut 1.000; BRD tidak |
| Cap maksimum per tenant | Kontrak |
| Grace period sebelum suspend | Operasional |

Kelimanya masuk `LearnerBillingPolicy` sebagai policy versioned. Yang penting bukan
jawabannya, melainkan bahwa jawabannya **tercatat berversi** — sehingga tagihan bulan
lalu tetap dapat dijelaskan setelah kebijakannya berubah.

## 6. Tagihan pendidikan (ringkas)

Entitas §200.2 (`EducationFeeType` … `RefundRequest`) memakai Finance Core:
piutang, alokasi pembayaran, subledger, dan jurnal. Aturan yang tidak boleh dilanggar:

> Controller pendidikan tidak melakukan debit/kredit langsung. (§200.3)

Domain pendidikan menerbitkan accounting event (`EDU_INVOICE_ISSUED`,
`EDU_PAYMENT_ALLOCATED`, …); Accounting Core yang memposting. Event catalog registry
sudah ada di `modules/accounting` — 11 event `EDU_*` ditambahkan ke sana, bukan ke
mesin jurnal kedua.
