/**
 * `BroadcastPort` — pengiriman siaran ke warga.
 *
 * Kredensial penyedia WhatsApp maupun surel **belum ada**, dan adapter di sini
 * menyatakannya dengan jujur: siaran disimpan berstatus `TERHALANG` beserta
 * alasannya, bukan `GAGAL` dan bukan `TERKIRIM`.
 *
 * Perbedaan ketiganya bukan istilah:
 *
 * | Status | Yang dilakukan orang sesudahnya |
 * |---|---|
 * | `GAGAL` | Mencoba lagi — berkali-kali, dan tidak akan pernah berhasil |
 * | `TERKIRIM` | Memberi tahu warga bahwa pesannya sudah dikirim |
 * | `TERHALANG` | Mengurus kredensialnya |
 *
 * Yang kedua paling merugikan: ia membuat pemerintah desa menyatakan sesuatu
 * yang tidak diketahuinya kepada warganya, dan kekeliruannya baru ketahuan
 * ketika warga bertanya mengapa ia tidak menerima apa-apa.
 */

import { Injectable } from '@nestjs/common';
import type { KanalSiaran } from '../village-site';

export interface HasilSiaran {
  /** Salah bila kanalnya belum siap. */
  terkirim: boolean;
  /** Rujukan dari penyedia. Tanpa ini, siaran tidak boleh ditandai terkirim. */
  providerReference?: string | null;
  /** Terisi bila kanalnya terhalang. */
  blockedReason?: string | null;
  failureReason?: string | null;
  recipientCount: number;
}

export interface KirimSiaranInput {
  channel: KanalSiaran;
  title: string;
  message: string;
  recipients: string[];
}

export interface BroadcastPort {
  /** Apakah kanal ini sudah punya kredensial? */
  siap(channel: KanalSiaran): Promise<boolean>;

  /** Mengirim. Mengembalikan hasil yang jujur, tanpa mengarang rujukan. */
  kirim(input: KirimSiaranInput): Promise<HasilSiaran>;
}

export const BROADCAST_PORT = Symbol('VillageBroadcastPort');

/** Metode yang boleh ada. Dijaga pengujian, sama seperti port D-8. */
export const METODE_SAH_BROADCAST = ['siap', 'kirim'] as const;

/**
 * Adapter yang menghalangi seluruh kanal berpenyedia.
 *
 * `PAPAN_INFORMASI` tetap berhasil: ia hanya menayangkan pada situs desa dan
 * tidak memerlukan penyedia mana pun. Rujukannya menyebut sumbernya sendiri,
 * bukan rujukan karangan yang menyerupai penyedia luar.
 */
@Injectable()
export class BroadcastBlockedAdapter implements BroadcastPort {
  async siap(channel: KanalSiaran): Promise<boolean> {
    return channel === 'PAPAN_INFORMASI';
  }

  async kirim(input: KirimSiaranInput): Promise<HasilSiaran> {
    if (input.channel === 'PAPAN_INFORMASI') {
      return {
        terkirim: true,
        providerReference: `PAPAN:${new Date().toISOString()}`,
        recipientCount: input.recipients.length,
      };
    }

    return {
      terkirim: false,
      providerReference: null,
      blockedReason:
        `Kanal ${input.channel} belum memiliki kredensial penyedia. Siaran tersimpan dan dapat ` +
        'dikirim setelah kredensialnya dipasang. Tidak ada pesan yang benar-benar terkirim — ' +
        'jangan memberi tahu warga bahwa pesannya sudah sampai.',
      recipientCount: 0,
    };
  }
}
