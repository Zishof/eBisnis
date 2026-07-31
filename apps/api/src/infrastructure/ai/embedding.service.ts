/**
 * Pembuatan embedding.
 *
 * ## Keadaan sekarang
 *
 * Penyedia yang berjalan **tidak memiliki satu pun model berkemampuan
 * embedding**. Diperiksa lewat `/api/show`, dan Ollama sendiri melaporkan
 * `capabilities: ["completion","tools"]` untuk ketiga modelnya.
 *
 * Pesan galat `/api/embed` — "This server does not support embeddings. Start it
 * with `--embeddings`" — berasal dari llama.cpp di balik Ollama dan
 * **menyesatkan**: ia menyiratkan bendera server, padahal yang kurang adalah
 * modelnya. Menambahkan bendera itu tidak akan mengubah apa pun.
 *
 * Yang perlu dilakukan operator: mengunduh model embedding, mis.
 *
 *     ollama pull bge-m3            # multibahasa, baik untuk bahasa Indonesia
 *     ollama pull nomic-embed-text  # lebih kecil, terutama bahasa Inggris
 *
 * Layanan ini **tidak menebak**. Ia menanyakan katalog, dan bila tidak ada
 * model berkemampuan embedding ia mengatakannya apa adanya — sehingga
 * pencariannya jatuh ke leksikal dengan keterangan yang jelas, bukan gagal
 * diam-diam.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OllamaAdapter } from './ollama.adapter';

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
}

export interface EmbeddingAvailability {
  available: boolean;
  model: string | null;
  reason: string;
  /** Saran yang dapat dijalankan operator. */
  remedy: string | null;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ollama: OllamaAdapter,
  ) {}

  /**
   * Apakah pembuatan embedding memungkinkan sekarang.
   *
   * Diperiksa dari katalog, dan katalog diisi dari pengujian nyata — bukan dari
   * tebakan atas nama model.
   */
  async availability(): Promise<EmbeddingAvailability> {
    const model = await this.prisma.aiModel.findFirst({
      where: {
        provider: 'ollama',
        isEnabled: true,
        missingSince: null,
        supportsEmbedding: true,
      },
      orderBy: { sizeBytes: 'desc' },
    });

    if (model) {
      return {
        available: true,
        model: model.name,
        reason: `Model ${model.name} terbukti mampu menghasilkan embedding.`,
        remedy: null,
      };
    }

    const adaModel = await this.prisma.aiModel.count({ where: { missingSince: null } });
    if (adaModel === 0) {
      return {
        available: false,
        model: null,
        reason: 'Katalog model masih kosong.',
        remedy: 'Jalankan POST /platform/ai/models/sync lalu POST /platform/ai/models/probe.',
      };
    }

    const belumDiuji = await this.prisma.aiModel.count({
      where: { missingSince: null, lastProbedAt: null },
    });
    if (belumDiuji > 0) {
      return {
        available: false,
        model: null,
        reason: `${belumDiuji} model belum diuji kemampuannya.`,
        remedy: 'Jalankan POST /platform/ai/models/probe.',
      };
    }

    return {
      available: false,
      model: null,
      reason:
        'Tidak ada satu pun model berkemampuan embedding pada penyedia. Ollama melaporkan ' +
        'kemampuan model sebagai "completion" dan "tools" saja.',
      // Disebutkan tepat, karena diagnosis yang salah membuat operator
      // mengerjakan hal yang sia-sia. Pesan `--embeddings` dari llama.cpp
      // menyesatkan: yang kurang adalah modelnya, bukan bendera servernya.
      remedy:
        'Unduh model embedding pada server penyedia: `ollama pull bge-m3` (multibahasa, ' +
        'baik untuk bahasa Indonesia) atau `ollama pull nomic-embed-text` (lebih kecil). ' +
        'Menambahkan bendera --embeddings TIDAK menyelesaikan ini — pesan galat dari ' +
        'llama.cpp itu menyesatkan.',
    };
  }

  /**
   * Membuat embedding untuk sebuah teks.
   *
   * Melempar bila tidak tersedia, dengan keterangan yang dapat ditindaklanjuti.
   * Pemanggil yang dapat bekerja tanpanya sebaiknya memeriksa `availability()`
   * lebih dulu alih-alih menangkap galat.
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const keadaan = await this.availability();
    if (!keadaan.available || !keadaan.model) {
      throw new Error(`${keadaan.reason} ${keadaan.remedy ?? ''}`.trim());
    }
    return this.embedWith(keadaan.model, text);
  }

  /** Membuat embedding dengan model tertentu. */
  async embedWith(model: string, text: string): Promise<EmbeddingResult> {
    const vektor = await this.ollama.embed(model, text);
    return { vector: vektor, model, dimensions: vektor.length };
  }

  /**
   * Membuat embedding untuk beberapa teks sekaligus.
   *
   * Dikerjakan berurutan, bukan bersamaan. Penyedia ini melayani seluruh tenant
   * dari satu mesin; mengirim lima puluh permintaan sekaligus akan membuat
   * pemakai lain menunggu, dan penghematan waktunya tidak sepadan.
   */
  async embedMany(
    model: string,
    texts: string[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<Array<EmbeddingResult | null>> {
    const hasil: Array<EmbeddingResult | null> = [];
    for (let i = 0; i < texts.length; i += 1) {
      try {
        hasil.push(await this.embedWith(model, texts[i]));
      } catch (error) {
        // Satu potongan yang gagal tidak menghentikan sisanya. Indeks yang
        // sebagian terisi tetap berguna; indeks yang batal seluruhnya tidak.
        this.logger.warn(`Embedding potongan ke-${i} gagal: ${(error as Error).message}`);
        hasil.push(null);
      }
      onProgress?.(i + 1, texts.length);
    }
    return hasil;
  }
}
