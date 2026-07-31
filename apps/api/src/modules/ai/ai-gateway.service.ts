/**
 * AI Gateway.
 *
 * Satu-satunya pintu menuju model bahasa. Setiap pemanggilan melewati urutan
 * yang sama, dan tidak ada jalan memintasnya:
 *
 *   1. Keperluannya dikenal?           — kode karangan ditolak
 *   2. Penggunanya berhak?             — izin menu, bukan sekadar sudah masuk
 *   3. Kuotanya masih ada?             — per pengguna per jam
 *   4. Buktinya cukup?                 — untuk keperluan yang wajib berbukti
 *   5. Datanya disamarkan              — sebelum meninggalkan server
 *   6. Modelnya dipilih dari katalog   — bukan dari nama yang dikarang
 *   7. Keluarannya diperiksa skemanya
 *   8. Seluruhnya dicatat
 *
 * Yang TIDAK ada di sini: cara membuat AI melakukan sesuatu. Keluarannya
 * dikembalikan kepada pemanggilnya sebagai usulan, dan pemanggilnya adalah
 * manusia lewat antarmuka.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OllamaAdapter } from '../../infrastructure/ai/ollama.adapter';
import { ModelCatalogService } from '../../infrastructure/ai/model-catalog.service';
import { TenantPermissionService } from '../auth/tenant-permission.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { currentScope } from '../../common/context/request-context';
import type { AuthenticatedUser } from '../../common/decorators';
import { findUseCase, type AiUseCase } from './ai-use-case.registry';
import {
  buildPrompt,
  parseModelJson,
  validateAgainstSchema,
  type Evidence,
} from './prompt-builder';

export interface AskInput {
  useCaseCode: string;
  question: string;
  evidence?: Evidence[];
  /** Nama model yang diminta; wajib ada pada katalog. */
  preferModel?: string;
}

export interface AskResult {
  useCaseCode: string;
  outputKind: string;
  model: string;
  /** Keluaran terstruktur sesuai skema keperluannya. */
  output: unknown;
  /** Sumber bukti yang benar-benar dipakai — ditampilkan bersama jawabannya. */
  evidenceUsed: Array<{ source: string; reference?: string }>;
  evidenceDropped: number;
  redacted: Array<{ kind: string; count: number }>;
  durationMs: number;
  invocationId: string;
  /**
   * Peringatan yang wajib ditampilkan bersama jawabannya.
   *
   * Jawaban AI yang disajikan tanpa peringatan akan diperlakukan sebagai
   * kebenaran.
   */
  disclaimer: string;
}

