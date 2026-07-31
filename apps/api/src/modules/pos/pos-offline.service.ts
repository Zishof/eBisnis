/**
 * Penerimaan transaksi luring dan pembagian jatah nomor struk.
 *
 * ## Mengapa layanan ini tidak membuat penjualan sendiri
 *
 * Godaan terbesarnya adalah menulis jalur pembuatan penjualan kedua di sini —
 * satu `INSERT` besar yang langsung membentuk `pos_sale` beserta barisnya, tanpa
 * melewati keranjang. Jalurnya akan lebih pendek dan lebih mudah dibaca.
 *
 * Dan ia akan menyimpang. Penjualan menyangkut kuotasi harga, pemesanan stok,
 * pemotongan persediaan, peristiwa akuntansi, penomoran struk, dan jejak audit.
 * Setiap kali salah satunya berubah, orang yang mengubahnya akan memperbaiki
 * jalur keranjang — yang terlihat — dan melupakan jalur luring yang tersembunyi
 * di modul lain. Perbedaannya lalu muncul sebagai transaksi luring yang
 * membukukan jurnal berbeda dari transaksi daring yang isinya sama.
 *
 * Karena itu penerimaan luring **memutar ulang** transaksi lewat jalur yang
 * sama persis: buka keranjang, masukkan barang, catat pembayaran, selesaikan.
 * Satu-satunya perbedaan adalah nomor struk, yang dibawa dari jatah karena
 * kertasnya sudah tercetak.
 *
 * ## Mengapa keranjang dibuat sebelum diputuskan
 *
 * Untuk tahu apakah peladen sepakat dengan harga pada struk, peladen harus
 * menghitungnya — dan satu-satunya cara menghitungnya sebagaimana ia akan
 * menghitung transaksi sungguhan adalah dengan benar-benar membuat
 * keranjangnya. Bila hasilnya berbeda, keranjang itu dibatalkan (yang juga
 * melepaskan pemesanan stoknya) dan transaksinya ditahan.
 *
 * Keranjang yang sempat ada dan dibatalkan meninggalkan jejak, dan itu justru
 * yang diinginkan: pertanyaan "mengapa transaksi ini ditahan" punya jawaban yang
 * dapat ditelusuri, bukan hanya angka pada baris karantina.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/decorators';
import { PosCatalogService } from './pos-catalog.service';
import { PosSaleService } from './pos-sale.service';
import {
  putuskan,
  rentangJatah,
  type KeadaanServer,
  type TransaksiLuringMasuk,
} from './pos-offline';

export interface JatahStruk {
  blockId: string;
  outletId: string;
  terminalId: string;
  prefix: string;
  padding: number;
  fromNumber: number;
  toNumber: number;
  nextNumber: number;
  businessDate: string | null;
  allocatedAt: string;
}

/**
 * Bentuk keranjang sebagaimana dikembalikan `PosSaleService`.
 *
 * Metode itu menyusun jawabannya dengan menyebar baris basis data
 * (`{ ...kepala[0], lines }`), sehingga tipe yang disimpulkan TypeScript hanya
 * menyisakan `lines`. Dibaca lewat tipe ini alih-alih menambah anotasi pada
 * layanan penjualan: mengubah tanda tangannya akan menyentuh seluruh jalur
 * kasir demi kenyamanan satu pemanggil.
 */
type KeranjangServer = Record<string, unknown> & { lines: Record<string, unknown>[] };

export interface HasilPenerimaan {
  offlineId: string;
  status: 'BOOKED' | 'QUARANTINED' | 'DUPLICATE';
  saleId: string | null;
  receiptNumber: string | null;
  reasonCode: string | null;
  reason: string | null;
  localTotal: string | null;
  serverTotal: string | null;
}

@Injectable()
export class PosOfflineService {
  private readonly logger = new Logger(PosOfflineService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly katalog: PosCatalogService,
    private readonly penjualan: PosSaleService,
  ) {}

  // --- Saklar dan setelan --------------------------------------------------

