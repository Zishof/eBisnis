# Serah-Terima — POS Apotik & POS eMedik (Flutter)

**Untuk:** sesi berikutnya yang mengerjakan Flutter
**Dari:** sesi Claude, 11 Agustus 2026
**Sifat:** rencana kerja lengkap, dari awal sampai akhir

---

## 0. Baca ini dulu — premisnya perlu diluruskan

Permintaannya menyebut *"aplikasi Flutter `C:\opt\CodeBaseDesktopDanMobile\*` dimana
`https://github.com/Zishof/AIS.git`"*. Setelah diperiksa, keduanya **repositori yang
berbeda**, dan keduanya benar-benar terlibat — tetapi pada peran yang berbeda:

| Yang disebut | Kenyataannya |
|---|---|
| `C:\opt\CodeBaseDesktopDanMobile` | repo **`Zishof/zishof-platform`** — *"satu basis kode Flutter untuk eBisnis, eCampus, eSchool, ePesantren, eKlinik, **eMedic**, **eFarmasi**, eLogistik, eMarketPlace"* |
| `Zishof/AIS` | *"Sistem eCampus, eSchool, dan ePesantren versi **Java**"*, cabang `master` — **backend**-nya, bukan Flutter |

Jadi rujukan AIS **tidak keliru**, hanya perannya perlu dinyatakan: **AIS adalah
peladen; zishof-platform adalah kliennya.** `ApiClient` Flutter memanggil servlet
`ais.action.servlet.ApiEBisnis` (alias `PosApi.java`).

> **Salinan `C:\opt\AIS` bukan checkout Git.** Ia direktori berisi sumber dan ratusan
> `.zip` tambalan. Sebelum menyunting satu baris pun Java, **klon `Zishof/AIS` yang
> sebenarnya** dan kerjakan di sana. Menyunting `C:\opt\AIS` berarti bekerja tanpa
> riwayat, tanpa cabang, dan tanpa cara membatalkan.

### Dan ada DUA aplikasi POS Flutter, bukan satu

Ini keputusan terpenting yang harus diambil **sebelum menulis kode**:

| | `zishof-platform/apps/ebisnis` | `eBisnis/apps/pos-flutter` |
|---|---|---|
| Backend | **Java** `Api_eBisnis` (AIS) | **NestJS** `https://apotik.emedik.id/api/v1/` |
| Otentikasi | token pada `SharedPreferences`, satu aksi generik | JWT `Bearer`, RBAC menu/permission |
| Izin menu | `konfigurasi.aksesMenu` ← `Tbmrole.ebisnisMenu` | `demo.menu` + `role_menu_permission` |
| Besar | 81 berkas Dart + 9 paket `core_*` | 36 berkas Dart |
| Varian | `default`, `albahjah`, `inventory_sales` | POS Apotik (sudah menyasar `apotik.emedik.id`) |

**Keduanya sudah menyasar apotek.** `apps/pos-flutter` pada repo eBisnis dibangun sesi
sebelumnya dan sudah menunjuk `apotik.emedik.id`; sementara permintaan ini mengarah ke
`zishof-platform`.

> **Putuskan dengan sadar, jangan sebagai efek samping.** Mengerjakan POS Apotik di
> `zishof-platform` berarti apotek berjalan di atas backend **Java/AIS**, sementara
> seluruh vertikal kesehatan eMedik V12 (H-1…H-12: pasien, kunjungan, resep, eMAR,
> koding, klaim, BPJS, SATUSEHAT) hidup di backend **NestJS**. Keduanya tidak berbagi
> basis data.

Tiga jalan yang mungkin, beserta ongkosnya:

1. **Semua di AIS/Java.** POS Apotik memakai modul **SIRS** yang sudah ada di AIS
   (191 berkas Java: pasien, dokter, rekam medis, booking registrasi, alat medis,
   gudang, harga jual item). Vertikal eMedik NestJS tidak dipakai untuk apotek.
   *Ongkos: dua sistem kesehatan berjalan paralel.*
