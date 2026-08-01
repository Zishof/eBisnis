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
