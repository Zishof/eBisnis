# Karakterisasi `create-order` Esmartlink

Kontrak pembuatan order pembayaran, dikarakterisasi dari
`docs/input/VirtualAccountBankAction.java` dan `docs/input/Esmartlink.java`.

## Autentikasi

**HTTP Basic Authentication** dengan header `Content-Type: application/json` dan
`Accept: application/json`, sesuai `curlSmartlink` / `curlSmartlinkGet` pada
source legacy.

Skema tanda tangan **tidak dikarang**. Bila Esmartlink kelak menyediakan
signature, penambahannya dilakukan di `EsmartlinkClient` berdasarkan dokumentasi
resmi provider — bukan hasil dugaan.

Legacy memanggil `curl` sebagai proses eksternal. Implementasi baru memakai
`fetch` bawaan Node dengan `AbortController` dan timeout 20 detik; tidak ada
perintah shell yang dijalankan, sehingga tidak ada permukaan command injection.

## Penentuan sukses

```
sukses  ⟺  HTTP response.ok  DAN  envelope.code === '0'
```

`code === 0` sebagai penanda sukses berasal langsung dari kontrak legacy. Nilai
`code` dinormalkan menjadi string sebelum dibandingkan, karena provider dapat
mengirimnya sebagai angka maupun string.

HTTP 200 dengan `code` selain `0` adalah **kegagalan**, bukan keberhasilan. Ini
menutup kelas bug klasik pada integrasi pembayaran: menganggap 200 = berhasil.

## Kegagalan yang ditangani

| Kondisi | Perilaku |
| --- | --- |
| Timeout (> 20 s) | `ok: false`, `code: null`, `error` terisi, log H2H ditulis |
| Body bukan JSON | `ok: false`, `raw` menyimpan teks mentah untuk investigasi |
| Provider dinonaktifkan (`ESMARTLINK_ENABLED=false`) | Gagal terkendali dengan pesan jelas, bukan exception tak tertangani |
| Jaringan tidak dapat dijangkau | Sama seperti timeout; order tetap tercatat sebagai gagal |

Seluruh cabang di atas menulis `host_to_host_log`.

## Masking payload

`maskPayload()` mengganti nilai pada field bernama `password`, `token`,
`secret`, `pin`, dan data kartu **sebelum** payload masuk log atau audit.
Masking berjalan rekursif pada objek bersarang, karena provider dapat
menempatkan field sensitif di dalam `data`.

## Idempotensi

Pembuatan order memakai kunci idempotensi. Permintaan berulang dengan kunci yang
sama mengembalikan order yang sudah ada alih-alih membuat order kedua.

## Batas waktu pembayaran

Pilihan batas waktu legacy dipetakan ke menit oleh `LEGACY_EXPIRY_OPTIONS`
(9 pilihan, 15 menit sampai 1 bulan). Kode yang tidak dikenali jatuh ke nilai
bawaan 24 jam, bukan menolak permintaan — sesuai perilaku legacy yang permisif
terhadap konfigurasi tidak lengkap.

## Rujukan

- [Karakterisasi legacy](esmartlink-legacy-characterization.md)
- [Karakterisasi inquiry](esmartlink-inquiry-characterization.md)
- `apps/api/src/modules/payment/esmartlink/esmartlink.client.ts`
- `apps/api/src/modules/payment/esmartlink/esmartlink-channel.parser.spec.ts`