2. **Semua di NestJS.** Lanjutkan `apps/pos-flutter`, jangan sentuh zishof-platform.
   *Ongkos: pekerjaan Flutter zishof-platform tidak terpakai untuk apotek.*
3. **zishof-platform sebagai cangkang, NestJS sebagai backend.** Tambah varian baru
   di zishof-platform yang `ApiClient`-nya menunjuk NestJS.
   *Ongkos: dua kontrak API di satu basis kode — dan itu sumber kekeliruan yang mahal.*

**Dokumen ini menulis rencananya untuk jalan 1**, sebab itulah yang paling sesuai
dengan apa yang diminta (zishof-platform + AIS + `Tbmrole`). Bila yang dipilih jalan
lain, bagian §3 dan §4 berubah seluruhnya — bagian §2 tetap berlaku.

---

## 1. Keadaan yang sudah ada

### 1.1 Flutter — `zishof-platform/apps/ebisnis`

Satu basis kode, banyak varian, lewat **dua** saklar yang wajib konsisten:

```bash
flutter build windows \
  -t lib/main_inventory_sales.dart \
  --dart-define=EBISNIS_VARIANT=inventory_sales
```

- `lib/app_variant.dart` — konstanta **compile-time** (nama, logo, kata kunci pembaruan).
  Juga menggerakkan `variant.cmake` pada build Windows.
- `lib/product_profile.dart` — profil **runtime**; entrypoint memilihnya lewat
  `bootstrap(profil)`. Keduanya dijaga `cocokDenganDartDefine()` — kombinasi build yang
  salah langsung ketahuan di log.
- `FiturGrup` — grup fitur yang dirakit ke dalam binary varian. **Bukan pengganti hak
  akses**; peladen tetap satu-satunya sumber kebenaran izin.

Layar yang sudah ada (`lib/screens/`): kasir, keranjang, produk, anggota, diskon,
kulakan, pesanan, retur penjualan/pembelian, laporan, mutasi antar outlet, price tag,
layar pelanggan, konfigurasi, hak akses, log error. Ditambah `screens/inventory_sales/`
untuk varian 48 layar.

Paket bersama: `core_auth`, `core_billing`, `core_db`, `core_device`, `core_hw`,
`core_notif`, `core_sync`, `core_ui`, `core_update`.

### 1.2 Java/AIS — yang relevan

| Berkas | Perannya |
|---|---|
| `ais/common/EbisnisMenuKatalog.java` | **katalog tunggal** semua menu POS yang dapat diatur per Grup Pengguna |
| `ais/action/servlet/PosApi.java` (~baris 922) | menyusun `aksesMenu` yang dikirim ke klien Flutter |
| `ais/action/maintenance/TbmroleAction.java` (~baris 2226) | layar admin "Grup Pengguna" tempat centang menu diatur |
| `ais/database/model/Tbmrole.java` | punya kolom `emedic`, `kantin`, `tampilPos`, `akunting` — **gerbang tingkat modul** |
| `ais/action/master/sirs/**` | **191 berkas** modul rumah sakit yang sudah jadi |
| `ais/action/servlet/api/EbisnisActorContextResolver.java` | konteks aktor per varian, *fail-closed* |

Layar SIRS yang sudah ada, antara lain: `DiagnosaPenyakitAction` (Rekam Medis),
`BookingRegistrasiAction` (Pendaftaran), `DokterAction`, `AlatMedisAction`,
`GudangAction`, `HargaJualItemAction`, `GenerikItemAction`, `DepositAction`,
`AsuransiAction`, `CetakKartuPasienAction`, `DataPasienKeluarAction`.

> **Jangan membangun ulang apa pun dari daftar itu.** Yang diminta POS Apotik —
> bukan sistem rumah sakit kedua.

---

## 2. Menu POS baru — spesifikasi lengkap

Ini bagian yang dapat dikerjakan **tanpa menunggu keputusan §0**, sebab ia murni
sisi Java dan tidak bergantung pada klien mana yang memakainya.

