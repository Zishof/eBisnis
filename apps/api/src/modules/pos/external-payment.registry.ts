/**
 * Registri penangan pembayaran bersaldo eksternal (IR-002).
 *
 * ## Persoalan yang diselesaikan
 *
 * Koperasi hendak menerima pembayaran di unit tokonya memakai saldo simpanan
 * anggota. Tanpa kontrak ini, satu-satunya cara adalah menyunting mesin
 * pembayaran POS — berkas bersama yang panduan koordinasi §3 larang disentuh
 * sesi vertikal, dan yang sedang dikerjakan sesi lain.
 *
 * Kebutuhannya pun tidak khas koperasi: eMedik akan memerlukannya untuk
 * pembayaran klaim, dan program loyalitas berpoin memerlukan bentuk yang sama.
 *
 * ## Yang membuatnya aman
 *
 * Tiga hal, dan ketiganya bukan pilihan:
 *
 * 1. **POS tidak pernah menerima, menyimpan, maupun meneruskan PIN.** Yang
 *    diterimanya adalah bukti sekali pakai (`authToken`) dari layar milik
 *    penyedia penangan. Spesifikasi eKoperasi §14 menyebutnya tegas: PIN
 *    anggota tidak boleh terlihat kasir — dan sesuatu yang melewati kasir
 *    adalah sesuatu yang terlihat kasir.
 *
 * 2. **`capture()` wajib berada di dalam transaksi penyelesaian penjualan.**
 *    Pemotongan saldo yang berhasil tanpa penjualan yang menaunginya adalah
 *    uang anggota yang hilang tanpa jejak. Registri tidak dapat memaksanya,
 *    tetapi kontraknya menyatakannya dan pengujian POS memeriksanya.
 *
 * 3. **`authorize()` menahan, tidak memotong.** Pemotongan hanya terjadi pada
 *    `capture()`. Kasir yang menutup layar di tengah pembayaran tidak boleh
 *    meninggalkan saldo anggota yang berkurang tanpa transaksi.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface ExternalPaymentContext {
  schemaName: string;
  saleId: string;
  outletId: string;
  customerId: string | null;
  /** Nilai dalam satuan terkecil, sebagai teks — sama dengan kolom uang POS. */
  amount: string;
  /**
   * Bukti sekali pakai dari layar milik penyedia penangan.
   *
   * POS meneruskannya apa adanya dan tidak pernah menyimpannya. Bukan PIN,
   * dan tidak dapat dipakai ulang.
   */
  authToken?: string;
  /** Kunci idempotensi milik permintaan pembayaran POS. */
  idempotencyKey: string;
}

export interface ExternalPaymentAuthorization {
  authorized: boolean;
  /** Rujukan penahanan; dipakai `capture()` dan `reverse()`. */
  reference: string;
  /**
   * Pesan bagi kasir bila ditolak.
   *
   * Tidak boleh memuat data pribadi maupun angka saldo. Kasir cukup tahu
   * bahwa pembayaran tidak dapat diteruskan; berapa saldo anggota bukan
   * urusannya, dan layar kasir sering terlihat pelanggan berikutnya.
   */
  message?: string;
}

export interface ExternalPaymentHandler {
  /** Nilai `payment_method.external_handler` yang ditanganinya. */
  readonly handlerCode: string;
  authorize(ctx: ExternalPaymentContext): Promise<ExternalPaymentAuthorization>;
  capture(ctx: { schemaName: string; reference: string }): Promise<void>;
  reverse(ctx: { schemaName: string; reference: string; reason: string }): Promise<void>;
}

export class ExternalPaymentError extends Error {}

@Injectable()
export class ExternalPaymentRegistry {
  private readonly logger = new Logger(ExternalPaymentRegistry.name);
  private readonly handlers = new Map<string, ExternalPaymentHandler>();

  register(handler: ExternalPaymentHandler): void {
    if (!/^[A-Z][A-Z0-9_]{3,63}$/.test(handler.handlerCode)) {
      throw new ExternalPaymentError(
        `Kode penangan "${handler.handlerCode}" tidak sah. Pakai huruf besar, angka, dan garis ` +
          'bawah — kode ini disimpan pada payment_method dan dicocokkan apa adanya.',
      );
    }
    if (this.handlers.has(handler.handlerCode)) {
      /*
       * Pendaftaran ganda hampir selalu berarti dua modul mengaku menangani
       * pembayaran yang sama. Menimpanya diam-diam berarti uang anggota
       * diproses modul yang bukan pemiliknya.
       */
      throw new ExternalPaymentError(
        `Penangan pembayaran "${handler.handlerCode}" sudah terdaftar. Dua modul tidak boleh ` +
          'menangani metode pembayaran yang sama.',
      );
    }
    this.handlers.set(handler.handlerCode, handler);
    this.logger.log(`Penangan pembayaran eksternal terdaftar: ${handler.handlerCode}`);
  }

  has(handlerCode: string): boolean {
    return this.handlers.has(handlerCode);
  }

  /**
   * Menemukan penangan, atau melempar.
   *
   * Melempar, bukan mengembalikan `undefined`. Metode pembayaran yang
   * menyebutkan penangan yang tidak terdaftar berarti penyewa dapat memilihnya
   * di layar kasir dan pembayarannya diam-diam tidak diproses siapa pun —
   * penjualan tercatat lunas tanpa ada dana yang berpindah.
   */
  require(handlerCode: string): ExternalPaymentHandler {
    const handler = this.handlers.get(handlerCode);
    if (!handler) {
      throw new ExternalPaymentError(
        `Metode pembayaran menyebut penangan "${handlerCode}", tetapi tidak ada modul yang ` +
          'mendaftarkannya. Pembayaran ditolak — penjualan yang tercatat lunas tanpa dana ' +
          'yang berpindah jauh lebih sulit diperbaiki daripada pembayaran yang gagal.',
      );
    }
    return handler;
  }

  registeredCodes(): string[] {
    return [...this.handlers.keys()].sort();
  }

  /** Hanya untuk pengujian. */
  reset(): void {
    this.handlers.clear();
  }
}
