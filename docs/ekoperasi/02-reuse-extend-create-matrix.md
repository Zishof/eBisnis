# K-0 · Matriks Pakai-Ulang / Perluas / Bangun

Perintah eKoperasi §7 menutup daftar port dengan satu kalimat: *"Jangan menyalin
source Core ke folder koperasi."* Dokumen ini adalah jawabannya — apa yang
dipakai apa adanya, apa yang diperluas lewat adapter, dan apa yang benar-benar
harus dibangun.

Tiga golongan:

| Golongan | Artinya |
|---|---|
| **PAKAI** | Dipanggil apa adanya lewat port; tidak ada tabel maupun kode baru |
| **PERLUAS** | Dipakai, ditambah konteks koperasi lewat tabel penghubung; Core tidak diubah |
| **BANGUN** | Tidak ada padanannya; dibangun di `modules/cooperative/` |

---

## PAKAI — dipanggil apa adanya

| Kemampuan Core | Port koperasi | Dipakai untuk |
|---|---|---|
| `posting-engine.ts` + `accounting_event` | `AccountingEventPort` | Jurnal simpanan, pinjaman, SHU, unit usaha |
| `workflow_*` | `WorkflowPort` | Persetujuan pinjaman, restrukturisasi, penghapusbukuan, SHU |
| `modules/notification/` | `NotificationPort` | Tagihan angsuran, undangan RAT, hasil SHU |
| Pemicu audit `V008` | — (otomatis) | Setiap perubahan tabel koperasi teraudit tanpa kode |
| `user_scope_assignment`, `role_data_scope` | — (otomatis) | Petugas cabang hanya melihat anggota cabangnya |
| `segregation_of_duty_rule` | — (data) | Analis tidak menyetujui pinjaman yang dianalisisnya |
| `number_sequence` | `NumberingPort` | Nomor anggota, nomor pinjaman, nomor RAT |
| `modules/ai/` | `AiGatewayPort` | Ringkasan kesehatan, draf notulen, analisis tunggakan |
| `file_object`, `entity_attachment` | `FileStoragePort` | Akta, KTP, agunan, notulen |
| `modules/master-seed/` | — (registri) | Data contoh koperasi bergolongan `EXAMPLE` |
| `modules/billing/` | `SubscriptionPort` | Langganan Rp 500.000 per bulan per koperasi |
| `modules/cms/`, `modules/storefront/` | — | Situs `<slug>.ekoperasi.id` |
| `sync_outbox` | `EventPort` | Penerbitan peristiwa `cooperative.*` |

Catatan penting soal penomoran: pola anti-kembar pada tata kelola surat (V10-6)
sudah terbukti di bawah permintaan bersamaan. Nomor anggota yang kembar adalah
cacat yang terbawa ke kartu anggota tercetak, jadi polanya dipakai ulang — bukan
ditulis ulang.

---

## PERLUAS — dipakai, ditambah konteks koperasi

| Yang ada | Cara memperluas | Mengapa tidak menyalin |
|---|---|---|
| `party` | `cooperative_member.party_id` menunjuk `party` | Anggota yang juga pemasok tidak boleh tercatat dua kali dengan data yang lambat laun berbeda |
| `customer` | `cooperative_member.customer_id` opsional | Anggota yang berbelanja di unit toko adalah pelanggan POS; menautkannya membuat patronage terhitung otomatis |
| `outlet` + `pos_terminal` | `cooperative_unit_pos_link` | Unit toko koperasi adalah outlet biasa dengan pemilik unit usaha. POS kedua akan membelah persediaan |
| `warehouse`, `stock_*` | `cooperative_unit_business.warehouse_id` | Gudang unit usaha adalah gudang biasa yang dimiliki unit |
| `chart_of_account` | `cooperative_account_mapping` | Akun simpanan dan piutang pinjaman dipetakan per koperasi, tidak dikunci di kode |
| `employee` | `cooperative_appointment.employee_id` opsional | Pengurus yang juga pegawai tidak dicatat dua kali |
| `journal_entry` | lewat `accounting_event` | Tidak ada buku besar kedua. Simpanan dan pinjaman menerbitkan peristiwa; mesin Core yang menjurnal |
| `payment_method` | `cooperative_payment_method_link` | Metode pembayaran angsuran memakai master yang sama dengan POS |
| Katalog menu | `cooperative-menu.catalog.ts` | Katalog modular sesuai panduan §9, bukan menambah ke berkas global |