### 2.1 Mengapa tidak perlu `ALTER TABLE`

`Tbmrole.ebisnisMenu` adalah **satu kolom JSON**:

```json
{ "supervisor": false, "berandaKantin": false,
  "menu": { "kasir": true, "ringkasan": true, "…": false } }
```

JavaDoc `EbisnisMenuKatalog` menyatakannya tegas: *"Menambah menu baru = tambah baris
di sini — TIDAK perlu ALTER TABLE apa pun."* Kunci tak dikenal diabaikan, tidak pernah
menggagalkan parse.

### 2.2 Yang ditambahkan ke `EbisnisMenuKatalog.java`

**(a) Konstanta modul baru**, sejajar `MODUL_INVENTORY_SALES`:

```java
/** Varian "POS Apotik" (eFarmasi) — penjualan obat dengan resep, PBF, dan batch-expiry. */
public static final String MODUL_APOTIK = "Menu POS Apotik (varian eFarmasi)";

/** Varian "POS eMedik" — kasir layanan fasilitas kesehatan (non-obat). */
public static final String MODUL_EMEDIK = "Menu POS eMedik (varian layanan medis)";
```

**(b) Baris menu.** Kunci memakai `snake_case` seperti `MODUL_INVENTORY_SALES`, dan
**harus persis sama** dengan yang dipakai klien Flutter:

```java
// -- POS Apotik --
DAFTAR.add(new Entri(MODUL_APOTIK, "apotik_kasir",        "Kasir Apotik",                 "desktop", "android"));
DAFTAR.add(new Entri(MODUL_APOTIK, "apotik_resep",        "Tebus Resep Dokter",           "desktop", "android"));
DAFTAR.add(new Entri(MODUL_APOTIK, "apotik_racikan",      "Racikan",                      "desktop", "android"));
DAFTAR.add(new Entri(MODUL_APOTIK, "apotik_formularium",  "Formularium & Obat",           "desktop", "android"));
DAFTAR.add(new Entri(MODUL_APOTIK, "apotik_batch",        "Batch & Kedaluwarsa",          "desktop", "android"));
DAFTAR.add(new Entri(MODUL_APOTIK, "apotik_pengadaan",    "Pengadaan / PBF",              "desktop", "android"));
DAFTAR.add(new Entri(MODUL_APOTIK, "apotik_stok_opname",  "Stok Opname Apotik",           "desktop", "android"));
DAFTAR.add(new Entri(MODUL_APOTIK, "apotik_retur",        "Retur Obat",                   "desktop", "android"));
DAFTAR.add(new Entri(MODUL_APOTIK, "apotik_narkotika",    "Obat Terkendali (Narkotika/Psikotropika)", "desktop", "android"));
DAFTAR.add(new Entri(MODUL_APOTIK, "apotik_laporan",      "Laporan Apotik",               "desktop", "android"));

// -- POS eMedik --
DAFTAR.add(new Entri(MODUL_EMEDIK, "emedik_kasir",        "Kasir Layanan Medis",          "desktop", "android"));
DAFTAR.add(new Entri(MODUL_EMEDIK, "emedik_pendaftaran",  "Pendaftaran Pasien",           "desktop", "android"));
DAFTAR.add(new Entri(MODUL_EMEDIK, "emedik_tagihan",      "Tagihan Kunjungan",            "desktop", "android"));
DAFTAR.add(new Entri(MODUL_EMEDIK, "emedik_deposit",      "Deposit Pasien",               "desktop", "android"));
DAFTAR.add(new Entri(MODUL_EMEDIK, "emedik_penjamin",     "Penjamin & Asuransi",          "desktop", "android"));
DAFTAR.add(new Entri(MODUL_EMEDIK, "emedik_laporan",      "Laporan Kasir Medis",          "desktop", "android"));
```