const DISCLAIMER =
  'Jawaban ini dihasilkan AI dari bukti yang disertakan dan BELUM diperiksa manusia. ' +
  'Periksa angkanya terhadap sumber sebelum dipakai untuk mengambil keputusan.';

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ollama: OllamaAdapter,
    private readonly catalog: ModelCatalogService,
    private readonly permissions: TenantPermissionService,
  ) {}

  async ask(user: AuthenticatedUser, input: AskInput): Promise<AskResult> {
    const useCase = findUseCase(input.useCaseCode);
    if (!useCase) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Keperluan AI '${input.useCaseCode}' tidak dikenal.`,
      );
    }

    await this.assertPermitted(user, useCase);
    await this.assertQuota(user, useCase);

    const evidence = input.evidence ?? [];
    if (useCase.requiresEvidence && evidence.length === 0) {
      // Kesimpulan tentang angka tanpa angka yang dapat ditelusuri adalah
      // tebakan yang terdengar meyakinkan — lebih berbahaya daripada tidak ada
      // jawaban sama sekali.
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Keperluan ${useCase.name} wajib menyertakan bukti. Tanpa bukti, jawabannya hanya tebakan.`,
      );
    }

    const prompt = buildPrompt({
      useCaseName: useCase.name,
      instruction: useCase.description,
      question: input.question,
      evidence,
    });

    const model = await this.catalog
      .selectModel({ requireStructured: true, preferName: input.preferModel })
      .catch((error: Error) => {
        throw AppError.internal(ErrorCodes.INTERNAL_ERROR, error.message);
      });

    const mulai = Date.now();
    let status = 'SUCCESS';
    let errorMessage: string | null = null;
    let output: unknown = null;
    let schemaValid: boolean | null = null;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let outputRaw = '';

    try {
      const respons = await this.ollama.chat({
        model: model.name,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        schema: useCase.outputSchema,
      });

      outputRaw = respons.content;
      promptTokens = respons.promptTokens;
      completionTokens = respons.completionTokens;

      const terbaca = parseModelJson(respons.content);
      if (!terbaca.ok) {
        status = 'INVALID_OUTPUT';
        schemaValid = false;
        errorMessage = `Keluaran model bukan JSON yang sah: ${terbaca.error}`;
      } else {
        const periksa = validateAgainstSchema(terbaca.value, useCase.outputSchema);
        schemaValid = periksa.valid;
        if (!periksa.valid) {
          status = 'INVALID_OUTPUT';
          errorMessage = `Keluaran tidak sesuai skema: ${periksa.errors.join(' ')}`;
        } else {
          output = terbaca.value;
        }
      }
    } catch (error) {
      status = 'FAILED';
      errorMessage = (error as Error).message;
    }

    const durationMs = Date.now() - mulai;
    const invocation = await this.record({
      useCase,
      model,
      user,
      status,
      errorMessage,
      promptTokens,
      completionTokens,
      durationMs,
      fingerprint: prompt.fingerprint,
      evidenceCount: prompt.includedEvidence,
      schemaValid,
      promptText: useCase.storeContent ? `${prompt.system}\n\n${prompt.user}` : null,
      outputText: useCase.storeContent ? outputRaw : null,
    });

    if (status !== 'SUCCESS') {
      throw AppError.internal(
        ErrorCodes.INTERNAL_ERROR,
        errorMessage ?? 'Pemanggilan AI gagal.',
        { invocationId: invocation },
      );
    }

    return {
      useCaseCode: useCase.code,
      outputKind: useCase.outputKind,
      model: model.name,
      output,
      evidenceUsed: evidence
        .slice(0, prompt.includedEvidence)
        .map((e) => ({ source: e.source, reference: e.reference })),
      evidenceDropped: prompt.droppedEvidence,
      redacted: prompt.redacted,
      durationMs,
      invocationId: invocation,
      disclaimer: DISCLAIMER,
    };
  }

  /**
   * Izin diperiksa terhadap menu keperluannya.
   *
   * Bukan sekadar "sudah masuk". Seseorang yang tidak berhak membaca laporan
   * keuangan juga tidak boleh meminta AI meringkasnya — kalau tidak, AI menjadi
   * jalan memintas seluruh hak akses yang sudah dibangun.
   */
  private async assertPermitted(user: AuthenticatedUser, useCase: AiUseCase): Promise<void> {
    if (!user.schemaName) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Sesi ini tidak terhubung ke tenant mana pun.',
      );
    }
    const kurang = await this.permissions.findMissing(
      user.schemaName,
      user.userId,
      [`${useCase.menuCode}.${useCase.action}`],
      { isDemo: user.isDemo, activeRoleId: user.activeRoleId },
    );
    if (kurang.length) {
      throw AppError.forbidden(
        ErrorCodes.PERMISSION_DENIED,
        `Keperluan ${useCase.name} menuntut hak ${kurang.join(', ')}. ` +
          'AI tidak memberi akses yang tidak Anda miliki.',
        { missing: kurang },
      );
    }
  }

  /**
   * Kuota per pengguna per jam.
   *
   * Dihitung dari jejak pemanggilan, bukan dari penghitung tersendiri: jejaknya
   * memang sudah ditulis, dan penghitung terpisah akan menyimpang dari
   * kenyataan begitu ada pemanggilan yang gagal dicatat.
   */
  private async assertQuota(user: AuthenticatedUser, useCase: AiUseCase): Promise<void> {
    const sejam = new Date(Date.now() - 3600_000);
    const terpakai = await this.prisma.aiInvocation.count({
      where: {
        actorUserId: user.userId,
        useCaseCode: useCase.code,
        occurredAt: { gte: sejam },
        // Yang gagal tidak dihitung: pengguna tidak boleh kehabisan kuota
        // karena penyedianya bermasalah.
        status: 'SUCCESS',
      },
    });

    if (terpakai >= useCase.hourlyQuotaPerUser) {
      throw AppError.tooManyRequests(
        ErrorCodes.AI_QUOTA_EXCEEDED,
        `Kuota ${useCase.name} sudah terpakai ${terpakai} dari ${useCase.hourlyQuotaPerUser} ` +
          'kali dalam satu jam terakhir. Coba lagi nanti.',
      );
    }
  }

  private async record(input: {
    useCase: AiUseCase;
    model: { id: string; name: string };
    user: AuthenticatedUser;
    status: string;
    errorMessage: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    durationMs: number;
    fingerprint: string;
    evidenceCount: number;
    schemaValid: boolean | null;
    promptText: string | null;
    outputText: string | null;
  }): Promise<string> {
    const scope = currentScope();
    const baris = await this.prisma.aiInvocation.create({
      data: {
        useCaseCode: input.useCase.code,
        modelId: input.model.id,
        modelName: input.model.name,
        tenantId: input.user.tenantId ?? null,
        tenantSchema: input.user.schemaName ?? null,
        actorUserId: input.user.userId,
        actorUsername: input.user.username,
        activeRoleCode: input.user.activeRoleCode ?? null,
        sessionId: input.user.sessionId,
        requestId: scope?.requestId ?? null,
        status: input.status,
        errorMessage: input.errorMessage?.slice(0, 2000) ?? null,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        durationMs: input.durationMs,
        inputFingerprint: input.fingerprint,
        evidenceCount: input.evidenceCount,
        schemaValid: input.schemaValid,
        promptRedacted: input.promptText?.slice(0, 20_000) ?? null,
        outputRedacted: input.outputText?.slice(0, 20_000) ?? null,
      },
      select: { id: true },
    });
    return baris.id;
  }

  /** Menilai keluaran. */
  async giveFeedback(
    user: AuthenticatedUser,
    invocationId: string,
    verdict: 'ACCEPTED' | 'EDITED' | 'REJECTED',
    reason?: string,
  ) {
    if (verdict === 'REJECTED' && (reason ?? '').trim().length < 5) {
      // Penolakan tanpa alasan tidak dapat diperbaiki — dan mutu AI hanya dapat
      // diperbaiki dari alasan penolakannya.
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Penolakan wajib menyebutkan alasannya.',
      );
    }

    const invocation = await this.prisma.aiInvocation.findUnique({
      where: { id: invocationId },
      select: { id: true, actorUserId: true },
    });
    if (!invocation || invocation.actorUserId !== user.userId) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pemanggilan AI tidak ditemukan.');
    }

    await this.prisma.aiFeedback.create({
      data: { invocationId, verdict, reason: reason ?? null, actorUserId: user.userId },
    });
    return { recorded: true };
  }

  /**
   * Metrik pemakaian.
   *
   * Yang paling berguna bukan jumlah pemanggilan melainkan **berapa yang
   * diterima**: keperluan yang jawabannya selalu ditolak sebaiknya dimatikan,
   * bukan dibiarkan memakan waktu penggunanya.
   */
  async usage(hours: number) {
    const sejak = new Date(Date.now() - hours * 3600_000);

    const [perKeperluan, penilaian] = await Promise.all([
      this.prisma.aiInvocation.groupBy({
        by: ['useCaseCode', 'status'],
        where: { occurredAt: { gte: sejak } },
        _count: { _all: true },
        _avg: { durationMs: true },
        _sum: { promptTokens: true, completionTokens: true },
      }),
      this.prisma.aiFeedback.groupBy({
        by: ['verdict'],
        where: { createdAt: { gte: sejak } },
        _count: { _all: true },
      }),
    ]);

    return {
      sinceHours: hours,
      byUseCase: perKeperluan.map((r) => ({
        useCaseCode: r.useCaseCode,
        status: r.status,
        count: r._count._all,
        avgDurationMs: Math.round(r._avg.durationMs ?? 0),
        promptTokens: r._sum.promptTokens ?? 0,
        completionTokens: r._sum.completionTokens ?? 0,
      })),
      feedback: Object.fromEntries(penilaian.map((r) => [r.verdict, r._count._all])),
    };
  }
}