  private async setelanLuring(schemaName: string): Promise<{
    enabled: boolean;
    blockSize: number;
    maxAgeHours: number;
  }> {
    const rows = await this.tenantDb.query<{ code: string; value_json: unknown }>(
      schemaName,
      `SELECT code, value_json FROM "${schemaName}".app_setting
        WHERE code IN ('POS_OFFLINE_SALE_ENABLED','POS_OFFLINE_RECEIPT_BLOCK_SIZE','POS_OFFLINE_MAX_AGE_HOURS')
          AND deleted_at IS NULL`,
    );
    const peta = new Map<string, unknown>();
    for (const r of rows) peta.set(r.code, (r.value_json as { value?: unknown } | null)?.value);
    const angka = (k: string, bawaan: number) => {
      const v = Number(peta.get(k));
      return Number.isFinite(v) && v > 0 ? v : bawaan;
    };
    return {
      // Hanya `true` yang menyalakan. Setelan yang hilang, salah ketik, atau
      // bernilai string "false" semuanya berarti mati — saklar yang menyala
      // karena nilainya tidak terbaca adalah saklar yang salah arah.
      enabled: peta.get('POS_OFFLINE_SALE_ENABLED') === true,
      blockSize: angka('POS_OFFLINE_RECEIPT_BLOCK_SIZE', 200),
      maxAgeHours: angka('POS_OFFLINE_MAX_AGE_HOURS', 72),
    };
  }

