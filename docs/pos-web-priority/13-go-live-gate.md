# POS Go-Live Gate — Status

Delapan belas butir pada perintah prioritas §25, diperiksa apa adanya.
**Tanggal:** 31 Juli 2026 · **Cabang:** `feature/pos-web-priority`

---

## Ringkasan

| | Jumlah |
|---|---|
| ✅ Lulus | 17 |
| ⚠️ Lulus sebagian | 1 |
| ⛔ Terhalang prasyarat | 0 |

*Diperbarui 1 Agustus 2026 sesudah POS-9, POS-10, dan uji Playwright.*

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
| 15 | reports berjalan | ⚠️ | **Lima belas laporan dan dasbor sudah ada** beserta halaman `/app/pos/laporan`. Yang tersisa hanya ekspor Excel, yang terhalang V8-5/6 |
| 16 | permissions/SoD berjalan | ✅ | Larangan menyetujui sendiri diuji pada tiga lapisan |
| 17 | audit/observability berjalan | ✅ | Audit V008 pada seluruh tabel POS; galat, kinerja, aktivitas dari V10 |
| 18 | E2E lulus | ✅ | **153 pemeriksaan** lewat empat naskah bukti terhadap API sungguhan, **plus 9 uji Playwright** yang benar-benar menekan tombol pada layar kasir: pindai, ubah jumlah, tahan, bayar tunai, struk terbit |
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

**Satu butir**, dan ia terhalang prasyarat di luar jalur POS:

1. **Ekspor Excel laporan** — terhalang V8-5/6 yang belum pernah dibangun.
   Laporan dapat dilihat di layar; yang belum ada adalah mengunduhnya.

## Catatan yang perlu dibaca sebelum meluncurkan

- **CI belum menjalankan Playwright.** Tidak ada langkah e2e pada
  `.github/workflows`, sehingga sembilan uji layar kasir hanya berjalan bila
  dijalankan orang. Menambahkannya ke CI adalah langkah berikutnya yang paling
  murah dan paling berdampak.
- **Uji layar kasir dilewati pada ponsel dengan sengaja.** Perintah prioritas
  §20 menyasar meja kasir desktop dan tablet lanskap; pada lebar 375 piksel
  keranjang tidak dapat tetap terlihat bersamaan dengan katalog, dan keduanya
  harus terlihat bersamaan.
- **Satu uji lama gagal pada ponsel** — `auth-and-erp.spec.ts:178`, halaman
  "Segera Hadir". Pre-existing, tidak berhubungan dengan POS, dan tidak pernah
  tertangkap karena CI tidak menjalankan e2e.
