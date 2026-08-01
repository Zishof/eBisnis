# santri.info — portal ePesantren

## 1. Mengapa portal tersendiri, bukan halaman di enterprise-education.id

`SANTRI_INFO` dan `ENTERPRISE_EDUCATION` adalah **dua portal yang berbagi satu
vertical**. Modulnya sama, entitlement-nya sama, penagihannya sama; yang berbeda
hanya merek dan halaman depannya.

Pemisahan itu ada karena portal menentukan merek dan konten. Menjadikan
`santri.info` sekadar host tambahan milik `ENTERPRISE_EDUCATION` membuat
pengunjungnya disambut halaman yang bercerita tentang eCampus dan eSchool — dua
hal yang tidak ia cari.

Kebalikannya juga dihindari: `santri.info` **tidak** memperkenalkan vertical
baru. Vertical baru berarti katalog modul baru, harga baru, dan provisioning
baru untuk hal yang sudah ada. `portal.catalog.spec.ts` mengikatnya — setiap
`verticalCode` harus berasal dari daftar yang dikenali.

Konsekuensi yang perlu diingat saat membaca kode: **`code` adalah merek,
`verticalCode` adalah hak akses.** Keduanya biasanya sepadan, tetapi tidak wajib.

## 2. Tiga jenis host pada satu domain

| Host | Apa | Ditentukan oleh |
| --- | --- | --- |
| `santri.info`, `www.santri.info` | Portal | `platform.platform_portal_domain` |
| `app.santri.info` | Pintu aplikasi | `platform.platform_portal_domain` |
| `<pondok>.santri.info` | Situs penyewa | `platform.vertical_site_domain` |
| `<domain-pondok>` | Situs penyewa | `platform.vertical_site_domain` |

Dua tabel yang berbeda, dan itu disengaja. Portal adalah merek platform; situs
penyewa adalah milik pondok. Menyatukannya berarti pondok yang mendaftar dapat
mengklaim host yang seharusnya milik platform.

Di sisi peramban, pemisahan itu ada di
[`santri-host.ts`](../../apps/web/src/verticals/pesantren/santri-host.ts):
`isSantriPortalHost` hanya benar untuk apex dan `www`, sedangkan
`slugPondokDariHost` menolak apex, label terpesan platform, dan subdomain
bertingkat.

Pengenalan di peramban itu **bukan kontrol keamanan** — ia hanya memilih
tampilan. Pondok mana yang datanya boleh dibaca tetap diputuskan API dari host
permintaan.

### Mengapa label terpesan disalin ke sisi peramban

`app.santri.info` benar-benar terdaftar. Tanpa daftar label terpesan di sisi
peramban, host itu dibaca sebagai pondok bernama "app" dan halaman aplikasi
berganti menjadi pencarian penyewa yang tidak akan pernah ketemu — 200, tanpa
galat.

Kedua daftar diikat oleh uji: `santri-host.test.ts` membaca `portal-host.ts` dan
gagal bila sisi API memuat label yang tidak ada di sisi peramban.

## 3. Harga

**Rp 2.000 per santri per bulan, ditagihkan satu tagihan per pondok, dapat
berubah sesuai kesepakatan.**

Angka itu tertulis pada halaman pemasaran sebagai **penawaran bawaan**, bukan
sumber kebenaran penagihan. Yang menagih tetap katalog harga berversi pada
control plane, dan kontrak tiap pondok dapat menimpanya (§7 melarang harga
di-hardcode pada controller).

Yang perlu dijaga saat harganya berubah: histori harga lama tidak diubah, dan
data contoh tidak pernah ditagihkan.

## 4. Yang sudah ada dan yang belum

Sudah ada:

- Portal `SANTRI_INFO` di `portal.catalog.ts`, ikut diseed dan ikut tautan silang.
- Pengenalan host di peramban, beserta 13 ujinya.
- Halaman portal
  ([`SantriInfoHomePage.tsx`](../../apps/web/src/verticals/pesantren/SantriInfoHomePage.tsx))
  dengan kerangkanya sendiri, sebab `PublicLayout` memakai merek eBisnis.
- Apache `*.santri.info`, CORS, dan pemeriksaan domain pada `ekosistem.sh`.
- Halaman "sedang disiapkan" untuk subdomain pondok, supaya pondok pertama tidak
  disambut halaman perusahaan eBisnis.

**Belum ada** — dan halaman pemasaran menjanjikannya, jadi ini utang, bukan
sekadar rencana:

1. **Situs penyewa yang dapat disunting sendiri.** CMS dan berita publik yang
   ada sekarang milik platform, bukan per penyewa: `GET /public/site`,
   `/public/pages/:slug`, dan `/public/news` tidak menerima host sebagai
   penentu penyewa. Yang dibutuhkan: pencarian penyewa dari host lewat
   `vertical_site_domain`, lalu CMS dan berita yang tersimpan pada schema
   penyewa — bukan pada `platform`.