> **Daftar ini rancangan, bukan hasil survei layar.** Sebelum dipakai, cocokkan tiap
> kunci dengan layar SIRS yang sudah ada (§1.2) — bila `DepositAction` sudah menangani
> deposit pasien, `emedik_deposit` harus **menunjuk layar itu**, bukan membuat yang baru.

**(c) Seluruh kunci baru masuk `KUNCI_DEFAULT_NONAKTIF`** — inilah "default dibuat
false saja" yang diminta:

```java
public static final java.util.Set<String> KUNCI_DEFAULT_NONAKTIF = new java.util.LinkedHashSet<String>(java.util.Arrays.asList(
        // …16 kunci inventory_sales yang sudah ada…
        "apotik_kasir", "apotik_resep", "apotik_racikan", "apotik_formularium",
        "apotik_batch", "apotik_pengadaan", "apotik_stok_opname", "apotik_retur",
        "apotik_narkotika", "apotik_laporan",
        "emedik_kasir", "emedik_pendaftaran", "emedik_tagihan", "emedik_deposit",
        "emedik_penjamin", "emedik_laporan"));
```

Alasannya sudah tertulis pada JavaDoc yang ada, dan berlaku sama di sini: **gerbang baru
wajib opt-in.** Role POS yang sudah ada tidak boleh tiba-tiba melihat menu apotek.

**(d) `PosApi.java` (~baris 922)** — tambahkan tiap kunci baru ke `aksesMenu`, dan
perhatikan bedanya dengan baris yang sudah ada:

```java
// Kunci lama: default TRUE bila belum pernah disimpan
aksesMenu.put("kasir", menuTersimpan.optBoolean("kasir", true));

// Kunci baru: default FALSE — fail-closed
aksesMenu.put("apotik_kasir", menuTersimpan.optBoolean("apotik_kasir", false));
```

Bila `KUNCI_DEFAULT_NONAKTIF` sudah dipakai terpusat oleh pembangun `aksesMenu`,
pakai jalur itu alih-alih menulis `false` satu per satu — periksa dulu, jangan menebak.

**(e) `TbmroleAction.java` (~baris 2226)** — layar admin dirender dari `DAFTAR`, jadi
menu baru **muncul sendiri**. Pastikan saja pengelompokannya benar (`modul` menjadi
judul grup) dan nilai centang bawaannya mengikuti `KUNCI_DEFAULT_NONAKTIF`.

### 2.3 Peran mana yang menyala

Yang diminta: **default false, kecuali `Tbmrole = Apotik` dan seluruh akses Tenaga
Medis / Pendaftaran Medis / Rekam Medis.**

`Tbmrole` sudah punya kolom **`emedic`** — gerbang tingkat modul, sejajar `kantin`
dan `tampilPos`. Itu pengait yang benar, dan ia sudah ada:

| Peran | `apotik_*` | `emedik_*` | Dasar |
|---|---|---|---|
| Grup "Apotik" | **nyala** | nyala | permintaan langsung |
| Grup ber-`emedic = true` (tenaga medis, pendaftaran, rekam medis) | mati | **nyala** | mereka melayani pasien, bukan menjual obat |
| Grup POS/kantin yang sudah ada | mati | mati | fail-closed, tidak berubah perilakunya |

> **Apoteker dan tenaga medis TIDAK diberi hak yang sama.** Yang menjual obat bukan
> yang memeriksa pasien. Menyalakan `apotik_*` untuk seluruh peran ber-`emedic`
> menghapus pemisahan itu sejak hari pertama, dan pemisahan yang tidak pernah ada
> jauh lebih sulit ditambahkan daripada dipertahankan.
>
> Catatan pembanding: pada eMedik NestJS, apoteker memegang `PRESCRIPTION.READ` +
> `REVIEW` **tanpa `CREATE`** — ia menelaah resep, tidak menulisnya. Aturan itu layak
> ditiru di sisi Java, bukan ditinggalkan.

Cara menyalakannya **idempoten**, meniru `SalesInventoryHelper.java` yang sudah
menyemai role `pemilik_sales_inventory` dan `sales_keliling`:

