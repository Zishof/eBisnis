# D-0 · Kontrak Kesehatan, Koperasi, dan POS

Perintah §3 menutup bagian anti-bentroknya dengan:
*"Untuk Posyandu gunakan public health contract. Untuk koperasi desa gunakan
public cooperative contract. Jangan menyalin modul tersebut ke village."*

Dokumen ini menetapkan bentuk kontraknya.

---

## Keadaan hari ini

Ketiga mitra kontrak ini **belum ada**:

| Mitra | Keadaan | Akibatnya bagi village |
|---|---|---|
| eMedik | Cabang `feature/v12-emedik` belum dibuat | Kontrak ditulis village, disepakati kemudian |
| eKoperasi | Cabang `feature/v12-ekoperasi` belum dibuat | Sama |
| POS Core | Sedang dikerjakan pada `feature/pos-web-priority`, belum masuk `main` | Adapter menunggu; BUMDes tetap dapat berjalan tanpanya |

Karena itu village **mendefinisikan sisi konsumennya lebih dahulu** — antarmuka
di `modules/village/ports/` beserta adapter tiruan (*stub*) yang mengembalikan
"belum tersedia" secara jujur. Dua akibat yang disengaja:

1. D-8 dan D-12 dapat dikerjakan dan diuji tanpa menunggu vertikal lain.
2. Ketika mitranya siap, yang berubah hanya isi adapter — bukan layanan
   village.

Adapter tiruan **tidak boleh mengembalikan data karangan.** Ia mengembalikan
keadaan "tidak tersedia" yang ditangani antarmuka dengan jujur. Data karangan
pada kontrak yang belum ada adalah cara tercepat membuat fitur tampak jadi
padahal belum.

---

## 1. `HealthAggregatePort` — eMedik

Kontrak paling berhati-hati di antara ketiganya, karena menyangkut data
kesehatan perorangan.

### Yang boleh diminta

```ts
export interface HealthAggregatePort {
  /** Jadwal Posyandu pada wilayah desa. Tidak memuat identitas peserta. */
  posyanduSchedule(input: {
    villageUnitId: string;
    from: string;
    to: string;
  }): Promise<PosyanduScheduleView[]>;

  /**
   * Indikator kesehatan tingkat wilayah.
   *
   * SELALU agregat. Bila cacahnya di bawah ambang minimum penyajian, nilainya
   * dikembalikan sebagai `null` disertai `suppressed: true` — bukan sebagai
   * angka kecil yang dapat dibongkar menjadi orang tertentu.
   */
  aggregateIndicators(input: {
    villageUnitId: string;
    period: string;
    breakdown?: 'HAMLET' | 'RW' | 'NONE';
  }): Promise<HealthIndicatorView[]>;

  /** Sasaran kegiatan: jumlah, bukan daftar nama. */
  targetPopulationCount(input: {
    villageUnitId: string;
    programCode: string;
  }): Promise<{ total: number; reached: number }>;

  /** Kampanye kesehatan yang perlu ditayangkan pada situs desa. */
  activeCampaigns(villageUnitId: string): Promise<HealthCampaignView[]>;
}
```

### Yang tidak boleh diminta, dan tidak disediakan antarmukanya

```
rekam medis perorangan
diagnosis
riwayat kunjungan seseorang
hasil pemeriksaan
resep
daftar nama pasien
```

Larangan ini ditegakkan dengan **tidak menyediakan metodenya**. Antarmuka yang
tidak punya metode tidak dapat dipanggil, dan itu jauh lebih kuat daripada
metode yang ada tetapi diberi pemeriksaan izin.

### Satu pengecualian, dan syaratnya

Ada satu keadaan sah ketika desa memerlukan data kesehatan perorangan:
**pendataan penerima bantuan yang syaratnya kondisi kesehatan** — misalnya
bantuan bagi penyandang disabilitas atau ibu hamil berisiko.

Bahkan itu **tidak dilayani lewat port ini.** Jalurnya:

1. Warga menyerahkan sendiri surat keterangan dari fasilitas kesehatan;
2. Diunggah sebagai berkas persyaratan pada permohonan bantuan;
3. Diverifikasi manusia.

Yaitu: datanya datang dari **warga**, bukan dari sistem kesehatan. Ini bukan
kerumitan yang tidak perlu — ini yang membedakan warga menyerahkan datanya
sendiri untuk keperluan yang ia ketahui, dari pemerintah desa mengambil data
kesehatan warganya tanpa ia tahu.

