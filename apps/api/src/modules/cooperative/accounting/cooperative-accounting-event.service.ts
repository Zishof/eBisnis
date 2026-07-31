/**
 * Penerbit peristiwa akuntansi koperasi.
 *
 * Inilah yang selama ini hilang. Katalognya sudah lengkap sejak K-8 — 26 kode
 * beserta nilai wajib dan pemetaan akunnya — tetapi tidak ada yang
 * menerbitkannya, sehingga tidak satu pun baris `accounting_event` pernah
 * terbentuk dari modul koperasi.
 *
 * ## Yang diperiksa sebelum menerbitkan
 *
 * Setiap peristiwa diperiksa terhadap katalog **sebelum** ditulis:
 *
 *   · kodenya dikenal katalog koperasi;
 *   · seluruh nilai wajibnya ada.
 *
 * Diperiksa saat diterbitkan, bukan saat dijurnal. Peristiwa yang kurang
 * nilainya akan gagal saat dijurnal — berhari-hari kemudian, oleh pekerja
 * yang tidak tahu apa-apa tentang transaksi yang melahirkannya. Menolaknya di
 * sini berarti menolaknya ketika konteksnya masih ada dan orangnya masih di
 * depan layar.
 *
 * ## Yang TIDAK dikerjakan berkas ini
 *
 * Menjurnal. Peristiwa terbit berstatus `PENDING` dan menunggu saluran
 * peristiwa-ke-jurnal yang belum dibangun untuk modul mana pun — bukan untuk
 * POS, bukan untuk koperasi. Lihat catatan pada `cooperative-events.catalog.ts`.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AccountingEventCatalogRegistry } from '../../accounting/event-catalog.registry';
import { AppError, ErrorCodes } from '../../../common/errors/app-error';
import { COOPERATIVE_EVENT_CATALOG } from './cooperative-events.catalog';

/** Klien transaksi yang sedang berjalan; peristiwa selalu terbit di dalamnya. */
export interface KlienTransaksi {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface PeristiwaKoperasi {
  eventCode: string;
  /** Jenis sumber, mis. `COOPERATIVE_SAVING` atau `COOPERATIVE_LOAN`. */
  sourceType: string;
  sourceId: string;
  sourceNumber?: string | null;
  amounts: Record<string, unknown>;
  currency?: string;
  userId?: string | null;
}

@Injectable()
export class CooperativeAccountingEventService {
  private readonly logger = new Logger(CooperativeAccountingEventService.name);

  constructor(private readonly katalog: AccountingEventCatalogRegistry) {}

  /**
   * Menerbitkan satu peristiwa, di dalam transaksi pemanggilnya.
   *
   * Menerima klien transaksi, bukan membuka transaksinya sendiri. Peristiwa
   * akuntansi yang terbit di luar transaksi yang melahirkannya dapat bertahan
   * meski transaksinya digulung balik — dan yang tersisa adalah catatan
   * keuangan atas kejadian yang tidak pernah terjadi.
   */
  async terbitkan(
    client: KlienTransaksi,
    schemaName: string,
    peristiwa: PeristiwaKoperasi,
  ): Promise<void> {
    this.periksa(peristiwa);

    /*
     * Kunci idempotensi disusun dari kode, jenis sumber, dan id sumbernya.
     * Bentuk yang sama dipakai POS. Satu sumber hanya melahirkan satu
     * peristiwa berkode itu, sehingga percobaan ulang — karena jaringan putus
     * atau pekerja yang menjalankan ulang — tidak menggandakan angkanya.
     */
    const idempotencyKey = `${peristiwa.eventCode}:${peristiwa.sourceType}:${peristiwa.sourceId}`;

    await client.query(
      `INSERT INTO "${schemaName}".accounting_event
         (event_code, source_type, source_id, source_number, occurred_at, amounts,
          currency_code, status, idempotency_key, created_by)
       VALUES ($1, $2, $3, $4, now(), $5, $6, 'PENDING', $7, $8)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        peristiwa.eventCode,
        peristiwa.sourceType,
        peristiwa.sourceId,
        peristiwa.sourceNumber ?? null,
        JSON.stringify(peristiwa.amounts),
        peristiwa.currency ?? 'IDR',
        idempotencyKey,
        peristiwa.userId ?? null,
      ],
    );
  }

  /** Menerbitkan beberapa peristiwa sekaligus; seluruhnya diperiksa lebih dahulu. */
  async terbitkanBanyak(
    client: KlienTransaksi,
    schemaName: string,
    daftar: PeristiwaKoperasi[],
  ): Promise<void> {
    /*
     * Seluruhnya diperiksa SEBELUM satu pun ditulis. Menerbitkan tiga
     * peristiwa lalu gagal pada yang keempat meninggalkan pembukuan separuh
     * jadi — dan meskipun transaksinya digulung balik, pesan galatnya menjadi
     * jauh lebih sulit ditelusuri daripada penolakan di depan.
     */
    for (const p of daftar) this.periksa(p);
    for (const p of daftar) await this.terbitkan(client, schemaName, p);
  }

  private periksa(p: PeristiwaKoperasi): void {
    if (!p.eventCode.startsWith(COOPERATIVE_EVENT_CATALOG.prefix)) {
      /*
       * Modul koperasi hanya menerbitkan peristiwanya sendiri. Menerbitkan
       * `POS_SALE` dari sini akan menjurnal penjualan dua kali — sekali oleh
       * kasir, sekali oleh koperasi — dan pendapatannya tercatat ganda.
       */
      throw AppError.internal(
        ErrorCodes.INTERNAL_ERROR,
        `Modul koperasi tidak boleh menerbitkan peristiwa "${p.eventCode}"; ` +
          `hanya yang berawalan ${COOPERATIVE_EVENT_CATALOG.prefix}.`,
      );
    }

    if (!this.katalog.isKnownEvent(p.eventCode)) {
      throw AppError.internal(
        ErrorCodes.INTERNAL_ERROR,
        `Peristiwa "${p.eventCode}" tidak dikenal katalog mana pun. ` +
          'Kemungkinan besar salah ketik, dan peristiwa yang tidak dikenal tidak akan pernah ' +
          'dijurnal — ia hanya menumpuk sebagai PENDING tanpa ada yang menyadarinya.',
      );
    }

    const lengkap = this.katalog.checkRequiredAmounts(p.eventCode, p.amounts);
    if (!lengkap.ok) {
      throw AppError.internal(
        ErrorCodes.INTERNAL_ERROR,
        `Peristiwa "${p.eventCode}" kurang nilai: ${lengkap.missing.join(', ')}. ` +
          'Ditolak saat diterbitkan, ketika konteksnya masih ada — bukan saat dijurnal, ' +
          'berhari-hari kemudian.',
      );
    }
  }

  /**
   * Pemetaan akun yang dituntut sebuah peristiwa.
   *
   * Dipakai layar pengaturan untuk menunjukkan pemetaan mana yang belum diisi
   * penyewa. Peristiwa yang pemetaannya belum lengkap tetap terbit — ia baru
   * gagal saat dijurnal, dan menahannya di sini akan menghentikan transaksi
   * koperasi hanya karena pengaturan akuntansinya belum selesai.
   */
  pemetaanDituntut(eventCode: string): readonly string[] {
    return this.katalog.requiredMappingsOf(eventCode) ?? [];
  }
}