---

## BANGUN — tidak ada padanannya

Delapan agregat pada [01-domain-map.md](01-domain-map.md), seluruhnya baru:

| Agregat | Perkiraan tabel | Fase |
|---|---|---|
| Koperasi dan legalitas | 7 | K-1 |
| Organisasi dan kepengurusan | 7 | K-2 |
| Calon anggota dan anggota | 10 | K-2 |
| Simpanan | 5 | K-3 |
| Pinjaman dan pembiayaan | 14 | K-4 |
| Penagihan dan risiko | 6 | K-4 |
| Rapat anggota | 9 | K-5 |
| SHU dan patronage | 7 | K-6 |
| Unit usaha | 6 | K-7 |
| Dompet anggota | 4 | K-7 |
| **Jumlah** | **± 75 tabel** | |

---

## Terdengar dapat dipakai, tetapi **tidak**

Bagian yang paling menghemat waktu. Empat hal berikut mudah disalahpahami.

### `investor_profile` dan `ownership_interest` — **bukan** keanggotaan koperasi

Keduanya ada pada `V002` dan menggoda untuk dipakai sebagai anggota koperasi.
Bukan. Keduanya memodelkan penyertaan modal perseroan: kepemilikan berbanding
lurus dengan setoran, dan suara mengikuti kepemilikan.

Koperasi bekerja terbalik — **satu anggota satu suara**, berapa pun simpanannya.
Memakai `ownership_interest` untuk keanggotaan akan menanamkan pembobotan suara
berdasarkan modal ke dalam fondasinya, dan itu bertentangan dengan prinsip
koperasi. Anggota dibangun tersendiri.

### `customer_group` — **bukan** kategori anggota

`customer_group` menggolongkan pelanggan untuk harga dan diskon.
`cooperative_member_category` menggolongkan anggota untuk hak suara, hak pinjam,
dan bagian SHU. Menyamakannya berarti kategori anggota ikut berubah setiap kali
seseorang menyunting daftar harga.

### `PricingEngineService` — mesin harga **langganan**, bukan harga anggota

Sudah dicatat sesi Core pada audit POS: mesin itu menghitung tagihan langganan
SaaS (`planCode`, `billingInterval`), bukan harga produk. Harga khusus anggota
memakai `price_book` dengan lingkup anggota, lewat adapter POS.

### `sales_order` — pesanan penjualan B2B, bukan transaksi anggota

Ada pada `V006` bersama tabel POS sehingga mudah dikira bagian alur kasir.
Sesungguhnya pesanan B2B dengan `delivery_date` dan `ordered_qty` versus
`delivered_qty`. Transaksi anggota di unit toko memakai `pos_sale`.

---

## Aturan yang dipegang selama koperasi dibangun

1. **Koperasi tidak pernah membaca tabel Core langsung.** Selalu lewat port dan
   adapter, meskipun kueri langsung akan lebih pendek.
2. **Tidak ada buku besar kedua.** Setiap konsekuensi keuangan menerbitkan
   `accounting_event`; mesin Core yang menjurnal.
3. **Tidak ada POS kedua.** Unit toko memakai POS Core lewat adapter.
4. **Tidak ada identitas kedua.** Anggota menunjuk `party`.
5. **Bila Core perlu berubah, buat permintaan integrasi** — jangan menyunting
   Core dari worktree ini, sedekat apa pun godaannya.
