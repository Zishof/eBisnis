/**
 * Copilot sadar-rute.
 *
 * Perbedaannya dari `AiGatewayService.ask`: copilot **mencari sendiri** bukti
 * tambahan dari basis pengetahuan, dibatasi izin penggunanya.
 *
 * ## Rute menentukan konteks, bukan izin
 *
 * Rute yang sedang dibuka dipakai memilih kata kunci pencarian dan menyusun
 * pertanyaan. Ia **tidak** dipakai menentukan apa yang boleh dibaca — itu tetap
 * ditentukan izin. Rute datang dari peramban dan dapat ditulis apa saja;
 * memakainya sebagai penentu akses berarti siapa pun dapat membaca apa pun
 * dengan mengarang rute.
 */

import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators';
import { AiGatewayService, type AskResult } from './ai-gateway.service';
import { KnowledgeService } from './knowledge.service';
import type { Evidence } from './prompt-builder';

export interface CopilotInput {
  useCaseCode: string;
  question: string;
  routePath?: string;
  evidence?: Evidence[];
}

export interface CopilotResult extends AskResult {
  /** Bukti yang ditemukan sendiri oleh copilot, di luar yang dikirim pemanggil. */
  retrievedEvidence: Array<{ source: string; reference?: string; score: number }>;
  retriever: string;
  retrieverNote: string;
}

const CATATAN_PENCARI =
  'Pencarian bukti bersifat LEKSIKAL (kata kunci), bukan semantik. Pertanyaan yang ' +
  'memakai kata berbeda dari dokumennya mungkin tidak menemukan bukti yang sebenarnya ada.';

@Injectable()
export class CopilotService {
  constructor(
    private readonly gateway: AiGatewayService,
    private readonly knowledge: KnowledgeService,
  ) {}

  async ask(user: AuthenticatedUser, input: CopilotInput): Promise<CopilotResult> {
    const disertakan = input.evidence ?? [];

    // Bukti tambahan dicari dari basis pengetahuan. Kegagalan pencarian tidak
    // menggagalkan pertanyaannya: bukti yang dikirim pemanggil sudah cukup
    // untuk sebagian besar keperluan, dan menolak menjawab karena pencarian
    // tambahan gagal akan membuat copilot tampak rusak padahal tidak.
    const temuan = await this.knowledge
      .findEvidence(user, input.question, 5)
      .catch(() => ({ evidence: [] as Evidence[], chunks: [], retriever: 'LEXICAL' }));

    const hasil = await this.gateway.ask(user, {
      useCaseCode: input.useCaseCode,
      question: this.contextualize(input),
      // Bukti pemanggil didahulukan: ia yang paling dekat dengan apa yang
      // sedang dilihat pengguna, dan bila anggarannya habis, yang terbuang
      // sebaiknya hasil pencarian.
      evidence: [...disertakan, ...temuan.evidence],
    });

    return {
      ...hasil,
      retrievedEvidence: temuan.chunks.map((c) => ({
        source: `${c.sourceType}: ${c.title}`,
        reference: c.sourceRef ?? undefined,
        score: Math.round(c.score * 1000) / 1000,
      })),
      retriever: temuan.retriever,
      retrieverNote: CATATAN_PENCARI,
    };
  }

  /**
   * Menyusun pertanyaan beserta konteks rutenya.
   *
   * Rute disebutkan sebagai keterangan, bukan sebagai perintah. Model yang
   * diberi tahu "pengguna sedang membuka halaman Surat Keluar" menjawab lebih
   * tepat tanpa perlu diberi kuasa apa pun atas halaman itu.
   */
  private contextualize(input: CopilotInput): string {
    if (!input.routePath) return input.question;
    const bersih = input.routePath.split('?')[0].slice(0, 200);
    return `[Pengguna sedang membuka halaman: ${bersih}]\n${input.question}`;
  }
}