---

## 2. `CooperativeIntegrationPort` — eKoperasi

```ts
export interface CooperativeIntegrationPort {
  /** Koperasi yang beroperasi di wilayah desa. */
  cooperativesInVillage(villageUnitId: string): Promise<CooperativeSummaryView[]>;

  /** Ringkasan keanggotaan tingkat desa — jumlah, bukan daftar nama. */
  membershipSummary(input: {
    villageUnitId: string;
    period: string;
  }): Promise<{ memberCount: number; activeCount: number; newThisPeriod: number }>;

  /**
   * Apakah seorang penduduk anggota koperasi tertentu.
   *
   * Dipakai saat penduduk mendaftar sebagai penerima bantuan modal usaha, agar
   * bantuan yang sama tidak diterima dua kali dari dua jalur. Mengembalikan
   * BOOLEAN, bukan data keanggotaannya — pertanyaannya "apakah", bukan "apa".
   */
  isMember(input: {
    residentNationalId: string;
    cooperativeId: string;
    purpose: 'AID_DUPLICATE_CHECK';
  }): Promise<{ isMember: boolean; checkedAt: string }>;

  /** Kinerja koperasi yang layak tayang pada situs desa. */
  publicPerformance(cooperativeId: string): Promise<CooperativePublicView | null>;
}
```

`isMember` sengaja menuntut `purpose`. Alasannya: parameter itu masuk ke jejak
audit di kedua sisi. Pemeriksaan yang dilakukan tanpa keperluan yang dinyatakan
adalah pemeriksaan yang tidak dapat dipertanggungjawabkan kemudian.

Yang **tidak** disediakan: saldo simpanan, riwayat pinjaman, tunggakan. Desa
tidak berkepentingan mengetahuinya, dan kepentingan yang tidak ada tidak boleh
diberi jalan.

---

## 3. `PosIntegrationPort` — Core POS

Untuk unit usaha BUMDes yang berjualan.

```ts
export interface PosIntegrationPort {
  /** Ringkasan penjualan satu unit usaha BUMDes. */
  salesSummary(input: {
    outletId: string;
    from: string;
    to: string;
  }): Promise<{ transactionCount: number; grossSales: string; currency: string }>;

  /** Produk terlaris, untuk laporan BUMDes. */
  topProducts(input: { outletId: string; period: string; limit: number }): Promise<ProductSalesView[]>;

  /** Menautkan unit usaha BUMDes ke outlet POS. */
  linkBusinessUnit(input: {
    bumdesUnitId: string;
    outletId: string;
  }): Promise<{ linked: boolean }>;
}
```

Village **tidak** memanggil penjualan, tidak membuka shift, tidak menyentuh
stok. BUMDes yang berjualan memakai POS sebagaimana penyewa lain; village hanya
membaca ringkasannya untuk laporan dan transparansi.

Perintah §3 melarang mengubah perilaku POS. Port ini hanya membaca, sehingga
larangannya terpenuhi dengan sendirinya.

---

## 4. Marketplace — kontrak listing publik

Produk UMKM desa dapat tampil pada marketplace. Village **tidak** membuat
listing; ia menautkan profil usaha ke listing yang dibuat pelaku usahanya
sendiri lewat jalur marketplace yang sudah ada.

Alasannya bukan teknis: produk yang didaftarkan pemerintah desa atas nama warga
menimbulkan pertanyaan siapa yang bertanggung jawab bila produknya bermasalah.

---

## Ringkasan larangan

| Larangan | Ditegakkan dengan |
|---|---|
| Desa membaca rekam medis | Metodenya tidak ada pada antarmuka |
| Desa membaca simpanan/pinjaman warga | Metodenya tidak ada |
| Desa mengubah perilaku POS | Port hanya membaca |
| Village menyalin modul koperasi/kesehatan | Tidak ada tabel koperasi/kesehatan pada `modules/village/` |
| Akses tabel langsung antar vertikal | Uji ketergantungan pada D-12 |

Uji terakhir layak dijelaskan: D-12 memuat pengujian yang memindai
`modules/village/` untuk impor dari `modules/health/`, `modules/cooperative/`,
dan akses SQL ke tabel di luar awalan village. Aturan yang hanya tertulis di
dokumen akan dilanggar suatu hari oleh orang yang belum pernah membacanya.
