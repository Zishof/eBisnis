# Offline Sync Contract

Flutter Windows dan Android menggunakan cache lokal per tenant/user/device.

1. Bootstrap membawa master, versi record, cursor, entitlement, dan batas periode.
2. Draft dan command masuk outbox dengan `deviceId + deviceEventId` unik.
3. Retry memakai idempotency key yang sama; timeout tidak boleh membuat dokumen ganda.
4. Pull delta bergerak monoton berdasarkan cursor server.
5. Konflik tidak ditimpa diam-diam. UI menampilkan server/client, waktu, actor,
   dan pilihan `SERVER_WINS`, `CLIENT_WINS`, `MERGED`, atau `DUPLICATE` sesuai izin.
6. Posting ke ledger hanya terjadi di server dalam transaksi atomik.
7. Logout menghapus token, tetapi cache tenant terenkripsi hanya dibersihkan melalui
   tindakan eksplisit agar draft offline tidak hilang tanpa peringatan.
8. Lampiran/foto mempunyai checksum dan antrean terpisah dari command uang.
