# POS-0 · Garis Dasar Pengujian

Dijalankan pada `feature/pos-web-priority` sebelum satu baris kode POS ditulis.
Angka-angka di bawah adalah titik acuan: setiap fase POS berikutnya harus
menambah, bukan mengurangi.

**Tanggal:** 31 Juli 2026 · **Titik tolak:** `main` @ `4f7ab88`

---

## Hasil

| Perintah | Hasil | Waktu |
|---|---|---|
| `tsc --noEmit` (API) | **bersih** | — |
| `tsc --noEmit` (web) | **bersih** | — |
| `eslint src --max-warnings=0` (API) | **bersih** | — |
| `eslint src --max-warnings=0` (web) | **bersih** | — |
| `jest` (API) | **45 suite, 1048 tes lulus** | 6,7 s |
| `vitest` (web) | **4 berkas, 35 tes lulus** | 4,5 s |
| `vite build` | **berhasil** | 7,2 s |

Tidak ada tes yang dilewati, tidak ada yang ditandai `.skip`, tidak ada
peringatan yang dibiarkan.

## Cakupan pengujian POS saat ini

**Nol.** Tidak ada satu pun berkas `*.spec.ts` yang menguji jalur POS. Pencarian
`pos_sale`, `pos_shift`, dan `pos_payment` di seluruh berkas pengujian tidak
menghasilkan apa-apa.

Yang paling dekat adalah:

| Berkas | Apa yang diuji | Relevansi POS |
|---|---|---|
| `modules/order/order-state.spec.ts` | Transisi status pesanan marketplace | Pola mesin transisi yang akan ditiru POS-5 |
| `modules/return/return-rules.spec.ts` | Kelayakan retur, perhitungan refund | Sebagian aturannya dapat dipakai POS-8 |
| `modules/checkout/checkout-validation.spec.ts` | Validasi checkout marketplace | Pola validasi berlapis |
| `modules/accounting/posting-engine.spec.ts` | Kelengkapan kode peristiwa akuntansi | **Penting** — polanya memaksa setiap kode peristiwa punya aturan posting. Dua belas kode `POS_*` harus lulus uji yang sama |

## Sasaran per fase

Angka minimum yang diharapkan bertambah pada tiap fase, agar "selesai" tidak
berarti "kodenya ditulis":

| Fase | Tambahan tes minimum | Yang wajib diuji |
|---|---|---|
| POS-1 | 12 | kasir hanya outlet yang ditugaskan; supervisor multi-register; peralihan peran teraudit; lintas-tenant ditolak; outlet nonaktif ditolak; register nonaktif ditolak |
| POS-2 | 16 | barcode utama; barcode alternatif; harga per outlet; tanggal berlaku; pajak inklusif; pembulatan; promosi; produk nonaktif |
| POS-3 | 10 | stok cukup; stok kurang; negatif diizinkan; negatif ditolak; penjualan bersamaan; commit ganda; batch/serial |
| POS-4 | 10 | buka ganda; register salah; transaksi tanpa shift; ambang selisih; kas keluar tanpa izin; tutup dengan penjualan tertunda |
| POS-5 | 18 | tambah/ubah/hapus baris; tahan/lanjutkan; sunting bersamaan; harga berubah; stok berubah; izin diskon; pembulatan pajak |
| POS-6 | 14 | tunai pas; tunai berkembalian; pembayaran majemuk; kurang bayar; lebih bayar tidak sah; pembayaran ganda; selesai ganda; gulung balik saat gagal |
| POS-7 | 8 | nomor unik; merek tenant; rincian pajak; pembayaran majemuk; kembalian; izin cetak ulang |
| POS-8 | 12 | void sebelum bayar; void sesudah selesai; retur sebagian; retur penuh; izin refund; larangan menyetujui sendiri; stok kembali; pembalikan jurnal |

Jumlah minimum sepanjang POS-1 sampai POS-8: **100 pengujian baru**.

## Yang tidak diukur di sini

- **Uji E2E.** `pnpm test:e2e` belum dijalankan pada garis dasar ini karena
  memerlukan API dan basis data yang hidup; akan dijalankan pada POS-1 ketika
  konteks POS pertama tersedia untuk diuji dari ujung ke ujung.
- **Uji beban.** Sasaran kinerja (barcode P95 &lt; 300 ms, kuotasi harga P95 &lt; 500 ms,
  penyelesaian tunai P95 &lt; 2 s) belum dapat diukur karena endpoint-nya belum ada.
  Pengukuran dimulai pada POS-2 begitu pencarian barcode berjalan.