```java
// Pola yang sudah ada — tiru, jangan mengarang yang baru.
// Seed HANYA menyetel kunci yang BELUM pernah tersimpan; role yang sudah
// disunting admin tidak boleh ditimpa.
```

### 2.4 Yang wajib diperiksa sesudahnya

1. Role POS lama dibuka di layar Grup Pengguna → **seluruh menu baru tidak tercentang**.
2. Role Apotik → `apotik_*` tercentang, `emedik_*` sesuai keputusan.
3. Klien Flutter lama (versi sebelum menu ini ada) tetap berjalan — kunci tak dikenal
   diabaikan, bukan menggagalkan parse.
4. `aksesMenu` yang dikirim `PosApi` memuat seluruh kunci baru, bernilai `false` bagi
   role yang belum menyimpannya.

---

## 3. Pekerjaan Flutter — POS Apotik

### 3.1 Varian baru, bukan aplikasi baru

Ikuti pola `inventory_sales` persis:

| Berkas | Yang ditambahkan |
|---|---|
| `lib/app_variant.dart` | `isApotik = kode == 'apotik'`, nama, logo, `updateAssetKeyword` |
| `lib/product_profile.dart` | `AppProductProfile.apotik()` + `FiturGrup.apotik` |
| `lib/main_apotik.dart` | entrypoint yang memanggil `bootstrap(AppProductProfile.apotik())` |
| `windows/variant.cmake` | varian Windows |
| `assets/images/apotik/` | ikon |

```bash
flutter build windows -t lib/main_apotik.dart --dart-define=EBISNIS_VARIANT=apotik
flutter build apk     -t lib/main_apotik.dart --dart-define=EBISNIS_VARIANT=apotik
```

`cocokDenganDartDefine()` yang sudah ada akan menangkap kombinasi yang salah.

### 3.2 Layar, menurut urutan yang benar

**Fase A — kasir yang dapat dipakai (paling dulu).**
Salin `kasir_screen.dart` sebagai dasar, lalu tambahkan yang membedakan apotek:

- **Tebus resep** — memilih resep, bukan mengetik obat satu per satu.
- **Batch dan kedaluwarsa** — kasir memilih batch, dan yang paling dekat kedaluwarsa
  didahulukan. Obat kedaluwarsa **tidak boleh dapat dijual sama sekali**; peringatan
  saja tidak cukup.
- **Obat terkendali** — narkotika dan psikotropika menuntut catatan tambahan.
  Bila tidak dapat dicatat, transaksinya **ditahan**, bukan dilanjutkan diam-diam.
- **Obat mirip (LASA)** — nama yang mirip ditampilkan berbeda, bukan berurutan rapi.

**Fase B — persediaan.** Formularium, batch/expiry, pengadaan PBF, stok opname, retur.

**Fase C — laporan.** Laporan apotek, obat terkendali, kedaluwarsa.

### 3.3 Menu digerakkan `Sesi.bolehMenu`

Sudah ada dan sudah benar:

```dart
bool bolehMenu(String kunci) => aksesMenu[kunci] ?? true;
```

> **Perhatikan bawaannya `true`.** Kunci yang hilang dianggap boleh — cocok untuk
> menu lama, **berbahaya untuk menu baru**. Karena itu §2.2(d) menuntut `PosApi`
> mengirim kunci baru secara **eksplisit** bernilai `false`; jangan mengandalkan
> klien untuk menutupnya sendiri.
>
> Bila ingin lebih aman, ubah menjadi daftar putih untuk kunci berawalan `apotik_`
> dan `emedik_` — tetapi ubah **satu tempat itu saja**, dan tulis alasannya.

Dan jangan lupa apa yang sudah tertulis di `sesi.dart`: ini **murni UX**. Gerbang yang
sebenarnya tetap ditegakkan peladen pada tiap aksi.

---

## 4. Pekerjaan Java yang menyertainya

