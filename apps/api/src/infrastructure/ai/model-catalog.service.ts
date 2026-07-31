/**
 * Katalog model AI.
 *
 * Menyelaraskan apa yang tercatat dengan apa yang benar-benar ada pada
 * penyedia, lalu menguji kemampuan setiap model dengan mencobanya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { OllamaAdapter } from './ollama.adapter';

@Injectable()
export class ModelCatalogService {
  private readonly logger = new Logger(ModelCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ollama: OllamaAdapter,
  ) {}

  /**
   * Menyelaraskan katalog dengan penyedia.
   *
   * Model yang hilang dari penyedia **tidak dihapus**, melainkan ditandai
   * `missingSince`. Menghapusnya akan memutus riwayat pemakaian yang
   * menunjuknya, dan pertanyaan "jawaban ini dihasilkan model apa" menjadi
   * tidak terjawab untuk seluruh keluaran lama.
   */
  async sync(): Promise<{
    discovered: number;
    added: number;
    returned: number;
    missing: number;
  }> {
    const ditemukan = await this.ollama.discoverModels();
    const namaDitemukan = new Set(ditemukan.map((m) => m.name));

    let added = 0;
    let returned = 0;

    for (const m of ditemukan) {
      const sebelumnya = await this.prisma.aiModel.findUnique({
        where: { provider_name: { provider: 'ollama', name: m.name } },
        select: { id: true, missingSince: true },
      });

      await this.prisma.aiModel.upsert({
        where: { provider_name: { provider: 'ollama', name: m.name } },
        create: {
          provider: 'ollama',
          name: m.name,
          family: m.family,
          parameterSize: m.parameterSize,
          quantization: m.quantization,
          sizeBytes: m.sizeBytes ? BigInt(m.sizeBytes) : null,
          contextLength: m.contextLength,
        },
        update: {
          family: m.family,
          parameterSize: m.parameterSize,
          quantization: m.quantization,
          sizeBytes: m.sizeBytes ? BigInt(m.sizeBytes) : null,
          contextLength: m.contextLength,
          lastSeenAt: new Date(),
          // Kembali muncul: penanda hilang dicabut.
          missingSince: null,
        },
      });

      if (!sebelumnya) added += 1;
      else if (sebelumnya.missingSince) returned += 1;
    }

    // Yang tercatat tetapi tidak lagi ditemukan.
    const tercatat = await this.prisma.aiModel.findMany({
      where: { provider: 'ollama', missingSince: null },
      select: { id: true, name: true },
    });
    const hilang = tercatat.filter((t) => !namaDitemukan.has(t.name));
    for (const h of hilang) {
      await this.prisma.aiModel.update({
        where: { id: h.id },
        data: { missingSince: new Date(), isEnabled: false },
      });
      this.logger.warn(`Model ${h.name} tidak lagi ada pada penyedia; dinonaktifkan.`);
    }

    return { discovered: ditemukan.length, added, returned, missing: hilang.length };
  }

  /**
   * Menguji kemampuan seluruh model yang ada.
   *
   * Mahal — setiap uji adalah satu pemanggilan nyata. Karena itu dijalankan
   * atas permintaan dan berkala, bukan pada setiap penyelarasan.
   */
  async probeAll(): Promise<Array<{ name: string; chat: boolean; embedding: boolean; structured: boolean }>> {
    const models = await this.prisma.aiModel.findMany({
      where: { provider: 'ollama', missingSince: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const hasil = [];
    for (const m of models) {
      const kemampuan = await this.ollama.probeCapabilities(m.name);
      await this.prisma.aiModel.update({
        where: { id: m.id },
        data: {
          supportsChat: kemampuan.chat,
          supportsEmbedding: kemampuan.embedding,
          supportsStructured: kemampuan.structured,
          lastProbedAt: new Date(),
          note: kemampuan.notes.length ? kemampuan.notes.join(' | ').slice(0, 2000) : null,
        },
      });
      hasil.push({ name: m.name, ...kemampuan });
    }
    return hasil;
  }

  /** Model yang boleh dipakai untuk percakapan. */
  async usableForChat() {
    return this.prisma.aiModel.findMany({
      where: {
        provider: 'ollama',
        isEnabled: true,
        missingSince: null,
        supportsChat: true,
      },
      orderBy: [{ parameterSize: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Memilih model untuk sebuah keperluan.
   *
   * ## Tidak ada nama model sebagai cadangan
   *
   * Bila tidak ada model yang cocok, fungsi ini **melempar** dengan keterangan
   * apa yang kurang — bukan mengembalikan nama tebakan. Nama tebakan akan
   * gagal pada penyedianya, dan galatnya muncul jauh dari sebabnya.
   */
  async selectModel(options: { requireStructured?: boolean; preferName?: string } = {}) {
    if (options.preferName) {
      const pilihan = await this.prisma.aiModel.findFirst({
        where: {
          provider: 'ollama',
          name: options.preferName,
          isEnabled: true,
          missingSince: null,
        },
      });
      if (!pilihan) {
        throw new Error(
          `Model '${options.preferName}' tidak tersedia, tidak aktif, atau sudah hilang dari penyedia.`,
        );
      }
      if (options.requireStructured && !pilihan.supportsStructured) {
        throw new Error(
          `Model '${options.preferName}' belum terbukti mampu menghasilkan keluaran terstruktur. ` +
            'Jalankan pengujian kemampuan lebih dulu.',
        );
      }
      return pilihan;
    }

    const kandidat = await this.prisma.aiModel.findMany({
      where: {
        provider: 'ollama',
        isEnabled: true,
        missingSince: null,
        supportsChat: true,
        ...(options.requireStructured ? { supportsStructured: true } : {}),
      },
      // Yang paling besar dipilih lebih dulu: pada jajaran model yang tersedia
      // di sini, selisih mutunya jauh lebih terasa daripada selisih waktunya.
      orderBy: [{ sizeBytes: 'desc' }],
      take: 1,
    });

    if (!kandidat.length) {
      const total = await this.prisma.aiModel.count({ where: { missingSince: null } });
      throw new Error(
        total === 0
          ? 'Katalog model masih kosong. Jalankan penyelarasan katalog lebih dulu.'
          : 'Tidak ada model yang memenuhi syarat. Periksa hasil pengujian kemampuan — ' +
            'kemungkinan belum ada model yang terbukti mendukung keluaran terstruktur.',
      );
    }
    return kandidat[0];
  }

  /** Mencatat keadaan kesehatan penyedia. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async recordHealth(): Promise<void> {
    const kesehatan = await this.ollama.health();
    await this.prisma.aiProviderHealth
      .create({
        data: {
          provider: 'ollama',
          status: kesehatan.status,
          latencyMs: kesehatan.latencyMs,
          version: kesehatan.version,
          modelCount: kesehatan.modelCount,
          note: kesehatan.note,
        },
      })
      .catch((error: Error) => {
        this.logger.warn(`Kesehatan AI gagal dicatat: ${error.message}`);
      });
  }

  /** Keadaan terkini beserta riwayat singkat. */
  async healthSummary(hours = 24) {
    const sejak = new Date(Date.now() - hours * 3600_000);
    const [terkini, riwayat] = await Promise.all([
      this.ollama.health(),
      this.prisma.aiProviderHealth.groupBy({
        by: ['status'],
        where: { checkedAt: { gte: sejak } },
        _count: { _all: true },
      }),
    ]);

    return {
      current: terkini,
      circuit: this.ollama.circuitState(),
      last24h: Object.fromEntries(riwayat.map((r) => [r.status, r._count._all])),
    };
  }
}