  private async pastikanMenyala(schemaName: string): Promise<{
    blockSize: number;
    maxAgeHours: number;
  }> {
    const s = await this.setelanLuring(schemaName);
    if (!s.enabled) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Penjualan luring belum diaktifkan untuk tenant ini. Aktifkan setelan ' +
          'POS_OFFLINE_SALE_ENABLED setelah kebijakan stok, jatah nomor struk, dan penanganan ' +
          'selisih harga disepakati.',
      );
    }
    return s;
  }

  // --- Jatah nomor struk ---------------------------------------------------

  /**
   * Memesan jatah nomor struk untuk satu register.
   *
   * Urutan `number_sequence` dimajukan sejauh ukuran jatah dalam transaksi yang
   * sama dengan pembuatan barisnya. Karena barisnya dikunci `FOR UPDATE`, dua
   * register yang meminta jatah bersamaan akan berbaris, bukan mendapat rentang
   * yang bertumpang tindih.
   */
  async alokasikanJatah(
    schemaName: string,
    terminalId: string,
    subjectId: string,
  ): Promise<JatahStruk> {
    const { blockSize } = await this.pastikanMenyala(schemaName);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const term = await client.query<{ outlet_id: string; register_status: string }>(
        `SELECT outlet_id, register_status FROM "${schemaName}".pos_terminal
          WHERE id = $1 AND deleted_at IS NULL`,
        [terminalId],
      );
      if (!term.rows.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Register tidak ditemukan.');
      }
      const outletId = term.rows[0].outlet_id;

      /*
       * Jatah lama register ini dilepaskan lebih dahulu.
       *
       * Indeks `ux_pos_receipt_block_active` hanya mengizinkan satu jatah aktif
       * per register, dan itu memang aturannya: dua jatah aktif berarti mesin
       * kasir dapat memilih, dan pilihan yang salah menerbitkan nomor kembar.
       * Nomor yang belum terpakai pada jatah lama memang hangus — nomor struk
       * tidak perlu dihemat, sedangkan nomor kembar mahal.
       */
      await client.query(
        `UPDATE "${schemaName}".pos_receipt_block
            SET status = 'RELEASED', released_at = now(), released_by = $2,
                updated_at = now(), version = version + 1
          WHERE terminal_id = $1 AND status = 'ACTIVE'`,
        [terminalId, subjectId],
      );

      const seq = await client.query<{
        id: string;
        prefix: string;
        padding: number;
        next_number: string;
      }>(
        `SELECT id, COALESCE(prefix, '') AS prefix, COALESCE(padding, 6) AS padding, next_number::text
           FROM "${schemaName}".number_sequence
          WHERE document_type = 'POS_RECEIPT' AND is_active = TRUE AND deleted_at IS NULL
            AND (scope_id IS NULL OR scope_id = $1)
          ORDER BY scope_id NULLS LAST
          LIMIT 1
          FOR UPDATE`,
        [outletId],
      );
      if (!seq.rows.length) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Outlet ini belum punya urutan nomor struk (POS_RECEIPT). Jatah luring tidak dapat ' +
            'dipesan tanpanya — nomor yang dipesan harus berasal dari urutan yang sama dengan ' +
            'nomor daring, supaya keduanya tidak mungkin bertabrakan.',
        );
      }

      const s = seq.rows[0];
      const rentang = rentangJatah(Number(s.next_number), blockSize);

      await client.query(
        `UPDATE "${schemaName}".number_sequence
            SET next_number = $2, updated_at = now() WHERE id = $1`,
        [s.id, rentang.sequenceSesudah],
      );

      const baris = await client.query<{ id: string; allocated_at: string }>(
        `INSERT INTO "${schemaName}".pos_receipt_block
           (outlet_id, terminal_id, prefix, padding, from_number, to_number, next_number,
            business_date, allocated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $5, CURRENT_DATE, $7)
         RETURNING id, allocated_at::text`,
        [
          outletId,
          terminalId,
          s.prefix,
          Number(s.padding),
          rentang.fromNumber,
          rentang.toNumber,
          subjectId,
        ],
      );

      this.logger.log(
        `Jatah struk ${rentang.fromNumber}-${rentang.toNumber} untuk register ${terminalId}`,
      );

      return {
        blockId: baris.rows[0].id,
        outletId,
        terminalId,
        prefix: s.prefix,
        padding: Number(s.padding),
        fromNumber: rentang.fromNumber,
        toNumber: rentang.toNumber,
        nextNumber: rentang.fromNumber,
        businessDate: null,
        allocatedAt: baris.rows[0].allocated_at,
      };
    });
  }

  /** Jatah aktif milik satu register, bila ada. */
  async jatahAktif(schemaName: string, terminalId: string): Promise<JatahStruk | null> {
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT id, outlet_id, terminal_id, prefix, padding, from_number::text, to_number::text,
              next_number::text, business_date::text, allocated_at::text
         FROM "${schemaName}".pos_receipt_block
        WHERE terminal_id = $1 AND status = 'ACTIVE'`,
      [terminalId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      blockId: r.id,
      outletId: r.outlet_id,
      terminalId: r.terminal_id,
      prefix: r.prefix,
      padding: Number(r.padding),
      fromNumber: Number(r.from_number),
      toNumber: Number(r.to_number),
      nextNumber: Number(r.next_number),
      businessDate: r.business_date ?? null,
      allocatedAt: r.allocated_at,
    };
  }

  // --- Penerimaan transaksi ------------------------------------------------

  /**
   * Menerima satu transaksi luring.
   *
   * Idempoten pada `offlineId`: antrean di mesin kasir memang mengirim ulang
   * sampai jawabannya jelas, dan pengiriman ulang tidak boleh menghasilkan
   * penjualan kedua maupun baris karantina kedua.
   */
  async terima(
    schemaName: string,
    masuk: TransaksiLuringMasuk,
    user: AuthenticatedUser,
    subjectId: string,
  ): Promise<HasilPenerimaan> {
    const { maxAgeHours } = await this.pastikanMenyala(schemaName);

    // 1. Sudah pernah dibukukan? Jawaban yang sama dikembalikan, bukan penjualan kedua.
    const sudah = await this.tenantDb.query<{ id: string; receipt_number: string | null }>(
      schemaName,
      `SELECT id, receipt_number FROM "${schemaName}".pos_sale WHERE offline_id = $1`,
      [masuk.offlineId],
    );
    if (sudah.length) {
      return {
        offlineId: masuk.offlineId,
        status: 'DUPLICATE',
        saleId: sudah[0].id,
        receiptNumber: sudah[0].receipt_number,
        reasonCode: null,
        reason: null,
        localTotal: masuk.grandTotal,
        serverTotal: null,
      };
    }

    // 2. Sudah pernah ditahan? Alasannya diulang apa adanya.
    const ditahan = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT id, reason_code, reason, local_total::text, server_total::text, status
         FROM "${schemaName}".pos_offline_quarantine WHERE offline_id = $1`,
      [masuk.offlineId],
    );
    if (ditahan.length) {
      const q = ditahan[0];
      return {
        offlineId: masuk.offlineId,
        status: 'QUARANTINED',
        saleId: null,
        receiptNumber: masuk.receiptNumber,
        reasonCode: q.reason_code,
        reason: q.reason,
        localTotal: q.local_total,
        serverTotal: q.server_total,
      };
    }

    // 3. Pemeriksaan murah lebih dahulu, sebelum apa pun dibuat.
    const blok = await this.jatahAktif(schemaName, masuk.terminalId);
    const shift = await this.tenantDb.query<{ status: string }>(
      schemaName,
      `SELECT status FROM "${schemaName}".pos_shift WHERE id = $1`,
      [masuk.shiftId],
    );
    const shiftStatus: KeadaanServer['shiftStatus'] = !shift.length
      ? 'MISSING'
      : shift[0].status === 'OPEN'
        ? 'OPEN'
        : 'CLOSED';

    const nonaktif = await this.produkNonaktif(
      schemaName,
      masuk.lines.map((l) => l.productId),
    );

    const keadaanAwal: KeadaanServer = {
      block: blok
        ? {
            blockId: blok.blockId,
            terminalId: blok.terminalId,
            fromNumber: blok.fromNumber,
            toNumber: blok.toNumber,
          }
        : null,
      shiftStatus,
      inactiveProductIds: nonaktif,
      shortProductIds: [],
      // Belum dihitung; pada tahap ini yang diperiksa hanyalah sebab-sebab yang
      // tidak menuntut perhitungan. Diisi total lokal supaya perbandingan harga
      // pada tahap ini tidak pernah memicu apa-apa.
      serverGrandTotal: masuk.grandTotal,
      now: Date.now(),
      maxAgeHours,
    };

    const awal = putuskan(masuk, keadaanAwal);
    if (awal.action === 'QUARANTINE') {
      return this.tahan(schemaName, masuk, awal.reasonCode!, awal.reason!, null, subjectId);
    }

    // 4. Diputar ulang lewat jalur penjualan yang sama.
    let saleId: string | null = null;
    try {
      const keranjang = await this.penjualan.buatKeranjang(
        schemaName,
        {
          outletId: masuk.outletId,
          terminalId: masuk.terminalId,
          shiftId: masuk.shiftId,
        },
        user,
        subjectId,
      );
      /*
       * Disalin ke konstanta supaya tipenya menyempit ke `string`.
       *
       * `saleId` sengaja tetap `string | null` dan berada di luar `try`: blok
       * `catch` memerlukannya untuk membatalkan keranjang yang sempat terbuat,
       * dan itulah satu-satunya cara memastikan pemesanan stok dilepaskan ketika
       * pemutaran ulang gagal di tengah jalan.
       */
      const id = String((keranjang as KeranjangServer).id);
      saleId = id;

      for (const b of masuk.lines) {
        await this.penjualan.tambahBaris(
          schemaName,
          id,
          {
            productId: b.productId,
            uomId: b.uomId ?? undefined,
            quantity: b.quantity,
            // Harga TIDAK dipaksakan. Peladen menghitungnya sendiri, dan itulah
            // gunanya seluruh langkah ini: mengetahui apakah ia sepakat.
          },
          user,
          subjectId,
        );
      }

      const kepala = (await this.penjualan.ambil(schemaName, id)) as KeranjangServer;
      const totalServer = String(kepala.grand_total ?? '0');

      const putusan = putuskan(masuk, { ...keadaanAwal, serverGrandTotal: totalServer });
      if (putusan.action === 'QUARANTINE') {
        // Keranjangnya dibatalkan supaya pemesanan stoknya dilepaskan. Jejaknya
        // tetap ada, dan itu yang menjawab "mengapa transaksi ini ditahan".
        await this.batalkanDiam(schemaName, id, user, subjectId);
        return this.tahan(
          schemaName,
          masuk,
          putusan.reasonCode!,
          putusan.reason!,
          totalServer,
          subjectId,
        );
      }

      for (const p of masuk.payments) {
        await this.penjualan.tambahPembayaran(
          schemaName,
          id,
          {
            paymentMethodId: p.paymentMethodId,
            amount: Number(p.amount),
            tenderedAmount: p.tenderedAmount ? Number(p.tenderedAmount) : undefined,
            reference: p.reference ?? undefined,
          },
          `${masuk.offlineId}:${p.paymentMethodId}:${p.amount}`,
          subjectId,
        );
      }

      const selesai = await this.penjualan.selesaikan(
        schemaName,
        id,
        masuk.offlineId,
        user,
        subjectId,
        masuk.receiptNumber,
      );

      await this.tandaiAsalLuring(schemaName, id, masuk, blok?.blockId ?? null);
      await this.majukanJatah(schemaName, blok?.blockId ?? null, masuk.receiptNumber);

      return {
        offlineId: masuk.offlineId,
        status: 'BOOKED',
        saleId: id,
        receiptNumber: selesai.receiptNumber,
        reasonCode: null,
        reason: null,
        localTotal: masuk.grandTotal,
        serverTotal: totalServer,
      };
    } catch (e) {
      /*
       * Apa pun yang gagal saat pemutaran ulang berakhir di karantina, bukan
       * sebagai galat yang dikembalikan ke mesin kasir.
       *
       * Mesin kasir yang menerima galat akan mencoba lagi, dan mencoba lagi
       * tidak akan menolong bila sebabnya stok kurang atau produk dinonaktifkan.
       * Yang terjadi hanyalah antrean yang tidak pernah kosong, dan kasir yang
       * melihat angka antrean naik terus tanpa penjelasan.
       */
      if (saleId) await this.batalkanDiam(schemaName, saleId, user, subjectId);
      const pesan = e instanceof Error ? e.message : String(e);
      const kode = /stok|stock/i.test(pesan) ? 'STOCK_SHORT' : 'REPLAY_FAILED';
      this.logger.warn(`Transaksi luring ${masuk.offlineId} ditahan: ${pesan}`);
      return this.tahan(schemaName, masuk, kode, pesan, null, subjectId);
    }
  }

  // --- Karantina -----------------------------------------------------------

  private async tahan(
    schemaName: string,
    masuk: TransaksiLuringMasuk,
    reasonCode: string,
    reason: string,
    serverTotal: string | null,
    subjectId: string,
  ): Promise<HasilPenerimaan> {
    await this.tenantDb.query(
      schemaName,
      `INSERT INTO "${schemaName}".pos_offline_quarantine
         (offline_id, outlet_id, terminal_id, shift_id, business_date, receipt_number,
          reason_code, reason, local_total, server_total, payload, local_hash, created_by)
       VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9::numeric,$10::numeric,$11::jsonb,$12,$13)
       ON CONFLICT (offline_id) DO NOTHING`,
      [
        masuk.offlineId,
        masuk.outletId,
        masuk.terminalId,
        masuk.shiftId,
        masuk.businessDate,
        masuk.receiptNumber,
        reasonCode,
        reason,
        masuk.grandTotal,
        serverTotal,
        JSON.stringify(masuk),
        masuk.localHash,
        subjectId,
      ],
    );

    return {
      offlineId: masuk.offlineId,
      status: 'QUARANTINED',
      saleId: null,
      receiptNumber: masuk.receiptNumber,
      reasonCode,
      reason,
      localTotal: masuk.grandTotal,
      serverTotal,
    };
  }

  /** Transaksi luring yang tertahan, terbaru lebih dahulu. */
  async karantina(
    schemaName: string,
    filter: { outletId?: string; status?: string; limit?: number } = {},
  ) {
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    return this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, offline_id, outlet_id, terminal_id, business_date::text, receipt_number,
              reason_code, reason, local_total::text, server_total::text, status,
              created_at::text, resolved_at::text, resolution_note
         FROM "${schemaName}".pos_offline_quarantine
        WHERE ($1::uuid IS NULL OR outlet_id = $1::uuid)
          AND ($2::varchar IS NULL OR status = $2::varchar)
        ORDER BY created_at DESC
        LIMIT $3`,
      [filter.outletId ?? null, filter.status ?? null, limit],
    );
  }

  /**
   * Catatan peladen untuk diadu dengan buku besar mesin kasir.
   *
   * Sengaja hanya mengembalikan yang berasal dari luring **dan** yang daring
   * pada rentang yang sama. Mesin kasir yang hanya menerima baris luring akan
   * melaporkan setiap penjualan daring sebagai "hanya ada di server", dan
   * laporan yang penuh selisih palsu tidak akan pernah dibaca.
   */
  async catatanUntukRekonsiliasi(
    schemaName: string,
    filter: { terminalId: string; businessDate: string },
  ) {
    return this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT offline_id, id AS sale_id, receipt_number, grand_total::text, status
         FROM "${schemaName}".pos_sale
        WHERE terminal_id = $1 AND business_date = $2::date AND deleted_at IS NULL
        ORDER BY receipt_number`,
      [filter.terminalId, filter.businessDate],
    );
  }

  // --- Pembantu ------------------------------------------------------------

  private async produkNonaktif(schemaName: string, productIds: string[]): Promise<string[]> {
    if (!productIds.length) return [];
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      /*
       * Yang diambil adalah `t.id`, bukan `p.id`.
       *
       * Barisnya justru yang TIDAK punya pasangan pada `product`, sehingga
       * `p.id` pada baris itu selalu NULL. Mengambil `p.id` menghasilkan daftar
       * berisi NULL — dan daftar itu lalu dipakai menyimpulkan bahwa seluruh
       * produk tidak aktif, sehingga setiap transaksi luring ditahan dengan
       * alasan yang keliru. Tertangkap oleh `scripts/prove-pos-offline.mjs`,
       * bukan oleh uji satuan: yang salah adalah SQL-nya, bukan aturannya.
       */
      `SELECT t.id::text AS id
         FROM unnest($1::uuid[]) AS t(id)
    LEFT JOIN "${schemaName}".product p
           ON p.id = t.id AND p.deleted_at IS NULL AND p.is_active = TRUE AND p.is_sellable = TRUE
        WHERE p.id IS NULL`,
      [productIds],
    );
    return rows.map((r) => r.id);
  }

  /** Membatalkan keranjang tanpa mengganggu pemanggil bila pembatalannya gagal. */
  private async batalkanDiam(
    schemaName: string,
    saleId: string,
    user: AuthenticatedUser,
    subjectId: string,
  ): Promise<void> {
    try {
      await this.penjualan.pindahStatus(
        schemaName,
        saleId,
        'CANCELLED',
        'Dibatalkan otomatis: transaksi luring ditahan sebelum diselesaikan',
        user,
        subjectId,
      );
    } catch (e) {
      // Kegagalan di sini tidak boleh menutupi sebab aslinya. Keranjang yang
      // tertinggal terbuka akan terlihat pada laporan dan dapat dibereskan;
      // sebab asli yang hilang tidak dapat dipulihkan.
      this.logger.warn(
        `Keranjang ${saleId} gagal dibatalkan sesudah transaksi luring ditahan: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  private async tandaiAsalLuring(
    schemaName: string,
    saleId: string,
    masuk: TransaksiLuringMasuk,
    blockId: string | null,
  ): Promise<void> {
    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".pos_sale
          SET offline_id = $2, sync_status = 'SYNCED', offline_received_at = now(),
              receipt_block_id = $3, offline_local_hash = $4,
              sale_at = $5::timestamptz, updated_at = now()
        WHERE id = $1`,
      [saleId, masuk.offlineId, blockId, masuk.localHash, masuk.occurredAt],
    );
  }

  /**
   * Memajukan penanda jatah supaya sisa jatah di peladen mengikuti kenyataan.
   *
   * Dipakai untuk pelaporan, bukan untuk menegakkan keunikan — yang menegakkan
   * keunikan tetap indeks pada `pos_sale.receipt_number`. Karena itu kegagalan
   * di sini tidak membatalkan transaksi yang sudah terbukukan.
   */
  private async majukanJatah(
    schemaName: string,
    blockId: string | null,
    receiptNumber: string,
  ): Promise<void> {
    if (!blockId) return;
    const angka = Number(/(\d+)\s*$/.exec(receiptNumber)?.[1] ?? NaN);
    if (!Number.isSafeInteger(angka)) return;
    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".pos_receipt_block
          SET next_number = GREATEST(next_number, $2 + 1),
              status = CASE WHEN GREATEST(next_number, $2 + 1) > to_number THEN 'EXHAUSTED' ELSE status END,
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [blockId, angka],
    );
  }
}
