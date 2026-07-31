# POS Go-Live Gate — Status

Delapan belas butir pada perintah prioritas §25, diperiksa apa adanya.
**Tanggal:** 31 Juli 2026 · **Cabang:** `feature/pos-web-priority`

---

## Ringkasan

| | Jumlah |
|---|---|
| ✅ Lulus | 14 |
| ⚠️ Lulus sebagian | 2 |
| ⛔ Terhalang prasyarat | 2 |

**Kasir dapat berjualan dari ujung ke ujung.** Yang tersisa tidak menghentikan
penjualan; masing-masing menurunkan mutu operasional, dan disebutkan apa adanya
di bawah.

---

## Butir demi butir

| # | Butir | Status | Bukti |
|---|---|---|---|
| 1 | login/role/outlet/register berjalan | ✅ | `bukti-pos-rbac.txt`, `GET /pos/context` |
| 2 | open shift berjalan | ✅ | `bukti-pos-sale-e2e.txt` §1 |
| 3 | barcode search berjalan | ✅ | `GET /pos/products/by-barcode`, uji barcode utama & alternatif |
| 4 | price/tax/promo benar | ✅ | `pos-pricing.spec.ts`, kuotasi peladen |
| 5 | stock validation berjalan | ✅ | `bukti-pos-sale-e2e.txt` §10, `pos-stock.spec.ts` (20 uji) |
| 6 | cart berjalan | ✅ | `bukti-pos-sale-e2e.txt` §2–4 |
| 7 | cash payment berjalan | ✅ | `bukti-pos-sale-e2e.txt` §5 |
| 8 | mixed payment berjalan | ✅ | Dua pembayaran atas satu transaksi, terbukti §5 |
| 9 | receipt berjalan | ✅ | `bukti-pos-return-e2e.txt` §1, cetak ulang tercatat |
| 10 | inventory posting berjalan | ✅ | `bukti-pos-sale-e2e.txt` §7, idempoten §8 |
| 11 | accounting event berjalan | ✅ | Enam kode `POS_*` terbentuk; pembalik pada void |
| 12 | hold/resume berjalan | ✅ | `bukti-pos-sale-e2e.txt` §4 |
| 13 | void/return/refund berjalan | ✅ | `bukti-pos-return-e2e.txt` §2–5 |
| 14 | close shift/reconciliation berjalan | ✅ | `PosShiftService`, ambang selisih, `PENDING_APPROVAL` |
| 15 | reports berjalan | ⚠️ | Ringkasan kas dan penjualan per shift ada. **Empat belas laporan POS-9 belum dibangun**, dan ekspor Excel terhalang V8-5/6 |
| 16 | permissions/SoD berjalan | ✅ | Larangan menyetujui sendiri diuji pada tiga lapisan |
| 17 | audit/observability berjalan | ✅ | Audit V008 pada seluruh tabel POS; galat, kinerja, aktivitas dari V10 |
| 18 | E2E lulus | ⚠️ | **73 pemeriksaan e2e lulus** lewat dua naskah bukti terhadap API sungguhan. Uji Playwright yang menjalankan layar kasir di peramban belum ditulis |
| — | CI green | ✅ | 1209 uji API + 35 uji web; lint dan build bersih |
| — | tidak ada isu keamanan kritis | ✅ | Tidak ada `eval`, tidak ada skema dari permintaan, nomor kartu tidak pernah disimpan |

---

## Yang terhalang prasyarat, bukan oleh POS

Ketiganya berasal dari V8 yang belum pernah dibangun. Disebutkan sebagai
terhalang, bukan diam-diam dilewati.

| Prasyarat | Menghalangi | Akibatnya bagi kasir |
|---|---|---|
| **V8-1/V8-2 Pusat Bantuan** | POS-11 (16 topik bantuan) | Kasir tetap dapat berjualan; yang hilang adalah panduan dalam aplikasi |
| **V8-5/6 Ekspor Excel** | Laporan POS dapat diunduh | Laporan hanya dapat dilihat di layar |
| **V8-7 Job cetak PDF** | Struk sebagai PDF | Struk dapat dicetak ke pencetak termal dan ditampilkan di layar |

---

## Yang sengaja ditunda

Sesuai perintah §3, keduanya boleh ditunda dan memang ditunda:

- **Mode luring penuh.** `pos_sale.offline_id` dan `sync_status` sudah
  disiapkan sejak V006, tetapi antrean lokal dan sinkronisasinya belum
  dibangun. Kasir daring dapat berjualan tanpa ini.
- **AI POS (POS-12).** Perintah §19 menyebutnya non-pemblokir secara eksplisit,
  dan gerbang AI V11 sudah siap dipakai begitu transaksi inti stabil.

---

## Yang tersisa sebelum gate penuh

1. **POS-9 — empat belas laporan operasional.** Yang paling dibutuhkan lebih
   dahulu: penjualan harian per kasir, per outlet, dan rekapitulasi selisih kas.
2. **Uji Playwright layar kasir.** Kedua naskah bukti menguji API dengan
   sungguh-sungguh, tetapi tidak menekan tombol di peramban. Alur pindai →
   bayar → struk perlu diuji sebagaimana kasir mengalaminya.
3. **POS-10 — profil data contoh POS** (3 merek, 10 outlet, 500 produk, 500
   penjualan) supaya penyewa baru dapat mencoba kasir tanpa menyiapkan data.
