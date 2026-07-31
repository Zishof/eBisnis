# IR-003 · Katalog peristiwa akuntansi modular

**Dari:** sesi eKoperasi (`feature/v12-ekoperasi`)
**Kepada:** sesi Core / Integrator
**Tanggal:** 31 Juli 2026
**Sifat:** Pemblokir bagi K-3 dan seterusnya (jurnal simpanan, pinjaman, SHU)
**Berkas bersama:** `apps/api/src/modules/accounting/posting-engine.ts`

---

## Kebutuhan

Koperasi memerlukan **25+ kode peristiwa akuntansi** `COOPERATIVE_*` — simpanan,
pinjaman, akad syariah, SHU, dompet, unit usaha. Rinciannya pada
[04-accounting-contract.md](../../ekoperasi/04-accounting-contract.md).

## Keadaan sekarang

`posting-engine.ts` menyimpan kodenya sebagai konstanta di dalam berkas:

```ts
export const MARKETPLACE_EVENTS = [ /* 12 kode */ ] as const;
export const POS_EVENTS = [ /* 12 kode */ ] as const;
export const ALL_EVENTS = [...MARKETPLACE_EVENTS, ...POS_EVENTS] as const;

export const REQUIRED_AMOUNTS: Record<KnownEventCode, string[]> = { /* ... */ };
```

Menambahkan `COOPERATIVE_EVENTS` berarti menyunting berkas milik Core —
dilarang perintah eKoperasi §3. Dan bila eMedik serta info-desa melakukan hal
yang sama, tiga vertikal menyunting satu berkas dan satu `Record`.

## Yang membuat mesin ini bagus, dan harus dipertahankan

`posting-engine.spec.ts` memaksa setiap kode punya aturan posting dan daftar
nilai wajib:

```ts
it('mendefinisikan nilai wajib untuk setiap peristiwa', () => {
  const tanpaDefinisi = ALL_EVENTS.filter(
    (e) => !REQUIRED_AMOUNTS[e] || REQUIRED_AMOUNTS[e].length === 0,
  );
  expect(tanpaDefinisi).toEqual([]);
});
```

Kode yang ditambahkan tanpa aturan **menggagalkan pengujian**, bukan diam-diam
menghasilkan jurnal kosong. Sifat itu harus tetap berlaku sesudah perubahan ini
— justru itulah yang membuat usulan di bawah aman.

## Kontrak yang diusulkan

Registri katalog, mengikuti bentuk yang sama dengan registri katalog menu yang
sudah dianjurkan panduan §9:

```ts
// apps/api/src/modules/accounting/event-catalog.registry.ts  (Core, baru)

export interface AccountingEventCatalog {
  /** Awalan kode; dipakai memeriksa tabrakan antar modul. */
  readonly prefix: string;
  readonly events: readonly string[];
  readonly requiredAmounts: Readonly<Record<string, readonly string[]>>;
}

@Injectable()
export class AccountingEventCatalogRegistry {
  register(catalog: AccountingEventCatalog): void;
  allEvents(): readonly string[];
  requiredAmounts(code: string): readonly string[] | undefined;
  isKnown(code: string): boolean;
}
```

`MARKETPLACE_EVENTS` dan `POS_EVENTS` menjadi dua katalog yang didaftarkan Core
sendiri, sehingga tidak ada perlakuan istimewa bagi kode inti.

Modul mendaftarkan katalognya:

```ts
// modules/cooperative/accounting/cooperative-events.catalog.ts  (koperasi)
export const COOPERATIVE_EVENT_CATALOG: AccountingEventCatalog = {
  prefix: 'COOPERATIVE_',
  events: [...],
  requiredAmounts: {...},
};
```

## Aturan yang harus ditegakkan registri

Tiga, dan ketiganya menutup jalan yang pernah menghasilkan cacat nyata:

1. **Awalan tidak boleh bertabrakan.** Dua katalog dengan `prefix` sama ditolak
   saat pendaftaran.
2. **Setiap kode wajib berawalan katalognya.** Katalog koperasi tidak boleh
   mendaftarkan `POS_SALE`.
3. **Setiap kode wajib punya `requiredAmounts` tidak kosong.** Sifat yang dijaga
   `posting-engine.spec.ts` sekarang, dipindahkan ke registri sehingga berlaku
   bagi setiap modul tanpa masing-masing perlu menulis ujinya.

## Kompatibilitas mundur

Penuh, bila `ALL_EVENTS` dan `REQUIRED_AMOUNTS` dipertahankan sebagai bentuk
turunan dari registri:

```ts
export const ALL_EVENTS = registry.allEvents();
```

Pemanggil yang sudah ada tidak berubah. Uji `posting-engine.spec.ts` yang ada
tetap lulus tanpa disunting — dan itu pemeriksaan terbaik bahwa perubahan ini
tidak merusak apa pun.

## Migrasi data

Tidak ada. `accounting_event.event_code` sudah bertipe teks bebas;
`accounting_posting_rule` sudah memetakan per kode.

## Pengujian yang diusulkan

```
katalog marketplace dan POS terdaftar; ALL_EVENTS sama persis dengan sekarang
dua katalog berawalan sama ditolak saat pendaftaran
kode yang tidak berawalan katalognya ditolak
kode tanpa requiredAmounts ditolak
isKnown mengenali kode dari seluruh katalog terdaftar
checkRequiredAmounts bekerja lintas katalog
peristiwa dengan kode tak dikenal tetap ditolak
```

## Sementara menunggu

Katalog koperasi ditulis penuh di
`modules/cooperative/accounting/cooperative-events.catalog.ts` beserta
pengujiannya sendiri — termasuk uji kelengkapan yang menirukan uji Core. Adapter
akuntansi koperasi memvalidasi terhadap katalog itu sebelum menerbitkan
peristiwa.

Yang tertunda hanyalah **pendaftarannya ke mesin Core**, bukan perancangan
maupun pengujiannya. Begitu IR ini disetujui, yang diperlukan hanya satu baris
`registry.register(COOPERATIVE_EVENT_CATALOG)`.

Konsekuensinya jujur: sampai itu terjadi, peristiwa koperasi tercatat pada
`accounting_event` tetapi **belum dijurnal** mesin Core, karena `isKnownEvent()`
menolaknya. Simpanan dan pinjaman tetap tercatat pada buku pembantu anggota; yang
belum terbentuk adalah jurnal buku besarnya. Ini disebutkan pada dokumen K-3
supaya tidak ada yang mengira pembukuan sudah lengkap.
