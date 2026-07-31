/**
 * Registri katalog peristiwa akuntansi per modul.
 *
 * Menjawab [IR-003](../../../../../docs/integration-requests/cooperative/003-katalog-peristiwa-akuntansi-modular.md).
 *
 * ## Persoalan yang diselesaikan
 *
 * `ALL_EVENTS` dan `REQUIRED_AMOUNTS` pada `posting-engine.ts` adalah dua
 * konstanta tertutup. Peristiwa yang tidak ada di sana ditolak `isKnownEvent()`,
 * sehingga vertikal mana pun yang hendak menjurnal harus menyunting mesin
 * akuntansi bersama — persis berkas yang panduan koordinasi §3 larang disentuh.
 *
 * Akibatnya nyata dan sudah terjadi: modul koperasi menulis 26 peristiwa
 * `COOPERATIVE_*` lengkap dengan nilai wajib dan pemetaan akunnya, tetapi tidak
 * satu pun dapat dijurnal. Buku pembantu anggotanya berjalan; buku besarnya
 * tidak. Neraca koperasi karena itu belum lengkap.
 *
 * ## Bentuknya
 *
 * Sama dengan `VerticalCatalogRegistry`: satu pola registri untuk seluruh
 * kebutuhan modular, supaya yang perlu dipahami hanya satu.
 *
 * Peristiwa inti — marketplace dan kasir — didaftarkan lewat pintu yang sama.
 * Bila inti istimewa, jalur inti dan jalur modul akan berbeda perilakunya, dan
 * yang jarang dipakai akan membusuk tanpa ada yang tahu.
 */

import { Injectable } from '@nestjs/common';

export interface AccountingEventCatalog {
  /** Kode modul: `core`, `cooperative`, `health`, `village`. */
  readonly module: string;
  /**
   * Awalan kode peristiwa milik katalog ini.
   *
   * Katalog inti mendaftarkan dua awalan lewat dua katalog terpisah
   * (`MARKETPLACE_` dan `POS_`), sebab keduanya memang dua kelompok peristiwa
   * yang berbeda dan dapat dimatikan sendiri-sendiri.
   */
  readonly prefix: string;
  readonly events: readonly string[];
  /** Nilai yang wajib dibawa tiap peristiwa. */
  readonly requiredAmounts: Readonly<Record<string, readonly string[]>>;
  /**
   * Kode pemetaan akun yang dituntut tiap peristiwa.
   *
   * Boleh kosong pada katalog inti, yang pemetaannya sudah tertanam pada
   * aturan posting. Modul yang menyertakannya memperoleh pemeriksaan tambahan:
   * peristiwa tidak dapat diterbitkan bila pemetaan akunnya belum diisi
   * penyewa — dan galat "akun belum dipetakan" jauh lebih mudah dipahami
   * daripada jurnal yang diam-diam tidak seimbang.
   */
  readonly requiredMappings?: Readonly<Record<string, readonly string[]>>;
}

export class AccountingEventCatalogError extends Error {}

@Injectable()
export class AccountingEventCatalogRegistry {
  private readonly catalogs = new Map<string, AccountingEventCatalog>();
  /** Peta datar, disusun ulang setiap pendaftaran. Pembacaan jauh lebih sering. */
  private byEvent = new Map<string, AccountingEventCatalog>();

  register(catalog: AccountingEventCatalog): void {
    const kunci = `${catalog.module}:${catalog.prefix}`;
    if (this.catalogs.has(kunci)) {
      throw new AccountingEventCatalogError(
        `Katalog "${kunci}" sudah terdaftar. Pendaftaran ganda akan menimpa yang pertama ` +
          'tanpa galat.',
      );
    }

    for (const event of catalog.events) {
      if (!event.startsWith(catalog.prefix)) {
        throw new AccountingEventCatalogError(
          `Peristiwa "${event}" pada katalog "${kunci}" tidak berawalan "${catalog.prefix}". ` +
            'Modul tidak boleh mendaftarkan peristiwa milik modul lain — jurnalnya akan ' +
            'terbentuk dengan aturan posting yang bukan miliknya.',
        );
      }

      const pemilik = this.byEvent.get(event);
      if (pemilik) {
        throw new AccountingEventCatalogError(
          `Peristiwa "${event}" sudah didaftarkan modul "${pemilik.module}"; ` +
            `"${catalog.module}" mendaftarkannya lagi.`,
        );
      }

      /*
       * Peristiwa tanpa daftar nilai wajib akan lolos pemeriksaan kelengkapan
       * apa pun isinya. Peristiwa keuangan yang tidak diperiksa nilainya
       * menghasilkan jurnal yang tidak seimbang — dan ketidakseimbangan baru
       * terlihat saat neraca disusun, berbulan-bulan kemudian.
       */
      if (!catalog.requiredAmounts[event]) {
        throw new AccountingEventCatalogError(
          `Peristiwa "${event}" tidak menyebutkan nilai wajibnya. Peristiwa keuangan yang ` +
            'tidak diperiksa kelengkapannya menghasilkan jurnal yang tidak seimbang, dan ' +
            'ketidakseimbangan itu baru terlihat saat neraca disusun.',
        );
      }
    }

    for (const event of Object.keys(catalog.requiredAmounts)) {
      if (!catalog.events.includes(event)) {
        throw new AccountingEventCatalogError(
          `Katalog "${kunci}" menyebutkan nilai wajib bagi "${event}", tetapi peristiwa itu ` +
            'tidak ada pada daftar peristiwanya. Kemungkinan besar salah ketik, dan ' +
            'pemeriksaannya tidak akan pernah berjalan.',
        );
      }
    }

    this.catalogs.set(kunci, catalog);
    for (const event of catalog.events) this.byEvent.set(event, catalog);
  }

  isKnownEvent(code: string): boolean {
    return this.byEvent.has(code);
  }

  moduleOf(code: string): string | undefined {
    return this.byEvent.get(code)?.module;
  }

  requiredAmountsOf(code: string): readonly string[] | undefined {
    return this.byEvent.get(code)?.requiredAmounts[code];
  }

  requiredMappingsOf(code: string): readonly string[] | undefined {
    return this.byEvent.get(code)?.requiredMappings?.[code];
  }

  /** Memeriksa kelengkapan nilai sebuah peristiwa sebelum diterbitkan. */
  checkRequiredAmounts(
    eventCode: string,
    amounts: Record<string, unknown>,
  ): { ok: boolean; missing: string[] } {
    const wajib = this.requiredAmountsOf(eventCode);
    if (!wajib) {
      return { ok: false, missing: [`(peristiwa "${eventCode}" tidak dikenal katalog mana pun)`] };
    }
    const missing = wajib.filter((k) => amounts[k] === undefined || amounts[k] === null);
    return { ok: missing.length === 0, missing };
  }

  allEvents(): string[] {
    return [...this.byEvent.keys()].sort();
  }

  eventsOfModule(module: string): string[] {
    return [...this.byEvent.entries()]
      .filter(([, c]) => c.module === module)
      .map(([e]) => e)
      .sort();
  }

  registeredCatalogs(): string[] {
    return [...this.catalogs.keys()];
  }

  /** Hanya untuk pengujian. */
  reset(): void {
    this.catalogs.clear();
    this.byEvent = new Map();
  }
}