POS Apotik menuntut aksi `Api_eBisnis` yang belum ada. Untuk masing-masing:

1. **Periksa dulu apakah SIRS sudah punya**. 191 berkas — kemungkinan besar sudah.
2. Bila sudah, buat aksi API yang **membungkusnya**, jangan menyalin logikanya.
3. Bila belum, tulis di modul SIRS, bukan di `PosApi`.

Aksi yang kemungkinan diperlukan: daftar resep menunggu tebus, detail resep, penyerahan
resep, pencarian obat berikut batch, stok per batch, catat penjualan apotek, catat obat
terkendali, retur obat.

---

## 5. Yang TIDAK boleh dikerjakan

- **Jangan menyunting `C:\opt\AIS`.** Bukan checkout Git. Klon `Zishof/AIS`.
- **Jangan membangun ulang modul SIRS.** Sudah ada 191 berkas.
- **Jangan menyalakan menu baru secara bawaan** untuk role mana pun selain yang
  disebut §2.3.
- **Jangan menyamakan hak apoteker dengan tenaga medis.**
- **Jangan membuat aplikasi Flutter ketiga.** Sudah ada dua; tambah **varian**.
- **Jangan menyentuh kunci menu lama** (`kasir`, `produk`, dst.) — bawaannya `true`
  dan role lama bergantung padanya.
- **Jangan menganggap eMedik NestJS dan SIRS Java berbagi data.** Tidak.

---

## 6. Bagaimana mengetahui pekerjaannya benar

| Yang dibuktikan | Caranya |
|---|---|
| Menu tidak bocor | buka role POS lama di layar Grup Pengguna; seluruh menu baru tidak tercentang |
| Role Apotik menyala | login sebagai role Apotik pada Flutter; menu apotek muncul |
| Klien lama tidak rusak | jalankan APK versi sebelumnya terhadap peladen baru |
| Kedaluwarsa benar-benar menahan | coba jual batch kedaluwarsa — harus **ditolak**, bukan diperingatkan |
| Obat terkendali tercatat | jual satu; pastikan catatannya ada sebelum struk tercetak |
| Varian tidak tertukar | jalankan build dengan `-t` dan `--dart-define` yang tidak cocok; `cocokDenganDartDefine()` harus berteriak |

Yang terakhir bukan formalitas: build yang varian dan entrypoint-nya tidak cocok
menghasilkan aplikasi yang **tampak benar** dan berperilaku seperti varian lain.

---

## 7. Bila yang dipilih ternyata jalan 2 atau 3

**Jalan 2 (semua NestJS):** abaikan §2 dan §4 seluruhnya. Lanjutkan
`eBisnis/apps/pos-flutter`; menunya diatur `demo.menu` + `role_menu_permission`, dan
polanya ada pada migrasi `H0NN__health__menu_truth_*.sql`. Vertikal eMedik V12 sudah
menyediakan resep, eMAR, dan dispensing — lihat `docs/emedik/`.

**Jalan 3 (cangkang zishof + backend NestJS):** §2 tetap berlaku hanya bila menunya
tetap diatur dari AIS. Bila tidak, `ApiClient` harus menumbuhkan lapisan kedua, dan
**itu harus dinyatakan terang-terangan** di `product_profile.dart` — satu profil, satu
backend, tanpa kecuali.

---

## 8. Rujukan

| Berkas | Isinya |
|---|---|
| `docs/emedik/22-aturan-tetap.md` | larangan yang berlaku di seluruh vertikal kesehatan |
| `docs/emedik/25-uat-persona.md` | pemisahan wewenang 43 peran kesehatan — **layak ditiru sisi Java** |
| `docs/emedik/26-alur-pasien-dan-e2e.md` | alur pendaftaran → klaim, dan uji peramban |
| `zishof-platform/docs/pos-inventory-sales/` | preseden varian `inventory_sales` |
| `ais/common/EbisnisMenuKatalog.java` | katalog menu — JavaDoc-nya menjelaskan sebab tiap keputusan |