2. **Verifikasi domain milik pondok.** Tabelnya sudah menolak baris `ACTIVE`
   tanpa `verifiedAt`, tetapi alur yang mengisinya belum dibangun. Sampai itu
   ada, domain milik pondok tidak boleh dilayani — bukan karena rapi, melainkan
   karena tanpa verifikasi siapa pun dapat mendaftarkan nama yang bukan miliknya
   dan memperoleh halaman yang dilayani infrastruktur kita.
3. **Sertifikat wildcard.** Menuntut DNS-01; lihat
   [docs/deployment/santri-info.md](../deployment/santri-info.md).

Ketiganya menghalangi pondok pertama benar-benar dipakai, bukan hanya
mendaftar.

---

## 5. Pendaftaran pondok — jalur tersendiri

`/daftar-pesantren`, terpisah dari `/daftar`.

Bukan soal tampilan. Yang ditanyakan berbeda — NSPP, izin operasional, tipe
pesantren, jenjang, pengasuh — dan yang **dihasilkan** juga berbeda: pendaftaran
ini membuat situs pondok dan menandai penyewanya sebagai pesantren, dua hal yang
tidak dilakukan pendaftaran eBisnis.

Formulir gabungan yang menukar setengah pertanyaannya menurut satu pilihan di
awal akan menampilkan pertanyaan retail kepada pengurus pondok setiap kali
pilihan itu tergeser.

### Dua nama yang tidak boleh tertukar

| | Menjadi | Pola | Contoh |
| --- | --- | --- | --- |
| Nama pengguna | nama schema | `^[a-z][a-z0-9_]{2,47}$` | `raudlatul_ulum` |
| Alamat situs | label DNS | `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$` | `raudlatul-ulum` |

Garis bawah sah pada yang pertama dan **tidak sah** pada yang kedua. Menyamakan
keduanya membuat pondok bernama `raudlatul_ulum` memperoleh host
`raudlatul_ulum.santri.info` — tersimpan, tercatat aktif, dan tidak pernah dapat
dibuka siapa pun.

Karena itu keduanya diminta terpisah, diperiksa terpisah, dan dijaga CHECK
terpisah di basis data.

### Urutan, dan mengapa begitu

1. Validasi bentuk — murni, tanpa basis data
2. Kunci penasihat atas host situs
3. Pastikan host belum diklaim
4. Pendaftaran umum: schema, penyewa, pengguna, credential
5. Identitas pesantren + penanda vertikal + situs — satu transaksi

Langkah 3 mendahului langkah 4 dengan sengaja. Kegagalan yang paling mungkin
adalah "alamat situs sudah dipakai", dan menemukannya sesudah schema dibuat
berarti meninggalkan schema yang tidak dipakai siapa pun.

Bila langkah 5 gagal sesudah langkah 4 berhasil, yang dilakukan adalah mencatat
dan memberitahu — bukan membatalkan. Penyewanya sudah sehat dan credential-nya
sudah dibuat; credential tidak dapat ditarik kembali.

### Kata sandi

Selalu dibuat peladen pada jalur ini. `generatePassword` **tidak** ada pada DTO —
bukan sekadar dipaksa `true` di service, melainkan tidak dapat dikirim sama
sekali. Nilai dari luar yang menentukan hal ini berarti pendaftar dapat memilih
kata sandinya sendiri lewat permintaan langsung, melewati formulir yang tidak
pernah menawarkannya.

Kata sandi ditampilkan **sekali** pada response, tidak pernah disimpan (hanya
hash Argon2), dan wajib diganti saat masuk pertama.

## 6. Beranda penyewa yang terpisah

Sesudah masuk, penyewa pesantren mendarat di `/pesantren`, bukan `/app`.

Keputusannya dibawa **sesi**, lewat `tenant.verticalCode` — bukan lewat alamat.
Sebabnya: kata sandi buatan peladen wajib diganti saat masuk pertama, sehingga
masuk pertama selalu berbelok ke halaman ganti kata sandi, dan tujuan yang
dititipkan pada query tidak selamat melewati belokan itu.

Aturannya ada di `apps/web/src/app/beranda-sesudah-masuk.ts`, dengan tiga hal
yang diuji:

- tujuan yang tadinya hendak dibuka menang atas beranda vertikal;
- staf platform menang atas vertikal — staf yang kebetulan anggota sebuah pondok
  tetap mendarat di konsol platform;
- vertikal yang belum punya beranda jatuh ke bawaan, bukan ke alamat yang belum
  ada.

`verticalCode` juga ikut pada `GET /auth/me`, dibaca dari basis data dan bukan
dari klaim token. Token berumur panjang; vertikal yang tertanam di dalamnya akan
tetap menunjuk beranda lama sampai tokennya kedaluwarsa.

Beranda pondok menyebutkan dengan jujur mana modul yang sudah dapat dibuka dan
mana yang belum. Yang belum tidak dibuat menjadi tombol: kartu yang dapat ditekan
tetapi mendarat di halaman kosong membuat pengurus mengira ia salah memakai.
