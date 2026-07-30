# Karakterisasi legacy Esmartlink — perilaku yang harus dipertahankan

Dokumen ini mencatat perilaku sistem lama yang **wajib** dipertahankan pada
implementasi baru, beserta letaknya pada source legacy di `docs/input/`. Setiap
poin adalah keputusan yang sudah terbukti di produksi, bukan preferensi desain.

Berkas sumber:

| Berkas | Baris | Peran |
| --- | --- | --- |
| `Esmartlink.java` | 339 | Servlet callback dan pemrosesan pembayaran |
| `SmartlinkChannelWindow.java` | 983 | Konfigurasi channel dan biaya admin |
| `VirtualAccountBankAction.java` | 2966 | Siklus hidup virtual account |
| `DownloadTagihanSiswaBankOnline.java` | 846 | Ekspor tagihan ke bank |

## 1. Log host-to-host SELALU ditulis

`Esmartlink.java:195-201` menempatkan `catatLogHostToHost(...)` di blok
`finally`, dengan komentar eksplisit pada baris 113 dan 197:

> "TANPA syarat bankHost: request bank apa pun WAJIB tercatat ke log H2H"
> "request dari IP tak dikenal pun WAJIB tercatat"

**Implikasi yang dipertahankan.** Log H2H ditulis walaupun:

- payload gagal di-parse,
- virtual account tidak ditemukan,
- terjadi exception di tengah pemrosesan (stack trace disimpan pada kolom log),
- pengirim berasal dari alamat IP yang tidak dikenali.

Implementasi baru: `EsmartlinkPaymentService` menulis `host_to_host_log`
sebelum validasi apa pun dan pada seluruh cabang keluar. Penolakan karena IP
tidak terdaftar tetap menghasilkan baris log — kalau tidak, serangan atau
salah konfigurasi jaringan menjadi tidak terlihat.

## 2. Dedupe callback berdasarkan `transaction_id`

`Esmartlink.java:127-137` mengambil `data.transaction_id` dari payload dan
membangun kriteria pencarian pada kolom `response`. Bila VA sudah terbayar,
`Esmartlink.java:145-148` mencetak "sudah pernah diproses" dan **melewati**
pemrosesan pembayaran alih-alih menggandakannya.

**Implikasi yang dipertahankan.** Callback bersifat idempotent terhadap
`transaction_id`. Pengiriman ulang oleh provider tidak boleh menambah
pembayaran kedua. Implementasi baru memakai unique constraint pada
`payment_callback_event` dan mengembalikan hasil pemrosesan pertama.

## 3. Parse gagal tidak menggagalkan seluruh proses

`Esmartlink.java:132-135` menangkap exception saat membaca `transaction_id` dan
melanjutkan dengan `crit = null`. Ketidakhadiran `transaction_id` bukan
kegagalan fatal.

## 4. Balasan selalu `OK`

`Esmartlink.java:204` mengembalikan `"OK"` tanpa syarat, dan `catatLogHostToHost`
juga dipanggil dengan status `"OK"` pada baris 200.

**Implikasi yang dipertahankan.** Provider memakai badan respons sebagai tanda
terima. Mengembalikan error HTTP membuat provider mengirim ulang callback
berkali-kali. Implementasi baru mempertahankan tanda terima yang dapat
dikonfigurasi (`ESMARTLINK_CALLBACK_ACK_SUCCESS`, default `OK`), memisahkan
"callback diterima" dari "pembayaran berhasil diproses".

## 5. Nominal minimum 0,1

`Esmartlink.java:138` memeriksa `virtualAccountBankNtt.getTotal() > 0.1` sebelum
memproses. Nilai nol atau mendekati nol diperlakukan sebagai tidak ada tagihan.

## 6. Rollback transaksi dan sesi selalu ditutup

`Esmartlink.java:187-198` melakukan `rollbackTransaction()` pada exception dan
menutup sesi Hibernate melalui tiga blok `try` terpisah (`clear`, `disconnect`,
`close`), sehingga kegagalan satu langkah tidak mencegah langkah berikutnya.

**Implikasi yang dipertahankan.** Koneksi tenant selalu dikembalikan ke pool
melalui `finally`, dan kegagalan pembersihan tidak menutupi error asli.

## 7. Tanggal transaksi memiliki nilai bawaan

`Esmartlink.java:208-220` memakai waktu sekarang bila `tanggalP` kosong, bukan
menolak permintaan.

## Perilaku legacy yang TIDAK dipertahankan

| Perilaku legacy | Alasan tidak dipertahankan |
| --- | --- |
| Payload mentah disimpan tanpa masking | Payload dapat memuat data kartu dan token. Implementasi baru memask `password`, `token`, `secret`, `pin`, dan data kartu sebelum menyimpan, dengan retensi payload mentah yang dibatasi (`ESMARTLINK_RAW_PAYLOAD_RETENTION_DAYS`) |
| `System.out.println` sebagai jejak | Diganti audit terstruktur pada `platform__audit` |
| Kredensial pada source | Seluruh kredensial berasal dari variabel lingkungan; `.env` tidak dikomit |
| Domain akademik (siswa, mahasiswa, semester) | Di luar cakupan; struktur dipetakan ke tagihan langganan tenant |

## Rujukan

- [Karakterisasi create-order](esmartlink-create-order-characterization.md)
- [Karakterisasi inquiry](esmartlink-inquiry-characterization.md)
- `apps/api/src/modules/payment/esmartlink/esmartlink-payment.service.ts`
